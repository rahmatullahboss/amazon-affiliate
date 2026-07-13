import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../utils/types';
import { createTrackingIdSchema, updateTrackingIdSchema } from '../schemas';
import {
  requireSitePrimaryTrackingTarget,
  remapAgentTrackingToSitePrimary,
} from '../services/site-primary-remap';
import { derivePublicSlugFromTrackingTag } from '../../shared/tracking-slug';
import { replaceSingleTrackingForAgentMarketplace } from '../services/single-tracking';

const tracking = new Hono<AppEnv>();

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

  const agent = await c.env.DB.prepare('SELECT id FROM agents WHERE id = ? AND is_active = 1')
    .bind(data.agent_id)
    .first<{ id: number }>();
  if (!agent) throw new HTTPException(404, { message: 'Agent not found or inactive' });

  const existing = await c.env.DB.prepare(
    'SELECT id FROM tracking_ids WHERE agent_id = ? AND marketplace = ? LIMIT 1'
  )
    .bind(data.agent_id, data.marketplace)
    .first<{ id: number }>();

  try {
    const trackingId = await replaceSingleTrackingForAgentMarketplace({
      db: c.env.DB,
      agentId: data.agent_id,
      marketplace: data.marketplace,
      tag: data.tag,
      label: data.label || null,
      aliasSlug: data.alias_slug || null,
      isSitePrimary: data.is_site_primary,
    });

    return c.json({
      trackingId,
      message: existing
        ? 'Tracking switched to the latest tag. Duplicate rows were removed and linked products now use this tag.'
        : 'Tracking tag created. Public slug uses the readable part before the Amazon -20/-21 suffix.',
    }, existing ? 200 : 201);
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

  const current = await c.env.DB.prepare(
    `SELECT t.id, t.agent_id, t.tag, t.label, t.marketplace, t.is_site_primary,
            asa.slug as alias_slug
     FROM tracking_ids t
     LEFT JOIN agent_slug_aliases asa
       ON asa.tracking_id = t.id AND asa.marketplace = t.marketplace AND asa.is_active = 1
     WHERE t.id = ?`
  )
    .bind(id)
    .first<{
      id: number;
      agent_id: number;
      tag: string;
      label: string | null;
      marketplace: string;
      is_site_primary: number;
      alias_slug: string | null;
    }>();
  if (!current) throw new HTTPException(404, { message: 'Tag not found' });

  const nextTag = body.tag ?? current.tag;
  const nextLabel = body.label !== undefined ? body.label : current.label;
  const currentDefaultAlias = derivePublicSlugFromTrackingTag(current.tag);
  const nextDefaultAlias = derivePublicSlugFromTrackingTag(nextTag);
  const aliasWasFollowingTag = !current.alias_slug || current.alias_slug === currentDefaultAlias;
  const nextAlias = body.alias_slug !== undefined
    ? body.alias_slug || nextDefaultAlias
    : aliasWasFollowingTag
      ? nextDefaultAlias
      : current.alias_slug;

  try {
    await replaceSingleTrackingForAgentMarketplace({
      db: c.env.DB,
      agentId: current.agent_id,
      marketplace: current.marketplace,
      tag: nextTag,
      label: nextLabel,
      aliasSlug: nextAlias,
      isSitePrimary: body.is_site_primary ?? (current.is_site_primary === 1),
    });
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
     WHERE t.agent_id = ? AND t.marketplace = ?
     LIMIT 1`
  ).bind(current.agent_id, current.marketplace).first();
  return c.json({
    trackingId: updated,
    message: 'Tracking updated. Public slug follows the tag name before the Amazon -20/-21 suffix unless admin sets a custom slug.',
  });
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
