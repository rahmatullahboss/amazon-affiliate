import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../utils/types';
import { createProductSchema, fetchAsinSchema, bulkAsinImportSchema, updateProductSchema } from '../schemas';
import { CacheService } from '../services/cache';
import {
  ensureProductRecord,
  fetchAmazonProductData,
  fetchAmazonProductDataWithFallback,
  refreshProductRecord,
} from '../services/product-ingestion';
import { writeAuditLog } from '../services/audit-log';

const products = new Hono<AppEnv>();

/**
 * GET /api/products — List all products
 */
products.get('/', async (c) => {
  const requestedPage = Number.parseInt(c.req.query('page') ?? '1', 10);
  const requestedPageSize = Number.parseInt(c.req.query('pageSize') ?? '12', 10);
  const page = Number.isNaN(requestedPage) ? 1 : Math.max(1, requestedPage);
  const pageSize = Number.isNaN(requestedPageSize)
    ? 12
    : Math.min(48, Math.max(8, requestedPageSize));

  const totalResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM products')
    .first<{ count: number | string }>();

  const totalItems =
    typeof totalResult?.count === 'string'
      ? Number.parseInt(totalResult.count, 10) || 0
      : totalResult?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const normalizedPage = Math.min(page, totalPages);
  const offset = (normalizedPage - 1) * pageSize;

  const [productsResult, summaryResult] = await Promise.all([
    c.env.DB.prepare(
      `SELECT p.*,
         (SELECT COUNT(*) FROM agent_products WHERE product_id = p.id AND is_active = 1) as agent_count,
         (SELECT COUNT(*) FROM clicks WHERE product_id = p.id) as total_clicks
       FROM products p
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`
    )
      .bind(pageSize, offset)
      .all(),
    c.env.DB.prepare(
      `SELECT
         COUNT(*) as total_products,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_products,
         SUM(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END) as pending_review_products,
         SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_products,
         SUM(
           CASE
             WHEN title LIKE '%Amazon Product B0%'
               OR title LIKE 'Product B0%'
               OR image_url LIKE '%images-na.ssl-images-amazon.com%'
             THEN 1
             ELSE 0
           END
         ) as needs_refresh_products
       FROM products`
    ).first<{
      total_products: number;
      active_products: number;
      pending_review_products: number;
      rejected_products: number;
      needs_refresh_products: number;
    }>(),
  ]);

  return c.json({
    products: productsResult.results,
    summary: {
      totalProducts: summaryResult?.total_products ?? 0,
      activeProducts: summaryResult?.active_products ?? 0,
      pendingReviewProducts: summaryResult?.pending_review_products ?? 0,
      rejectedProducts: summaryResult?.rejected_products ?? 0,
      needsRefreshProducts: summaryResult?.needs_refresh_products ?? 0,
    },
    pagination: {
      page: normalizedPage,
      pageSize,
      totalItems,
      totalPages,
    },
  });
});

/**
 * GET /api/products/submissions — Review agent-submitted products
 */
products.get('/submissions', async (c) => {
  const status = c.req.query('status');
  const allowedStatuses = new Set(['pending_review', 'rejected', 'active']);

  if (status && !allowedStatuses.has(status)) {
    throw new HTTPException(400, { message: 'Invalid status filter' });
  }

  const whereClause = status
    ? 'WHERE p.status = ? AND ap.submitted_by_user_id IS NOT NULL'
    : "WHERE p.status != 'active' AND ap.submitted_by_user_id IS NOT NULL";
  const bindings = status ? [status] : [];

  const { results } = await c.env.DB.prepare(
    `SELECT
       p.id,
       p.asin,
       p.title,
       p.image_url,
       p.marketplace,
       p.category,
       p.status,
       p.created_at,
       p.updated_at,
       COUNT(DISTINCT ap.agent_id) as requesting_agents,
       GROUP_CONCAT(DISTINCT a.name) as agent_names,
       GROUP_CONCAT(DISTINCT u.username) as submitted_by
     FROM products p
     JOIN agent_products ap ON ap.product_id = p.id
     LEFT JOIN agents a ON a.id = ap.agent_id
     LEFT JOIN users u ON u.id = ap.submitted_by_user_id
     ${whereClause}
     GROUP BY p.id
     ORDER BY p.updated_at DESC, p.created_at DESC`
  )
    .bind(...bindings)
    .all();

  return c.json({ submissions: results ?? [] });
});

