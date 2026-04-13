import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../utils/types';
import { createAgentSchema, updateAgentSchema } from '../schemas';
import { CacheService } from '../services/cache';
import { writeAuditLog } from '../services/audit-log';
import {
  collectAgentDeleteMarketplaces,
  ensureSitePrimaryCoverageForMarketplaces,
  remapAgentAnalyticsToSitePrimary,
  remapAgentProductsForAgentToSitePrimary,
} from '../services/site-primary-remap';

const agents = new Hono<AppEnv>();

function generateBindCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < bytes.length; i += 1) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

/**
 * GET /api/agents — List all agents with stats
 */
agents.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT a.*,
       (SELECT COUNT(*) FROM tracking_ids WHERE agent_id = a.id) as tracking_count,
       (SELECT COUNT(*) FROM agent_products WHERE agent_id = a.id) as product_count,
       (SELECT COUNT(*) FROM clicks WHERE agent_id = a.id) as total_clicks,
       (SELECT COUNT(*) FROM users WHERE agent_id = a.id AND is_active = 1) as user_count,
       (SELECT MAX(clicked_at) FROM clicks WHERE agent_id = a.id) as last_click_at,
       (
         SELECT COALESCE(SUM(ac.ordered_items), 0)
         FROM amazon_conversions ac
         JOIN tracking_ids t ON t.tag = ac.tracking_tag AND t.marketplace = ac.marketplace
         WHERE t.agent_id = a.id
       ) as total_ordered_items,
       (
         SELECT COALESCE(
           SUM(
             CASE
               WHEN ac.ordered_items > ac.shipped_items THEN ac.ordered_items - ac.shipped_items
               ELSE 0
             END
           ),
           0
         )
         FROM amazon_conversions ac
         JOIN tracking_ids t ON t.tag = ac.tracking_tag AND t.marketplace = ac.marketplace
         WHERE t.agent_id = a.id
       ) as total_returned_items,
       (
         SELECT COALESCE(SUM(ac.revenue_amount), 0)
         FROM amazon_conversions ac
         JOIN tracking_ids t ON t.tag = ac.tracking_tag AND t.marketplace = ac.marketplace
         WHERE t.agent_id = a.id
       ) as total_revenue,
       (
         SELECT COALESCE(SUM(ac.commission_amount), 0)
         FROM amazon_conversions ac
         JOIN tracking_ids t ON t.tag = ac.tracking_tag AND t.marketplace = ac.marketplace
         WHERE t.agent_id = a.id
       ) as total_commission
     FROM agents a ORDER BY a.created_at DESC`
  ).all();

  return c.json({ agents: results });
});

/**
 * POST /api/agents — Create a new agent
 */
agents.post('/', zValidator('json', createAgentSchema), async (c) => {
  const data = c.req.valid('json');

  try {
    await c.env.DB.prepare(
      'INSERT INTO agents (name, slug, email, phone) VALUES (?, ?, ?, ?)'
    )
      .bind(data.name, data.slug, data.email || null, data.phone || null)
      .run();

    const agent = await c.env.DB.prepare('SELECT * FROM agents WHERE slug = ?')
      .bind(data.slug)
      .first();

    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        userId: c.get('userId'),
        action: 'agent.created',
        entityType: 'agent',
        entityId: (agent as { id?: number } | null)?.id ?? data.slug,
        details: {
          name: data.name,
          slug: data.slug,
          email: data.email || null,
          phone: data.phone || null,
        },
      })
    );

    return c.json({ agent, message: 'Agent created successfully' }, 201);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new HTTPException(409, { message: 'Agent slug already exists' });
    }
    throw error;
  }
});

/**
 * POST /api/agents/:id/telegram-bind — Generate a one-time bind code
 */
agents.post('/:id/telegram-bind', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) throw new HTTPException(400, { message: 'Invalid agent ID' });

  const agent = await c.env.DB.prepare(
    'SELECT id, telegram_chat_id FROM agents WHERE id = ?'
  )
    .bind(id)
    .first<{ id: number; telegram_chat_id: string | null }>();
  if (!agent) throw new HTTPException(404, { message: 'Agent not found' });
  if (agent.telegram_chat_id) {
    throw new HTTPException(409, { message: 'Agent already bound to Telegram' });
  }

  let code = '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateBindCode();
    const exists = await c.env.DB.prepare(
      'SELECT id FROM agents WHERE telegram_bind_code = ? LIMIT 1'
    )
      .bind(candidate)
      .first<{ id: number }>();
    if (!exists) {
      code = candidate;
      break;
    }
  }
  if (!code) throw new HTTPException(503, { message: 'Could not generate a unique bind code' });

  await c.env.DB.prepare(
    'UPDATE agents SET telegram_bind_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  )
    .bind(code, id)
    .run();

  return c.json({ bindCode: code });
});

/**
 * PUT /api/agents/:id — Update an agent
 */
agents.put('/:id', zValidator('json', updateAgentSchema), async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) throw new HTTPException(400, { message: 'Invalid agent ID' });

  const data = c.req.valid('json');

  const agent = await c.env.DB.prepare('SELECT * FROM agents WHERE id = ?')
    .bind(id).first<{ slug: string }>();
  if (!agent) throw new HTTPException(404, { message: 'Agent not found' });

  const updates: string[] = [];
  const values: (string | number | boolean | null)[] = [];

  if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
  if (data.slug !== undefined) { updates.push('slug = ?'); values.push(data.slug); }
  if (data.email !== undefined) { updates.push('email = ?'); values.push(data.email); }
  if (data.phone !== undefined) { updates.push('phone = ?'); values.push(data.phone); }
  if (data.is_active !== undefined) { updates.push('is_active = ?'); values.push(data.is_active ? 1 : 0); }

  if (updates.length === 0) {
    throw new HTTPException(400, { message: 'No fields to update' });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  try {
    await c.env.DB.prepare(
      `UPDATE agents SET ${updates.join(', ')} WHERE id = ?`
    )
      .bind(...values)
      .run();
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new HTTPException(409, { message: 'Agent slug already exists' });
    }
    throw error;
  }

  // Invalidate cache
  const cache = new CacheService(c.env.KV);
  c.executionCtx.waitUntil(
    Promise.all([
      cache.invalidateForAgent(agent.slug),
      data.slug && data.slug !== agent.slug ? cache.invalidateForAgent(data.slug) : Promise.resolve(),
    ])
  );

  const updated = await c.env.DB.prepare('SELECT * FROM agents WHERE id = ?').bind(id).first();

  c.executionCtx.waitUntil(
    writeAuditLog(c.env.DB, {
      userId: c.get('userId'),
      action: 'agent.updated',
      entityType: 'agent',
      entityId: id,
      details: {
        name: data.name,
        slug: data.slug,
        email: data.email,
        phone: data.phone,
        isActive: data.is_active,
      },
    })
  );

  return c.json({ agent: updated, message: 'Agent updated' });
});

/**
 * DELETE /api/agents/:id — Soft-delete by deactivating
 */
agents.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) throw new HTTPException(400, { message: 'Invalid agent ID' });

  const agent = await c.env.DB.prepare('SELECT slug, is_active FROM agents WHERE id = ?')
    .bind(id).first<{ slug: string; is_active: number }>();
  if (!agent) throw new HTTPException(404, { message: 'Agent not found' });
  if (agent.is_active === 1) {
    throw new HTTPException(409, { message: 'Deactivate the agent before deleting it.' });
  }

  const marketplaces = await collectAgentDeleteMarketplaces(c.env.DB, id);

  try {
    const replacements = await ensureSitePrimaryCoverageForMarketplaces(c.env.DB, marketplaces);

    await remapAgentProductsForAgentToSitePrimary(c.env.DB, id, replacements);
    await remapAgentAnalyticsToSitePrimary(c.env.DB, id, replacements);
  } catch (error) {
    throw new HTTPException(409, {
      message: error instanceof Error ? error.message : 'Missing site-primary replacement tags.',
    });
  }

  await c.env.DB.prepare(
    `UPDATE users
     SET agent_id = NULL,
         is_active = 0,
         updated_at = CURRENT_TIMESTAMP
     WHERE agent_id = ?`
  )
    .bind(id)
    .run();

  await c.env.DB.prepare('DELETE FROM agents WHERE id = ?')
    .bind(id)
    .run();

  const cache = new CacheService(c.env.KV);
  c.executionCtx.waitUntil(cache.invalidateForAgent(agent.slug));
  c.executionCtx.waitUntil(
    writeAuditLog(c.env.DB, {
      userId: c.get('userId'),
      action: 'agent.deleted',
      entityType: 'agent',
      entityId: id,
      details: { slug: agent.slug },
    })
  );

  return c.json({ message: 'Agent deleted and remapped to site-primary tags.' });
});

/**
 * DELETE /api/agents/:id/tracking — Delete all tracking for an inactive agent
 */
agents.delete('/:id/tracking', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) throw new HTTPException(400, { message: 'Invalid agent ID' });

  const agent = await c.env.DB.prepare('SELECT slug, is_active FROM agents WHERE id = ?')
    .bind(id).first<{ slug: string; is_active: number }>();
  if (!agent) throw new HTTPException(404, { message: 'Agent not found' });
  if (agent.is_active === 1) {
    throw new HTTPException(409, { message: 'Deactivate the agent before deleting all tracking.' });
  }

  const marketplacesResult = await c.env.DB.prepare(
    `SELECT DISTINCT marketplace
     FROM tracking_ids
     WHERE agent_id = ?`
  )
    .bind(id)
    .all<{ marketplace: string }>();

  const marketplaces = (marketplacesResult.results ?? []).map((row) => row.marketplace);
  const excludedTrackingIdsByMarketplace = new Map<string, number>();
  const currentTrackingRows = await c.env.DB.prepare(
    `SELECT id, marketplace
     FROM tracking_ids
     WHERE agent_id = ?`
  )
    .bind(id)
    .all<{ id: number; marketplace: string }>();

  for (const row of currentTrackingRows.results ?? []) {
    excludedTrackingIdsByMarketplace.set(row.marketplace, row.id);
  }

  try {
    const replacements = await ensureSitePrimaryCoverageForMarketplaces(
      c.env.DB,
      marketplaces,
      excludedTrackingIdsByMarketplace
    );

    await remapAgentProductsForAgentToSitePrimary(c.env.DB, id, replacements);
  } catch (error) {
    throw new HTTPException(409, {
      message: error instanceof Error ? error.message : 'Missing site-primary replacement tags.',
    });
  }

  await c.env.DB.prepare('DELETE FROM tracking_ids WHERE agent_id = ?')
    .bind(id)
    .run();

  const cache = new CacheService(c.env.KV);
  c.executionCtx.waitUntil(cache.invalidateForAgent(agent.slug));

  return c.json({ message: 'All tracking removed and linked products remapped to site-primary tags.' });
});

export default agents;
