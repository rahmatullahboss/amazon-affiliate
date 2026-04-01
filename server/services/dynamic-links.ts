import { ASIN_IMPORT_ENABLED, ASIN_IMPORT_PAUSED_MESSAGE } from "../utils/asin-import";
import { buildAmazonUrl } from "../utils/types";
import { CacheService } from "./cache";
import { resolvePublicSlug } from "./public-slugs";
import {
  AmazonProductFetchError,
  ensureProductRecord,
  extractAsinFromInput,
  getAmazonProductFetchErrorMessage,
} from "./product-ingestion";

interface TrackingRouteContext {
  trackingId: number;
  trackingTag: string;
  marketplace: string;
  agentId: number;
  agentSlug: string;
  agentName: string;
}

interface EnsureLegacyDynamicLinkInput {
  db: D1Database;
  kv?: KVNamespace;
  agentSlug: string;
  asin: string;
  preferredMarketplace?: string | null;
  apiKey?: string;
  fallbackApiKeys?: string[];
}

interface ProductRouteContext {
  id: number;
  title: string;
  image_url: string;
  status: string;
}

export interface AgentProductResolutionRow {
  agent_slug: string;
  agent_name: string;
  agent_id: number;
  asin: string;
  product_title: string;
  image_url: string;
  description: string | null;
  features: string | null;
  product_images: string | null;
  aplus_images: string | null;
  product_id: number;
  tracking_tag: string;
  marketplace: string;
  custom_title: string | null;
}

export interface AgentProductResolution {
  row: AgentProductResolutionRow;
  resolvedMarketplace: string;
}

export interface DynamicLinkResolution {
  agentId: number;
  agentSlug: string;
  agentName: string;
  trackingId: number;
  trackingTag: string;
  marketplace: string;
  productId: number;
  asin: string;
  title: string;
  imageUrl: string;
  amazonUrl: string;
}

interface EnsureDynamicLinkInput {
  db: D1Database;
  kv?: KVNamespace;
  trackingTag: string;
  asin: string;
  apiKey?: string;
  fallbackApiKeys?: string[];
}

export class DynamicLinkResolutionError extends Error {
  readonly status: 400 | 404 | 409 | 502 | 503;

  constructor(status: 400 | 404 | 409 | 502 | 503, message: string) {
    super(message);
    this.name = "DynamicLinkResolutionError";
    this.status = status;
  }
}

function isAmazonProductFetchError(
  error: unknown
): error is AmazonProductFetchError {
  return (
    error instanceof AmazonProductFetchError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string")
  );
}

const AGENT_PRODUCT_SELECT = `SELECT
  a.slug as agent_slug, a.name as agent_name, a.id as agent_id,
  p.asin, p.title as product_title, p.image_url, p.description, p.features,
  p.product_images, p.aplus_images, p.id as product_id,
  t.tag as tracking_tag, t.marketplace,
  ap.custom_title
FROM agent_products ap
JOIN agents a ON a.id = ap.agent_id
JOIN products p ON p.id = ap.product_id
JOIN tracking_ids t ON t.id = ap.tracking_id`;

async function loadAgentProductRow(
  db: D1Database,
  agentSlug: string,
  asin: string,
  marketplace?: string | null
): Promise<AgentProductResolutionRow | null> {
  const statement = marketplace
    ? db.prepare(
        `${AGENT_PRODUCT_SELECT}
         WHERE a.slug = ? AND p.asin = ? AND t.marketplace = ?
           AND ap.is_active = 1 AND a.is_active = 1 AND p.is_active = 1 AND p.status = 'active'
         LIMIT 1`
      ).bind(agentSlug, asin, marketplace)
    : db.prepare(
        `${AGENT_PRODUCT_SELECT}
         WHERE a.slug = ? AND p.asin = ?
           AND ap.is_active = 1 AND a.is_active = 1 AND p.is_active = 1 AND p.status = 'active'
         ORDER BY t.is_default DESC, t.created_at ASC
         LIMIT 1`
      ).bind(agentSlug, asin);

  return statement.first<AgentProductResolutionRow>();
}

