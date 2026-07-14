import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../utils/types';
import {
  createMappingSchema,
  bulkAssignMappingsSchema,
  bulkMappingSchema,
  bulkReplaceMappingTrackingSchema,
  updateMappingSchema,
} from '../schemas';
import { CacheService } from '../services/cache';
import { writeAuditLog } from '../services/audit-log';
import {
  buildCanonicalBridgeUrl,
  buildCanonicalRedirectUrl,
  getPublicAppOrigin,
} from '../utils/url';

const mappings = new Hono<AppEnv>();

interface MappingCacheRow {
  id: number;
  agent_slug: string;
  asin: string;
  marketplace: string;
}

async function getProductMappingCacheRows(
  db: D1Database,
  productId: number
): Promise<MappingCacheRow[]> {
  const { results } = await db.prepare(
    `SELECT ap.id,
       a.slug as agent_slug,
       p.asin,
       p.marketplace
     FROM agent_products ap
     JOIN agents a ON a.id = ap.agent_id
     JOIN products p ON p.id = ap.product_id
     WHERE ap.product_id = ?`
  )
    .bind(productId)
    .all<MappingCacheRow>();

  return results ?? [];
}

async function invalidateCacheRows(
  env: AppEnv['Bindings'],
  executionCtx: ExecutionContext,
  rows: MappingCacheRow[]
) {
  const cache = new CacheService(env.KV);
  const seen = new Set<string>();

  for (const row of rows) {
    const key = `${row.agent_slug}|${row.asin}|${row.marketplace}`;
    if (seen.has(key)) continue;
    seen.add(key);

    executionCtx.waitUntil(cache.deleteRedirectUrl(row.agent_slug, row.asin, row.marketplace));
    executionCtx.waitUntil(cache.deletePageData(row.agent_slug, row.asin, row.marketplace));
  }
}

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

async function keepOnlyOneActiveMappingForProduct(
  db: D1Database,
  productId: number,
  keepMappingId: number
) {
  await db.prepare(
    `UPDATE agent_products
     SET is_active = 0,
         updated_at = CURRENT_TIMESTAMP
     WHERE product_id = ? AND id != ? AND is_active = 1`
  )
    .bind(productId, keepMappingId)
    .run();
}

async function fetchMappingByAgentProduct(
  db: D1Database,
  agentId: number,
  productId: number
) {
  return db.prepare(
    `SELECT ap.*,
       a.name as agent_name, a.slug as agent_slug,
       p.asin, p.title as product_title, p.image_url,
       p.marketplace as product_marketplace,
       t.tag as tracking_tag,
       t.is_active as tracking_is_active,
       t.marketplace as tracking_marketplace
     FROM agent_products ap
     JOIN agents a ON a.id = ap.agent_id
     JOIN products p ON p.id = ap.product_id
     JOIN tracking_ids t ON t.id = ap.tracking_id
     WHERE ap.agent_id = ? AND ap.product_id = ?`
  )
    .bind(agentId, productId)
    .first<{ id: number } & Record<string, unknown>>();
}

/**
 * GET /api/mappings — List active agent-product mappings
 */
