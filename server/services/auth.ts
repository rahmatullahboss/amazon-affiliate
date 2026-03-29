import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const PBKDF2_ITERATIONS = 100_000;
const LEGACY_PBKDF2_ITERATIONS = 310_000;
const SALT_LENGTH = 16;

function parseStoredHash(storedHash: string): {
  iterations: number;
  saltHex: string;
  expectedHash: string;
} | null {
  if (storedHash.includes('$')) {
    const [iterationsRaw, payload] = storedHash.split('$', 2);
    const [saltHex, expectedHash] = payload?.split(':') ?? [];
    const iterations = Number.parseInt(iterationsRaw, 10);

    if (!Number.isFinite(iterations) || !saltHex || !expectedHash) return null;

    return { iterations, saltHex, expectedHash };
  }

  const [saltHex, expectedHash] = storedHash.split(':');
  if (!saltHex || !expectedHash) return null;

  return {
    iterations: LEGACY_PBKDF2_ITERATIONS,
    saltHex,
    expectedHash,
  };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, "sha256");
  const saltHex = salt.toString("hex");
  const hashHex = hash.toString("hex");

  return `${PBKDF2_ITERATIONS}$${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parsed = parseStoredHash(storedHash);
  if (!parsed) return false;

  const salt = Buffer.from(parsed.saltHex, "hex");
  const expected = Buffer.from(parsed.expectedHash, "hex");
  const actual = pbkdf2Sync(password, salt, parsed.iterations, expected.length, "sha256");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

export async function createJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + 86400 };
  const payloadB64 = btoa(JSON.stringify(fullPayload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${payloadB64}`));
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${header}.${payloadB64}.${signature}`;
}
