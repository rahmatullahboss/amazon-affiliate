import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../utils/types';

/**
 * JWT Authentication Middleware
 * Verifies JWT tokens using Web Crypto API (Cloudflare Workers compatible)
 */
export const authMiddleware = async (c: Context<AppEnv>, next: Next): Promise<void | Response> => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Authorization header required' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyJwt(token, c.env.JWT_SECRET);

    if (payload.exp && Date.now() / 1000 > (payload.exp as number)) {
      throw new HTTPException(401, { message: 'Token expired' });
    }

    c.set('userId', payload.sub as number);
    c.set('userRole', payload.role as string);
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(401, { message: 'Invalid token' });
  }

  await next();
};

async function verifyJwt(
  token: string,
  secret: string
): Promise<Record<string, unknown>> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = Uint8Array.from(
    atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
    (ch) => ch.charCodeAt(0)
  );

  const isValid = await crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    encoder.encode(signingInput)
  );

  if (!isValid) {
    throw new Error('Invalid signature');
  }

  const payloadStr = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(payloadStr);
}
