import { buildAmazonUrl } from "../utils/types";
import { CacheService } from "./cache";
import {
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
  apiKey?: string;
  fallbackApiKeys?: string[];
}

interface ProductRouteContext {
  id: number;
  title: string;
  image_url: string;
  status: string;
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
      cache.deletePageData(input.tracking.agentSlug, input.asin),
      cache.deleteRedirectUrl(input.tracking.agentSlug, input.asin),
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
       WHERE a.slug = ?
         AND a.is_active = 1
         AND t.is_active = 1
       ORDER BY t.is_default DESC, t.created_at ASC`
    )
    .bind(normalizedAgentSlug)
    .all<TrackingRouteContext>();

  const trackingCandidates = results ?? [];
  if (trackingCandidates.length === 0) {
    throw new DynamicLinkResolutionError(
      404,
      "No active tracking tag was found for this link. Ask admin to review the agent setup."
    );
  }

  let deferredStatusError: DynamicLinkResolutionError | null = null;
  let deferredFetchError: unknown = null;

  for (const tracking of trackingCandidates) {
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
    throw deferredStatusError ?? new DynamicLinkResolutionError(
      503,
      "Amazon product API is not configured. Dynamic ASIN links need live product data."
    );
  }

  const attemptedMarketplaces = new Set<string>();

  for (const tracking of trackingCandidates) {
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
      if (error instanceof DynamicLinkResolutionError) {
        deferredStatusError = deferredStatusError ?? error;
        continue;
      }

      deferredFetchError = deferredFetchError ?? error;
      continue;
    }
  }

  throw deferredStatusError ??
    new DynamicLinkResolutionError(502, getAmazonProductFetchErrorMessage(deferredFetchError));
}
