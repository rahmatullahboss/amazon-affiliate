import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../utils/types';
import { portalAsinSubmissionSchema } from '../schemas';
import { CacheService } from '../services/cache';

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
     ${whereClause}
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

    const response = await fetch(
      `https://real-time-amazon-data.p.rapidapi.com/product-details?asin=${asin}&country=${marketplace}`,
      {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'real-time-amazon-data.p.rapidapi.com',
        },
      }
    );

    if (!response.ok) {
      throw new HTTPException(502, { message: 'Failed to fetch product from Amazon data provider' });
    }

    const result = (await response.json()) as {
      data?: {
        product_title?: string;
        product_photo?: string;
        product_category?: string;
      };
    };

    if (!result.data?.product_title) {
      throw new HTTPException(404, { message: 'ASIN not found in product data provider' });
    }

    await c.env.DB.prepare(
      `INSERT INTO products (asin, title, image_url, marketplace, category, status, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
      .bind(
        asin,
        result.data.product_title,
        result.data.product_photo || `https://images-na.ssl-images-amazon.com/images/I/${asin}._AC_SL1500_.jpg`,
        marketplace,
        result.data.product_category || null,
        'active'
      )
      .run();

    product = await c.env.DB.prepare(
      'SELECT id, title, image_url, status FROM products WHERE asin = ? AND marketplace = ?'
    )
      .bind(asin, marketplace)
      .first<{ id: number; title: string; image_url: string; status: string }>();
  }

  if (!product) {
    throw new HTTPException(500, { message: 'Product creation failed unexpectedly' });
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
      message: 'Product submitted successfully',
      link: `/${agent.slug}/${asin}`,
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
