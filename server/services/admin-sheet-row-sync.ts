import { derivePublicSlugFromTrackingTag } from "../../shared/tracking-slug";
import { CacheService } from "./cache";
import { writeAuditLog } from "./audit-log";
import { replaceSingleTrackingForAgentMarketplace } from "./single-tracking";
import {
  ensureProductRecord,
  refreshProductRecord,
  extractAsinFromInput,
  getAmazonProductFetchErrorMessage,
  type ProductRecord,
} from "./product-ingestion";

const SUPPORTED_MARKETPLACES = new Set(["US", "CA", "UK", "DE", "FR", "IT", "ES"]);
const MAX_ROWS_PER_REQUEST = 100;
const CONCURRENCY = 5;

export interface AdminSheetSyncRowInput {
  rowNumber: number;
  asin: string;
  marketplace: string;
  trackingTag?: string | null;
  previousResolvedTrackingTag?: string | null;
  previousAgentSlug?: string | null;
  customTitle?: string | null;
  forceUpdateExisting?: boolean;
}

export interface AdminSheetSyncRowResult {
  rowNumber: number;
  asin: string;
  marketplace: string;
  status: "live" | "existing" | "updated" | "failed";
  productTitle: string | null;
  bridgePageUrl: string | null;
  storefrontUrl: string | null;
  redirectUrl: string | null;
  orderLink: string | null;
  resolvedTrackingTag: string | null;
  errorMessage: string | null;
  syncedAt: string;
}

export interface AdminSheetSyncBatchResult {
  results: AdminSheetSyncRowResult[];
}

interface TrackingOwnerRow {
  tracking_id: number;
  tracking_tag: string;
  agent_id: number;
  agent_slug: string;
}

interface AgentRow {
  id: number;
  name: string;
  slug: string;
  is_active: number;
}

interface ExistingProductRow extends ProductRecord {
  is_active: number;
}

export async function syncAdminSheetRows(input: {
  db: D1Database;
  kv: KVNamespace;
  publicAppUrl?: string;
  rows: AdminSheetSyncRowInput[];
  apiKey?: string;
  fallbackApiKeys?: string[];
  serpApiToken?: string;
  zyteApiKey?: string;
  lwaClientId?: string;
  lwaClientSecret?: string;
  lwaScope?: string;
}): Promise<AdminSheetSyncBatchResult> {
  if (input.rows.length > MAX_ROWS_PER_REQUEST) {
    throw new Error("A maximum of 100 rows can be synced per request.");
  }

  const results: AdminSheetSyncRowResult[] = [];

  for (let offset = 0; offset < input.rows.length; offset += CONCURRENCY) {
    const chunk = input.rows.slice(offset, offset + CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map((row) => syncAdminSheetRow({ ...input, row }))
    );
    results.push(...chunkResults);
  }

  return { results };
}

