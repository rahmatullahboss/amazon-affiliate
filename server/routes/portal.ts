import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../utils/types';
import { portalAsinSubmissionSchema } from '../schemas';
import { CacheService } from '../services/cache';
import { ensureProductRecord } from '../services/product-ingestion';

const portal = new Hono<AppEnv>();

portal.get('/me', async (c) => {
  const userId = c.get('userId');
  const role = c.get('userRole');
  const agentId = c.get('agentId');

  const user = await c.env.DB.prepare(
    `SELECT u.id, u.username, u.email, u.role, u.agent_id,
            a.name as agent_name, a.slug as agent_slug
     FROM users u
     LEFT JOIN agents a ON a.id = u.agent_id
     WHERE u.id = ?`
  )
    .bind(userId)
    .first<{
      id: number;
      username: string;
      email: string | null;
      role: string;
      agent_id: number | null;
      agent_name: string | null;
      agent_slug: string | null;
    }>();

  return c.json({
    user,
    context: { role, agentId },
  });
});

portal.get('/products', async (c) => {
  const role = c.get('userRole');
  const agentId = c.get('agentId');

  if (role === 'agent' && !agentId) {
    throw new HTTPException(403, { message: 'Agent account is not linked to an agent profile' });
  }

  const bindings = role === 'agent' ? [agentId] : [];
  const whereClause = role === 'agent' ? 'WHERE ap.agent_id = ?' : '';

  const { results } = await c.env.DB.prepare(
    `SELECT ap.id, ap.custom_title, ap.created_at, ap.updated_at,
            p.id as product_id, p.asin, p.marketplace, p.title, p.image_url, p.status,
            a.id as agent_id, a.name as agent_name, a.slug as agent_slug,
            t.tag as tracking_tag
     FROM agent_products ap
     JOIN products p ON p.id = ap.product_id
     JOIN agents a ON a.id = ap.agent_id
     JOIN tracking_ids t ON t.id = ap.tracking_id
     ${whereClause}
     ORDER BY ap.created_at DESC`
  )
    .bind(...bindings)
    .all();

  return c.json({ products: results ?? [] });
});

portal.get('/links', async (c) => {
  const role = c.get('userRole');
  const agentId = c.get('agentId');

  if (role === 'agent' && !agentId) {
    throw new HTTPException(403, { message: 'Agent account is not linked to an agent profile' });
  }

  const bindings = role === 'agent' ? [agentId] : [];
  const whereClause = role === 'agent' ? 'WHERE ap.agent_id = ?' : '';
  const origin = new URL(c.req.url).origin;

  const { results } = await c.env.DB.prepare(
    `SELECT a.slug as agent_slug, a.name as agent_name,
            p.asin, p.marketplace, p.title, p.image_url,
            ap.custom_title, t.tag as tracking_tag
     FROM agent_products ap
     JOIN agents a ON a.id = ap.agent_id
     JOIN products p ON p.id = ap.product_id
     JOIN tracking_ids t ON t.id = ap.tracking_id
     ${whereClause}${whereClause ? ' AND' : ' WHERE'} p.status = 'active' AND p.is_active = 1
     ORDER BY ap.created_at DESC`
  )
    .bind(...bindings)
    .all<{
      agent_slug: string;
      agent_name: string;
      asin: string;
      marketplace: string;
      title: string;
      image_url: string;
      custom_title: string | null;
      tracking_tag: string;
    }>();

  const links = (results ?? []).map((row) => ({
    agentSlug: row.agent_slug,
    agentName: row.agent_name,
    asin: row.asin,
    marketplace: row.marketplace,
    title: row.custom_title || row.title,
    imageUrl: row.image_url,
    trackingTag: row.tracking_tag,
    bridgePageUrl: `${origin}/${row.agent_slug}/${row.asin}`,
    redirectUrl: `${origin}/go/${row.agent_slug}/${row.asin}`,
  }));

  return c.json({ links });
});

