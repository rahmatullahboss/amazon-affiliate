import { CacheService } from "./cache";
import {
  parseSpreadsheetReference,
  readSheetRows,
  writeSheetRows,
} from "./google-sheets";
import { ensureProductRecord, isValidAsin } from "./product-ingestion";

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
  config: SheetSyncConfig;
  credentials: GoogleCredentials;
  triggeredByUserId?: number;
}

interface MirrorProductsToSheetInput {
  db: D1Database;
  config: SheetSyncConfig;
  credentials: GoogleCredentials;
  triggeredByUserId?: number;
}

interface SyncSummary {
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
}

type SheetRowRecord = Record<string, string>;

const SHEET_HEADERS = [
  "asin",
  "title",
  "marketplace",
  "category",
  "status",
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
      const asin = normalizeCell(row.asin).toUpperCase();
      if (!isValidAsin(asin)) {
        skippedCount += 1;
        continue;
      }

      const marketplace = normalizeCell(row.marketplace || input.config.default_marketplace).toUpperCase() || input.config.default_marketplace;
      const status = normalizeCell(row.status) || "active";
      const existing = await input.db
        .prepare("SELECT id FROM products WHERE asin = ? AND marketplace = ?")
        .bind(asin, marketplace)
        .first<{ id: number }>();

      try {
        await ensureProductRecord({
          db: input.db,
          asin,
          marketplace,
          apiKey: input.apiKey,
          title: normalizeCell(row.title) || null,
          category: normalizeCell(row.category) || null,
          status,
          updateExistingFromInput: true,
          requireRealProductData: true,
        });
      } catch {
        skippedCount += 1;
        continue;
      }

      if (existing) {
        updatedCount += 1;
      } else {
        createdCount += 1;
      }

      await cache.invalidateForProduct(asin);
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
           asin,
           title,
           marketplace,
           category,
           status,
           is_active,
           created_at,
           updated_at
         FROM products
         ORDER BY updated_at DESC`
      )
      .all<{
        asin: string;
        title: string;
        marketplace: string;
        category: string | null;
        status: string | null;
        is_active: number;
        created_at: string;
        updated_at: string;
      }>();

    const reference = parseSpreadsheetReference(input.config.sheet_url);
    const rows = [
      SHEET_HEADERS,
      ...(results ?? []).map((product) => [
        product.asin,
        product.title,
        product.marketplace,
        product.category || "",
        product.status || (product.is_active ? "active" : "inactive"),
        product.is_active ? "1" : "0",
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

function mapRows(values: string[][]): SheetRowRecord[] {
  if (values.length === 0) {
    return [];
  }

  const headers = values[0].map(normalizeHeader);
  const hasAsinHeader = headers.includes("asin");

  if (!hasAsinHeader) {
    return mapHeaderlessAsinGrid(values);
  }

  if (values.length < 2) {
    return [];
  }

  return values.slice(1).map((row) =>
    headers.reduce<SheetRowRecord>((accumulator, header, index) => {
      accumulator[header] = row[index] ?? "";
      return accumulator;
    }, {})
  );
}

function mapHeaderlessAsinGrid(values: string[][]): SheetRowRecord[] {
  const records: SheetRowRecord[] = [];

  for (const row of values) {
    for (const cell of row) {
      const normalized = normalizeCell(cell).toUpperCase();

      if (!isValidAsin(normalized)) {
        continue;
      }

      records.push({ asin: normalized });
    }
  }

  return dedupeSheetRecords(records);
}

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeCell(value?: string): string {
  return (value || "").trim();
}

function dedupeSheetRecords(records: SheetRowRecord[]): SheetRowRecord[] {
  const seen = new Set<string>();
  const deduped: SheetRowRecord[] = [];

  for (const record of records) {
    const asin = normalizeCell(record.asin).toUpperCase();
    const marketplace = normalizeCell(record.marketplace).toUpperCase();
    const key = `${asin}:${marketplace}`;

    if (!asin || seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(record);
  }

  return deduped;
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