/**
 * POST /api/products — Create product (manual entry)
 */
products.post('/', zValidator('json', createProductSchema), async (c) => {
  const data = c.req.valid('json');

  try {
    await c.env.DB.prepare(
      `INSERT INTO products (asin, title, image_url, marketplace, category)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(data.asin, data.title, data.image_url, data.marketplace, data.category || null)
      .run();

    const product = await c.env.DB.prepare('SELECT * FROM products WHERE asin = ? AND marketplace = ?')
      .bind(data.asin, data.marketplace)
      .first();

    return c.json({ product, message: 'Product created successfully' }, 201);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new HTTPException(409, { message: 'Product ASIN already exists for this marketplace' });
    }
    throw error;
  }
});

/**
 * POST /api/products/fetch-asin — Fetch product data from ASIN API
 */
products.post('/fetch-asin', zValidator('json', fetchAsinSchema), async (c) => {
  const { asin, marketplace } = c.req.valid('json');

  // Check if product already exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM products WHERE asin = ? AND marketplace = ?'
  )
    .bind(asin, marketplace)
    .first();

  if (existing) {
    throw new HTTPException(409, { message: 'Product already exists' });
  }

  const apiKey = c.env.AMAZON_API_KEY;
  if (!apiKey) {
    throw new HTTPException(503, {
      message: 'ASIN fetch API not configured. Please add product manually.',
    });
  }

  try {
    const productData = await fetchAmazonProductDataWithFallback({
      asin,
      marketplace,
      primaryApiKey: apiKey,
      fallbackApiKeys: c.env.AMAZON_API_KEY_FALLBACK ? [c.env.AMAZON_API_KEY_FALLBACK] : [],
    });
    if (!productData) {
      throw new HTTPException(404, { message: 'Product not found on Amazon' });
    }

    const product = await ensureProductRecord({
      db: c.env.DB,
      asin,
      marketplace,
      apiKey,
      fallbackApiKeys: c.env.AMAZON_API_KEY_FALLBACK ? [c.env.AMAZON_API_KEY_FALLBACK] : [],
      title: productData.title,
      imageUrl: productData.imageUrl,
      category: productData.category,
      description: productData.description,
      features: productData.features,
      status: 'active',
      updateExistingFromInput: true,
      requireRealProductData: true,
    });

    return c.json({ product, message: 'Product fetched and saved' }, 201);
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('[Products] ASIN fetch error:', error);
    throw new HTTPException(502, {
      message: 'Failed to fetch product data from API. Try adding manually.',
    });
  }
});

/**
 * POST /api/products/bulk-import — Bulk import ASINs (paste or CSV)
 *
 * Accepts an array of ASINs + marketplace.
 * Uses D1 batch() for atomic performance.
 * Skips duplicates (ON CONFLICT IGNORE).
 */
products.post('/bulk-import', zValidator('json', bulkAsinImportSchema), async (c) => {
  const { asins, marketplace, default_title_prefix } = c.req.valid('json');

  // Deduplicate input
  const uniqueAsins = [...new Set(asins.map((a: string) => a.toUpperCase().trim()))];

  const results: Array<{ asin: string; status: 'created' | 'exists' | 'error'; error?: string }> = [];

  // Use D1 batch for performance (all inserts in one round trip)
  const statements = uniqueAsins.map((asin: string) => {
    const title = default_title_prefix
      ? `${default_title_prefix} - ${asin}`
      : `Product ${asin}`;

    return c.env.DB.prepare(
      `INSERT OR IGNORE INTO products (asin, title, image_url, marketplace)
       VALUES (?, ?, ?, ?)`
    ).bind(
      asin,
      title,
      `https://images-na.ssl-images-amazon.com/images/I/${asin}._AC_SL1500_.jpg`,
      marketplace
    );
  });

  try {
    // D1 batch() — atomic, single round-trip
    const batchResults = await c.env.DB.batch(statements);

    // Check which ones were inserted vs already existed
    for (let i = 0; i < uniqueAsins.length; i++) {
      const meta = batchResults[i]?.meta;
      if (meta && meta.changes > 0) {
        results.push({ asin: uniqueAsins[i], status: 'created' });
      } else {
        results.push({ asin: uniqueAsins[i], status: 'exists' });
      }
    }
  } catch (error) {
    console.error('[Products] Bulk import error:', error);
    throw new HTTPException(500, { message: 'Bulk import failed. Try with fewer ASINs.' });
  }

  const created = results.filter(r => r.status === 'created').length;
  const existed = results.filter(r => r.status === 'exists').length;

  return c.json({
    results,
    summary: {
      total: uniqueAsins.length,
      created,
      already_existed: existed,
      failed: results.filter(r => r.status === 'error').length,
    },
    message: `Imported ${created} new products. ${existed} already existed.`,
  }, 201);
});

