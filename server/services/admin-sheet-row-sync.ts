import { CacheService } from "./cache";
import {
  ensureProductRecord,
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
  customTitle?: string | null;
}

export interface AdminSheetSyncRowResult {
  rowNumber: number;
  asin: string;
  marketplace: string;
  status: "live" | "existing" | "failed";
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
    const tracking = await resolveTrackingOwner({
      db: input.db,
      marketplace,
      trackingTag: input.row.trackingTag,
    });

    if (!tracking) {
      throw new Error(
        input.row.trackingTag?.trim()
          ? "The supplied tracking tag is not active for this marketplace."
          : "No active site-primary admin tracking tag exists for this marketplace."
      );
    }

    let product = await input.db
      .prepare(
        `SELECT id, asin, title, image_url, marketplace, category, status,
                description, features, review_content, product_images, aplus_images, is_active
         FROM products
         WHERE asin = ? AND marketplace = ?
         LIMIT 1`
      )
      .bind(asin, marketplace)
      .first<ExistingProductRow>();
    const existed = Boolean(product);

    if (!product) {
      product = {
        ...(await ensureProductRecord({
          db: input.db,
          asin,
          marketplace,
          apiKey: input.apiKey,
          fallbackApiKeys: input.fallbackApiKeys,
          serpApiToken: input.serpApiToken,
          zyteApiKey: input.zyteApiKey,
          lwaClientId: input.lwaClientId,
          lwaClientSecret: input.lwaClientSecret,
          lwaScope: input.lwaScope,
          status: "active",
          requireRealProductData: true,
        })),
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

    return {
      rowNumber: input.row.rowNumber,
      asin,
      marketplace,
      status: existed ? "existing" : "live",
      productTitle: product.title,
      bridgePageUrl: `${baseUrl}/${tracking.agent_slug}/${marketplacePath}/${asin}`,
      storefrontUrl: `${baseUrl}/${tracking.agent_slug}`,
      redirectUrl: `${baseUrl}/go/${tracking.agent_slug}/${marketplacePath}/${asin}`,
      orderLink: `${baseUrl}/deals/${asin}`,
      resolvedTrackingTag: tracking.tracking_tag,
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
}): Promise<TrackingOwnerRow | null> {
  const explicitTag = input.trackingTag?.trim() || null;
  const whereClause = explicitTag
    ? "t.tag = ? AND t.marketplace = ?"
    : "t.marketplace = ? AND t.is_site_primary = 1";
  const bindings = explicitTag
    ? [explicitTag, input.marketplace]
    : [input.marketplace];

  return input.db
    .prepare(
      `SELECT
         t.id AS tracking_id,
         t.tag AS tracking_tag,
         a.id AS agent_id,
         a.slug AS agent_slug
       FROM tracking_ids t
       JOIN agents a ON a.id = t.agent_id
       WHERE ${whereClause}
         AND t.is_active = 1
         AND a.is_active = 1
       ORDER BY t.created_at ASC
       LIMIT 1`
    )
    .bind(...bindings)
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