portal.get('/performance', async (c) => {
  const role = c.get('userRole');
  const agentId = c.get('agentId');

  if (role !== 'agent' || !agentId) {
    throw new HTTPException(403, { message: 'Only linked agent accounts can view performance' });
  }

  const [clicks, views, topProducts, salesTotals, recentClicks] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as count FROM clicks WHERE agent_id = ?')
      .bind(agentId)
      .first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM page_views WHERE agent_id = ?')
      .bind(agentId)
      .first<{ count: number }>(),
    c.env.DB.prepare(
      `SELECT p.asin, p.title, COUNT(c.id) as clicks
       FROM clicks c
       JOIN products p ON p.id = c.product_id
       WHERE c.agent_id = ?
       GROUP BY p.id
       ORDER BY clicks DESC
       LIMIT 8`
    )
      .bind(agentId)
      .all<{ asin: string; title: string; clicks: number }>(),
    c.env.DB.prepare(
      `SELECT
         COALESCE(SUM(ac.ordered_items), 0) as ordered_items,
         COALESCE(SUM(ac.revenue_amount), 0) as revenue_amount,
         COALESCE(SUM(ac.commission_amount), 0) as commission_amount
       FROM amazon_conversions ac
       JOIN tracking_ids t ON t.tag = ac.tracking_tag AND t.marketplace = ac.marketplace
       WHERE t.agent_id = ?`
    )
      .bind(agentId)
      .first<{ ordered_items: number; revenue_amount: number; commission_amount: number }>(),
    c.env.DB.prepare(
      `SELECT tracking_tag, country, clicked_at
       FROM clicks
       WHERE agent_id = ?
       ORDER BY clicked_at DESC
       LIMIT 20`
    )
      .bind(agentId)
      .all<{ tracking_tag: string; country: string | null; clicked_at: string }>(),
  ]);

  const totalClicks = clicks?.count ?? 0;
  const totalViews = views?.count ?? 0;

  return c.json({
    totalClicks,
    totalViews,
    ctr: totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(2) : '0.00',
    orderedItems: salesTotals?.ordered_items ?? 0,
    revenueAmount: salesTotals?.revenue_amount ?? 0,
    commissionAmount: salesTotals?.commission_amount ?? 0,
    topProducts: topProducts.results ?? [],
    recentClicks: recentClicks.results ?? [],
  });
});

portal.post('/products/submit', zValidator('json', portalAsinSubmissionSchema), async (c) => {
  const role = c.get('userRole');
  const agentId = c.get('agentId');
  const userId = c.get('userId');

  if (role !== 'agent' || !agentId) {
    throw new HTTPException(403, { message: 'Only linked agent accounts can submit ASINs' });
  }

  const { asin, marketplace, custom_title } = c.req.valid('json');

  const agent = await c.env.DB.prepare('SELECT id, slug FROM agents WHERE id = ? AND is_active = 1')
    .bind(agentId)
    .first<{ id: number; slug: string }>();

  if (!agent) {
    throw new HTTPException(404, { message: 'Agent profile not found or inactive' });
  }

  const trackingId = await c.env.DB.prepare(
    `SELECT id
     FROM tracking_ids
     WHERE agent_id = ? AND marketplace = ? AND is_active = 1
     ORDER BY is_default DESC, created_at ASC
     LIMIT 1`
  )
    .bind(agentId, marketplace)
    .first<{ id: number }>();

  if (!trackingId) {
    throw new HTTPException(409, {
      message: `No active tracking ID found for marketplace ${marketplace}. Create one first.`,
    });
  }

  let product = await c.env.DB.prepare(
    'SELECT id, title, image_url, status FROM products WHERE asin = ? AND marketplace = ?'
  )
    .bind(asin, marketplace)
    .first<{ id: number; title: string; image_url: string; status: string }>();

  if (!product) {
    const apiKey = c.env.AMAZON_API_KEY;
    if (!apiKey) {
      throw new HTTPException(503, {
        message: 'AMAZON_API_KEY not configured. Product submission cannot auto-fetch yet.',
      });
    }

    const ensuredProduct = await ensureProductRecord({
      db: c.env.DB,
      asin,
      marketplace,
      apiKey,
      status: 'pending_review',
    });

    product = {
      id: ensuredProduct.id,
      title: ensuredProduct.title,
      image_url: ensuredProduct.image_url,
      status: ensuredProduct.status || 'pending_review',
    };
  }

  if (!product) {
    throw new HTTPException(500, { message: 'Product creation failed unexpectedly' });
  }

  if (product.status === 'rejected') {
    await c.env.DB.prepare(
      `UPDATE products
       SET status = 'pending_review', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
      .bind(product.id)
      .run();

    product.status = 'pending_review';
  }

  await c.env.DB.prepare(
    `INSERT INTO agent_products (agent_id, product_id, tracking_id, custom_title, submitted_by_user_id)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(agent_id, product_id) DO UPDATE SET
       tracking_id = excluded.tracking_id,
       custom_title = excluded.custom_title,
       submitted_by_user_id = excluded.submitted_by_user_id,
       is_active = 1,
       updated_at = CURRENT_TIMESTAMP`
  )
    .bind(agentId, product.id, trackingId.id, custom_title || null, userId)
    .run();

  const cache = new CacheService(c.env.KV);
  c.executionCtx.waitUntil(cache.deletePageData(agent.slug, asin));
  c.executionCtx.waitUntil(cache.deleteRedirectUrl(agent.slug, asin));

  return c.json(
    {
      message:
        product.status === 'active'
          ? 'Product submitted successfully'
          : 'Product submitted and is waiting for admin approval',
      link: `/${agent.slug}/${asin}`,
      status: product.status,
      product: {
        asin,
        marketplace,
        title: custom_title || product.title,
        imageUrl: product.image_url,
      },
    },
    201
  );
});

export default portal;
