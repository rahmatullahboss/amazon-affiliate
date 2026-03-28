import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../utils/types';
import { loginSchema, setupSchema } from '../schemas';

const auth = new Hono<AppEnv>();

// ─── Password Hashing with PBKDF2 (Web Crypto) ───────────
// SHA-256 is NOT suitable for passwords — too fast, brute-forceable.
// PBKDF2 with 100K iterations is the correct approach for Workers runtime.

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16; // 128-bit salt

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Store as "salt:hash" — both the salt and hash are needed for verification
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, expectedHash] = storedHash.split(':');
  if (!saltHex || !expectedHash) return false;

  const encoder = new TextEncoder();
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));

  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );

  const hashHex = Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return hashHex === expectedHash;
}

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

  const user = await c.env.DB.prepare('SELECT * FROM admin_users WHERE username = ?')
    .bind(username)
    .first<{ id: number; username: string; password_hash: string; role: string }>();

  if (!user) {
    c.executionCtx.waitUntil(recordFailedLogin(c.env.KV, ip));
    throw new HTTPException(401, { message: 'Invalid credentials' });
  }

  const isValid = await verifyPassword(password, user.password_hash);

  if (!isValid) {
    c.executionCtx.waitUntil(recordFailedLogin(c.env.KV, ip));
    throw new HTTPException(401, { message: 'Invalid credentials' });
  }

  // Clear rate limit on successful login
  c.executionCtx.waitUntil(clearLoginAttempts(c.env.KV, ip));

  const token = await createJwt(
    { sub: user.id, username: user.username, role: user.role },
    c.env.JWT_SECRET
  );

  return c.json({
    token,
    user: { id: user.id, username: user.username, role: user.role },
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

  const { username, password } = c.req.valid('json');
  const passwordHash = await hashPassword(password);

  await c.env.DB.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)')
    .bind(username, passwordHash, 'admin')
    .run();

  const user = await c.env.DB.prepare('SELECT * FROM admin_users WHERE username = ?')
    .bind(username)
    .first<{ id: number; username: string; role: string }>();

  const token = await createJwt(
    { sub: user!.id, username: user!.username, role: user!.role },
    c.env.JWT_SECRET
  );

  return c.json(
    {
      message: 'Admin account created successfully',
      token,
      user: { id: user!.id, username: user!.username, role: user!.role },
    },
    201
  );
});

// ─── JWT Creation (24-hour expiry) ───────────────────────
async function createJwt(
  payload: Record<string, unknown>,
  secret: string
): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + 86400 }; // 24 hours
  const payloadB64 = btoa(JSON.stringify(fullPayload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );

  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${payloadB64}`));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${header}.${payloadB64}.${signature}`;
}

export default auth;
