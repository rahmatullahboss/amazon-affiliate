import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../utils/types';
import {
  ASIN_IMPORT_ENABLED,
  ASIN_IMPORT_PAUSED_MESSAGE,
  BATCH_ASIN_IMPORT_ENABLED,
} from '../utils/asin-import';
import { portalAsinSubmissionSchema, portalTrackingSetupSchema } from '../schemas';
import { CacheService } from '../services/cache';
import {
  ensureProductRecord,
  extractAsinFromInput,
  getAmazonProductFetchErrorMessage,
  hasAmazonProductFetchSource,
} from '../services/product-ingestion';
import {
  buildCanonicalBridgeUrl,
  buildCanonicalRedirectUrl,
  getPublicAppOrigin,
} from '../utils/url';
import { getPublicSlugForTracking } from '../services/public-slugs';

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
  const isAgentRole = role === 'agent';

  if (isAgentRole && !agentId) {
    throw new HTTPException(403, { message: 'Agent account is not linked to an agent profile' });
  }

  const bindings = isAgentRole ? [agentId] : [];
  const whereClause = isAgentRole ? 'WHERE ap.agent_id = ?' : '';
  const origin = getPublicAppOrigin(c.req.url, c.env);

  const { results } = await c.env.DB.prepare(
    `SELECT ap.id, ap.custom_title, ap.created_at, ap.updated_at,
            p.id as product_id, p.asin, p.marketplace, p.title, p.image_url, p.status,
            a.id as agent_id, a.name as agent_name, a.slug as agent_slug,
            t.id as tracking_id
     FROM agent_products ap
     JOIN products p ON p.id = ap.product_id
     JOIN agents a ON a.id = ap.agent_id
     JOIN tracking_ids t ON t.id = ap.tracking_id
     ${whereClause}
     ORDER BY ap.created_at DESC`
  )
    .bind(...bindings)
    .all();

  return c.json({
    products: await Promise.all(
      (results ?? []).map(async (product) => {
        const publicSlug = await getPublicSlugForTracking({
          db: c.env.DB,
          agentId: Number(product.agent_id),
          trackingId: Number(product.tracking_id),
          marketplace: String(product.marketplace),
          fallbackSlug: String(product.agent_slug),
        });

        return {
          ...product,
          bridge_page_url: buildCanonicalBridgeUrl(
            origin,
            publicSlug,
            String(product.asin),
            String(product.marketplace)
          ),
          redirect_url: buildCanonicalRedirectUrl(
            origin,
            publicSlug,
            String(product.asin),
            String(product.marketplace)
          ),
        };
      })
    ),
    importCapabilities: {
      newAsinImportEnabled: ASIN_IMPORT_ENABLED,
      batchAsinImportEnabled: BATCH_ASIN_IMPORT_ENABLED,
    },
    canSubmit: isAgentRole,
  });
});

