import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv, LandingPageData } from '../utils/types';
import { buildAmazonUrl } from '../utils/types';
import { CacheService } from '../services/cache';
import { recordView, hashIp } from '../services/analytics';
import { DynamicLinkResolutionError, ensureDynamicLinkByAgentSlug } from '../services/dynamic-links';

const page = new Hono<AppEnv>();

/**
 * GET /api/page/:agentSlug/:asin — Landing page data
 *
 * Returns product info + Amazon URL for bridge page SSR rendering.
 * In the single-worker architecture, the bridge loader calls this
 * via internal Data directly (D1 access) — NOT over HTTP.
 * This endpoint is kept for API consumers and future flexibility.
 */
page.get('/:agentSlug/:asin', async (c) => {
  const agentSlug = c.req.param('agentSlug');
  const asin = c.req.param('asin');

  if (!agentSlug || !asin) {
    throw new HTTPException(400, { message: 'Missing agent slug or ASIN' });
  }

  const cache = new CacheService(c.env.KV);

  // 1. Check cache
  const cached = await cache.getPageData(agentSlug, asin);
  if (cached) {
    // Record view asynchronously
    c.executionCtx.waitUntil(
      recordViewAsync(c, cached as { agent_id: number; product_id: number } & Record<string, unknown>)
    );
    return c.json(cached);
  }

  const loadPageRow = async () =>
    c.env.DB.prepare(
      `SELECT
         a.slug as agent_slug, a.name as agent_name, a.id as agent_id,
         p.asin, p.title as product_title, p.image_url, p.description, p.features,
         p.product_images, p.aplus_images, p.id as product_id,
         t.tag as tracking_tag, t.marketplace,
         ap.custom_title
       FROM agent_products ap
       JOIN agents a ON a.id = ap.agent_id
       JOIN products p ON p.id = ap.product_id
       JOIN tracking_ids t ON t.id = ap.tracking_id
       WHERE a.slug = ? AND p.asin = ?
         AND ap.is_active = 1 AND a.is_active = 1 AND p.is_active = 1 AND p.status = 'active'
       LIMIT 1`
    )
      .bind(agentSlug, asin)
      .first<{
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
      }>();

  let row = await loadPageRow();

  if (!row) {
    try {
      await ensureDynamicLinkByAgentSlug({
        db: c.env.DB,
        kv: c.env.KV,
        agentSlug,
        asin,
        apiKey: c.env.AMAZON_API_KEY,
        fallbackApiKeys: c.env.AMAZON_API_KEY_FALLBACK ? [c.env.AMAZON_API_KEY_FALLBACK] : [],
      });
    } catch (error) {
      if (error instanceof DynamicLinkResolutionError) {
        throw new HTTPException(error.status, { message: error.message });
      }

      throw error;
    }

    row = await loadPageRow();
  }

  if (!row) {
    throw new HTTPException(404, { message: 'Product page not found' });
  }

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
    })
  );

  // 4. Track view asynchronously
  c.executionCtx.waitUntil(
    recordViewAsync(c, { agent_id: row.agent_id, product_id: row.product_id })
  );

  return c.json(pageData);
});

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
