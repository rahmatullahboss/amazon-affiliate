import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../utils/types';
import { ASIN_IMPORT_ENABLED, ASIN_IMPORT_PAUSED_MESSAGE } from '../utils/asin-import';
import { portalAsinSubmissionSchema, portalTrackingReplaceDeleteSchema, portalTrackingSetupSchema } from '../schemas';
import { CacheService } from '../services/cache';
import {
  ensureProductRecord,
  extractAsinFromInput,
  getAmazonProductFetchErrorMessage,
} from '../services/product-ingestion';
import { getPublicAppOrigin } from '../utils/url';

const portal = new Hono<AppEnv>();

async function ensureMarketplaceDefaultTag(
  db: D1Database,
  agentId: number,
  marketplace: string,
  preferredTrackingId?: number
): Promise<void> {
  if (preferredTrackingId) {
    await db.prepare('UPDATE tracking_ids SET is_default = 0 WHERE agent_id = ? AND marketplace = ?')
      .bind(agentId, marketplace)
      .run();

    await db.prepare('UPDATE tracking_ids SET is_default = 1 WHERE id = ? AND agent_id = ?')
      .bind(preferredTrackingId, agentId)
      .run();
    return;
  }

  const existingDefault = await db.prepare(
    `SELECT id
     FROM tracking_ids
     WHERE agent_id = ? AND marketplace = ? AND is_active = 1 AND is_default = 1
     LIMIT 1`
  )
    .bind(agentId, marketplace)
    .first<{ id: number }>();

  if (existingDefault) {
    return;
  }

  const fallbackTag = await db.prepare(
    `SELECT id
     FROM tracking_ids
     WHERE agent_id = ? AND marketplace = ? AND is_active = 1
     ORDER BY created_at ASC
     LIMIT 1`
  )
    .bind(agentId, marketplace)
    .first<{ id: number }>();

  if (fallbackTag) {
    await db.prepare('UPDATE tracking_ids SET is_default = 1 WHERE id = ?')
      .bind(fallbackTag.id)
      .run();
  }
}

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
  const origin = getPublicAppOrigin(c.req.url, c.env);

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

  return c.json({
    products: (results ?? []).map((product) => ({
      ...product,
      bridge_page_url: `${origin}/${product.agent_slug}/${product.asin}`,
      redirect_url: `${origin}/go/${product.agent_slug}/${product.asin}`,
    })),
  });
});

portal.get('/links', async (c) => {
  const role = c.get('userRole');
  const agentId = c.get('agentId');

  if (role === 'agent' && !agentId) {
    throw new HTTPException(403, { message: 'Agent account is not linked to an agent profile' });
  }

  const bindings = role === 'agent' ? [agentId] : [];
  const whereClause = role === 'agent' ? 'WHERE ap.agent_id = ?' : '';
  const origin = getPublicAppOrigin(c.req.url, c.env);

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

  const { results: dynamicBridgeResults } = await c.env.DB.prepare(
    `SELECT DISTINCT a.slug as agent_slug, a.name as agent_name
     FROM tracking_ids t
     JOIN agents a ON a.id = t.agent_id
     ${role === 'agent' ? 'WHERE a.id = ?' : 'WHERE 1 = 1'}
       AND t.is_active = 1
       AND a.is_active = 1
     ORDER BY a.name ASC`
  )
    .bind(...bindings)
    .all<{
      agent_slug: string;
      agent_name: string;
    }>();

  const dynamicBridgeTemplates = (dynamicBridgeResults ?? []).map((row) => ({
    agentSlug: row.agent_slug,
    agentName: row.agent_name,
    bridgeTemplateUrl: `${origin}/${row.agent_slug}/{ASIN}`,
  }));

  return c.json({ links, dynamicBridgeTemplates });
});