async function syncAdminSheetRow(input: {
  db: D1Database;
  kv: KVNamespace;
  publicAppUrl?: string;
  row: AdminSheetSyncRowInput;
  apiKey?: string;
  fallbackApiKeys?: string[];
  serpApiToken?: string;
  zyteApiKey?: string;
  lwaClientId?: string;
  lwaClientSecret?: string;
  lwaScope?: string;
}): Promise<AdminSheetSyncRowResult> {
  const syncedAt = new Date().toISOString();
  const asin = extractAsinFromInput(input.row.asin) ?? "";
  const marketplace = input.row.marketplace.trim().toUpperCase();

  if (!asin) {
    return failedResult(input.row, asin, marketplace, "Provide a valid 10-character ASIN.", syncedAt);
  }

  if (!SUPPORTED_MARKETPLACES.has(marketplace)) {
    return failedResult(
      input.row,
      asin,
      marketplace,
      "Marketplace must be one of US, CA, UK, DE, FR, IT, or ES.",
      syncedAt
    );
  }

  try {
    let product = await input.db
      .prepare(
        `SELECT id, asin, title, image_url, marketplace, category, status,
                description, features, review_content, product_images, aplus_images, is_adult, adult_detection_reason, is_active
         FROM products
         WHERE asin = ? AND marketplace = ?
         LIMIT 1`
      )
      .bind(asin, marketplace)
      .first<ExistingProductRow>();
    const existed = Boolean(product);

    const tracking = await resolveTrackingOwner({
      db: input.db,
      marketplace,
      trackingTag: input.row.trackingTag,
      previousResolvedTrackingTag: input.row.previousResolvedTrackingTag,
      previousAgentSlug: input.row.previousAgentSlug,
      productId: product?.id ?? null,
    });

    if (!tracking) {
      throw new Error(
        input.row.trackingTag?.trim()
          ? "The supplied tracking tag could not be matched, reactivated, or created for this marketplace."
          : "No active site-primary admin tracking tag exists for this marketplace."
      );
    }
    const shouldRefreshExisting = existed && Boolean(input.row.forceUpdateExisting);

    if (!product || shouldRefreshExisting) {
      const refreshedOrCreated = shouldRefreshExisting
        ? await refreshProductRecord({ ...input, asin, marketplace, status: "active" })
        : await ensureProductRecord({
            ...input,
            asin,
            marketplace,
            status: "active",
            requireRealProductData: true,
          });

      product = {
        ...refreshedOrCreated,
        is_active: 1,
      };
    }

    await input.db
      .prepare(
        `INSERT INTO agent_products (
           agent_id, product_id, tracking_id, custom_title, is_active
         ) VALUES (?, ?, ?, ?, 1)
         ON CONFLICT(agent_id, product_id) DO UPDATE SET
           tracking_id = excluded.tracking_id,
           custom_title = excluded.custom_title,
           is_active = 1`
      )
      .bind(
        tracking.agent_id,
        product.id,
        tracking.tracking_id,
        input.row.customTitle?.trim() || null
      )
      .run();

    if (product.is_active !== 1 || product.status !== "active") {
      await input.db
        .prepare(
          `UPDATE products
           SET is_active = 1,
               status = 'active',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(product.id)
        .run();
    }

    const cache = new CacheService(input.kv);
    await Promise.all([
      cache.invalidateForProduct(asin),
      cache.deletePageData(tracking.agent_slug, asin, marketplace),
      cache.deleteRedirectUrl(tracking.agent_slug, asin, marketplace),
    ]);

    const baseUrl = (input.publicAppUrl || "https://dealsrky.com").replace(/\/+$/, "");
    const marketplacePath = marketplace.toLowerCase();
    const redirectUrl = baseUrl + "/go/" + tracking.agent_slug + "/" + marketplacePath + "/" + asin;
    const isAdult = product.is_adult === 1;

    return {
      rowNumber: input.row.rowNumber,
      asin,
      marketplace,
      status: shouldRefreshExisting ? "updated" : existed ? "existing" : "live",
      productTitle: product.title,
      bridgePageUrl: isAdult ? null : baseUrl + "/" + tracking.agent_slug + "/" + marketplacePath + "/" + asin,
      storefrontUrl: isAdult ? null : baseUrl + "/" + tracking.agent_slug,
      redirectUrl,
      orderLink: isAdult ? redirectUrl : baseUrl + "/deals/" + asin,
      resolvedTrackingTag: normalizeTrackingTag(tracking.tracking_tag),
      errorMessage: null,
      syncedAt,
    };
  } catch (error) {
    return failedResult(
      input.row,
      asin,
      marketplace,
      getAdminSheetErrorMessage(error),
      syncedAt
    );
  }
}

async function resolveTrackingOwner(input: {
  db: D1Database;
  marketplace: string;
  trackingTag?: string | null;
  previousResolvedTrackingTag?: string | null;
  previousAgentSlug?: string | null;
  productId: number | null;
}): Promise<TrackingOwnerRow | null> {
  const requestedTag = normalizeTrackingTag(input.trackingTag);
  const previousResolvedTag = normalizeTrackingTag(input.previousResolvedTrackingTag);
  const previousAgentSlug = normalizeAgentSlug(input.previousAgentSlug);
  const previousOwner = previousResolvedTag
    ? await findTrackingOwnerByTag(input.db, input.marketplace, previousResolvedTag)
    : null;
  const previousAgent =
    previousOwner === null && previousAgentSlug
      ? await findAgentBySlug(input.db, previousAgentSlug)
      : null;
  const previousAgentId = previousOwner?.agent_id ?? previousAgent?.id ?? null;
  const productTracking = input.productId
    ? previousAgentId
      ? await findProductTrackingOwnerForAgent(
          input.db,
          input.productId,
          input.marketplace,
          previousAgentId
        )
      : await findProductTrackingOwner(input.db, input.productId, input.marketplace)
    : null;
  const sheetChangedTag = previousResolvedTag !== null && requestedTag !== previousResolvedTag;

  if (sheetChangedTag) {
    if (!requestedTag) {
      return findSitePrimaryTrackingOwner(input.db, input.marketplace);
    }

    return resolveOrCreateTrackingOwner({
      db: input.db,
      marketplace: input.marketplace,
      trackingTag: requestedTag,
      preferredAgentId: previousAgentId ?? undefined,
    });
  }

  if (requestedTag) {
    // The sheet still contains its last confirmed value, so a changed website
    // mapping/tag is authoritative and must be written back to the sheet.
    if (
      previousResolvedTag === requestedTag &&
      productTracking &&
      normalizeTrackingTag(productTracking.tracking_tag) !== requestedTag
    ) {
      return productTracking;
    }

    if (previousResolvedTag === requestedTag && !productTracking) {
      const sitePrimary = await findSitePrimaryTrackingOwner(input.db, input.marketplace);
      if (sitePrimary && normalizeTrackingTag(sitePrimary.tracking_tag) !== requestedTag) {
        return sitePrimary;
      }
    }

    return resolveOrCreateTrackingOwner({
      db: input.db,
      marketplace: input.marketplace,
      trackingTag: requestedTag,
      preferredAgentId: previousAgentId ?? undefined,
    });
  }

  return findSitePrimaryTrackingOwner(input.db, input.marketplace);
}

function normalizeTrackingTag(value: string | null | undefined): string | null {
  const normalized = (value ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .trim();

  if (!normalized) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*-[A-Za-z0-9]+$/.test(normalized)) {
    throw new Error("Tracking tag format is invalid. Use the full tag, such as ivan101-20.");
  }

  return normalized;
}

function normalizeAgentSlug(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized && /^[a-z0-9-]+$/.test(normalized) ? normalized : null;
}

async function resolveOrCreateTrackingOwner(input: {
  db: D1Database;
  marketplace: string;
  trackingTag: string;
  preferredAgentId?: number;
}): Promise<TrackingOwnerRow | null> {
  const activeOwner = await findActiveTrackingOwnerByTag(
    input.db,
    input.marketplace,
    input.trackingTag
  );
  if (activeOwner) return activeOwner;

  const existingOwner = await findTrackingOwnerByTag(
    input.db,
    input.marketplace,
    input.trackingTag
  );
  if (existingOwner) {
    await Promise.all([
      input.db
        .prepare(
          `UPDATE agents
           SET is_active = 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(existingOwner.agent_id)
        .run(),
      input.db
        .prepare(
          `UPDATE tracking_ids
           SET is_active = 1, is_default = 1, is_portal_editable = 0
           WHERE id = ?`
        )
        .bind(existingOwner.tracking_id)
        .run(),
    ]);

    return findActiveTrackingOwnerByTag(input.db, input.marketplace, input.trackingTag);
  }

  const conflictingMarketplace = await input.db
    .prepare(
      `SELECT marketplace
       FROM tracking_ids
       WHERE tag = ?
       LIMIT 1`
    )
    .bind(input.trackingTag)
    .first<{ marketplace: string }>();
  if (conflictingMarketplace) {
    throw new Error(
      `This tracking tag already belongs to the ${conflictingMarketplace.marketplace} marketplace.`
    );
  }

  const agent = input.preferredAgentId
    ? await getOrReactivateAgentById(input.db, input.preferredAgentId)
    : await findOrCreateSheetAgent(input.db, input.trackingTag);
  if (!agent) {
    throw new Error("Could not create or resolve an agent for this tracking tag.");
  }

  const previousTracking = await input.db
    .prepare(
      `SELECT id
       FROM tracking_ids
       WHERE agent_id = ? AND marketplace = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`
    )
    .bind(agent.id, input.marketplace)
    .first<{ id: number }>();

  const savedTracking = await replaceSingleTrackingForAgentMarketplace({
    db: input.db,
    agentId: agent.id,
    marketplace: input.marketplace,
    tag: input.trackingTag,
    label: "Auto-created from Admin Sheet",
    aliasSlug: derivePublicSlugFromTrackingTag(input.trackingTag),
  });

  const createdOwner = await findActiveTrackingOwnerByTag(
    input.db,
    input.marketplace,
    input.trackingTag
  );
  if (!createdOwner) {
    throw new Error("The tracking tag could not be created for this marketplace.");
  }

  await writeSheetAuditLogSafe(input.db, {
    action: previousTracking ? "sheet.tracking_tag.switched" : "sheet.tracking_tag.auto_created",
    entityType: "tracking_id",
    entityId: savedTracking.id,
    details: {
      tag: input.trackingTag,
      marketplace: input.marketplace,
      agentId: createdOwner.agent_id,
      agentSlug: createdOwner.agent_slug,
      replacedTrackingId: previousTracking?.id ?? null,
    },
  });

  return createdOwner;
}