async function loadAgentProductRowForResolvedSlug(
  db: D1Database,
  input: {
    publicSlug: string;
    agentId: number;
    trackingId: number | null;
    fixedMarketplace: string | null;
    asin: string;
    preferredMarketplace: string | null;
  }
): Promise<AgentProductResolutionRow | null> {
  if (input.trackingId) {
    const effectiveMarketplace = input.fixedMarketplace;
    if (!effectiveMarketplace) {
      return null;
    }

    if (input.preferredMarketplace && input.preferredMarketplace !== effectiveMarketplace) {
      return null;
    }

    const row = await db
      .prepare(
        `${AGENT_PRODUCT_SELECT}
         WHERE ap.tracking_id = ? AND p.asin = ? AND t.marketplace = ?
           AND ap.is_active = 1 AND a.is_active = 1 AND p.is_active = 1 AND p.status = 'active'
         LIMIT 1`
      )
      .bind(input.trackingId, input.asin, effectiveMarketplace)
      .first<AgentProductResolutionRow>();

    return row ? { ...row, agent_slug: input.publicSlug } : null;
  }

  const row = input.preferredMarketplace
    ? await db
        .prepare(
          `${AGENT_PRODUCT_SELECT}
           WHERE a.id = ? AND p.asin = ? AND t.marketplace = ?
             AND ap.is_active = 1 AND a.is_active = 1 AND p.is_active = 1 AND p.status = 'active'
           LIMIT 1`
        )
        .bind(input.agentId, input.asin, input.preferredMarketplace)
        .first<AgentProductResolutionRow>()
    : await db
        .prepare(
          `${AGENT_PRODUCT_SELECT}
           WHERE a.id = ? AND p.asin = ?
             AND ap.is_active = 1 AND a.is_active = 1 AND p.is_active = 1 AND p.status = 'active'
           ORDER BY t.is_default DESC, t.created_at ASC
           LIMIT 1`
        )
        .bind(input.agentId, input.asin)
        .first<AgentProductResolutionRow>();

  return row ? { ...row, agent_slug: input.publicSlug } : null;
}

export async function hasAgentMarketplaceCandidate(
  db: D1Database,
  agentSlug: string,
  marketplace: string
): Promise<boolean> {
  const resolvedSlug = await resolvePublicSlug(db, agentSlug);
  if (!resolvedSlug) {
    return false;
  }

  if (resolvedSlug.trackingId) {
    return resolvedSlug.marketplace === marketplace;
  }

  const candidate = await db
    .prepare(
      `SELECT 1
       FROM tracking_ids t
       WHERE t.agent_id = ?
         AND t.is_active = 1
         AND t.marketplace = ?
       LIMIT 1`
    )
    .bind(resolvedSlug.agentId, marketplace)
    .first<{ 1: number }>();

  return candidate !== null;
}

export async function resolveAgentProductBySlug(input: {
  db: D1Database;
  agentSlug: string;
  asin: string;
  preferredMarketplace?: string | null;
}): Promise<AgentProductResolution | null> {
  const preferredMarketplace = input.preferredMarketplace?.trim().toUpperCase() || null;
  const resolvedSlug = await resolvePublicSlug(input.db, input.agentSlug);
  if (!resolvedSlug) {
    return null;
  }

  const row = await loadAgentProductRowForResolvedSlug(input.db, {
    publicSlug: resolvedSlug.publicSlug,
    agentId: resolvedSlug.agentId,
    trackingId: resolvedSlug.trackingId,
    fixedMarketplace: resolvedSlug.marketplace,
    asin: input.asin,
    preferredMarketplace,
  });

  if (!row) {
    return null;
  }

  return {
    row,
    resolvedMarketplace: row.marketplace,
  };
}

async function finalizeDynamicLinkResolution(input: {
  db: D1Database;
  kv?: KVNamespace;
  tracking: TrackingRouteContext;
  asin: string;
  product: ProductRouteContext;
}): Promise<DynamicLinkResolution> {
  if (input.product.status === "rejected") {
    throw new DynamicLinkResolutionError(
      409,
      "This product is currently blocked and must be reviewed by admin before it can be used again."
    );
  }

  if (input.product.status !== "active") {
    throw new DynamicLinkResolutionError(
      409,
      "This product is not active yet. Ask admin to review it before sharing the link."
    );
  }

  await input.db
    .prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id)
       VALUES (?, ?, ?)
       ON CONFLICT(agent_id, product_id) DO UPDATE SET
         tracking_id = excluded.tracking_id,
         is_active = 1,
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind(input.tracking.agentId, input.product.id, input.tracking.trackingId)
    .run();

  if (input.kv) {
    const cache = new CacheService(input.kv);
    await Promise.all([
      cache.deletePageData(input.tracking.agentSlug, input.asin, input.tracking.marketplace),
      cache.deleteRedirectUrl(input.tracking.agentSlug, input.asin, input.tracking.marketplace),
    ]);
  }

  return {
    agentId: input.tracking.agentId,
    agentSlug: input.tracking.agentSlug,
    agentName: input.tracking.agentName,
    trackingId: input.tracking.trackingId,
    trackingTag: input.tracking.trackingTag,
    marketplace: input.tracking.marketplace,
    productId: input.product.id,
    asin: input.asin,
    title: input.product.title,
    imageUrl: input.product.image_url,
    amazonUrl: buildAmazonUrl(input.asin, input.tracking.trackingTag, input.tracking.marketplace),
  };
}

