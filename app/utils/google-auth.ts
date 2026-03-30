import { extractApiErrorMessage } from "./api-errors";
import type { AuthSessionUser } from "./auth-session";

export interface GoogleAuthProfile {
  email?: string;
  name?: string | null;
}

export interface GoogleAuthResponse {
  token?: string;
  user?: AuthSessionUser;
  requiresCompletion?: boolean;
  signupToken?: string;
  profile?: GoogleAuthProfile;
  error?: unknown;
  message?: string;
}

export async function exchangeGoogleCredential(
  credential: string,
  fallbackMessage: string
): Promise<GoogleAuthResponse> {
  const response = await fetch("/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });

  const data = (await response.json()) as GoogleAuthResponse;

  if (!response.ok) {
    throw new Error(extractApiErrorMessage(data, fallbackMessage));
  }

  return data;
}

export function buildGoogleCompleteSignupPath(
  signupToken: string,
  profile?: GoogleAuthProfile
): string {
  const params = new URLSearchParams({
    token: signupToken,
    email: profile?.email || "",
    name: profile?.name || "",
  });

  return `/portal/complete-signup?${params.toString()}`;
}