async function findOrCreateSheetAgent(
  db: D1Database,
  trackingTag: string
): Promise<AgentRow | null> {
  const slug = derivePublicSlugFromTrackingTag(trackingTag).slice(0, 50);
  let agent = await db
    .prepare("SELECT id, name, slug, is_active FROM agents WHERE slug = ? LIMIT 1")
    .bind(slug)
    .first<AgentRow>();
  const wasCreated = !agent;

  if (!agent) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO agents (name, slug, is_active)
         VALUES (?, ?, 1)`
      )
      .bind(trackingTag, slug)
      .run();

    agent = await db
      .prepare("SELECT id, name, slug, is_active FROM agents WHERE slug = ? LIMIT 1")
      .bind(slug)
      .first<AgentRow>();
  }

  if (!agent) return null;

  if (agent.is_active !== 1) {
    await db
      .prepare(
        `UPDATE agents
         SET is_active = 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(agent.id)
      .run();
    agent = { ...agent, is_active: 1 };
  }

  if (wasCreated) {
    await writeSheetAuditLogSafe(db, {
      action: "sheet.agent.auto_created",
      entityType: "agent",
      entityId: agent.id,
      details: {
        name: agent.name,
        slug: agent.slug,
        sourceTrackingTag: trackingTag,
      },
    });
  }

  return agent;
}

