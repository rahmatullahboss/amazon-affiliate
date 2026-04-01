import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Context } from 'hono';
import type { AppEnv, LandingPageData } from '../utils/types';
import { buildAmazonUrl } from '../utils/types';
import { CacheService } from '../services/cache';
import { recordView, hashIp } from '../services/analytics';
import {
  DynamicLinkResolutionError,
  ensureDynamicLinkByAgentSlug,
  hasAgentMarketplaceCandidate,
  resolveAgentProductBySlug,
  type AgentProductResolution,
} from '../services/dynamic-links';
import { normalizeMarketplaceHint } from '../utils/url';

const page = new Hono<AppEnv>();

/**
 * GET /api/page/:agentSlug/:asin and /api/page/:agentSlug/:country/:asin — Landing page data
 *
 * Returns product info + Amazon URL for bridge page SSR rendering.
 * In the single-worker architecture, the bridge loader calls this
 * via internal Data directly (D1 access) — NOT over HTTP.
 * This endpoint is kept for API consumers and future flexibility.
 */
const handlePageRequest = async (c: Context<AppEnv>) => {
  const agentSlug = c.req.param('agentSlug');
  const asin = c.req.param('asin');
  const countryParam = c.req.param('country');
  const countryMarketplace = countryParam ? normalizeMarketplaceHint(countryParam) : null;

  if (countryParam && !countryMarketplace) {
    throw new HTTPException(404, { message: 'Product page not found' });
  }

  const preferredMarketplace = countryMarketplace ?? normalizeMarketplaceHint(c.req.query('m'));

  if (!agentSlug || !asin) {
    throw new HTTPException(400, { message: 'Missing agent slug or ASIN' });
  }

  const cache = new CacheService(c.env.KV);
  let resolution: AgentProductResolution | null = null;

  if (!preferredMarketplace) {
    resolution = await resolveAgentProductBySlug({
      db: c.env.DB,
      agentSlug,
      asin,
    });
  }

  // 1. Check cache
  const cached = await cache.getPageData(
    agentSlug,
    asin,
    resolution?.resolvedMarketplace ?? preferredMarketplace ?? undefined
  );
  if (cached) {
    // Record view asynchronously
    c.executionCtx.waitUntil(
      recordViewAsync(c, cached as { agent_id: number; product_id: number } & Record<string, unknown>)
    );
    return c.json(cached);
  }

  const loadPageResolution = async (): Promise<AgentProductResolution | null> => {
    const directResolution = await resolveAgentProductBySlug({
      db: c.env.DB,
      agentSlug,
      asin,
      preferredMarketplace,
    });

    if (directResolution) {
      return directResolution;
    }

    if (
      preferredMarketplace &&
      !(await hasAgentMarketplaceCandidate(c.env.DB, agentSlug, preferredMarketplace))
    ) {
      throw new HTTPException(404, { message: 'Product page not found' });
    }

    try {
      await ensureDynamicLinkByAgentSlug({
        db: c.env.DB,
        kv: c.env.KV,
        agentSlug,
        asin,
        preferredMarketplace,
        apiKey: c.env.AMAZON_API_KEY,
        fallbackApiKeys: c.env.AMAZON_API_KEY_FALLBACK ? [c.env.AMAZON_API_KEY_FALLBACK] : [],
      });
    } catch (error) {
      if (error instanceof DynamicLinkResolutionError) {
        throw new HTTPException(error.status, { message: error.message });
      }

      throw error;
    }

    return await resolveAgentProductBySlug({
      db: c.env.DB,
      agentSlug,
      asin,
      preferredMarketplace,
    });
  };

  if (!resolution) {
    resolution = await loadPageResolution();
  }

  if (!resolution) {
    throw new HTTPException(404, { message: 'Product page not found' });
  }

  const row = resolution.row;
  const resolvedMarketplace = resolution.resolvedMarketplace;

  const pageData: LandingPageData = {
    agent: {
      slug: row.agent_slug,
      name: row.agent_name,
    },
    product: {
      asin: row.asin,
      title: row.custom_title || row.product_title,
      imageUrl: row.image_url,
      description: row.description,
      features: parseJsonArray(row.features),
      productImages: parseJsonArray(row.product_images),
      aplusImages: parseJsonArray(row.aplus_images),
    },
    trackingTag: row.tracking_tag,
    amazonUrl: buildAmazonUrl(row.asin, row.tracking_tag, row.marketplace),
    marketplace: row.marketplace,
  };

  // 3. Cache the result
  c.executionCtx.waitUntil(
    cache.setPageData(agentSlug, asin, {
      ...pageData,
      agent_id: row.agent_id,
      product_id: row.product_id,
    }, resolvedMarketplace)
  );

  // 4. Track view asynchronously
  c.executionCtx.waitUntil(
    recordViewAsync(c, { agent_id: row.agent_id, product_id: row.product_id })
  );

  return c.json(pageData);
};

page.get('/:agentSlug/:country/:asin', handlePageRequest);
page.get('/:agentSlug/:asin', handlePageRequest);

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string');
    }
  } catch {
    return [];
  }

  return [];
}

async function recordViewAsync(
  c: { req: { header: (name: string) => string | undefined; raw: Request }; env: { DB: D1Database } },
  data: { agent_id: number; product_id: number }
): Promise<void> {
  try {
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '';
    const ipHash = ip ? await hashIp(ip) : null;
    await recordView(c.env.DB, {
      agentId: data.agent_id,
      productId: data.product_id,
      ipHash,
      userAgent: c.req.header('user-agent') || null,
      referer: c.req.header('referer') || null,
      country: (c.req.raw as unknown as { cf?: { country?: string } }).cf?.country || null,
    });
  } catch (e) {
    console.error('[Page] View tracking error:', e);
  }
}

export default page;
