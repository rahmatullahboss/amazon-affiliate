import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../utils/types';
import {
  createMappingSchema,
  bulkAssignMappingsSchema,
  bulkMappingSchema,
  updateMappingSchema,
} from '../schemas';
import { CacheService } from '../services/cache';
import {
  buildCanonicalBridgeUrl,
  buildCanonicalRedirectUrl,
  getPublicAppOrigin,
} from '../utils/url';

const mappings = new Hono<AppEnv>();

async function invalidateMappingCaches(
  env: AppEnv['Bindings'],
  executionCtx: ExecutionContext,
  agentSlug: string,
  products: Array<{ asin: string; marketplace: string }>
) {
  const cache = new CacheService(env.KV);

  for (const product of products) {
    executionCtx.waitUntil(cache.deleteRedirectUrl(agentSlug, product.asin, product.marketplace));
    executionCtx.waitUntil(cache.deletePageData(agentSlug, product.asin, product.marketplace));
  }
}

/**
 * GET /api/mappings — List all agent-product mappings
 */
mappings.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ap.*,
       a.name as agent_name, a.slug as agent_slug,
       p.asin, p.title as product_title, p.image_url,
       t.tag as tracking_tag,
       t.is_active as tracking_is_active,
       t.marketplace as tracking_marketplace
     FROM agent_products ap
     JOIN agents a ON a.id = ap.agent_id
     JOIN products p ON p.id = ap.product_id
     JOIN tracking_ids t ON t.id = ap.tracking_id
     ORDER BY ap.created_at DESC`
  ).all();

  return c.json({ mappings: results });
});

/**
 * POST /api/mappings — Create agent-product mapping
 */
mappings.post('/', zValidator('json', createMappingSchema), async (c) => {
  const data = c.req.valid('json');

  const [agent, product, trackingId] = await Promise.all([
    c.env.DB.prepare('SELECT id, slug FROM agents WHERE id = ? AND is_active = 1')
      .bind(data.agent_id).first<{ id: number; slug: string }>(),
    c.env.DB.prepare('SELECT id, asin, marketplace FROM products WHERE id = ? AND is_active = 1')
      .bind(data.product_id).first<{ id: number; asin: string; marketplace: string }>(),
    c.env.DB.prepare('SELECT id, marketplace FROM tracking_ids WHERE id = ? AND agent_id = ? AND is_active = 1')
      .bind(data.tracking_id, data.agent_id).first<{ id: number; marketplace: string }>(),
  ]);

  if (!agent) throw new HTTPException(404, { message: 'Agent not found or inactive' });
  if (!product) throw new HTTPException(404, { message: 'Product not found or inactive' });
  if (!trackingId) throw new HTTPException(404, { message: 'Tag not found or not owned by agent' });
  if (trackingId.marketplace !== product.marketplace) {
    throw new HTTPException(400, {
      message: `Selected tag is for ${trackingId.marketplace}. Choose a ${product.marketplace} tag for this product.`,
    });
  }

  try {
    await c.env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, custom_title, is_active)
       VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(agent_id, product_id) DO UPDATE SET
         tracking_id = excluded.tracking_id,
         custom_title = excluded.custom_title,
         is_active = 1`
    )
      .bind(data.agent_id, data.product_id, data.tracking_id, data.custom_title || null)
      .run();

    // Invalidate cache
    const cache = new CacheService(c.env.KV);
    c.executionCtx.waitUntil(cache.deleteRedirectUrl(agent.slug, product.asin, product.marketplace));
    c.executionCtx.waitUntil(cache.deletePageData(agent.slug, product.asin, product.marketplace));

    const mapping = await c.env.DB.prepare(
      `SELECT ap.*,
         a.name as agent_name, a.slug as agent_slug,
         p.asin, p.title as product_title,
         t.tag as tracking_tag
       FROM agent_products ap
       JOIN agents a ON a.id = ap.agent_id
       JOIN products p ON p.id = ap.product_id
       JOIN tracking_ids t ON t.id = ap.tracking_id
       WHERE ap.agent_id = ? AND ap.product_id = ?`
    )
      .bind(data.agent_id, data.product_id)
      .first();

    return c.json({ mapping, message: 'Mapping created successfully' }, 201);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new HTTPException(409, { message: 'This agent-product mapping already exists' });
    }
    throw error;
  }
});

/**
 * POST /api/mappings/bulk — Bulk create mappings
 */