portal.get('/links', async (c) => {
  const role = c.get('userRole');
  const agentId = c.get('agentId');
  const isAgentRole = role === 'agent';

  if (isAgentRole && !agentId) {
    throw new HTTPException(403, { message: 'Agent account is not linked to an agent profile' });
  }

  const bindings = isAgentRole ? [agentId] : [];
  const whereClause = isAgentRole ? 'WHERE ap.agent_id = ?' : '';
  const origin = getPublicAppOrigin(c.req.url, c.env);

  const { results } = await c.env.DB.prepare(
    `SELECT a.slug as agent_slug, a.id as agent_id, a.name as agent_name,
            t.id as tracking_id,
            p.asin, p.marketplace, p.title, p.image_url,
            ap.custom_title
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
      agent_id: number;
      agent_name: string;
      tracking_id: number;
      asin: string;
      marketplace: string;
      title: string;
      image_url: string;
      custom_title: string | null;
    }>();

  return c.json({
    links: await Promise.all(
      (results ?? []).map(async (row) => {
        const publicSlug = await getPublicSlugForTracking({
          db: c.env.DB,
          agentId: row.agent_id,
          trackingId: row.tracking_id,
          marketplace: row.marketplace,
          fallbackSlug: row.agent_slug,
        });

        return {
          agentSlug: publicSlug,
          agentName: row.agent_name,
          asin: row.asin,
          marketplace: row.marketplace,
          title: row.custom_title || row.title,
          imageUrl: row.image_url,
          bridgePageUrl: buildCanonicalBridgeUrl(origin, publicSlug, row.asin, row.marketplace),
          redirectUrl: buildCanonicalRedirectUrl(origin, publicSlug, row.asin, row.marketplace),
        };
      })
    ),
  });
});

portal.get('/performance', async (c) => {
  const role = c.get('userRole');
  const agentId = c.get('agentId');
  const isAgentRole = role === 'agent';

  if (isAgentRole && !agentId) {
    throw new HTTPException(403, { message: 'Agent account is not linked to an agent profile' });
  }

  const [clicks, views, topProducts, salesTotals, recentClicks, marketplaceBreakdown, tagBreakdown] = isAgentRole
    ? await Promise.all([
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
             COALESCE(
               SUM(
                 CASE
                   WHEN ac.ordered_items > ac.shipped_items THEN ac.ordered_items - ac.shipped_items
                   ELSE 0
                 END
               ),
               0
             ) as returned_items,
             COALESCE(SUM(ac.revenue_amount), 0) as revenue_amount,
             COALESCE(SUM(ac.commission_amount), 0) as commission_amount
           FROM amazon_conversions ac
           JOIN tracking_ids t ON t.tag = ac.tracking_tag AND t.marketplace = ac.marketplace
           WHERE t.agent_id = ?`
        )
          .bind(agentId)
          .first<{
            ordered_items: number;
            returned_items: number;
            revenue_amount: number;
            commission_amount: number;
          }>(),
        c.env.DB.prepare(
          `SELECT tracking_tag, country, clicked_at
           FROM clicks
           WHERE agent_id = ?
           ORDER BY clicked_at DESC
           LIMIT 20`
        )
          .bind(agentId)
          .all<{ tracking_tag: string; country: string | null; clicked_at: string }>(),
        c.env.DB.prepare(
          `SELECT
             ac.marketplace as marketplace,
             (
               SELECT COUNT(*)
               FROM clicks c
               JOIN tracking_ids tc ON tc.tag = c.tracking_tag
               WHERE tc.agent_id = ?
                 AND tc.marketplace = ac.marketplace
                 AND c.agent_id = ?
             ) as clicks,
             COALESCE(SUM(ac.ordered_items), 0) as ordered_items,
             COALESCE(
               SUM(
                 CASE
                   WHEN ac.ordered_items > ac.shipped_items THEN ac.ordered_items - ac.shipped_items
                   ELSE 0
                 END
               ),
               0
             ) as returned_items
           FROM amazon_conversions ac
           JOIN tracking_ids t ON t.tag = ac.tracking_tag AND t.marketplace = ac.marketplace
           WHERE t.agent_id = ?
           GROUP BY ac.marketplace
           ORDER BY ordered_items DESC, ac.marketplace ASC`
        )
          .bind(agentId, agentId, agentId)
          .all<{ marketplace: string; clicks: number; ordered_items: number; returned_items: number }>(),
        c.env.DB.prepare(
          `SELECT
             t.tag as tag,
             t.marketplace as marketplace,
             (
               SELECT COUNT(*)
               FROM clicks c
               WHERE c.agent_id = ?
                 AND c.tracking_tag = t.tag
             ) as clicks,
             COALESCE(SUM(ac.ordered_items), 0) as ordered_items,
             COALESCE(
               SUM(
                 CASE
                   WHEN ac.ordered_items > ac.shipped_items THEN ac.ordered_items - ac.shipped_items
                   ELSE 0
                 END
               ),
               0
             ) as returned_items
           FROM tracking_ids t
           LEFT JOIN amazon_conversions ac
             ON ac.tracking_tag = t.tag AND ac.marketplace = t.marketplace
           WHERE t.agent_id = ?
           GROUP BY t.id
           ORDER BY ordered_items DESC, t.marketplace ASC, t.tag ASC`
        )
          .bind(agentId, agentId)
          .all<{ tag: string; marketplace: string; clicks: number; ordered_items: number; returned_items: number }>(),
      ])
    : await Promise.all([
        c.env.DB.prepare('SELECT COUNT(*) as count FROM clicks').first<{ count: number }>(),
        c.env.DB.prepare('SELECT COUNT(*) as count FROM page_views').first<{ count: number }>(),
        c.env.DB.prepare(
          `SELECT p.asin, p.title, COUNT(c.id) as clicks
           FROM clicks c
           JOIN products p ON p.id = c.product_id
           GROUP BY p.id
           ORDER BY clicks DESC
           LIMIT 8`
        ).all<{ asin: string; title: string; clicks: number }>(),
        c.env.DB.prepare(
          `SELECT
             COALESCE(SUM(ordered_items), 0) as ordered_items,
             COALESCE(
               SUM(
                 CASE
                   WHEN ordered_items > shipped_items THEN ordered_items - shipped_items
                   ELSE 0
                 END
               ),
               0
             ) as returned_items,
             COALESCE(SUM(revenue_amount), 0) as revenue_amount,
             COALESCE(SUM(commission_amount), 0) as commission_amount
           FROM amazon_conversions`
        ).first<{
          ordered_items: number;
          returned_items: number;
          revenue_amount: number;
          commission_amount: number;
        }>(),
        c.env.DB.prepare(
          `SELECT tracking_tag, country, clicked_at
           FROM clicks
           ORDER BY clicked_at DESC
           LIMIT 20`
        ).all<{ tracking_tag: string; country: string | null; clicked_at: string }>(),
        c.env.DB.prepare(
          `SELECT
             ac.marketplace as marketplace,
             0 as clicks,
             COALESCE(SUM(ordered_items), 0) as ordered_items,
             COALESCE(
               SUM(
                 CASE
                   WHEN ordered_items > shipped_items THEN ordered_items - shipped_items
                   ELSE 0
                 END
               ),
               0
             ) as returned_items
           FROM amazon_conversions ac
           GROUP BY ac.marketplace
           ORDER BY ordered_items DESC, ac.marketplace ASC`
        ).all<{ marketplace: string; clicks: number; ordered_items: number; returned_items: number }>(),
        c.env.DB.prepare(
          `SELECT
             t.tag as tag,
             t.marketplace as marketplace,
             (
               SELECT COUNT(*)
               FROM clicks c
               WHERE c.tracking_tag = t.tag
             ) as clicks,
             COALESCE(SUM(ac.ordered_items), 0) as ordered_items,
             COALESCE(
               SUM(
                 CASE
                   WHEN ac.ordered_items > ac.shipped_items THEN ac.ordered_items - ac.shipped_items
                   ELSE 0
                 END
               ),
               0
             ) as returned_items
           FROM tracking_ids t
           LEFT JOIN amazon_conversions ac
             ON ac.tracking_tag = t.tag AND ac.marketplace = t.marketplace
           GROUP BY t.id
           ORDER BY ordered_items DESC, t.marketplace ASC, t.tag ASC`
        ).all<{ tag: string; marketplace: string; clicks: number; ordered_items: number; returned_items: number }>(),
      ]);

  const totalClicks = clicks?.count ?? 0;
  const totalViews = views?.count ?? 0;

  return c.json({
    totalClicks,
    totalViews,
    ctr: totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(2) : '0.00',
    orderedItems: salesTotals?.ordered_items ?? 0,
    returnedItems: salesTotals?.returned_items ?? 0,
    revenueAmount: salesTotals?.revenue_amount ?? 0,
    commissionAmount: salesTotals?.commission_amount ?? 0,
    topProducts: topProducts.results ?? [],
    recentClicks: recentClicks.results ?? [],
    marketplaceOrderBreakdown: marketplaceBreakdown.results ?? [],
    tagOrderBreakdown: tagBreakdown.results ?? [],
  });
});