async function findAgentBySlug(
  db: D1Database,
  slug: string
): Promise<AgentRow | null> {
  return db
    .prepare("SELECT id, name, slug, is_active FROM agents WHERE slug = ? LIMIT 1")
    .bind(slug)
    .first<AgentRow>();
}

async function getOrReactivateAgentById(
  db: D1Database,
  agentId: number
): Promise<AgentRow | null> {
  let agent = await db
    .prepare("SELECT id, name, slug, is_active FROM agents WHERE id = ? LIMIT 1")
    .bind(agentId)
    .first<AgentRow>();
  if (!agent) return null;

  if (agent.is_active !== 1) {
    await db
      .prepare(
        `UPDATE agents
         SET is_active = 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(agent.id)
      .run();
    agent = { ...agent, is_active: 1 };
  }

  return agent;
}

async function writeSheetAuditLogSafe(
  db: D1Database,
  input: Parameters<typeof writeAuditLog>[1]
): Promise<void> {
  try {
    await writeAuditLog(db, input);
  } catch (error) {
    console.warn("[Admin Sheet Sync] Could not write audit log", error);
  }
}

async function findTrackingOwnerByTag(
  db: D1Database,
  marketplace: string,
  trackingTag: string
): Promise<TrackingOwnerRow | null> {
  return db
    .prepare(
      `SELECT
         t.id AS tracking_id,
         t.tag AS tracking_tag,
         a.id AS agent_id,
         COALESCE(asa.slug, a.slug) AS agent_slug
       FROM tracking_ids t
       JOIN agents a ON a.id = t.agent_id
       LEFT JOIN agent_slug_aliases asa
         ON asa.tracking_id = t.id AND asa.marketplace = t.marketplace AND asa.is_active = 1
       WHERE t.tag = ?
         AND t.marketplace = ?
       LIMIT 1`
    )
    .bind(trackingTag, marketplace)
    .first<TrackingOwnerRow>();
}

async function findActiveTrackingOwnerByTag(
  db: D1Database,
  marketplace: string,
  trackingTag: string
): Promise<TrackingOwnerRow | null> {
  return db
    .prepare(
      `SELECT
         t.id AS tracking_id,
         t.tag AS tracking_tag,
         a.id AS agent_id,
         COALESCE(asa.slug, a.slug) AS agent_slug
       FROM tracking_ids t
       JOIN agents a ON a.id = t.agent_id
       LEFT JOIN agent_slug_aliases asa
         ON asa.tracking_id = t.id AND asa.marketplace = t.marketplace AND asa.is_active = 1
       WHERE t.tag = ?
         AND t.marketplace = ?
         AND t.is_active = 1
         AND a.is_active = 1
       LIMIT 1`
    )
    .bind(trackingTag, marketplace)
    .first<TrackingOwnerRow>();
}

async function findSitePrimaryTrackingOwner(
  db: D1Database,
  marketplace: string
): Promise<TrackingOwnerRow | null> {
  return db
    .prepare(
      `SELECT
         t.id AS tracking_id,
         t.tag AS tracking_tag,
         a.id AS agent_id,
         COALESCE(asa.slug, a.slug) AS agent_slug
       FROM tracking_ids t
       JOIN agents a ON a.id = t.agent_id
       LEFT JOIN agent_slug_aliases asa
         ON asa.tracking_id = t.id AND asa.marketplace = t.marketplace AND asa.is_active = 1
       WHERE t.marketplace = ?
         AND t.is_site_primary = 1
         AND t.is_active = 1
         AND a.is_active = 1
       ORDER BY t.created_at ASC
       LIMIT 1`
    )
    .bind(marketplace)
    .first<TrackingOwnerRow>();
}

async function findProductTrackingOwner(
  db: D1Database,
  productId: number,
  marketplace: string
): Promise<TrackingOwnerRow | null> {
  return db
    .prepare(
      `SELECT
         t.id AS tracking_id,
         t.tag AS tracking_tag,
         a.id AS agent_id,
         COALESCE(asa.slug, a.slug) AS agent_slug
       FROM agent_products ap
       JOIN tracking_ids t ON t.id = ap.tracking_id
       JOIN agents a ON a.id = ap.agent_id
       LEFT JOIN agent_slug_aliases asa
         ON asa.tracking_id = t.id AND asa.marketplace = t.marketplace AND asa.is_active = 1
       WHERE ap.product_id = ?
         AND t.marketplace = ?
         AND ap.is_active = 1
         AND t.is_active = 1
         AND a.is_active = 1
       ORDER BY t.is_site_primary DESC, ap.updated_at DESC, ap.id DESC
       LIMIT 1`
    )
    .bind(productId, marketplace)
    .first<TrackingOwnerRow>();
}

async function findProductTrackingOwnerForAgent(
  db: D1Database,
  productId: number,
  marketplace: string,
  agentId: number
): Promise<TrackingOwnerRow | null> {
  return db
    .prepare(
      `SELECT
         t.id AS tracking_id,
         t.tag AS tracking_tag,
         a.id AS agent_id,
         COALESCE(asa.slug, a.slug) AS agent_slug
       FROM agent_products ap
       JOIN tracking_ids t ON t.id = ap.tracking_id
       JOIN agents a ON a.id = ap.agent_id
       LEFT JOIN agent_slug_aliases asa
         ON asa.tracking_id = t.id AND asa.marketplace = t.marketplace AND asa.is_active = 1
       WHERE ap.product_id = ?
         AND ap.agent_id = ?
         AND t.marketplace = ?
         AND ap.is_active = 1
         AND t.is_active = 1
         AND a.is_active = 1
       ORDER BY ap.updated_at DESC, ap.id DESC
       LIMIT 1`
    )
    .bind(productId, agentId, marketplace)
    .first<TrackingOwnerRow>();
}

function failedResult(
  row: AdminSheetSyncRowInput,
  asin: string,
  marketplace: string,
  errorMessage: string,
  syncedAt: string
): AdminSheetSyncRowResult {
  return {
    rowNumber: row.rowNumber,
    asin: asin || row.asin.trim().toUpperCase(),
    marketplace,
    status: "failed",
    productTitle: null,
    bridgePageUrl: null,
    storefrontUrl: null,
    redirectUrl: null,
    orderLink: null,
    resolvedTrackingTag: null,
    errorMessage,
    syncedAt,
  };
}

function getAdminSheetErrorMessage(error: unknown): string {
  const productMessage = getAmazonProductFetchErrorMessage(error);
  if (productMessage !== "Could not fetch live product data for this ASIN. Try another ASIN or ask admin to review it.") {
    return productMessage;
  }
  return error instanceof Error ? error.message : "Row sync failed.";
}
