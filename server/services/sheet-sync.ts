import { CacheService } from "./cache";
import {
  parseSpreadsheetReference,
  readSheetRows,
  writeSheetRows,
} from "./google-sheets";
import { ensureProductRecord, extractAsinFromInput, isValidAsin } from "./product-ingestion";
import {
  mapRows,
  parseSheetSyncRow,
  normalizeTrackingTag,
  type SheetRowRecord,
} from "./sheet-rows";

interface SheetSyncConfig {
  id: number;
  sheet_url: string | null;
  sheet_tab_name: string | null;
  default_marketplace: string;
  is_active: number;
  last_imported_at: string | null;
  last_exported_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SheetSyncLog {
  id: number;
  direction: "import" | "export";
  status: "success" | "failed";
  total_rows: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  details: string;
  error_message: string | null;
  triggered_by_username: string | null;
  created_at: string;
  finished_at: string | null;
}

interface GoogleCredentials {
  clientEmail: string;
  privateKey: string;
}

interface SyncProductsFromSheetInput {
  db: D1Database;
  kv: KVNamespace;
  apiKey?: string;
  fallbackApiKeys?: string[];
  config: SheetSyncConfig;
  credentials: GoogleCredentials;
  triggeredByUserId?: number;
}

interface MirrorProductsToSheetInput {
  db: D1Database;
  config: SheetSyncConfig;
  credentials: GoogleCredentials;
  publicAppUrl?: string;
  triggeredByUserId?: number;
}

interface SyncSummary {
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
}

interface ParsedSheetSyncRow {
  asin: string;
  marketplace: string;
  title: string | null;
  category: string | null;
  customTitle: string | null;
  agentSlug: string | null;
  trackingTag: string | null;
  rowStatus: "active" | "inactive";
  productStatus: string;
}

interface ProductLookupRow {
  id: number;
  is_active: number;
}

interface AgentLookupRow {
  id: number;
  slug: string;
}

interface TrackingLookupRow {
  id: number;
}

const SHEET_HEADERS = [
  "asin",
  "marketplace",
  "agent_slug",
  "tracking_tag",
  "custom_title",
  "status",
  "product_status",
  "bridge_page_url",
  "storefront_url",
  "redirect_url",
  "title",
  "category",
  "is_active",
  "created_at",
  "updated_at",
];

export async function getSheetSyncConfig(db: D1Database): Promise<SheetSyncConfig> {
  const config = await db
    .prepare(
      `SELECT
         id,
         sheet_url,
         sheet_tab_name,
         default_marketplace,
         is_active,
         last_imported_at,
         last_exported_at,
         created_at,
         updated_at
       FROM sheet_sync_configs
       WHERE id = 1`
    )
    .first<SheetSyncConfig>();

  if (config) {
    return config;
  }

  await db
    .prepare(
      `INSERT OR IGNORE INTO sheet_sync_configs (id, sheet_url, sheet_tab_name, default_marketplace, is_active)
       VALUES (1, NULL, NULL, 'US', 0)`
    )
    .run();

  return getSheetSyncConfig(db);
}

export async function updateSheetSyncConfig(
  db: D1Database,
  input: {
    sheetUrl: string | null;
    sheetTabName: string | null;
    defaultMarketplace: string;
    isActive: boolean;
  }
): Promise<SheetSyncConfig> {
  await db
    .prepare(
      `UPDATE sheet_sync_configs
       SET sheet_url = ?,
           sheet_tab_name = ?,
           default_marketplace = ?,
           is_active = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`
    )
    .bind(
      input.sheetUrl,
      input.sheetTabName,
      input.defaultMarketplace,
      input.isActive ? 1 : 0
    )
    .run();

  return getSheetSyncConfig(db);
}

export async function getSheetSyncLogs(db: D1Database): Promise<SheetSyncLog[]> {
  const { results } = await db
    .prepare(
      `SELECT
         ssl.id,
         ssl.direction,
         ssl.status,
         ssl.total_rows,
         ssl.created_count,
         ssl.updated_count,
         ssl.skipped_count,
         ssl.details,
         ssl.error_message,
         u.username as triggered_by_username,
         ssl.created_at,
         ssl.finished_at
       FROM sheet_sync_logs ssl
       LEFT JOIN users u ON u.id = ssl.triggered_by_user_id
       ORDER BY ssl.created_at DESC
       LIMIT 10`
    )
    .all<SheetSyncLog>();

  return results ?? [];
}

export async function syncProductsFromSheet(
  input: SyncProductsFromSheetInput
): Promise<SyncSummary> {
  if (!input.config.sheet_url) {
    throw new Error("Sheet URL is not configured.");
  }

  const logId = await startLog(input.db, {
    direction: "import",
    triggeredByUserId: input.triggeredByUserId,
  });

  try {
    const reference = parseSpreadsheetReference(input.config.sheet_url);
    const values = await readSheetRows({
      credentials: input.credentials,
      spreadsheetId: reference.spreadsheetId,
      gid: reference.gid,
      sheetTabName: input.config.sheet_tab_name,
    });

    const rowRecords = mapRows(values);
    const cache = new CacheService(input.kv);

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const row of rowRecords) {
      const parsedRow = parseSheetSyncRow(row, input.config.default_marketplace);
      if (!parsedRow) {
        skippedCount += 1;
        continue;
      }

      const existing = await input.db
        .prepare("SELECT id, is_active FROM products WHERE asin = ? AND marketplace = ?")
        .bind(parsedRow.asin, parsedRow.marketplace)
        .first<ProductLookupRow>();

      try {
        const product = await ensureProductRecord({
          db: input.db,
          asin: parsedRow.asin,
          marketplace: parsedRow.marketplace,
          apiKey: input.apiKey,
          fallbackApiKeys: input.fallbackApiKeys,
          title: parsedRow.title,
          category: parsedRow.category,
          status: parsedRow.productStatus,
          updateExistingFromInput: true,
          requireRealProductData: true,
        });

        let rowCreated = !existing;
        let rowUpdated = Boolean(existing);

        if (!parsedRow.agentSlug) {
          const targetIsActive = parsedRow.rowStatus === "active" ? 1 : 0;

          if (!existing || existing.is_active !== targetIsActive) {
            await input.db
              .prepare(
                `UPDATE products
                 SET is_active = ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`
              )
              .bind(targetIsActive, product.id)
              .run();
            rowUpdated = true;
          }
        } else {
          const mappingResult = await syncAgentProductRow({
            db: input.db,
            cache,
            productId: product.id,
            asin: parsedRow.asin,
            marketplace: parsedRow.marketplace,
            agentSlug: parsedRow.agentSlug,
            trackingTag: parsedRow.trackingTag,
            customTitle: parsedRow.customTitle,
            rowStatus: parsedRow.rowStatus,
          });

          if (mappingResult === "skipped") {
            skippedCount += 1;
            continue;
          }

          if (mappingResult === "created") {
            rowCreated = true;
            rowUpdated = false;
          } else if (mappingResult === "updated") {
            rowUpdated = true;
          }
        }

        if (rowCreated) {
          createdCount += 1;
        } else if (rowUpdated) {
          updatedCount += 1;
        } else {
          skippedCount += 1;
        }

        await cache.invalidateForProduct(parsedRow.asin);
      } catch {
        skippedCount += 1;
        continue;
      }
    }

    const summary = {
      totalRows: rowRecords.length,
      createdCount,
      updatedCount,
      skippedCount,
    };

    await input.db
      .prepare(
        `UPDATE sheet_sync_configs
         SET last_imported_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = 1`
      )
      .run();

    await finishLog(input.db, logId, {
      status: "success",
      totalRows: summary.totalRows,
      createdCount,
      updatedCount,
      skippedCount,
      details: JSON.stringify({ sheetUrl: input.config.sheet_url }),
    });

    return summary;
  } catch (error) {
    await finishLog(input.db, logId, {
      status: "failed",
      totalRows: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errorMessage: error instanceof Error ? error.message : "Sheet sync failed",
      details: JSON.stringify({ sheetUrl: input.config.sheet_url }),
    });
    throw error;
  }
}

