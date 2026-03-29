import type { Bindings } from './types';

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getPublicAppOrigin(requestUrl: string, env: Pick<Bindings, 'PUBLIC_APP_URL'>): string {
  const configuredOrigin = env.PUBLIC_APP_URL ? normalizeOrigin(env.PUBLIC_APP_URL) : null;
  if (configuredOrigin) return configuredOrigin;
  return new URL(requestUrl).origin;
}

export function shouldRedirectToPublicAppUrl(
  requestUrl: string,
  env: Pick<Bindings, 'PUBLIC_APP_URL'>
): string | null {
  const configuredOrigin = env.PUBLIC_APP_URL ? normalizeOrigin(env.PUBLIC_APP_URL) : null;
  if (!configuredOrigin) return null;

  const currentUrl = new URL(requestUrl);
  const targetUrl = new URL(configuredOrigin);

  if (currentUrl.host === targetUrl.host) return null;
  if (!currentUrl.hostname.endsWith('.workers.dev')) return null;

  currentUrl.protocol = targetUrl.protocol;
  currentUrl.host = targetUrl.host;
  return currentUrl.toString();
}
