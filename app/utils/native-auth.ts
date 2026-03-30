import { Capacitor } from "@capacitor/core";
import type { AuthSessionUser } from "./auth-session";

const NATIVE_AUTH_CALLBACK_URL = "com.dealsrky.agent://auth";

export type NativeGoogleAuthMode = "login" | "signup";

export interface NativeAuthCallbackPayload {
  next?: string;
  token?: string;
  user?: AuthSessionUser;
}

export function isNativeCapacitorApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function buildNativeGoogleAuthUrl(mode: NativeGoogleAuthMode): string {
  const url = new URL("/portal/google-external", window.location.origin);
  url.searchParams.set("mode", mode);
  url.searchParams.set("source", "native-app");
  return url.toString();
}

export function buildNativeAuthCallbackUrl(
  payload: NativeAuthCallbackPayload
): string {
  const url = new URL(NATIVE_AUTH_CALLBACK_URL);

  if (payload.next) {
    url.searchParams.set("next", payload.next);
  }

  if (payload.token) {
    url.searchParams.set("token", payload.token);
  }

  if (payload.user) {
    url.searchParams.set("user", JSON.stringify(payload.user));
  }

  return url.toString();
}

export function parseNativeAuthCallbackUrl(
  value: string
): NativeAuthCallbackPayload | null {
  try {
    const url = new URL(value);

    if (url.protocol !== "com.dealsrky.agent:" || url.host !== "auth") {
      return null;
    }

    const token = url.searchParams.get("token") || undefined;
    const next = url.searchParams.get("next") || undefined;
    const serializedUser = url.searchParams.get("user");

    let user: AuthSessionUser | undefined;

    if (serializedUser) {
      user = JSON.parse(serializedUser) as AuthSessionUser;
    }

    return { next, token, user };
  } catch {
    return null;
  }
}