portal.get('/performance', async (c) => {
  const role = c.get('userRole');
  const agentId = c.get('agentId');

  if (role !== 'agent' || !agentId) {
    throw new HTTPException(403, { message: 'Only linked agent accounts can view performance' });
  }

  const [clicks, views, topProducts, salesTotals, recentClicks, marketplaceBreakdown, tagBreakdown] = await Promise.all([
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

  if (role !== 'agent' || !agentId) {
    throw new HTTPException(403, { message: 'Only linked agent accounts can manage tags' });
  }

  const { results } = await c.env.DB.prepare(
    `SELECT id, tag, label, marketplace, is_default, is_active, is_portal_editable, created_at,
            (
              SELECT COUNT(*)
              FROM agent_products ap
              WHERE ap.tracking_id = tracking_ids.id
            ) as usage_count
     FROM tracking_ids
     WHERE agent_id = ?
     ORDER BY marketplace ASC, is_default DESC, created_at ASC`
  )
    .bind(agentId)
    .all<{
      id: number;
      tag: string;
      label: string | null;
      marketplace: string;
      is_default: number;
      is_active: number;
      is_portal_editable: number;
      created_at: string;
      usage_count: number;
    }>();

  return c.json({ trackingIds: results ?? [] });
});

portal.post('/tracking', zValidator('json', portalTrackingSetupSchema), async (c) => {
  const role = c.get('userRole');
  const agentId = c.get('agentId');

  if (role !== 'agent' || !agentId) {
    throw new HTTPException(403, { message: 'Only linked agent accounts can manage tags' });
  }

  const body = c.req.valid('json');

  try {
    const marketplaceTagCount = await c.env.DB.prepare(
      `SELECT COUNT(*) AS count
       FROM tracking_ids
       WHERE agent_id = ? AND marketplace = ? AND is_active = 1`
    )
      .bind(agentId, body.marketplace)
      .first<{ count: number }>();

    const shouldBeDefault = (marketplaceTagCount?.count ?? 0) === 0;

    const insertResult = await c.env.DB.prepare(
      `INSERT INTO tracking_ids (agent_id, tag, label, marketplace, is_default, is_active, is_portal_editable)
       VALUES (?, ?, ?, ?, ?, 1, 1)`
    )
      .bind(agentId, body.tag, body.label || null, body.marketplace, shouldBeDefault ? 1 : 0)
      .run();

    const trackingIdValue = Number(insertResult.meta.last_row_id);
    if (shouldBeDefault && Number.isFinite(trackingIdValue)) {
      await ensureMarketplaceDefaultTag(c.env.DB, agentId, body.marketplace, trackingIdValue);
    }

    const trackingId = await c.env.DB.prepare(
      `SELECT id, tag, label, marketplace, is_default, is_active, is_portal_editable, created_at
       FROM tracking_ids
       WHERE id = ? AND agent_id = ?`
    )
      .bind(trackingIdValue, agentId)
      .first();

    return c.json(
      {
        trackingId,
        message: shouldBeDefault
          ? 'Tag saved successfully and set as default for this marketplace.'
          : 'Tag saved successfully',
      },
      201
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new HTTPException(409, {
        message:
          'This tag is already assigned to another account. Use a different tag or ask admin to move it to this agent.',
      });
    }

    throw error;
  }
});

portal.put('/tracking/:id', zValidator('json', portalTrackingSetupSchema), async (c) => {
  const role = c.get('userRole');
  const agentId = c.get('agentId');
  const id = Number.parseInt(c.req.param('id'), 10);

  if (role !== 'agent' || !agentId) {
    throw new HTTPException(403, { message: 'Only linked agent accounts can manage tags' });
  }

  if (Number.isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid tag ID' });
  }

  const body = c.req.valid('json');

  const current = await c.env.DB.prepare(
    `SELECT id, marketplace, is_portal_editable
     FROM tracking_ids
     WHERE id = ? AND agent_id = ?`
  )
    .bind(id, agentId)
    .first<{ id: number; marketplace: string; is_portal_editable: number }>();

  if (!current) {
    throw new HTTPException(404, { message: 'Tag not found' });
  }

  if (current.is_portal_editable !== 1) {
    throw new HTTPException(403, {
      message: 'This tag is admin-managed and read-only in the agent portal.',
    });
  }

  try {
    await c.env.DB.prepare(
      `UPDATE tracking_ids
       SET tag = ?, label = ?, is_active = 1
       WHERE id = ? AND agent_id = ?`
    )
      .bind(body.tag, body.label || null, id, agentId)
      .run();

    const trackingId = await c.env.DB.prepare(
      `SELECT id, tag, label, marketplace, is_default, is_active, is_portal_editable, created_at
       FROM tracking_ids
       WHERE id = ? AND agent_id = ?`
    )
      .bind(id, agentId)
      .first();

    await ensureMarketplaceDefaultTag(c.env.DB, agentId, current.marketplace);

    return c.json({ trackingId, message: 'Tag updated successfully' });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new HTTPException(409, {
        message:
          'This tag is already assigned to another account. Use a different tag or ask admin to move it to this agent.',
      });
    }

    throw error;
  }
});

portal.post('/tracking/:id/default', async (c) => {
  const role = c.get('userRole');
  const agentId = c.get('agentId');
  const id = Number.parseInt(c.req.param('id'), 10);

  if (role !== 'agent' || !agentId) {
    throw new HTTPException(403, { message: 'Only linked agent accounts can manage tags' });
  }

  if (Number.isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid tag ID' });
  }

  const current = await c.env.DB.prepare(
    `SELECT id, marketplace, is_portal_editable
     FROM tracking_ids
     WHERE id = ? AND agent_id = ? AND is_active = 1`
  )
    .bind(id, agentId)
    .first<{ id: number; marketplace: string; is_portal_editable: number }>();

  if (!current) {
    throw new HTTPException(404, { message: 'Tag not found' });
  }

  if (current.is_portal_editable !== 1) {
    throw new HTTPException(403, {
      message: 'This tag is admin-managed and read-only in the agent portal.',
    });
  }

  await ensureMarketplaceDefaultTag(c.env.DB, agentId, current.marketplace, current.id);

  const trackingId = await c.env.DB.prepare(
    `SELECT id, tag, label, marketplace, is_default, is_active, created_at
     FROM tracking_ids
     WHERE id = ? AND agent_id = ?`
  )
    .bind(id, agentId)
    .first();

  return c.json({ trackingId, message: 'Default tag updated successfully' });
});

portal.delete('/tracking/:id', async (c) => {
  const role = c.get('userRole');
  const agentId = c.get('agentId');
  const id = Number.parseInt(c.req.param('id'), 10);

  if (role !== 'agent' || !agentId) {
    throw new HTTPException(403, { message: 'Only linked agent accounts can manage tags' });
  }

  if (Number.isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid tag ID' });
  }

  const current = await c.env.DB.prepare(
    `SELECT id, marketplace, is_default, is_portal_editable
     FROM tracking_ids
     WHERE id = ? AND agent_id = ?`
  )
    .bind(id, agentId)
    .first<{ id: number; marketplace?: string; is_default?: number; is_portal_editable?: number }>();

  if (!current) {
    throw new HTTPException(404, { message: 'Tag not found' });
  }

  if (current.is_portal_editable !== 1) {
    throw new HTTPException(403, {
      message: 'This tag is admin-managed and read-only in the agent portal.',
    });
  }

  const usage = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM agent_products WHERE tracking_id = ?'
  )
    .bind(id)
    .first<{ count: number }>();

  const cascade = c.req.query('cascade') === '1';
  const usageCount = usage?.count ?? 0;

  if (usageCount > 0 && !cascade) {
    throw new HTTPException(409, {
      message: 'This tag is already linked to products. Replace it or delete it with its linked products.',
    });
  }

  if (usageCount > 0 && cascade) {
    await c.env.DB.prepare('DELETE FROM agent_products WHERE tracking_id = ?').bind(id).run();
  }

  await c.env.DB.prepare('DELETE FROM tracking_ids WHERE id = ?').bind(id).run();

  if (current.marketplace) {
    await ensureMarketplaceDefaultTag(c.env.DB, agentId, current.marketplace);
  }

  return c.json({
    message:
      usageCount > 0 && cascade
        ? `Tag deleted successfully. Removed ${usageCount} linked product mapping${usageCount > 1 ? 's' : ''}.`
        : 'Tag deleted successfully',
  });
});

