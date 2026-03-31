import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../utils/types';
import { createTrackingIdSchema } from '../schemas';

const tracking = new Hono<AppEnv>();

/**
 * GET /api/tracking — List all tags with agent info
 */
tracking.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT t.*, a.name as agent_name, a.slug as agent_slug
     FROM tracking_ids t
     JOIN agents a ON a.id = t.agent_id
     ORDER BY t.created_at DESC`
  ).all();

  return c.json({ trackingIds: results });
});

/**
 * POST /api/tracking — Create a new tag
 */
tracking.post('/', zValidator('json', createTrackingIdSchema), async (c) => {
  const data = c.req.valid('json');

  // Verify agent exists
  const agent = await c.env.DB.prepare('SELECT id FROM agents WHERE id = ? AND is_active = 1')
    .bind(data.agent_id)
    .first();
  if (!agent) throw new HTTPException(404, { message: 'Agent not found or inactive' });

  // If setting as default, unset other defaults for this agent+marketplace
  if (data.is_default) {
    await c.env.DB.prepare(
      'UPDATE tracking_ids SET is_default = 0 WHERE agent_id = ? AND marketplace = ?'
    )
      .bind(data.agent_id, data.marketplace)
      .run();
  }

  try {
    await c.env.DB.prepare(
      `INSERT INTO tracking_ids (agent_id, tag, label, marketplace, is_default, is_portal_editable)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        data.agent_id,
        data.tag,
        data.label || null,
        data.marketplace,
        data.is_default ? 1 : 0,
        data.is_portal_editable ? 1 : 0
      )
      .run();

    const trackingId = await c.env.DB.prepare('SELECT * FROM tracking_ids WHERE tag = ?')
      .bind(data.tag)
      .first();

    return c.json({ trackingId, message: 'Tag created' }, 201);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new HTTPException(409, { message: 'Tracking tag already exists' });
    }
    throw error;
  }
});

/**
 * PUT /api/tracking/:id — Update tag
 */
tracking.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) throw new HTTPException(400, { message: 'Invalid tag ID' });

  const body = await c.req.json<{ label?: string; is_default?: boolean; is_active?: boolean }>();

  const current = await c.env.DB.prepare('SELECT * FROM tracking_ids WHERE id = ?')
    .bind(id)
    .first<{ id: number; agent_id: number; marketplace: string }>();
  if (!current) throw new HTTPException(404, { message: 'Tag not found' });

  if (body.is_default) {
    await c.env.DB.prepare(
      'UPDATE tracking_ids SET is_default = 0 WHERE agent_id = ? AND marketplace = ?'
    )
      .bind(current.agent_id, current.marketplace)
      .run();
  }

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (body.label !== undefined) { updates.push('label = ?'); values.push(body.label); }
  if (body.is_default !== undefined) { updates.push('is_default = ?'); values.push(body.is_default ? 1 : 0); }
  if (body.is_active !== undefined) { updates.push('is_active = ?'); values.push(body.is_active ? 1 : 0); }

  if (updates.length > 0) {
    values.push(id);
    await c.env.DB.prepare(`UPDATE tracking_ids SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  const updated = await c.env.DB.prepare('SELECT * FROM tracking_ids WHERE id = ?').bind(id).first();
  return c.json({ trackingId: updated, message: 'Tag updated' });
});

/**
 * DELETE /api/tracking/:id — Delete tag
 */
tracking.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) throw new HTTPException(400, { message: 'Invalid tag ID' });

  // Check if in use
  const usage = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM agent_products WHERE tracking_id = ?'
  )
    .bind(id)
    .first<{ count: number }>();

  if (usage && usage.count > 0) {
    throw new HTTPException(409, {
      message: `Cannot delete: tag is used in ${usage.count} mapping(s). Remove mappings first.`,
    });
  }

  await c.env.DB.prepare('DELETE FROM tracking_ids WHERE id = ?').bind(id).run();
  return c.json({ message: 'Tag deleted' });
});

export default tracking;
