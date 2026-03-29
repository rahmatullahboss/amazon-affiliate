const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface AuthSessionUser {
  id: number;
  username: string;
  role: string;
  agentId: number | null;
}

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;

  const prefix = `${name}=`;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!match) return null;

  return decodeURIComponent(match.slice(prefix.length));
}

function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
}

function clearCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function getAuthToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("auth_token") || getCookieValue("auth_token") || "";
}

export function getAuthUser(): AuthSessionUser | null {
  if (typeof window === "undefined") return null;

  const raw =
    localStorage.getItem("auth_user") ||
    getCookieValue("auth_user");

  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSessionUser;
  } catch {
    return null;
  }
}

export function persistAuthSession(token: string, user: AuthSessionUser): void {
  if (typeof window === "undefined") return;

  const serializedUser = JSON.stringify(user);
  localStorage.setItem("auth_token", token);
  localStorage.setItem("auth_user", serializedUser);
  setCookie("auth_token", token, SESSION_MAX_AGE_SECONDS);
  setCookie("auth_user", serializedUser, SESSION_MAX_AGE_SECONDS);
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
  clearCookie("auth_token");
  clearCookie("auth_user");
}

export function restoreAuthSession(): AuthSessionUser | null {
  if (typeof window === "undefined") return null;

  const token = getAuthToken();
  const user = getAuthUser();

  if (!token || !user) return null;

  localStorage.setItem("auth_token", token);
  localStorage.setItem("auth_user", JSON.stringify(user));
  return user;
}
