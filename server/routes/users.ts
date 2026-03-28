import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../utils/types';
import { createUserSchema, updateUserSchema } from '../schemas';
import { hashPassword } from '../services/auth';
import { writeAuditLog } from '../services/audit-log';

const users = new Hono<AppEnv>();

users.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.username, u.email, u.role, u.agent_id, u.is_active, u.created_at, u.updated_at,
            a.name as agent_name, a.slug as agent_slug
     FROM users u
     LEFT JOIN agents a ON a.id = u.agent_id
     ORDER BY u.created_at DESC`
  ).all();

  return c.json({ users: results ?? [] });
});

users.post('/', zValidator('json', createUserSchema), async (c) => {
  const body = c.req.valid('json');

  if (body.role === 'agent' && !body.agent_id) {
    throw new HTTPException(400, { message: 'Agent users must be linked to an agent profile' });
  }

  if (body.agent_id) {
    const agent = await c.env.DB.prepare('SELECT id FROM agents WHERE id = ? AND is_active = 1')
      .bind(body.agent_id)
      .first();
    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found or inactive' });
    }
  }

  const passwordHash = await hashPassword(body.password);

  try {
    await c.env.DB.prepare(
      `INSERT INTO users (username, email, password_hash, role, agent_id)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(body.username, body.email || null, passwordHash, body.role, body.agent_id ?? null)
      .run();
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new HTTPException(409, { message: 'Username or email already exists' });
    }
    throw error;
  }

  const user = await c.env.DB.prepare(
    `SELECT u.id, u.username, u.email, u.role, u.agent_id, u.is_active,
            a.name as agent_name, a.slug as agent_slug
     FROM users u
     LEFT JOIN agents a ON a.id = u.agent_id
     WHERE u.username = ?`
  )
    .bind(body.username)
    .first();

  c.executionCtx.waitUntil(
    writeAuditLog(c.env.DB, {
      userId: c.get('userId'),
      action: 'user.created',
      entityType: 'user',
      entityId: (user as { id?: number } | null)?.id ?? body.username,
      details: {
        username: body.username,
        role: body.role,
        agentId: body.agent_id ?? null,
      },
    })
  );

  return c.json({ user, message: 'User created successfully' }, 201);
});

users.put('/:id', zValidator('json', updateUserSchema), async (c) => {
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid user ID' });
  }

  const current = await c.env.DB.prepare('SELECT id, role FROM users WHERE id = ?')
    .bind(id)
    .first<{ id: number; role: string }>();

  if (!current) {
    throw new HTTPException(404, { message: 'User not found' });
  }

  const body = c.req.valid('json');

  if (body.role === 'agent' && body.agent_id === undefined) {
    const existing = await c.env.DB.prepare('SELECT agent_id FROM users WHERE id = ?')
      .bind(id)
      .first<{ agent_id: number | null }>();
    if (!existing?.agent_id) {
      throw new HTTPException(400, { message: 'Agent users must be linked to an agent profile' });
    }
  }

  if (body.agent_id) {
    const agent = await c.env.DB.prepare('SELECT id FROM agents WHERE id = ? AND is_active = 1')
      .bind(body.agent_id)
      .first();
    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found or inactive' });
    }
  }

  const updates: string[] = [];
  const values: Array<string | number | null> = [];

  if (body.email !== undefined) {
    updates.push('email = ?');
    values.push(body.email);
  }

  if (body.role !== undefined) {
    updates.push('role = ?');
    values.push(body.role);
  }

  if (body.agent_id !== undefined) {
    updates.push('agent_id = ?');
    values.push(body.agent_id);
  }

  if (body.is_active !== undefined) {
    updates.push('is_active = ?');
    values.push(body.is_active ? 1 : 0);
  }

  if (body.password !== undefined) {
    updates.push('password_hash = ?');
    values.push(await hashPassword(body.password));
  }

  if (updates.length === 0) {
    throw new HTTPException(400, { message: 'No fields to update' });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  const user = await c.env.DB.prepare(
    `SELECT u.id, u.username, u.email, u.role, u.agent_id, u.is_active,
            a.name as agent_name, a.slug as agent_slug
     FROM users u
     LEFT JOIN agents a ON a.id = u.agent_id
     WHERE u.id = ?`
  )
    .bind(id)
    .first();

  c.executionCtx.waitUntil(
    writeAuditLog(c.env.DB, {
      userId: c.get('userId'),
      action: 'user.updated',
      entityType: 'user',
      entityId: id,
      details: {
        emailUpdated: body.email !== undefined,
        role: body.role,
        agentId: body.agent_id,
        isActive: body.is_active,
        passwordUpdated: body.password !== undefined,
      },
    })
  );

  return c.json({ user, message: 'User updated successfully' });
});

export default users;
