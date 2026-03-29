import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../utils/types';
import {
  agentRegistrationSchema,
  forgotPasswordSchema,
  googleAuthSchema,
  googleCompleteSignupSchema,
  loginSchema,
  resetPasswordSchema,
  setupSchema,
} from '../schemas';
import { createJwt, hashPassword, verifyPassword } from '../services/auth';
import {
  consumeGoogleSignupToken,
  consumePasswordResetToken,
  generatePasswordResetToken,
  sendPasswordResetEmail,
  storeGoogleSignupToken,
  storePasswordResetToken,
} from '../services/password-reset';
import { getPublicAppOrigin } from '../utils/url';
import { verifyGoogleCredential } from '../services/google-auth';

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
  const envAdminMatch =
    username === c.env.ADMIN_USERNAME && password === c.env.ADMIN_PASSWORD;

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

  if (!user && !legacyAdmin && !envAdminMatch) {
    c.executionCtx.waitUntil(recordFailedLogin(c.env.KV, ip));
    throw new HTTPException(401, { message: 'Invalid credentials' });
  }

  if (user && !user.is_active) {
    throw new HTTPException(403, { message: 'User account is inactive' });
  }

  const account = user ?? (legacyAdmin
    ? {
        ...legacyAdmin,
        agent_id: null,
        is_active: 1,
      }
    : null);

  if (!account) {
    c.executionCtx.waitUntil(recordFailedLogin(c.env.KV, ip));
    throw new HTTPException(401, { message: 'Invalid credentials' });
  }

  let isValid = false;

  if (envAdminMatch && (account.role === 'super_admin' || account.role === 'admin')) {
    isValid = true;
  } else {
    isValid = await verifyPassword(password, account.password_hash);
  }

  if (!isValid) {
    c.executionCtx.waitUntil(recordFailedLogin(c.env.KV, ip));
    throw new HTTPException(401, { message: 'Invalid credentials' });
  }

  if (envAdminMatch && (account.role === 'super_admin' || account.role === 'admin')) {
    const upgradedHash = await hashPassword(password);

    if (user) {
      await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        .bind(upgradedHash, user.id)
        .run();
    }

    if (legacyAdmin) {
      await c.env.DB.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?')
        .bind(upgradedHash, legacyAdmin.id)
        .run();
    }
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

auth.post('/register-agent', zValidator('json', agentRegistrationSchema), async (c) => {
  const body = c.req.valid('json');
  const passwordHash = await hashPassword(body.password);

  try {
    await c.env.DB.prepare(
      'INSERT INTO agents (name, slug, email, phone) VALUES (?, ?, ?, ?)'
    )
      .bind(body.agent_name, body.agent_slug, body.email || null, body.phone || null)
      .run();
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new HTTPException(409, { message: 'Agent slug already exists' });
    }
    throw error;
  }

  const agent = await c.env.DB.prepare('SELECT id, name, slug FROM agents WHERE slug = ?')
    .bind(body.agent_slug)
    .first<{ id: number; name: string; slug: string }>();

  if (!agent) {
    throw new HTTPException(500, { message: 'Agent creation failed unexpectedly' });
  }

  try {
    await c.env.DB.prepare(
      `INSERT INTO users (username, email, password_hash, role, agent_id)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(body.username, body.email || null, passwordHash, 'agent', agent.id)
      .run();
  } catch (error: unknown) {
    await c.env.DB.prepare('DELETE FROM agents WHERE id = ?').bind(agent.id).run();

    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new HTTPException(409, { message: 'Username or email already exists' });
    }
    throw error;
  }

  const user = await c.env.DB.prepare(
    'SELECT id, username, role, agent_id FROM users WHERE username = ?'
  )
    .bind(body.username)
    .first<{ id: number; username: string; role: string; agent_id: number | null }>();

  if (!user) {
    throw new HTTPException(500, { message: 'User creation failed unexpectedly' });
  }

  const token = await createJwt(
    { sub: user.id, username: user.username, role: 'agent', agentId: user.agent_id },
    c.env.JWT_SECRET
  );

  return c.json(
    {
      message: 'Agent account created successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: 'agent',
        agentId: user.agent_id,
      },
      agent,
    },
    201
  );
});

auth.post('/forgot-password', zValidator('json', forgotPasswordSchema), async (c) => {
  const { email } = c.req.valid('json');

  const user = await c.env.DB.prepare(
    `SELECT id, email, is_active
     FROM users
     WHERE email = ? AND role = 'agent'
     LIMIT 1`
  )
    .bind(email)
    .first<{ id: number; email: string | null; is_active: number }>();

  if (user && user.is_active && user.email) {
    const token = generatePasswordResetToken();
    const origin = getPublicAppOrigin(c.req.url, c.env);
    const resetUrl = `${origin}/portal/reset-password?token=${encodeURIComponent(token)}`;

    try {
      await storePasswordResetToken(c.env.KV, token, user.id);
      await sendPasswordResetEmail({
        env: c.env,
        to: user.email,
        resetUrl,
      });
    } catch (error: unknown) {
      throw new HTTPException(503, {
        message:
          error instanceof Error && error.message
            ? error.message
            : 'Password reset email is not available right now.',
      });
    }
  }

  return c.json({
    message: 'If this email exists in the system, a password reset link has been sent.',
  });
});

auth.post('/reset-password', zValidator('json', resetPasswordSchema), async (c) => {
  const { token, password } = c.req.valid('json');
  const userId = await consumePasswordResetToken(c.env.KV, token);

  if (!userId) {
    throw new HTTPException(400, { message: 'This reset link is invalid or expired.' });
  }

  const passwordHash = await hashPassword(password);

  await c.env.DB.prepare(
    `UPDATE users
     SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND is_active = 1`
  )
    .bind(passwordHash, userId)
    .run();

  return c.json({ message: 'Password reset successful. You can now sign in.' });
});

auth.post('/google', zValidator('json', googleAuthSchema), async (c) => {
  const { credential } = c.req.valid('json');
  const profile = await verifyGoogleCredential(credential, c.env);

  let user = await c.env.DB.prepare(
    `SELECT id, username, role, agent_id, is_active
     FROM users
     WHERE google_sub = ?
     LIMIT 1`
  )
    .bind(profile.sub)
    .first<{ id: number; username: string; role: string; agent_id: number | null; is_active: number }>();

  if (!user && profile.email) {
    user = await c.env.DB.prepare(
      `SELECT id, username, role, agent_id, is_active
       FROM users
       WHERE email = ?
       LIMIT 1`
    )
      .bind(profile.email)
      .first<{ id: number; username: string; role: string; agent_id: number | null; is_active: number }>();

    if (user) {
      await c.env.DB.prepare(
        `UPDATE users
         SET google_sub = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
        .bind(profile.sub, user.id)
        .run();
    }
  }

  if (user) {
    if (!user.is_active) {
      throw new HTTPException(403, { message: 'User account is inactive' });
    }

    const token = await createJwt(
      {
        sub: user.id,
        username: user.username,
        role: user.role,
        agentId: user.agent_id,
      },
      c.env.JWT_SECRET
    );

    return c.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        agentId: user.agent_id,
      },
    });
  }

  const signupToken = generatePasswordResetToken();
  await storeGoogleSignupToken(c.env.KV, signupToken, {
    email: profile.email,
    name: profile.name,
    googleSub: profile.sub,
  });

  return c.json({
    requiresCompletion: true,
    signupToken,
    profile: {
      email: profile.email,
      name: profile.name,
    },
  });
});

