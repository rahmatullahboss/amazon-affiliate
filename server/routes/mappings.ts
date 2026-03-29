import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../utils/types';
import { createMappingSchema, bulkMappingSchema } from '../schemas';
import { CacheService } from '../services/cache';
import { getPublicAppOrigin } from '../utils/url';

const mappings = new Hono<AppEnv>();

/**
 * GET /api/mappings — List all agent-product mappings
 */
mappings.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ap.*,
       a.name as agent_name, a.slug as agent_slug,
       p.asin, p.title as product_title, p.image_url,
       t.tag as tracking_tag
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
    c.env.DB.prepare('SELECT id, asin FROM products WHERE id = ? AND is_active = 1')
      .bind(data.product_id).first<{ id: number; asin: string }>(),
    c.env.DB.prepare('SELECT id FROM tracking_ids WHERE id = ? AND agent_id = ? AND is_active = 1')
      .bind(data.tracking_id, data.agent_id).first<{ id: number }>(),
  ]);

  if (!agent) throw new HTTPException(404, { message: 'Agent not found or inactive' });
  if (!product) throw new HTTPException(404, { message: 'Product not found or inactive' });
  if (!trackingId) throw new HTTPException(404, { message: 'Tag not found or not owned by agent' });

  try {
    await c.env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, custom_title)
       VALUES (?, ?, ?, ?)`
    )
      .bind(data.agent_id, data.product_id, data.tracking_id, data.custom_title || null)
      .run();

    // Invalidate cache
    const cache = new CacheService(c.env.KV);
    c.executionCtx.waitUntil(cache.deleteRedirectUrl(agent.slug, product.asin));
    c.executionCtx.waitUntil(cache.deletePageData(agent.slug, product.asin));

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

/**
 * DELETE /api/mappings/:id — Remove mapping
 */
mappings.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) throw new HTTPException(400, { message: 'Invalid mapping ID' });

  const current = await c.env.DB.prepare(
    `SELECT ap.*, a.slug as agent_slug, p.asin
     FROM agent_products ap
     JOIN agents a ON a.id = ap.agent_id
     JOIN products p ON p.id = ap.product_id
     WHERE ap.id = ?`
  )
    .bind(id)
    .first<{ agent_slug: string; asin: string }>();

  if (!current) throw new HTTPException(404, { message: 'Mapping not found' });

  await c.env.DB.prepare('DELETE FROM agent_products WHERE id = ?').bind(id).run();

  const cache = new CacheService(c.env.KV);
  c.executionCtx.waitUntil(cache.deleteRedirectUrl(current.agent_slug, current.asin));
  c.executionCtx.waitUntil(cache.deletePageData(current.agent_slug, current.asin));

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
    `SELECT p.asin, p.title, p.image_url, t.tag, t.marketplace, ap.custom_title
     FROM agent_products ap
     JOIN products p ON p.id = ap.product_id
     JOIN tracking_ids t ON t.id = ap.tracking_id
     WHERE ap.agent_id = (SELECT id FROM agents WHERE slug = ?)
       AND ap.is_active = 1 AND p.is_active = 1`
  )
    .bind(agentSlug)
    .all<{ asin: string; title: string; image_url: string; tag: string; marketplace: string; custom_title: string | null }>();

  const host = getPublicAppOrigin(c.req.url, c.env);
  const links = (results || []).map((r) => ({
    asin: r.asin,
    title: r.custom_title || r.title,
    imageUrl: r.image_url,
    trackingTag: r.tag,
    marketplace: r.marketplace,
    bridgePageUrl: `${host}/${agentSlug}/${r.asin}`,
    directRedirectUrl: `${host}/go/${agentSlug}/${r.asin}`,
  }));

  return c.json({ agent, links });
});

export default mappings;