mappings.post('/bulk', zValidator('json', bulkMappingSchema), async (c) => {
  const { mappings: items } = c.req.valid('json');
  const results: Array<{ agentId: number; productId: number; status: string; error?: string }> = [];

  for (const item of items) {
    try {
      await c.env.DB.prepare(
        `INSERT INTO agent_products (agent_id, product_id, tracking_id, custom_title)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(agent_id, product_id) DO UPDATE SET
           tracking_id = excluded.tracking_id,
           custom_title = excluded.custom_title,
           is_active = 1`
      )
        .bind(item.agent_id, item.product_id, item.tracking_id, item.custom_title || null)
        .run();
      results.push({ agentId: item.agent_id, productId: item.product_id, status: 'success' });
    } catch (error: unknown) {
      results.push({
        agentId: item.agent_id,
        productId: item.product_id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return c.json({
    results,
    summary: {
      total: items.length,
      success: results.filter((r) => r.status === 'success').length,
      failed: results.filter((r) => r.status === 'failed').length,
    },
  });
});

mappings.post('/bulk-assign', zValidator('json', bulkAssignMappingsSchema), async (c) => {
  const data = c.req.valid('json');

  const agent = await c.env.DB.prepare(
    `SELECT id, slug
     FROM agents
     WHERE id = ? AND is_active = 1`
  )
    .bind(data.agent_id)
    .first<{ id: number; slug: string }>();

  if (!agent) {
    throw new HTTPException(404, { message: 'Agent not found or inactive' });
  }

  const tracking = await c.env.DB.prepare(
    `SELECT id, marketplace
     FROM tracking_ids
     WHERE id = ? AND agent_id = ? AND is_active = 1`
  )
    .bind(data.tracking_id, data.agent_id)
    .first<{ id: number; marketplace: string }>();

  if (!tracking) {
    throw new HTTPException(404, { message: 'Selected tracking tag not found or inactive' });
  }

  const productPlaceholders = data.product_ids.map(() => '?').join(', ');
  const productStatement = c.env.DB.prepare(
    `SELECT id, asin, marketplace
     FROM products
     WHERE id IN (${productPlaceholders}) AND is_active = 1`
  );
  const { results } = await productStatement.bind(...data.product_ids).all<{
    id: number;
    asin: string;
    marketplace: string;
  }>();

  const products = results || [];
  if (products.length !== data.product_ids.length) {
    throw new HTTPException(400, { message: 'Some selected products are missing or inactive' });
  }

  const incompatibleProducts = products.filter(
    (product) => product.marketplace !== tracking.marketplace
  );
  if (incompatibleProducts.length > 0) {
    throw new HTTPException(400, {
      message: `Selected tag is for ${tracking.marketplace}. Remove products from other marketplaces before bulk assigning.`,
    });
  }

  for (const product of products) {
    await c.env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, custom_title, is_active)
       VALUES (?, ?, ?, NULL, 1)
       ON CONFLICT(agent_id, product_id) DO UPDATE SET
         tracking_id = excluded.tracking_id,
         is_active = 1`
    )
      .bind(data.agent_id, product.id, data.tracking_id)
      .run();
  }

  await invalidateMappingCaches(c.env, c.executionCtx, agent.slug, products);

  return c.json({
    message: 'Tracking tag assigned to selected products',
    summary: {
      updated: products.length,
      marketplace: tracking.marketplace,
    },
  });
});

mappings.put('/:id', zValidator('json', updateMappingSchema), async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) throw new HTTPException(400, { message: 'Invalid mapping ID' });

  const data = c.req.valid('json');
  const current = await c.env.DB.prepare(
    `SELECT ap.id, ap.agent_id, ap.product_id, ap.tracking_id, ap.custom_title, ap.show_on_homepage,
            a.slug as agent_slug, p.asin, p.marketplace
     FROM agent_products ap
     JOIN agents a ON a.id = ap.agent_id
     JOIN products p ON p.id = ap.product_id
     WHERE ap.id = ?`
  )
    .bind(id)
    .first<{
      id: number;
      agent_id: number;
      product_id: number;
      tracking_id: number;
      custom_title: string | null;
      show_on_homepage: number;
      agent_slug: string;
      asin: string;
      marketplace: string;
    }>();

  if (!current) {
    throw new HTTPException(404, { message: 'Mapping not found' });
  }

  let nextTrackingId = current.tracking_id;
  if (data.tracking_id !== undefined) {
    const tracking = await c.env.DB.prepare(
      `SELECT id
       FROM tracking_ids
       WHERE id = ? AND agent_id = ? AND is_active = 1`
    )
      .bind(data.tracking_id, current.agent_id)
      .first<{ id: number }>();

    if (!tracking) {
      throw new HTTPException(404, { message: 'Selected tracking tag not found or inactive' });
    }

    nextTrackingId = tracking.id;
  }

  await c.env.DB.prepare(
    `UPDATE agent_products
     SET tracking_id = ?,
         custom_title = ?,
         show_on_homepage = ?,
         is_active = 1
     WHERE id = ?`
  )
    .bind(
      nextTrackingId,
      data.custom_title === undefined ? current.custom_title : data.custom_title || null,
      data.show_on_homepage === undefined
        ? current.show_on_homepage
        : data.show_on_homepage
          ? 1
          : 0,
      id
    )
    .run();

  await invalidateMappingCaches(c.env, c.executionCtx, current.agent_slug, [
    { asin: current.asin, marketplace: current.marketplace },
  ]);

  const mapping = await c.env.DB.prepare(
    `SELECT ap.*,
       a.name as agent_name, a.slug as agent_slug,
       p.asin, p.title as product_title, p.image_url,
       t.tag as tracking_tag,
       t.is_active as tracking_is_active,
       t.marketplace as tracking_marketplace
     FROM agent_products ap
     JOIN agents a ON a.id = ap.agent_id
     JOIN products p ON p.id = ap.product_id
     JOIN tracking_ids t ON t.id = ap.tracking_id
     WHERE ap.id = ?`
  )
    .bind(id)
    .first();

  return c.json({ mapping, message: 'Mapping updated successfully' });
});

/**
 * DELETE /api/mappings/:id — Remove mapping
 */
mappings.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) throw new HTTPException(400, { message: 'Invalid mapping ID' });

  const current = await c.env.DB.prepare(
    `SELECT ap.*, a.slug as agent_slug, p.asin, p.marketplace
     FROM agent_products ap
     JOIN agents a ON a.id = ap.agent_id
     JOIN products p ON p.id = ap.product_id
     WHERE ap.id = ?`
  )
    .bind(id)
    .first<{ agent_slug: string; asin: string; marketplace: string }>();

  if (!current) throw new HTTPException(404, { message: 'Mapping not found' });

  await c.env.DB.prepare('DELETE FROM agent_products WHERE id = ?').bind(id).run();

  await invalidateMappingCaches(c.env, c.executionCtx, current.agent_slug, [
    { asin: current.asin, marketplace: current.marketplace },
  ]);

  return c.json({ message: 'Mapping removed successfully' });
});

/**
 * GET /api/mappings/links/:agentSlug — Generate all shareable links
 */
mappings.get('/links/:agentSlug', async (c) => {
  const agentSlug = c.req.param('agentSlug');

  const agent = await c.env.DB.prepare('SELECT * FROM agents WHERE slug = ? AND is_active = 1')
    .bind(agentSlug).first();
  if (!agent) throw new HTTPException(404, { message: 'Agent not found' });

  const { results } = await c.env.DB.prepare(
    `SELECT p.asin, p.title, p.image_url, t.tag, p.marketplace as product_marketplace, ap.custom_title
     FROM agent_products ap
     JOIN products p ON p.id = ap.product_id
     JOIN tracking_ids t ON t.id = ap.tracking_id
     WHERE ap.agent_id = (SELECT id FROM agents WHERE slug = ?)
       AND ap.is_active = 1 AND p.is_active = 1`
  )
    .bind(agentSlug)
    .all<{
      asin: string;
      title: string;
      image_url: string;
      tag: string;
      product_marketplace: string;
      custom_title: string | null;
    }>();

  const host = getPublicAppOrigin(c.req.url, c.env);
  const links = (results || []).map((r) => ({
    asin: r.asin,
    title: r.custom_title || r.title,
    imageUrl: r.image_url,
    trackingTag: r.tag,
    marketplace: r.product_marketplace,
    bridgePageUrl: buildCanonicalBridgeUrl(host, agentSlug, r.asin, r.product_marketplace),
    directRedirectUrl: buildCanonicalRedirectUrl(host, agentSlug, r.asin, r.product_marketplace),
  }));

  return c.json({ agent, links });
});

export default mappings;