portal.get('/tracking', async (c) => {
  const role = c.get('userRole');
  const agentId = c.get('agentId');
  const isAdminRole = role === 'admin' || role === 'super_admin';

  if (!isAdminRole && (role !== 'agent' || !agentId)) {
    throw new HTTPException(403, { message: 'Only linked agent accounts can view tracking' });
  }

  const { results } = await c.env.DB.prepare(
    `SELECT tracking_ids.id, tracking_ids.agent_id, tracking_ids.tag, tracking_ids.label,
            tracking_ids.marketplace, tracking_ids.is_default, tracking_ids.is_active,
            0 as is_portal_editable, tracking_ids.created_at,
            a.name as agent_name, a.slug as agent_slug,
            (
              SELECT COUNT(*)
              FROM agent_products ap
              WHERE ap.tracking_id = tracking_ids.id
            ) as usage_count
     FROM tracking_ids
     JOIN agents a ON a.id = tracking_ids.agent_id
     ${isAdminRole ? '' : 'WHERE agent_id = ?'}
     ORDER BY ${isAdminRole ? 'a.name ASC,' : ''} tracking_ids.marketplace ASC, tracking_ids.is_default DESC, tracking_ids.created_at ASC`
  )
    .bind(...(isAdminRole ? [] : [agentId]))
    .all<{
      id: number;
      agent_id: number;
      tag: string;
      label: string | null;
      marketplace: string;
      is_default: number;
      is_active: number;
      is_portal_editable: number;
      created_at: string;
      agent_name: string;
      agent_slug: string;
      usage_count: number;
    }>();

  return c.json({ trackingIds: results ?? [], canCreate: false });
});

portal.post('/tracking', zValidator('json', portalTrackingSetupSchema), async () => {
  throw new HTTPException(403, {
    message: 'Tracking is admin-managed. Ask an admin to add or change the tracking tag.',
  });
});