export async function ensureDynamicLinkByTrackingTag(
  input: EnsureDynamicLinkInput
): Promise<DynamicLinkResolution> {
  const resolvedAsin = extractAsinFromInput(input.asin);
  if (!resolvedAsin) {
    throw new DynamicLinkResolutionError(400, "Provide a valid ASIN or Amazon product link.");
  }

  const normalizedTrackingTag = input.trackingTag.trim();
  if (!normalizedTrackingTag) {
    throw new DynamicLinkResolutionError(400, "Tracking tag is required.");
  }

  const tracking = await input.db
    .prepare(
      `SELECT
         t.id as trackingId,
         t.tag as trackingTag,
         t.marketplace,
         a.id as agentId,
         a.slug as agentSlug,
         a.name as agentName
       FROM tracking_ids t
       JOIN agents a ON a.id = t.agent_id
       WHERE t.tag = ?
         AND t.is_active = 1
         AND a.is_active = 1
       LIMIT 1`
    )
    .bind(normalizedTrackingTag)
    .first<TrackingRouteContext>();

  if (!tracking) {
    throw new DynamicLinkResolutionError(404, "Tracking tag not found.");
  }

  let product = await input.db
    .prepare(
      `SELECT id, title, image_url, status
       FROM products
       WHERE asin = ? AND marketplace = ?`
    )
    .bind(resolvedAsin, tracking.marketplace)
    .first<ProductRouteContext>();

  if (!product) {
    if (!ASIN_IMPORT_ENABLED) {
      throw new DynamicLinkResolutionError(503, ASIN_IMPORT_PAUSED_MESSAGE);
    }

    if (!input.apiKey && !(input.fallbackApiKeys ?? []).length) {
      throw new DynamicLinkResolutionError(
        503,
        "Amazon product API is not configured. Dynamic ASIN links need live product data."
      );
    }

    try {
      const ensuredProduct = await ensureProductRecord({
        db: input.db,
        asin: resolvedAsin,
        marketplace: tracking.marketplace,
        apiKey: input.apiKey,
        fallbackApiKeys: input.fallbackApiKeys,
        status: "active",
        requireRealProductData: true,
      });

      product = {
        id: ensuredProduct.id,
        title: ensuredProduct.title,
        image_url: ensuredProduct.image_url,
        status: ensuredProduct.status || "active",
      };
    } catch (error) {
      throw new DynamicLinkResolutionError(
        502,
        getAmazonProductFetchErrorMessage(error)
      );
    }
  }

  return finalizeDynamicLinkResolution({
    db: input.db,
    kv: input.kv,
    tracking,
    asin: resolvedAsin,
    product,
  });
}

