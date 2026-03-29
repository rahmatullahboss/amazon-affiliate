import type { Bindings } from '../utils/types';
import { safeKvDelete, safeKvGetText, safeKvPut } from './kv-safe';

const RESET_TOKEN_TTL_SECONDS = 60 * 60;
const GOOGLE_SIGNUP_TTL_SECONDS = 15 * 60;

function toSqliteDateTime(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 19).replace("T", " ");
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generatePasswordResetToken(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

export async function storePasswordResetToken(
  db: D1Database,
  kv: KVNamespace,
  token: string,
  userId: number
): Promise<void> {
  const payload = JSON.stringify({ userId });
  const expiresAt = toSqliteDateTime(Date.now() + RESET_TOKEN_TTL_SECONDS * 1000);
  const storedInKv = await safeKvPut(kv, `password-reset:${token}`, payload, {
    expirationTtl: RESET_TOKEN_TTL_SECONDS,
  });

  if (!storedInKv) {
    await db.prepare(
      `INSERT OR REPLACE INTO temp_tokens (token, purpose, payload, expires_at, created_at)
       VALUES (?, 'password_reset', ?, ?, CURRENT_TIMESTAMP)`
    )
      .bind(token, payload, expiresAt)
      .run();
  }
}

export async function consumePasswordResetToken(
  db: D1Database,
  kv: KVNamespace,
  token: string
): Promise<number | null> {
  const kvKey = `password-reset:${token}`;
  const raw = await safeKvGetText(kv, kvKey);

  if (raw) {
    await safeKvDelete(kv, kvKey);

    try {
      const parsed = JSON.parse(raw) as { userId?: number };
      return typeof parsed.userId === 'number' ? parsed.userId : null;
    } catch {
      return null;
    }
  }

  const fallback = await db.prepare(
    `SELECT payload
     FROM temp_tokens
     WHERE token = ? AND purpose = 'password_reset' AND expires_at > CURRENT_TIMESTAMP
     LIMIT 1`
  )
    .bind(token)
    .first<{ payload: string }>();

  if (!fallback?.payload) return null;

  await db.prepare(`DELETE FROM temp_tokens WHERE token = ? AND purpose = 'password_reset'`)
    .bind(token)
    .run();

  try {
    const parsed = JSON.parse(fallback.payload) as { userId?: number };
    return typeof parsed.userId === 'number' ? parsed.userId : null;
  } catch {
    return null;
  }
}

export async function sendPasswordResetEmail({
  env,
  to,
  resetUrl,
}: {
  env: Bindings;
  to: string;
  resetUrl: string;
}): Promise<void> {
  if (!env.RESEND_API_KEY) {
    throw new Error('Password reset email provider is not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: [to],
      reply_to: env.RESEND_REPLY_TO || undefined,
      subject: 'Reset your DealsRky portal password',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h2 style="margin:0 0 16px">Reset your password</h2>
          <p style="margin:0 0 16px">
            Click the button below to set a new password for your DealsRky portal account.
          </p>
          <p style="margin:24px 0">
            <a
              href="${resetUrl}"
              style="display:inline-block;background:#f59e0b;color:#111827;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700"
            >
              Reset password
            </a>
          </p>
          <p style="margin:0 0 12px">This link expires in 1 hour.</p>
          <p style="margin:0;color:#6b7280;font-size:14px">
            If you did not request this, you can ignore this email.
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send reset email: ${response.status} ${errorText}`);
  }
}

export async function storeGoogleSignupToken(
  db: D1Database,
  kv: KVNamespace,
  token: string,
  payload: {
    email: string;
    name: string | null;
    googleSub: string;
  }
): Promise<void> {
  const serialized = JSON.stringify(payload);
  const expiresAt = toSqliteDateTime(Date.now() + GOOGLE_SIGNUP_TTL_SECONDS * 1000);
  const storedInKv = await safeKvPut(kv, `google-signup:${token}`, serialized, {
    expirationTtl: GOOGLE_SIGNUP_TTL_SECONDS,
  });

  if (!storedInKv) {
    await db.prepare(
      `INSERT OR REPLACE INTO temp_tokens (token, purpose, payload, expires_at, created_at)
       VALUES (?, 'google_signup', ?, ?, CURRENT_TIMESTAMP)`
    )
      .bind(token, serialized, expiresAt)
      .run();
  }
}

export async function consumeGoogleSignupToken(
  db: D1Database,
  kv: KVNamespace,
  token: string
): Promise<{
  email: string;
  name: string | null;
  googleSub: string;
} | null> {
  const kvKey = `google-signup:${token}`;
  let raw = await safeKvGetText(kv, kvKey);

  if (raw) {
    await safeKvDelete(kv, kvKey);
  } else {
    const fallback = await db.prepare(
      `SELECT payload
       FROM temp_tokens
       WHERE token = ? AND purpose = 'google_signup' AND expires_at > CURRENT_TIMESTAMP
       LIMIT 1`
    )
      .bind(token)
      .first<{ payload: string }>();

    raw = fallback?.payload || null;
    if (!raw) return null;

    await db.prepare(`DELETE FROM temp_tokens WHERE token = ? AND purpose = 'google_signup'`)
      .bind(token)
      .run();
  }

  try {
    const parsed = JSON.parse(raw) as {
      email?: string;
      name?: string | null;
      googleSub?: string;
    };

    if (!parsed.email || !parsed.googleSub) return null;

    return {
      email: parsed.email,
      name: parsed.name ?? null,
      googleSub: parsed.googleSub,
    };
  } catch {
    return null;
  }
}