auth.post('/google/complete-signup', zValidator('json', googleCompleteSignupSchema), async (c) => {
  const body = c.req.valid('json');
  const pending = await consumeGoogleSignupToken(c.env.KV, body.token);

  if (!pending) {
    throw new HTTPException(400, { message: 'This signup session is invalid or expired.' });
  }

  const passwordHash = await hashPassword(crypto.randomUUID());

  try {
    await c.env.DB.prepare(
      'INSERT INTO agents (name, slug, email, phone) VALUES (?, ?, ?, ?)'
    )
      .bind(body.agent_name, body.agent_slug, pending.email, body.phone || null)
      .run();
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new HTTPException(409, { message: 'Agent slug already exists' });
    }
    throw error;
  }

  const agent = await c.env.DB.prepare('SELECT id, name, slug FROM agents WHERE slug = ?')
    .bind(body.agent_slug)
    .first<{ id: number; name: string; slug: string }>();

  if (!agent) {
    throw new HTTPException(500, { message: 'Agent creation failed unexpectedly' });
  }

  try {
    await c.env.DB.prepare(
      `INSERT INTO users (username, email, password_hash, role, agent_id, google_sub)
       VALUES (?, ?, ?, 'agent', ?, ?)`
    )
      .bind(body.username, pending.email, passwordHash, agent.id, pending.googleSub)
      .run();
  } catch (error: unknown) {
    await c.env.DB.prepare('DELETE FROM agents WHERE id = ?').bind(agent.id).run();

    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new HTTPException(409, { message: 'Username or email already exists' });
    }
    throw error;
  }

  const user = await c.env.DB.prepare(
    'SELECT id, username, role, agent_id FROM users WHERE username = ?'
  )
    .bind(body.username)
    .first<{ id: number; username: string; role: string; agent_id: number | null }>();

  if (!user) {
    throw new HTTPException(500, { message: 'User creation failed unexpectedly' });
  }

  const token = await createJwt(
    { sub: user.id, username: user.username, role: 'agent', agentId: user.agent_id },
    c.env.JWT_SECRET
  );

  return c.json(
    {
      message: 'Agent account created successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: 'agent',
        agentId: user.agent_id,
      },
      agent,
    },
    201
  );
});

export default auth;
