import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../utils/types';
import { createTrackingIdSchema, updateTrackingIdSchema } from '../schemas';
import { ensurePublicSlugAlias } from '../services/public-slugs';
import {
  requireSitePrimaryTrackingTarget,
  remapAgentTrackingToSitePrimary,
} from '../services/site-primary-remap';

const tracking = new Hono<AppEnv>();

async function enforceSingleActiveTagForAgentMarketplace(
  db: D1Database,
  input: {
    agentId: number;
    marketplace: string;
    keepTrackingId: number;
  }
) {
  await db.prepare(
    `UPDATE agent_products
     SET tracking_id = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE agent_id = ?
       AND tracking_id IN (
         SELECT id FROM tracking_ids
         WHERE agent_id = ? AND marketplace = ? AND id != ?
       )`
  )
    .bind(
      input.keepTrackingId,
      input.agentId,
      input.agentId,
      input.marketplace,
      input.keepTrackingId
    )
    .run();

  await db.prepare(
    `UPDATE tracking_ids
     SET is_active = 0,
         is_default = 0
     WHERE agent_id = ? AND marketplace = ? AND id != ?`
  )
    .bind(input.agentId, input.marketplace, input.keepTrackingId)
    .run();

  await db.prepare(
    `UPDATE tracking_ids
     SET is_active = 1,
         is_default = 1
     WHERE id = ?`
  )
    .bind(input.keepTrackingId)
    .run();
}

/**
 * GET /api/tracking — List all tags with agent info
 */
tracking.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT t.*, a.name as agent_name, a.slug as agent_slug, asa.slug as alias_slug,
       (SELECT COUNT(*) FROM agent_products ap WHERE ap.tracking_id = t.id AND ap.is_active = 1) as linked_product_count
     FROM tracking_ids t
     JOIN agents a ON a.id = t.agent_id
     LEFT JOIN agent_slug_aliases asa
       ON asa.tracking_id = t.id AND asa.marketplace = t.marketplace AND asa.is_active = 1
     ORDER BY t.is_active DESC, t.created_at DESC`
  ).all();

  return c.json({ trackingIds: results });
});

/**
 * POST /api/tracking — Create a new tag.
 * Single-tag mode: one active tag per agent + marketplace. New tag becomes active/default.
 */
tracking.post('/', zValidator('json', createTrackingIdSchema), async (c) => {
  const data = c.req.valid('json');

  const agent = await c.env.DB.prepare('SELECT id, slug FROM agents WHERE id = ? AND is_active = 1')
    .bind(data.agent_id)
    .first<{ id: number; slug: string }>();
  if (!agent) throw new HTTPException(404, { message: 'Agent not found or inactive' });

  try {
    await c.env.DB.prepare(
      `INSERT INTO tracking_ids (agent_id, tag, label, marketplace, is_default, is_site_primary, is_active, is_portal_editable)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
    )
      .bind(
        data.agent_id,
        data.tag,
        data.label || null,
        data.marketplace,
        data.is_default ? 1 : 0,
        data.is_site_primary ? 1 : 0,
        data.is_portal_editable ? 1 : 0
      )
      .run();

    const trackingId = await c.env.DB.prepare(
      'SELECT * FROM tracking_ids WHERE agent_id = ? AND marketplace = ? AND tag = ? ORDER BY id DESC LIMIT 1'
    )
      .bind(data.agent_id, data.marketplace, data.tag)
      .first<{ id: number; agent_id: number; marketplace: string }>();

    if (!trackingId) {
      throw new HTTPException(500, { message: 'Tracking tag was not saved.' });
    }

    await enforceSingleActiveTagForAgentMarketplace(c.env.DB, {
      agentId: trackingId.agent_id,
      marketplace: trackingId.marketplace,
      keepTrackingId: trackingId.id,
    });

    await ensurePublicSlugAlias({
      db: c.env.DB,
      agentId: trackingId.agent_id,
      trackingId: trackingId.id,
      marketplace: trackingId.marketplace,
      fallbackSlug: agent.slug,
      preferredAlias: data.alias_slug || null,
    });

    return c.json({
      trackingId,
      message: 'Tag created. Other active tags for this agent + marketplace were turned off and linked products were moved to this tag.',
    }, 201);
  } catch (error: unknown) {
    if (error instanceof HTTPException) throw error;
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new HTTPException(409, {
        message: error.message.includes('agent_slug_aliases')
          ? 'Public slug alias already exists'
          : 'Tracking tag already exists',
      });
    }
    throw error;
  }
});

/**
 * PUT /api/tracking/:id — Update tag
 */