export async function ensureDynamicLinkByAgentSlug(
  input: EnsureLegacyDynamicLinkInput
): Promise<DynamicLinkResolution> {
  const resolvedAsin = extractAsinFromInput(input.asin);
  if (!resolvedAsin) {
    throw new DynamicLinkResolutionError(400, "Provide a valid ASIN or Amazon product link.");
  }

  const normalizedAgentSlug = input.agentSlug.trim();
  if (!normalizedAgentSlug) {
    throw new DynamicLinkResolutionError(400, "Agent slug is required.");
  }

  const preferredMarketplace = input.preferredMarketplace?.trim().toUpperCase() || null;
  const resolvedSlug = await resolvePublicSlug(input.db, normalizedAgentSlug);
  if (!resolvedSlug) {
    throw new DynamicLinkResolutionError(404, "No active tracking tag was found for this link. Ask admin to review the agent setup.");
  }

  if (resolvedSlug.marketplace && preferredMarketplace && resolvedSlug.marketplace !== preferredMarketplace) {
    throw new DynamicLinkResolutionError(404, "This marketplace is not available for the selected agent.");
  }

  const { results } = await input.db
    .prepare(
      `SELECT
         t.id as trackingId,
         t.tag as trackingTag,
         t.marketplace,
         a.id as agentId,
         a.slug as agentSlug,
         a.name as agentName
       FROM tracking_ids t
       JOIN agents a ON a.id = t.agent_id
       WHERE a.id = ?
         AND a.is_active = 1
         AND t.is_active = 1
       ORDER BY t.is_default DESC, t.created_at ASC`
    )
    .bind(resolvedSlug.agentId)
    .all<TrackingRouteContext>();

  const trackingCandidates = (results ?? []).map((tracking) => ({
    ...tracking,
    agentSlug: resolvedSlug.publicSlug,
  }));
  if (trackingCandidates.length === 0) {
    throw new DynamicLinkResolutionError(
      404,
      "No active tracking tag was found for this link. Ask admin to review the agent setup."
    );
  }

  const baseCandidates = resolvedSlug.trackingId
    ? trackingCandidates.filter((tracking) => tracking.trackingId === resolvedSlug.trackingId)
    : trackingCandidates;

  const preferredTrackingCandidates = preferredMarketplace
    ? baseCandidates.filter((tracking) => tracking.marketplace === preferredMarketplace)
    : baseCandidates;
  if (preferredMarketplace && preferredTrackingCandidates.length === 0) {
    throw new DynamicLinkResolutionError(
      404,
      "This marketplace is not available for the selected agent."
    );
  }

  const resolutionCandidates = preferredMarketplace ? preferredTrackingCandidates : trackingCandidates;
  let deferredStatusError: DynamicLinkResolutionError | null = null;
  let deferredFetchError: unknown = null;

  for (const tracking of resolutionCandidates) {
    const product = await input.db
      .prepare(
        `SELECT id, title, image_url, status
         FROM products
         WHERE asin = ? AND marketplace = ?`
      )
      .bind(resolvedAsin, tracking.marketplace)
      .first<ProductRouteContext>();

    if (!product) {
      continue;
    }

    try {
      return await finalizeDynamicLinkResolution({
        db: input.db,
        kv: input.kv,
        tracking,
        asin: resolvedAsin,
        product,
      });
    } catch (error) {
      if (error instanceof DynamicLinkResolutionError) {
        deferredStatusError = deferredStatusError ?? error;
        continue;
      }

      throw error;
    }
  }

  if (!input.apiKey && !(input.fallbackApiKeys ?? []).length) {
    if (preferredMarketplace && preferredTrackingCandidates.length > 0) {
      throw new DynamicLinkResolutionError(
        404,
        "This ASIN is not available in the selected marketplace."
      );
    }

    throw deferredStatusError ?? new DynamicLinkResolutionError(
      503,
      "Amazon product API is not configured. Dynamic ASIN links need live product data."
    );
  }

  if (!ASIN_IMPORT_ENABLED) {
    if (preferredMarketplace && preferredTrackingCandidates.length > 0) {
      throw new DynamicLinkResolutionError(
        404,
        "This ASIN is not available in the selected marketplace."
      );
    }

    throw deferredStatusError ?? new DynamicLinkResolutionError(503, ASIN_IMPORT_PAUSED_MESSAGE);
  }

  const attemptedMarketplaces = new Set<string>();

  for (const tracking of resolutionCandidates) {
    if (attemptedMarketplaces.has(tracking.marketplace)) {
      continue;
    }

    attemptedMarketplaces.add(tracking.marketplace);

    try {
      const ensuredProduct = await ensureProductRecord({
        db: input.db,
        asin: resolvedAsin,
        marketplace: tracking.marketplace,
        apiKey: input.apiKey,
        fallbackApiKeys: input.fallbackApiKeys,
        status: "active",
        requireRealProductData: true,
      });

      return await finalizeDynamicLinkResolution({
        db: input.db,
        kv: input.kv,
        tracking,
        asin: resolvedAsin,
        product: {
          id: ensuredProduct.id,
          title: ensuredProduct.title,
          image_url: ensuredProduct.image_url,
          status: ensuredProduct.status || "active",
        },
      });
    } catch (error) {
      if (
        isAmazonProductFetchError(error) &&
        (error.code === "not_found" || error.code === "invalid_response")
      ) {
        if (preferredMarketplace && preferredTrackingCandidates.length > 0) {
          throw new DynamicLinkResolutionError(
            404,
            "This ASIN is not available in the selected marketplace."
          );
        }

        deferredFetchError = deferredFetchError ?? error;
        continue;
      }

      if (error instanceof DynamicLinkResolutionError) {
        if (preferredMarketplace && preferredTrackingCandidates.length > 0 && error.status >= 500) {
          throw new DynamicLinkResolutionError(
            404,
            "This ASIN is not available in the selected marketplace."
          );
        }

        deferredStatusError = deferredStatusError ?? error;
        continue;
      }

      deferredFetchError = deferredFetchError ?? error;
      continue;
    }
  }

  if (preferredMarketplace && preferredTrackingCandidates.length > 0) {
    throw new DynamicLinkResolutionError(
      404,
      "This ASIN is not available in the selected marketplace."
    );
  }

  throw deferredStatusError ??
    new DynamicLinkResolutionError(502, getAmazonProductFetchErrorMessage(deferredFetchError));
}