/**
 * GET /api/products/export — Export all products as CSV
 */
products.get('/export', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT asin, title, marketplace, category, is_active, created_at FROM products ORDER BY marketplace, asin'
  ).all<{ asin: string; title: string; marketplace: string; category: string | null; is_active: number; created_at: string }>();

  const header = 'ASIN,Title,Marketplace,Category,Active,Created At';
  const rows = (results || []).map(r => {
    const escapedTitle = `"${(r.title || '').replace(/"/g, '""')}"`;
    return `${r.asin},${escapedTitle},${r.marketplace},${r.category || ''},${r.is_active ? 'Yes' : 'No'},${r.created_at}`;
  });

  const csv = [header, ...rows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="dealsrky-products.csv"',
    },
  });
});

products.post('/:id/refresh', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10);
  if (Number.isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid product ID' });
  }

  const apiKey = c.env.AMAZON_API_KEY;
  if (!apiKey) {
    throw new HTTPException(503, {
      message: 'AMAZON_API_KEY not configured. Product refresh is unavailable.',
    });
  }

  const product = await c.env.DB
    .prepare(
      `SELECT id, asin, marketplace, status
       FROM products
       WHERE id = ?`
    )
    .bind(id)
    .first<{ id: number; asin: string; marketplace: string; status: string }>();

  if (!product) {
    throw new HTTPException(404, { message: 'Product not found' });
  }

  try {
    const refreshed = await refreshProductRecord({
      db: c.env.DB,
      apiKey,
      fallbackApiKeys: c.env.AMAZON_API_KEY_FALLBACK ? [c.env.AMAZON_API_KEY_FALLBACK] : [],
      asin: product.asin,
      marketplace: product.marketplace,
      status: product.status || 'active',
    });

    const relatedAgents = await c.env.DB.prepare(
      `SELECT a.slug
       FROM agent_products ap
       JOIN agents a ON a.id = ap.agent_id
       WHERE ap.product_id = ?`
    )
      .bind(id)
      .all<{ slug: string }>();

    const cache = new CacheService(c.env.KV);
    c.executionCtx.waitUntil(cache.invalidateForProduct(product.asin));
    c.executionCtx.waitUntil(
      Promise.all(
        (relatedAgents.results ?? []).flatMap((agent) => [
          cache.deletePageData(agent.slug, product.asin),
          cache.deleteRedirectUrl(agent.slug, product.asin),
        ])
      )
    );

    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        userId: c.get('userId'),
        action: 'product.refreshed',
        entityType: 'product',
        entityId: id,
        details: {
          asin: product.asin,
          marketplace: product.marketplace,
        },
      })
    );

    return c.json({
      product: refreshed,
      message: 'Product refreshed successfully',
    });
  } catch (error) {
    console.error('[Products] Refresh error:', error);
    throw new HTTPException(502, {
      message: 'Could not refresh live product data right now. Please retry later.',
    });
  }
});

