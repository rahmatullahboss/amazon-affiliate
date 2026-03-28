const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  const saltHex = Array.from(salt).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');

  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, expectedHash] = storedHash.split(':');
  if (!saltHex || !expectedHash) return false;

  const encoder = new TextEncoder();
  const salt = new Uint8Array(saltHex.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) ?? []);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );

  const hashHex = Array.from(new Uint8Array(derivedBits))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return hashHex === expectedHash;
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
