import { AMAZON_DOMAINS, type Bindings } from './types';

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

export function normalizeMarketplaceHint(value: string | null | undefined): string | null {
  const normalized = (value || '').trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  return AMAZON_DOMAINS[normalized] ? normalized : null;
}

function toMarketplaceCountrySlug(value: string | null | undefined): string | null {
  const normalizedMarketplace = normalizeMarketplaceHint(value);
  return normalizedMarketplace ? normalizedMarketplace.toLowerCase() : null;
}

export function buildCanonicalBridgePath(
  agentSlug: string,
  asin: string,
  marketplace: string | null | undefined
): string {
  const countrySlug = toMarketplaceCountrySlug(marketplace);
  if (!countrySlug) {
    return `/${agentSlug}/${asin}`;
  }

  return `/${agentSlug}/${countrySlug}/${asin}`;
}

export function buildCanonicalRedirectPath(
  agentSlug: string,
  asin: string,
  marketplace: string | null | undefined
): string {
  const countrySlug = toMarketplaceCountrySlug(marketplace);
  if (!countrySlug) {
    return `/go/${agentSlug}/${asin}`;
  }

  return `/go/${agentSlug}/${countrySlug}/${asin}`;
}

export function appendMarketplaceHint(url: string, marketplace: string | null | undefined): string {
  const normalizedMarketplace = normalizeMarketplaceHint(marketplace);
  if (!normalizedMarketplace) {
    return url;
  }

  const parsed = new URL(url, 'http://placeholder.local');
  parsed.searchParams.set('m', normalizedMarketplace);

  if (/^https?:\/\//i.test(url)) {
    return parsed.toString();
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function buildCanonicalBridgeUrl(
  origin: string,
  agentSlug: string,
  asin: string,
  marketplace: string | null | undefined
): string {
  return `${origin}${buildCanonicalBridgePath(agentSlug, asin, marketplace)}`;
}

export function buildCanonicalBridgeTemplateUrl(origin: string, agentSlug: string): string {
  return `${origin}${buildCanonicalBridgeTemplatePath(agentSlug)}`;
}

export function buildCanonicalBridgeTemplatePath(agentSlug: string): string {
  return `/${agentSlug}/{country}/{ASIN}`;
}

export function buildCanonicalRedirectUrl(
  origin: string,
  agentSlug: string,
  asin: string,
  marketplace: string | null | undefined
): string {
  return `${origin}${buildCanonicalRedirectPath(agentSlug, asin, marketplace)}`;
}