/**
 * PUT /api/products/:id — Update a product
 */
products.put('/:id', zValidator('json', updateProductSchema), async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) throw new HTTPException(400, { message: 'Invalid product ID' });

  const body = c.req.valid('json');

  const product = await c.env.DB.prepare('SELECT asin FROM products WHERE id = ?')
    .bind(id).first<{ asin: string }>();
  if (!product) throw new HTTPException(404, { message: 'Product not found' });

  const relatedAgents = await c.env.DB.prepare(
    `SELECT a.slug
     FROM agent_products ap
     JOIN agents a ON a.id = ap.agent_id
     WHERE ap.product_id = ?`
  )
    .bind(id)
    .all<{ slug: string }>();

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (body.title) { updates.push('title = ?'); values.push(body.title); }
  if (body.image_url) { updates.push('image_url = ?'); values.push(body.image_url); }
  if (body.category !== undefined) { updates.push('category = ?'); values.push(body.category); }
  if (body.is_active !== undefined) { updates.push('is_active = ?'); values.push(body.is_active ? 1 : 0); }
  if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status); }

  if (updates.length === 0) {
    throw new HTTPException(400, { message: 'No fields to update' });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  await c.env.DB.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  const cache = new CacheService(c.env.KV);
  c.executionCtx.waitUntil(cache.invalidateForProduct(product.asin));
  c.executionCtx.waitUntil(
    Promise.all(
      (relatedAgents.results ?? []).flatMap((agent) => [
        cache.deletePageData(agent.slug, product.asin),
        cache.deleteRedirectUrl(agent.slug, product.asin),
      ])
    )
  );

  const updated = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();

  c.executionCtx.waitUntil(
    writeAuditLog(c.env.DB, {
      userId: c.get('userId'),
      action: 'product.updated',
      entityType: 'product',
      entityId: id,
      details: {
        titleUpdated: body.title !== undefined,
        imageUpdated: body.image_url !== undefined,
        categoryUpdated: body.category !== undefined,
        isActive: body.is_active,
        status: body.status,
      },
    })
  );

  return c.json({ product: updated, message: 'Product updated' });
});

/**
 * DELETE /api/products/:id — Soft-delete by deactivating
 */
products.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) throw new HTTPException(400, { message: 'Invalid product ID' });

  const product = await c.env.DB.prepare('SELECT asin FROM products WHERE id = ?')
    .bind(id)
    .first<{ asin: string }>();
  if (!product) throw new HTTPException(404, { message: 'Product not found' });

  const relatedAgents = await c.env.DB.prepare(
    `SELECT a.slug
     FROM agent_products ap
     JOIN agents a ON a.id = ap.agent_id
     WHERE ap.product_id = ?`
  )
    .bind(id)
    .all<{ slug: string }>();

  await c.env.DB.prepare('UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(id).run();

  const cache = new CacheService(c.env.KV);
  c.executionCtx.waitUntil(cache.invalidateForProduct(product.asin));
  c.executionCtx.waitUntil(
    Promise.all(
      (relatedAgents.results ?? []).flatMap((agent) => [
        cache.deletePageData(agent.slug, product.asin),
        cache.deleteRedirectUrl(agent.slug, product.asin),
      ])
    )
  );

  return c.json({ message: 'Product deactivated' });
});

/**
 * POST /api/products/enrich — Bulk-enrich products with real Amazon data
 *
 * Fetches real title, image, category, price from RapidAPI
 * for products that still have placeholder data.
 * Rate-limited: processes 5 at a time with 1s delay between batches.
 */