export async function mirrorProductsToSheet(
  input: MirrorProductsToSheetInput
): Promise<SyncSummary> {
  if (!input.config.sheet_url) {
    throw new Error("Sheet URL is not configured.");
  }

  const logId = await startLog(input.db, {
    direction: "export",
    triggeredByUserId: input.triggeredByUserId,
  });

  try {
    const { results } = await input.db
      .prepare(
        `SELECT
           p.asin,
           p.title,
           p.marketplace,
           p.category,
           p.status as product_status,
           p.is_active as product_is_active,
           p.created_at,
           p.updated_at,
           a.slug as agent_slug,
           t.tag as tracking_tag,
           ap.custom_title,
           ap.is_active as mapping_is_active
         FROM products p
         LEFT JOIN agent_products ap ON ap.product_id = p.id
         LEFT JOIN agents a ON a.id = ap.agent_id
         LEFT JOIN tracking_ids t ON t.id = ap.tracking_id
         ORDER BY p.updated_at DESC, ap.updated_at DESC, ap.id DESC`
      )
      .all<{
        asin: string;
        title: string;
        marketplace: string;
        category: string | null;
        product_status: string | null;
        product_is_active: number;
        created_at: string;
        updated_at: string;
        agent_slug: string | null;
        tracking_tag: string | null;
        custom_title: string | null;
        mapping_is_active: number | null;
      }>();

    const publicAppOrigin = (input.publicAppUrl || "https://dealsrky.com").replace(/\/+$/, "");

    const reference = parseSpreadsheetReference(input.config.sheet_url);
    const rows = [
      SHEET_HEADERS,
      ...(results ?? []).map((product) => [
        product.asin,
        product.marketplace,
        product.agent_slug || "",
        product.tracking_tag || "",
        product.custom_title || "",
        product.agent_slug
          ? product.mapping_is_active
            ? "active"
            : "hidden"
          : product.product_is_active
            ? "active"
            : "hidden",
        product.product_status || "active",
        product.agent_slug ? `${publicAppOrigin}/${product.agent_slug}/${product.asin}` : "",
        product.agent_slug ? `${publicAppOrigin}/${product.agent_slug}` : "",
        product.agent_slug ? `${publicAppOrigin}/go/${product.agent_slug}/${product.asin}` : "",
        product.title,
        product.category || "",
        product.agent_slug
          ? product.mapping_is_active
            ? "1"
            : "0"
          : product.product_is_active
            ? "1"
            : "0",
        product.created_at,
        product.updated_at,
      ]),
    ];

    await writeSheetRows({
      credentials: input.credentials,
      spreadsheetId: reference.spreadsheetId,
      gid: reference.gid,
      sheetTabName: input.config.sheet_tab_name,
      rows,
    });

    const summary = {
      totalRows: results?.length ?? 0,
      createdCount: results?.length ?? 0,
      updatedCount: 0,
      skippedCount: 0,
    };

    await input.db
      .prepare(
        `UPDATE sheet_sync_configs
         SET last_exported_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = 1`
      )
      .run();

    await finishLog(input.db, logId, {
      status: "success",
      totalRows: summary.totalRows,
      createdCount: summary.createdCount,
      updatedCount: summary.updatedCount,
      skippedCount: summary.skippedCount,
      details: JSON.stringify({ sheetUrl: input.config.sheet_url }),
    });

    return summary;
  } catch (error) {
    await finishLog(input.db, logId, {
      status: "failed",
      totalRows: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errorMessage: error instanceof Error ? error.message : "Sheet export failed",
      details: JSON.stringify({ sheetUrl: input.config.sheet_url }),
    });
    throw error;
  }
}