tracking.put('/:id', zValidator('json', updateTrackingIdSchema), async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) throw new HTTPException(400, { message: 'Invalid tag ID' });

  const body = c.req.valid('json');

  const current = await c.env.DB.prepare('SELECT * FROM tracking_ids WHERE id = ?')
    .bind(id)
    .first<{ id: number; agent_id: number; marketplace: string }>();
  if (!current) throw new HTTPException(404, { message: 'Tag not found' });

  const usage = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM agent_products WHERE tracking_id = ? AND is_active = 1'
  )
    .bind(id)
    .first<{ count: number }>();

  if (body.is_active === false && usage && usage.count > 0) {
    throw new HTTPException(409, {
      message: 'This tag is linked to active products. Replace or delete it first.',
    });
  }

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (body.tag !== undefined) { updates.push('tag = ?'); values.push(body.tag); }
  if (body.label !== undefined) { updates.push('label = ?'); values.push(body.label); }
  if (body.is_default !== undefined) { updates.push('is_default = ?'); values.push(body.is_default ? 1 : 0); }
  if (body.is_site_primary !== undefined) { updates.push('is_site_primary = ?'); values.push(body.is_site_primary ? 1 : 0); }
  if (body.is_active !== undefined) { updates.push('is_active = ?'); values.push(body.is_active ? 1 : 0); }
  if (body.is_portal_editable !== undefined) { updates.push('is_portal_editable = ?'); values.push(body.is_portal_editable ? 1 : 0); }

  try {
    if (updates.length > 0) {
      values.push(id);
      await c.env.DB.prepare(`UPDATE tracking_ids SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run();
    }

    if (body.is_active !== false) {
      await enforceSingleActiveTagForAgentMarketplace(c.env.DB, {
        agentId: current.agent_id,
        marketplace: current.marketplace,
        keepTrackingId: current.id,
      });
    }

    if (body.alias_slug !== undefined) {
      const normalizedAliasSlug = body.alias_slug?.trim() || null;
      if (normalizedAliasSlug) {
        await c.env.DB.prepare(
          `INSERT INTO agent_slug_aliases (agent_id, tracking_id, marketplace, slug, is_active)
           VALUES (?, ?, ?, ?, 1)
           ON CONFLICT(tracking_id, marketplace) DO UPDATE SET
             slug = excluded.slug,
             is_active = 1,
             updated_at = CURRENT_TIMESTAMP`
        )
          .bind(current.agent_id, current.id, current.marketplace, normalizedAliasSlug)
          .run();
      } else {
        await c.env.DB.prepare(
          `DELETE FROM agent_slug_aliases
           WHERE tracking_id = ? AND marketplace = ?`
        )
          .bind(current.id, current.marketplace)
          .run();
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new HTTPException(409, {
        message: error.message.includes('agent_slug_aliases')
          ? 'Public slug alias already exists'
          : 'Tracking tag already exists',
      });
    }
    throw error;
  }

  const updated = await c.env.DB.prepare(
    `SELECT t.*, a.name as agent_name, a.slug as agent_slug, asa.slug as alias_slug
     FROM tracking_ids t
     JOIN agents a ON a.id = t.agent_id
     LEFT JOIN agent_slug_aliases asa
       ON asa.tracking_id = t.id AND asa.marketplace = t.marketplace AND asa.is_active = 1
     WHERE t.id = ?`
  ).bind(id).first();
  return c.json({ trackingId: updated, message: 'Tag updated. Single-tag mode is enforced for this agent + marketplace.' });
});

/**
 * DELETE /api/tracking/:id — Delete tag
 */
tracking.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) throw new HTTPException(400, { message: 'Invalid tag ID' });

  const current = await c.env.DB.prepare(
    'SELECT id, agent_id, marketplace, tag FROM tracking_ids WHERE id = ?'
  )
    .bind(id)
    .first<{ id: number; agent_id: number; marketplace: string; tag: string }>();

  if (!current) {
    throw new HTTPException(404, { message: 'Tag not found' });
  }

  const usage = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM agent_products WHERE tracking_id = ?'
  )
    .bind(id)
    .first<{ count: number }>();

  if (usage && usage.count > 0) {
    try {
      const replacement = await requireSitePrimaryTrackingTarget(c.env.DB, current.marketplace, id);
      await remapAgentTrackingToSitePrimary(c.env.DB, id, replacement);
    } catch (error) {
      throw new HTTPException(409, {
        message: error instanceof Error ? error.message : 'Missing site-primary replacement tag.',
      });
    }
  }

  await c.env.DB.prepare('DELETE FROM agent_slug_aliases WHERE tracking_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM tracking_ids WHERE id = ?').bind(id).run();

  return c.json({
    message: usage && usage.count > 0
      ? `Moved ${usage.count} linked mapping${usage.count > 1 ? 's' : ''} to the site-primary tag and deleted ${current.tag}.`
      : 'Tag deleted',
  });
});

export default tracking;
