import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../utils/types';
import { createAgentSchema, updateAgentSchema } from '../schemas';
import { CacheService } from '../services/cache';
import { writeAuditLog } from '../services/audit-log';

const agents = new Hono<AppEnv>();

/**
 * GET /api/agents — List all agents with stats
 */
agents.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT a.*,
       (SELECT COUNT(*) FROM tracking_ids WHERE agent_id = a.id) as tracking_count,
       (SELECT COUNT(*) FROM agent_products WHERE agent_id = a.id) as product_count,
       (SELECT COUNT(*) FROM clicks WHERE agent_id = a.id) as total_clicks
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
  if (data.email !== undefined) { updates.push('email = ?'); values.push(data.email); }
  if (data.phone !== undefined) { updates.push('phone = ?'); values.push(data.phone); }
  if (data.is_active !== undefined) { updates.push('is_active = ?'); values.push(data.is_active ? 1 : 0); }

  if (updates.length === 0) {
    throw new HTTPException(400, { message: 'No fields to update' });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  await c.env.DB.prepare(
    `UPDATE agents SET ${updates.join(', ')} WHERE id = ?`
  )
    .bind(...values)
    .run();

  // Invalidate cache
  const cache = new CacheService(c.env.KV);
  c.executionCtx.waitUntil(cache.invalidateForAgent(agent.slug));

  const updated = await c.env.DB.prepare('SELECT * FROM agents WHERE id = ?').bind(id).first();

  c.executionCtx.waitUntil(
    writeAuditLog(c.env.DB, {
      userId: c.get('userId'),
      action: 'agent.updated',
      entityType: 'agent',
      entityId: id,
      details: {
        name: data.name,
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

  const agent = await c.env.DB.prepare('SELECT slug FROM agents WHERE id = ?')
    .bind(id).first<{ slug: string }>();
  if (!agent) throw new HTTPException(404, { message: 'Agent not found' });

  await c.env.DB.prepare('UPDATE agents SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(id).run();

  const cache = new CacheService(c.env.KV);
  c.executionCtx.waitUntil(cache.invalidateForAgent(agent.slug));
  c.executionCtx.waitUntil(
    writeAuditLog(c.env.DB, {
      userId: c.get('userId'),
      action: 'agent.deactivated',
      entityType: 'agent',
      entityId: id,
      details: { slug: agent.slug },
    })
  );

  return c.json({ message: 'Agent deactivated' });
});

export default agents;
