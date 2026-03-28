import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../utils/types';
import { loginSchema, setupSchema } from '../schemas';
import { createJwt, hashPassword, verifyPassword } from '../services/auth';

const auth = new Hono<AppEnv>();

// ─── Rate Limiting ───────────────────────────────────────
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 900; // 15 minutes in seconds

async function checkRateLimit(kv: KVNamespace, ip: string): Promise<void> {
  const key = `rate:login:${ip}`;
  const attempts = parseInt((await kv.get(key)) || '0');

  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    throw new HTTPException(429, { message: 'Too many login attempts. Try again in 15 minutes.' });
  }
}

async function recordFailedLogin(kv: KVNamespace, ip: string): Promise<void> {
  const key = `rate:login:${ip}`;
  const attempts = parseInt((await kv.get(key)) || '0');
  await kv.put(key, String(attempts + 1), { expirationTtl: LOCKOUT_DURATION });
}

async function clearLoginAttempts(kv: KVNamespace, ip: string): Promise<void> {
  await kv.delete(`rate:login:${ip}`);
}

/**
 * POST /api/auth/login - Admin login
 */
auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  await checkRateLimit(c.env.KV, ip);

  const { username, password } = c.req.valid('json');

  const user = await c.env.DB.prepare(
    `SELECT id, username, password_hash, role, agent_id, is_active
     FROM users
     WHERE username = ?`
  )
    .bind(username)
    .first<{ id: number; username: string; password_hash: string; role: string; agent_id: number | null; is_active: number }>();

  const legacyAdmin = !user
    ? await c.env.DB.prepare('SELECT id, username, password_hash, role FROM admin_users WHERE username = ?')
        .bind(username)
        .first<{ id: number; username: string; password_hash: string; role: string }>()
    : null;

  if (!user && !legacyAdmin) {
    c.executionCtx.waitUntil(recordFailedLogin(c.env.KV, ip));
    throw new HTTPException(401, { message: 'Invalid credentials' });
  }

  if (user && !user.is_active) {
    throw new HTTPException(403, { message: 'User account is inactive' });
  }

  const account = user ?? {
    ...legacyAdmin!,
    agent_id: null,
    is_active: 1,
  };

  const isValid = await verifyPassword(password, account.password_hash);

  if (!isValid) {
    c.executionCtx.waitUntil(recordFailedLogin(c.env.KV, ip));
    throw new HTTPException(401, { message: 'Invalid credentials' });
  }

  // Clear rate limit on successful login
  c.executionCtx.waitUntil(clearLoginAttempts(c.env.KV, ip));

  const token = await createJwt(
    {
      sub: account.id,
      username: account.username,
      role: account.role,
      agentId: account.agent_id,
    },
    c.env.JWT_SECRET
  );

  return c.json({
    token,
    user: {
      id: account.id,
      username: account.username,
      role: account.role,
      agentId: account.agent_id,
    },
  });
});

/**
 * POST /api/auth/setup - Initial admin setup (one-time)
 */
auth.post('/setup', zValidator('json', setupSchema), async (c) => {
  const existing = await c.env.DB.prepare('SELECT COUNT(*) as count FROM admin_users')
    .first<{ count: number }>();

  if (existing && existing.count > 0) {
    throw new HTTPException(403, { message: 'Setup already completed. Use login instead.' });
  }

  const { username, email, password } = c.req.valid('json');
  const passwordHash = await hashPassword(password);

  await c.env.DB.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)')
    .bind(username, passwordHash, 'admin')
    .run();

  await c.env.DB.prepare(
    'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
  )
    .bind(username, email || null, passwordHash, 'super_admin')
    .run();

  const user = await c.env.DB.prepare('SELECT id, username, role, agent_id FROM users WHERE username = ?')
    .bind(username)
    .first<{ id: number; username: string; role: string; agent_id: number | null }>();

  const token = await createJwt(
    { sub: user!.id, username: user!.username, role: 'super_admin', agentId: user!.agent_id },
    c.env.JWT_SECRET
  );

  return c.json(
    {
      message: 'Admin account created successfully',
      token,
      user: { id: user!.id, username: user!.username, role: 'super_admin', agentId: user!.agent_id },
    },
    201
  );
});

export default auth;