async function syncAgentProductRow(input: {
  db: D1Database;
  cache: CacheService;
  productId: number;
  asin: string;
  marketplace: string;
  agentSlug: string;
  trackingTag: string | null;
  customTitle: string | null;
  rowStatus: "active" | "inactive";
}): Promise<"created" | "updated" | "skipped"> {
  const agent = await input.db
    .prepare(`SELECT id, slug FROM agents WHERE slug = ? AND is_active = 1 LIMIT 1`)
    .bind(input.agentSlug)
    .first<AgentLookupRow>();

  if (!agent) {
    return "skipped";
  }

  const tracking = input.trackingTag
    ? await input.db
        .prepare(
          `SELECT id
           FROM tracking_ids
           WHERE agent_id = ? AND marketplace = ? AND tag = ? AND is_active = 1
           LIMIT 1`
        )
        .bind(agent.id, input.marketplace, input.trackingTag)
        .first<TrackingLookupRow>()
    : await input.db
        .prepare(
          `SELECT id
           FROM tracking_ids
           WHERE agent_id = ? AND marketplace = ? AND is_active = 1
           ORDER BY is_default DESC, created_at ASC
           LIMIT 1`
        )
        .bind(agent.id, input.marketplace)
        .first<TrackingLookupRow>();

  if (!tracking) {
    return "skipped";
  }

  const existing = await input.db
    .prepare(
      `SELECT id, tracking_id, custom_title, is_active
       FROM agent_products
       WHERE agent_id = ? AND product_id = ?
       LIMIT 1`
    )
    .bind(agent.id, input.productId)
    .first<{ id: number; tracking_id: number; custom_title: string | null; is_active: number }>();

  const nextIsActive = input.rowStatus === "active" ? 1 : 0;

  if (!existing) {
    await input.db
      .prepare(
        `INSERT INTO agent_products (agent_id, product_id, tracking_id, custom_title, is_active)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(agent.id, input.productId, tracking.id, input.customTitle, nextIsActive)
      .run();

    await input.cache.deletePageData(agent.slug, input.asin);
    await input.cache.deleteRedirectUrl(agent.slug, input.asin);

    return "created";
  }

  const hasChanged =
    existing.tracking_id !== tracking.id ||
    (existing.custom_title || null) !== (input.customTitle || null) ||
    existing.is_active !== nextIsActive;

  if (!hasChanged) {
    return "skipped";
  }

  await input.db
    .prepare(
      `UPDATE agent_products
       SET tracking_id = ?,
           custom_title = ?,
           is_active = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(tracking.id, input.customTitle, nextIsActive, existing.id)
    .run();

  await input.cache.deletePageData(agent.slug, input.asin);
  await input.cache.deleteRedirectUrl(agent.slug, input.asin);

  return "updated";
}

async function startLog(
  db: D1Database,
  input: { direction: "import" | "export"; triggeredByUserId?: number }
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO sheet_sync_logs (direction, status, triggered_by_user_id)
       VALUES (?, 'success', ?)`
    )
    .bind(input.direction, input.triggeredByUserId ?? null)
    .run();

  return Number(result.meta.last_row_id);
}

async function finishLog(
  db: D1Database,
  logId: number,
  input: {
    status: "success" | "failed";
    totalRows: number;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    details: string;
    errorMessage?: string;
  }
): Promise<void> {
  await db
    .prepare(
      `UPDATE sheet_sync_logs
       SET status = ?,
           total_rows = ?,
           created_count = ?,
           updated_count = ?,
           skipped_count = ?,
           details = ?,
           error_message = ?,
           finished_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(
      input.status,
      input.totalRows,
      input.createdCount,
      input.updatedCount,
      input.skippedCount,
      input.details,
      input.errorMessage ?? null,
      logId
    )
    .run();
}
