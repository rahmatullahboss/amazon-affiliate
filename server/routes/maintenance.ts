import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../utils/types';
import { CacheService } from '../services/cache';

const maintenance = new Hono<AppEnv>();

function parsePositiveIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return [...new Set(
    value
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0)
  )];
}

async function invalidateProductCaches(
  env: AppEnv['Bindings'],
  ctx: ExecutionContext,
  products: Array<{ asin: string; marketplace: string }>
) {
  const cache = new CacheService(env.KV);

  for (const product of products) {
    ctx.waitUntil(cache.invalidateForProduct(product.asin));
  }
}

maintenance.post('/mappings/hard-delete', async (c) => {
  const body = await c.req.json<{ mappingIds?: number[] }>().catch(() => ({}));
  const mappingIds = parsePositiveIds(body.mappingIds);

  if (!mappingIds.length) {
    throw new HTTPException(400, { message: 'Select at least one mapping.' });
  }

  if (mappingIds.length > 500) {
    throw new HTTPException(400, { message: 'Max 500 mappings can be deleted at once.' });
  }

  const placeholders = mappingIds.map(() => '?').join(',');
  const { results } = await c.env.DB.prepare(
    `SELECT DISTINCT p.asin, p.marketplace
     FROM agent_products ap
     JOIN products p ON p.id = ap.product_id
     WHERE ap.id IN (${placeholders})`
  )
    .bind(...mappingIds)
    .all<{ asin: string; marketplace: string }>();

  await c.env.DB.prepare(`DELETE FROM agent_products WHERE id IN (${placeholders})`)
    .bind(...mappingIds)
    .run();

  await invalidateProductCaches(c.env, c.executionCtx, results ?? []);

  return c.json({
    message: `Deleted ${mappingIds.length} product tracking mapping${mappingIds.length === 1 ? '' : 's'}.`,
    deleted: mappingIds.length,
  });
});

maintenance.post('/products/hard-delete', async (c) => {
  const body = await c.req.json<{ productIds?: number[] }>().catch(() => ({}));
  const productIds = parsePositiveIds(body.productIds);

  if (!productIds.length) {
    throw new HTTPException(400, { message: 'Select at least one product.' });
  }

  if (productIds.length > 200) {
    throw new HTTPException(400, { message: 'Max 200 products can be deleted at once.' });
  }

  const placeholders = productIds.map(() => '?').join(',');
  const { results: products } = await c.env.DB.prepare(
    `SELECT id, asin, marketplace
     FROM products
     WHERE id IN (${placeholders})`
  )
    .bind(...productIds)
    .all<{ id: number; asin: string; marketplace: string }>();

  const existingProducts = products ?? [];
  if (!existingProducts.length) {
    throw new HTTPException(404, { message: 'No selected products were found.' });
  }

  const existingIds = existingProducts.map((product) => product.id);
  const existingPlaceholders = existingIds.map(() => '?').join(',');

  await c.env.DB.prepare(`DELETE FROM agent_products WHERE product_id IN (${existingPlaceholders})`)
    .bind(...existingIds)
    .run();

  // Click rows can block hard deletion when foreign keys are enabled.
  await c.env.DB.prepare(`DELETE FROM clicks WHERE product_id IN (${existingPlaceholders})`)
    .bind(...existingIds)
    .run()
    .catch(() => undefined);

  await c.env.DB.prepare(`DELETE FROM products WHERE id IN (${existingPlaceholders})`)
    .bind(...existingIds)
    .run();

  await invalidateProductCaches(c.env, c.executionCtx, existingProducts);

  return c.json({
    message: `Permanently deleted ${existingProducts.length} product${existingProducts.length === 1 ? '' : 's'} and their tracking mappings.`,
    deleted: existingProducts.length,
  });
});

maintenance.post('/tracking/hard-delete', async (c) => {
  const body = await c.req.json<{ trackingIds?: number[] }>().catch(() => ({}));
  const trackingIds = parsePositiveIds(body.trackingIds);

  if (!trackingIds.length) {
    throw new HTTPException(400, { message: 'Select at least one tracking tag.' });
  }

  if (trackingIds.length > 200) {
    throw new HTTPException(400, { message: 'Max 200 tracking tags can be deleted at once.' });
  }

  const placeholders = trackingIds.map(() => '?').join(',');
  const { results: affectedProducts } = await c.env.DB.prepare(
    `SELECT DISTINCT p.asin, p.marketplace
     FROM agent_products ap
     JOIN products p ON p.id = ap.product_id
     WHERE ap.tracking_id IN (${placeholders})`
  )
    .bind(...trackingIds)
    .all<{ asin: string; marketplace: string }>();

  await c.env.DB.prepare(`DELETE FROM agent_products WHERE tracking_id IN (${placeholders})`)
    .bind(...trackingIds)
    .run();
  await c.env.DB.prepare(`DELETE FROM agent_slug_aliases WHERE tracking_id IN (${placeholders})`)
    .bind(...trackingIds)
    .run()
    .catch(() => undefined);
  await c.env.DB.prepare(`DELETE FROM tracking_ids WHERE id IN (${placeholders})`)
    .bind(...trackingIds)
    .run();

  await invalidateProductCaches(c.env, c.executionCtx, affectedProducts ?? []);

  return c.json({
    message: `Permanently deleted ${trackingIds.length} tracking tag${trackingIds.length === 1 ? '' : 's'} and their product mappings.`,
    deleted: trackingIds.length,
  });
});

maintenance.post('/cleanup-single-mapping', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ap.id, ap.product_id, p.asin, p.marketplace
     FROM agent_products ap
     JOIN products p ON p.id = ap.product_id
     WHERE ap.is_active = 1
     ORDER BY ap.product_id ASC, ap.updated_at DESC, ap.id DESC`
  ).all<{ id: number; product_id: number; asin: string; marketplace: string }>();

  const activeRows = results ?? [];
  const seenProductIds = new Set<number>();
  const duplicateIds: number[] = [];
  const affectedProducts = new Map<number, { asin: string; marketplace: string }>();

  for (const row of activeRows) {
    if (seenProductIds.has(row.product_id)) {
      duplicateIds.push(row.id);
      affectedProducts.set(row.product_id, { asin: row.asin, marketplace: row.marketplace });
      continue;
    }

    seenProductIds.add(row.product_id);
  }

  if (duplicateIds.length > 0) {
    const placeholders = duplicateIds.map(() => '?').join(',');
    await c.env.DB.prepare(
      `UPDATE agent_products
       SET is_active = 0,
           updated_at = CURRENT_TIMESTAMP
       WHERE id IN (${placeholders})`
    )
      .bind(...duplicateIds)
      .run();
  }

  await invalidateProductCaches(c.env, c.executionCtx, Array.from(affectedProducts.values()));

  return c.json({
    message: duplicateIds.length
      ? `Turned off ${duplicateIds.length} duplicate active tracking mapping${duplicateIds.length === 1 ? '' : 's'}.`
      : 'No duplicate active mappings were found.',
    disabled: duplicateIds.length,
  });
});

export default maintenance;