products.post('/enrich', async (c) => {
  const apiKey = c.env.AMAZON_API_KEY;
  if (!apiKey) {
    throw new HTTPException(503, {
      message: 'AMAZON_API_KEY not configured. Add it to .dev.vars or wrangler secrets.',
    });
  }

  // Get optional limit from body (default 20, max 50 per call)
  const body = await c.req.json<{ limit?: number; offset?: number }>().catch(() => ({ limit: 20, offset: 0 }));
  const limit = Math.min(body.limit || 20, 50);
  const offset = body.offset || 0;

  // Find products that still have placeholder titles (generated by seed script)
  const { results: unenriched } = await c.env.DB.prepare(
    `SELECT id, asin, marketplace FROM products
     WHERE (title LIKE '%Amazon Product B0%' OR title LIKE 'Product B0%' OR image_url LIKE '%images-na.ssl-images-amazon.com%')
     AND is_active = 1
     ORDER BY id ASC
     LIMIT ? OFFSET ?`
  ).bind(limit, offset).all<{ id: number; asin: string; marketplace: string }>();

  if (!unenriched || unenriched.length === 0) {
    return c.json({
      message: 'No more products to enrich. All products have real data!',
      enriched: 0,
      failed: 0,
      remaining: 0,
    });
  }

  // Count total remaining
  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM products
     WHERE (title LIKE '%Amazon Product B0%' OR title LIKE 'Product B0%' OR image_url LIKE '%images-na.ssl-images-amazon.com%')
     AND is_active = 1`
  ).first<{ cnt: number }>();
  const totalRemaining = countResult?.cnt || 0;

  const results: Array<{ asin: string; status: 'enriched' | 'not_found' | 'error'; title?: string }> = [];

  // Process in mini-batches of 5 with delay
  const BATCH_SIZE = 5;
  for (let i = 0; i < unenriched.length; i += BATCH_SIZE) {
    const batch = unenriched.slice(i, i + BATCH_SIZE);

    const promises = batch.map(async (product) => {
      try {
        const productData = await fetchAmazonProductDataWithFallback({
          asin: product.asin,
          marketplace: product.marketplace,
          primaryApiKey: apiKey,
          fallbackApiKeys: c.env.AMAZON_API_KEY_FALLBACK ? [c.env.AMAZON_API_KEY_FALLBACK] : [],
        });

        if (!productData) {
          results.push({ asin: product.asin, status: 'error' });
          return;
        }
        const features = JSON.stringify(productData.features.slice(0, 6));

        await c.env.DB.prepare(
          `UPDATE products SET
            title = ?,
            image_url = ?,
            category = ?,
            price = ?,
            original_price = ?,
            rating = ?,
            description = ?,
            features = ?,
            status = ?,
            fetched_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).bind(
          productData.title.substring(0, 500),
          productData.imageUrl || `https://images-na.ssl-images-amazon.com/images/I/${product.asin}._AC_SL1500_.jpg`,
          productData.category || null,
          '',
          '',
          4.5,
          (productData.description || '').substring(0, 2000),
          features,
          'active',
          product.id
        ).run();

        results.push({ asin: product.asin, status: 'enriched', title: productData.title.substring(0, 80) });
      } catch (err) {
        console.error(`[Enrich] Failed for ${product.asin}:`, err);
        results.push({ asin: product.asin, status: 'error' });
      }
    });

    await Promise.all(promises);

    // Rate-limit delay between batches (skip after last batch)
    if (i + BATCH_SIZE < unenriched.length) {
      await new Promise(r => setTimeout(r, 1200));
    }
  }

  const enriched = results.filter(r => r.status === 'enriched').length;
  const failed = results.filter(r => r.status !== 'enriched').length;

  return c.json({
    message: `Enriched ${enriched}/${unenriched.length} products. ${totalRemaining - enriched} still remaining.`,
    results,
    summary: { enriched, failed, totalRemaining: totalRemaining - enriched },
  });
});

export default products;
