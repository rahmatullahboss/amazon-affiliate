import type { Bindings } from '../utils/types';

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

export async function verifyGoogleCredential(
  credential: string,
  env: Bindings
): Promise<GoogleProfile> {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new Error('Google sign-in is not configured');
  }

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
  );

  if (!response.ok) {
    throw new Error('Google token verification failed');
  }

  const payload = (await response.json()) as {
    aud?: string;
    sub?: string;
    email?: string;
    email_verified?: string;
    name?: string;
    picture?: string;
  };

  if (payload.aud !== env.GOOGLE_CLIENT_ID) {
    throw new Error('Google token audience mismatch');
  }

  if (!payload.sub || !payload.email) {
    throw new Error('Google profile data is incomplete');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === 'true',
    name: payload.name || null,
    picture: payload.picture || null,
  };
}