portal.post(
  '/tracking/:id/replace-delete',
  zValidator('json', portalTrackingReplaceDeleteSchema),
  async (c) => {
    const role = c.get('userRole');
    const agentId = c.get('agentId');
    const id = Number.parseInt(c.req.param('id'), 10);

    if (role !== 'agent' || !agentId) {
      throw new HTTPException(403, { message: 'Only linked agent accounts can manage tags' });
    }

    if (Number.isNaN(id)) {
      throw new HTTPException(400, { message: 'Invalid tag ID' });
    }

    const body = c.req.valid('json');

    const current = await c.env.DB.prepare(
      `SELECT id, marketplace, is_default, is_portal_editable
       FROM tracking_ids
       WHERE id = ? AND agent_id = ?`
    )
      .bind(id, agentId)
      .first<{ id: number; marketplace: string; is_default: number; is_portal_editable: number }>();

    if (!current) {
      throw new HTTPException(404, { message: 'Tag not found' });
    }

    if (current.is_portal_editable !== 1) {
      throw new HTTPException(403, {
        message: 'This tag is admin-managed and read-only in the agent portal.',
      });
    }

    const replacement = await c.env.DB.prepare(
      `SELECT id, marketplace
       FROM tracking_ids
       WHERE id = ? AND agent_id = ? AND is_active = 1`
    )
      .bind(body.replacement_tracking_id, agentId)
      .first<{ id: number; marketplace: string }>();

    if (!replacement || replacement.id === current.id) {
      throw new HTTPException(400, { message: 'Select another active tag to replace this one.' });
    }

    if (replacement.marketplace !== current.marketplace) {
      throw new HTTPException(400, {
        message: `Replacement tag must be from the same marketplace (${current.marketplace}).`,
      });
    }

    const usage = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM agent_products WHERE tracking_id = ?'
    )
      .bind(current.id)
      .first<{ count: number }>();

    const usageCount = usage?.count ?? 0;

    await c.env.DB.prepare(
      `UPDATE agent_products
       SET tracking_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE tracking_id = ? AND agent_id = ?`
    )
      .bind(replacement.id, current.id, agentId)
      .run();

    if (current.is_default) {
      await c.env.DB.prepare(
        'UPDATE tracking_ids SET is_default = 0 WHERE agent_id = ? AND marketplace = ?'
      )
        .bind(agentId, current.marketplace)
        .run();

      await c.env.DB.prepare('UPDATE tracking_ids SET is_default = 1 WHERE id = ?')
        .bind(replacement.id)
        .run();
    }

    await c.env.DB.prepare('DELETE FROM tracking_ids WHERE id = ?').bind(current.id).run();

    return c.json({
      message: `Tag replaced and deleted successfully. Moved ${usageCount} linked product mapping${usageCount > 1 ? 's' : ''}.`,
    });
  }
);

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

    const apiKey = c.env.AMAZON_API_KEY;
    if (!apiKey) {
      throw new HTTPException(503, {
        message: 'Amazon product API is not configured. Product link generation needs live product data.',
      });
    }

    try {
      const ensuredProduct = await ensureProductRecord({
        db: c.env.DB,
        asin: resolvedAsin,
        marketplace,
        apiKey,
        fallbackApiKeys: c.env.AMAZON_API_KEY_FALLBACK ? [c.env.AMAZON_API_KEY_FALLBACK] : [],
        status: 'active',
        requireRealProductData: true,
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
  c.executionCtx.waitUntil(cache.deletePageData(agent.slug, resolvedAsin));
  c.executionCtx.waitUntil(cache.deleteRedirectUrl(agent.slug, resolvedAsin));
  const origin = getPublicAppOrigin(c.req.url, c.env);

  return c.json(
    {
      message: 'Product link is ready.',
      link: `${origin}/${agent.slug}/${resolvedAsin}`,
      redirectLink: `${origin}/go/${agent.slug}/${resolvedAsin}`,
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