portal.put('/tracking/:id', zValidator('json', portalTrackingSetupSchema), async () => {
  throw new HTTPException(403, {
    message: 'Tracking is admin-managed. Use the admin tracking page to make this change.',
  });
});

portal.post('/tracking/:id/default', async () => {
  throw new HTTPException(403, {
    message: 'Tracking is admin-managed. Use the admin tracking page to make this change.',
  });
});

portal.delete('/tracking/:id', async () => {
  throw new HTTPException(403, {
    message: 'Tracking is admin-managed. Use the admin tracking page to make this change.',
  });
});

portal.post('/tracking/:id/replace-delete', async () => {
  throw new HTTPException(403, {
    message: 'Tracking is admin-managed. Use the admin tracking page to make this change.',
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
  const resolvedAsin = extractAsinFromInput(asin);

  if (!resolvedAsin) {
    throw new HTTPException(400, {
      message: 'Provide a valid ASIN or Amazon product link.',
    });
  }

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
      message: `No active tag found for marketplace ${marketplace}. Create one first.`,
    });
  }

  let product = await c.env.DB.prepare(
    'SELECT id, title, image_url, status FROM products WHERE asin = ? AND marketplace = ?'
  )
    .bind(resolvedAsin, marketplace)
    .first<{ id: number; title: string; image_url: string; status: string }>();

  if (!product) {
    if (!ASIN_IMPORT_ENABLED) {
      throw new HTTPException(503, {
        message: `${ASIN_IMPORT_PAUSED_MESSAGE} Only ASINs already saved in the system can be linked right now.`,
      });
    }

    const fallbackApiKeys = c.env.AMAZON_API_KEY_FALLBACK ? [c.env.AMAZON_API_KEY_FALLBACK] : [];
    const hasFetchSource = hasAmazonProductFetchSource({
      primaryApiKey: c.env.AMAZON_API_KEY,
      fallbackApiKeys,
      serpApiToken: c.env.SERPAPI_TOKEN,
      zyteApiKey: c.env.ZYTE_API_KEY,
      lwaClientId: c.env.LWA_CLIENT_ID,
      lwaClientSecret: c.env.LWA_CLIENT_SECRET,
    });

    if (!hasFetchSource) {
      throw new HTTPException(503, {
        message: 'Amazon product API is not configured. Product link generation needs live product data.',
      });
    }

    try {
      const ensuredProduct = await ensureProductRecord({
        db: c.env.DB,
        asin: resolvedAsin,
        marketplace,
        apiKey: c.env.AMAZON_API_KEY,
        fallbackApiKeys,
        serpApiToken: c.env.SERPAPI_TOKEN,
        zyteApiKey: c.env.ZYTE_API_KEY,
        status: 'active',
        requireRealProductData: true,
        lwaClientId: c.env.LWA_CLIENT_ID,
        lwaClientSecret: c.env.LWA_CLIENT_SECRET,
        lwaScope: c.env.LWA_CREATORS_SCOPE,
      });

      product = {
        id: ensuredProduct.id,
        title: ensuredProduct.title,
        image_url: ensuredProduct.image_url,
        status: ensuredProduct.status || 'active',
      };
    } catch (error) {
      throw new HTTPException(502, {
        message: getAmazonProductFetchErrorMessage(error),
      });
    }
  }

  if (!product) {
    throw new HTTPException(500, { message: 'Product creation failed unexpectedly' });
  }

  if (product.status === 'rejected') {
    throw new HTTPException(409, {
      message: 'This product is currently blocked and must be reviewed by admin before it can be used again.',
    });
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
  c.executionCtx.waitUntil(cache.deletePageData(agent.slug, resolvedAsin, marketplace));
  c.executionCtx.waitUntil(cache.deleteRedirectUrl(agent.slug, resolvedAsin, marketplace));
  const origin = getPublicAppOrigin(c.req.url, c.env);

  return c.json(
    {
      message: 'Product link is ready.',
      link: buildCanonicalBridgeUrl(
        origin,
        await getPublicSlugForTracking({
          db: c.env.DB,
          agentId: agent.id,
          trackingId: trackingId.id,
          marketplace,
          fallbackSlug: agent.slug,
        }),
        resolvedAsin,
        marketplace
      ),
      redirectLink: buildCanonicalRedirectUrl(
        origin,
        await getPublicSlugForTracking({
          db: c.env.DB,
          agentId: agent.id,
          trackingId: trackingId.id,
          marketplace,
          fallbackSlug: agent.slug,
        }),
        resolvedAsin,
        marketplace
      ),
      status: product.status,
      product: {
        asin: resolvedAsin,
        marketplace,
        title: custom_title || product.title,
        imageUrl: product.image_url,
      },
    },
    201
  );
});

export default portal;
