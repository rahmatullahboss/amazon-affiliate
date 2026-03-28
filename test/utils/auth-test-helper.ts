import type { AppEnv } from '../../server/utils/types';

/**
 * Creates a valid JWT for testing, mimicking the internal auth implementation
 */
export async function createTestJwt(
  payload: Record<string, unknown>,
  secret: string
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };

  const encodePayload = (obj: any) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  const headerB64 = encodePayload(header);
  const payloadB64 = encodePayload(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signingInput)
  );

  const signatureB64 = btoa(
    String.fromCharCode(...new Uint8Array(signatureBuffer))
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}
