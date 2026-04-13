function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/+$/, "");
  }
}

export function buildMarketplaceReadyLinkTemplate(
  publicUrl: string,
  publicSlug: string,
  marketplace: string
): string {
  const origin = normalizeOrigin(publicUrl);
  const countrySlug = marketplace.trim().toLowerCase();
  return `${origin}/${publicSlug}/${countrySlug}/{ASIN}`;
}

export function buildMarketplaceReadyLink(
  publicUrl: string,
  publicSlug: string,
  marketplace: string,
  asin: string
): string {
  const origin = normalizeOrigin(publicUrl);
  const countrySlug = marketplace.trim().toLowerCase();
  const normalizedAsin = asin.trim().toUpperCase();
  return `${origin}/${publicSlug}/${countrySlug}/${normalizedAsin}`;
}