mappings.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ap.*,
       a.name as agent_name, a.slug as agent_slug,
       p.asin, p.title as product_title, p.image_url,
       p.marketplace as product_marketplace,
       t.tag as tracking_tag,
       t.is_active as tracking_is_active,
       t.marketplace as tracking_marketplace
     FROM agent_products ap
     JOIN agents a ON a.id = ap.agent_id
     JOIN products p ON p.id = ap.product_id
     JOIN tracking_ids t ON t.id = ap.tracking_id
     WHERE ap.is_active = 1
     ORDER BY ap.updated_at DESC, ap.created_at DESC`
  ).all();

  return c.json({ mappings: results });
});

/**
 * POST /api/mappings — Create/replace product mapping.
 * Single-tracking mode: one active mapping per product.
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

  const previousRows = await getProductMappingCacheRows(c.env.DB, product.id);

  try {
    await c.env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, custom_title, is_active)
       VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(agent_id, product_id) DO UPDATE SET
         tracking_id = excluded.tracking_id,
         custom_title = excluded.custom_title,
         is_active = 1,
         updated_at = CURRENT_TIMESTAMP`
    )
      .bind(data.agent_id, data.product_id, data.tracking_id, data.custom_title || null)
      .run();

    const mapping = await fetchMappingByAgentProduct(c.env.DB, data.agent_id, data.product_id);
    if (!mapping) {
      throw new HTTPException(500, { message: 'Mapping was not saved.' });
    }

    await keepOnlyOneActiveMappingForProduct(c.env.DB, product.id, Number(mapping.id));
    await invalidateCacheRows(c.env, c.executionCtx, previousRows);
    await invalidateMappingCaches(c.env, c.executionCtx, agent.slug, [product]);

    return c.json({
      mapping,
      message: 'Tracking mapping saved. Other active mappings for this product were turned off.',
    }, 201);
  } catch (error: unknown) {
    if (error instanceof HTTPException) throw error;
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
      const previousRows = await getProductMappingCacheRows(c.env.DB, item.product_id);
      await c.env.DB.prepare(
        `INSERT INTO agent_products (agent_id, product_id, tracking_id, custom_title, is_active)
         VALUES (?, ?, ?, ?, 1)
         ON CONFLICT(agent_id, product_id) DO UPDATE SET
           tracking_id = excluded.tracking_id,
           custom_title = excluded.custom_title,
           is_active = 1,
           updated_at = CURRENT_TIMESTAMP`
      )
        .bind(item.agent_id, item.product_id, item.tracking_id, item.custom_title || null)
        .run();

      const mapping = await c.env.DB.prepare(
        `SELECT id FROM agent_products WHERE agent_id = ? AND product_id = ?`
      )
        .bind(item.agent_id, item.product_id)
        .first<{ id: number }>();

      if (mapping) {
        await keepOnlyOneActiveMappingForProduct(c.env.DB, item.product_id, mapping.id);
      }
      await invalidateCacheRows(c.env, c.executionCtx, previousRows);
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

  const invalidationRows: MappingCacheRow[] = [];

  for (const product of products) {
    invalidationRows.push(...await getProductMappingCacheRows(c.env.DB, product.id));

    await c.env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, custom_title, is_active)
       VALUES (?, ?, ?, NULL, 1)
       ON CONFLICT(agent_id, product_id) DO UPDATE SET
         tracking_id = excluded.tracking_id,
         is_active = 1,
         updated_at = CURRENT_TIMESTAMP`
    )
      .bind(data.agent_id, product.id, data.tracking_id)
      .run();

    const mapping = await c.env.DB.prepare(
      `SELECT id FROM agent_products WHERE agent_id = ? AND product_id = ?`
    )
      .bind(data.agent_id, product.id)
      .first<{ id: number }>();

    if (mapping) {
      await keepOnlyOneActiveMappingForProduct(c.env.DB, product.id, mapping.id);
    }
  }

  await invalidateCacheRows(c.env, c.executionCtx, invalidationRows);
  await invalidateMappingCaches(c.env, c.executionCtx, agent.slug, products);

  return c.json({
    message: 'Tracking replaced for selected products. Only one active tracking mapping is kept per product.',
    summary: {
      updated: products.length,
      marketplace: tracking.marketplace,
    },
  });
});

mappings.post('/bulk-replace-tag', zValidator('json', bulkReplaceMappingTrackingSchema), async (c) => {
  const data = c.req.valid('json');

  if (data.source_tracking_id && data.target_tracking_id) {
    if (data.source_tracking_id === data.target_tracking_id) {
      throw new HTTPException(400, { message: 'Source and target tags must be different' });
    }

    const [source, target] = await Promise.all([
      c.env.DB.prepare(
        `SELECT id, agent_id, tag, marketplace
         FROM tracking_ids
         WHERE id = ?`
      )
        .bind(data.source_tracking_id)
        .first<{ id: number; agent_id: number; tag: string; marketplace: string }>(),
      c.env.DB.prepare(
        `SELECT id, agent_id, tag, marketplace
         FROM tracking_ids
         WHERE id = ? AND is_active = 1`
      )
        .bind(data.target_tracking_id)
        .first<{ id: number; agent_id: number; tag: string; marketplace: string }>(),
    ]);

    if (!source) throw new HTTPException(404, { message: 'Source tag not found' });
    if (!target) throw new HTTPException(404, { message: 'Target tag not found or inactive' });
    if (source.marketplace !== target.marketplace) {
      throw new HTTPException(400, {
        message: `Source and target tags are in different marketplaces: ${source.marketplace} vs ${target.marketplace}`,
      });
    }

    const targetAgent = await c.env.DB.prepare(
      `SELECT id, slug
       FROM agents
       WHERE id = ? AND is_active = 1`
    )
      .bind(target.agent_id)
      .first<{ id: number; slug: string }>();

    if (!targetAgent) {
      throw new HTTPException(404, { message: 'Target tag owner is inactive or missing' });
    }

    const whereClauses = ['ap.tracking_id = ?', 'ap.is_active = 1', 'p.is_active = 1'];
    const bindings: Array<string | number> = [source.id];
    if (data.mapping_ids?.length) {
      whereClauses.push(`ap.id IN (${data.mapping_ids.map(() => '?').join(', ')})`);
      bindings.push(...data.mapping_ids);
    }

    const { results: rows } = await c.env.DB.prepare(
      `SELECT ap.id as mapping_id,
              ap.product_id,
              a.slug as agent_slug,
              p.asin,
              p.marketplace
       FROM agent_products ap
       JOIN agents a ON a.id = ap.agent_id
       JOIN products p ON p.id = ap.product_id
       WHERE ${whereClauses.join(' AND ')}`
    )
      .bind(...bindings)
      .all<MappingCacheRow & { mapping_id: number; product_id: number }>();

    const matchedRows = rows ?? [];
    const targetCacheRows: MappingCacheRow[] = [];

    for (const row of matchedRows) {
      let keepMappingId = row.mapping_id;

      if (source.agent_id === target.agent_id) {
        await c.env.DB.prepare(
          `UPDATE agent_products
           SET tracking_id = ?,
               is_active = 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
          .bind(target.id, row.mapping_id)
          .run();
      } else {
        const existingTargetMapping = await c.env.DB.prepare(
          `SELECT id
           FROM agent_products
           WHERE agent_id = ? AND product_id = ?`
        )
          .bind(target.agent_id, row.product_id)
          .first<{ id: number }>();

        if (existingTargetMapping) {
          keepMappingId = existingTargetMapping.id;
          await c.env.DB.prepare(
            `UPDATE agent_products
             SET tracking_id = ?,
                 is_active = 1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
          )
            .bind(target.id, existingTargetMapping.id)
            .run();
        } else {
          await c.env.DB.prepare(
            `UPDATE agent_products
             SET agent_id = ?,
                 tracking_id = ?,
                 is_active = 1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
          )
            .bind(target.agent_id, target.id, row.mapping_id)
            .run();
        }
      }

      await keepOnlyOneActiveMappingForProduct(c.env.DB, row.product_id, keepMappingId);
      targetCacheRows.push({
        id: keepMappingId,
        agent_slug: targetAgent.slug,
        asin: row.asin,
        marketplace: row.marketplace,
      });
    }

    await invalidateCacheRows(c.env, c.executionCtx, [...matchedRows, ...targetCacheRows]);
    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        userId: c.get('userId'),
        action: 'mapping.bulk_replaced_tag',
        entityType: 'tracking_id',
        entityId: source.id,
        details: {
          sourceTrackingId: source.id,
          targetTrackingId: target.id,
          updated: matchedRows.length,
        },
      })
    );

    return c.json({
      message: `Replaced source tag on ${matchedRows.length} mappings`,
      summary: {
        matched: matchedRows.length,
        updated: matchedRows.length,
        skippedMissingReplacement: 0,
        marketplace: source.marketplace,
      },
    });
  }

  const oldTrackingTags = [...new Set(data.old_tracking_tags)];
  const whereClauses = [`old_track.tag IN (${oldTrackingTags.map(() => '?').join(', ')})`];
  const bindings: Array<string | number> = [...oldTrackingTags];

  if (data.marketplace !== 'ALL') {
    whereClauses.push('p.marketplace = ?');
    bindings.push(data.marketplace);
  }

  if (data.mapping_ids?.length) {
    whereClauses.push(`ap.id IN (${data.mapping_ids.map(() => '?').join(', ')})`);
    bindings.push(...data.mapping_ids);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT
       ap.id as mapping_id,
       ap.product_id,
       a.id as agent_id,
       a.slug as agent_slug,
       p.asin,
       p.marketplace,
       replacement.id as replacement_tracking_id
     FROM agent_products ap
     JOIN tracking_ids old_track ON old_track.id = ap.tracking_id
     JOIN agents a ON a.id = ap.agent_id
     JOIN products p ON p.id = ap.product_id
     LEFT JOIN tracking_ids replacement
       ON replacement.agent_id = ap.agent_id
      AND replacement.marketplace = p.marketplace
      AND replacement.tag = ?
      AND replacement.is_active = 1
     WHERE ${whereClauses.join(' AND ')}
       AND ap.is_active = 1
       AND p.is_active = 1`
  )
    .bind(data.new_tracking_tag, ...bindings)
    .all<{
      mapping_id: number;
      product_id: number;
      agent_id: number;
      agent_slug: string;
      asin: string;
      marketplace: string;
      replacement_tracking_id: number | null;
    }>();

  const matches = results ?? [];
  const rowsToUpdate = matches.filter((row) => Boolean(row.replacement_tracking_id));
  const skippedRows = matches.filter((row) => !row.replacement_tracking_id);

  for (const row of rowsToUpdate) {
    await c.env.DB.prepare(
      `UPDATE agent_products
       SET tracking_id = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
      .bind(row.replacement_tracking_id, row.mapping_id)
      .run();

    await keepOnlyOneActiveMappingForProduct(c.env.DB, row.product_id, row.mapping_id);
  }

  const cache = new CacheService(c.env.KV);
  const invalidated = new Set<string>();

  for (const row of rowsToUpdate) {
    const key = `${row.agent_slug}|${row.asin}|${row.marketplace}`;
    if (invalidated.has(key)) continue;

    invalidated.add(key);
    c.executionCtx.waitUntil(cache.deleteRedirectUrl(row.agent_slug, row.asin, row.marketplace));
    c.executionCtx.waitUntil(cache.deletePageData(row.agent_slug, row.asin, row.marketplace));
  }

  return c.json({
    message: `Updated ${rowsToUpdate.length} mappings from ${oldTrackingTags.join(', ')} to ${data.new_tracking_tag}.`,
    summary: {
      matched: matches.length,
      updated: rowsToUpdate.length,
      skippedMissingReplacement: skippedRows.length,
      marketplace: data.marketplace,
    },
    skipped: skippedRows.slice(0, 50).map((row) => ({
      mappingId: row.mapping_id,
      asin: row.asin,
      agentSlug: row.agent_slug,
      marketplace: row.marketplace,
      reason: 'Replacement tag was not found for this agent + marketplace.',
    })),
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
      `SELECT id, marketplace
       FROM tracking_ids
       WHERE id = ? AND agent_id = ? AND is_active = 1`
    )
      .bind(data.tracking_id, current.agent_id)
      .first<{ id: number; marketplace: string }>();

    if (!tracking) {
      throw new HTTPException(404, { message: 'Selected tracking tag not found or inactive' });
    }

    if (tracking.marketplace !== current.marketplace) {
      throw new HTTPException(400, { message: `Selected tag is for ${tracking.marketplace}. Choose a ${current.marketplace} tag.` });
    }

    nextTrackingId = tracking.id;
  }

  const previousRows = await getProductMappingCacheRows(c.env.DB, current.product_id);

  await c.env.DB.prepare(
    `UPDATE agent_products
     SET tracking_id = ?,
         custom_title = ?,
         show_on_homepage = ?,
         is_active = 1,
         updated_at = CURRENT_TIMESTAMP
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

  await keepOnlyOneActiveMappingForProduct(c.env.DB, current.product_id, id);
  await invalidateCacheRows(c.env, c.executionCtx, previousRows);
  await invalidateMappingCaches(c.env, c.executionCtx, current.agent_slug, [
    { asin: current.asin, marketplace: current.marketplace },
  ]);

  const mapping = await c.env.DB.prepare(
    `SELECT ap.*,
       a.name as agent_name, a.slug as agent_slug,
       p.asin, p.title as product_title, p.image_url,
       p.marketplace as product_marketplace,
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

  return c.json({ mapping, message: 'Mapping updated. Only one active mapping is kept for this product.' });
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
       AND ap.is_active = 1 AND p.is_active = 1 AND p.is_adult = 0`
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
