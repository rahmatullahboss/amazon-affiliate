export const PUBLIC_MARKETPLACES = ["US", "CA", "UK", "DE", "IT", "FR", "ES"] as const;
export type PublicMarketplace = (typeof PUBLIC_MARKETPLACES)[number];

const CLOUDFLARE_COUNTRY_TO_MARKETPLACE: Record<string, PublicMarketplace> = {
  US: "US",
  CA: "CA",
  GB: "UK",
  UK: "UK",
  DE: "DE",
  IT: "IT",
  FR: "FR",
  ES: "ES",
};

export function isPublicMarketplace(value: string | null | undefined): value is PublicMarketplace {
  return PUBLIC_MARKETPLACES.includes((value || "").trim().toUpperCase() as PublicMarketplace);
}

export function normalizePublicMarketplace(
  value: string | null | undefined,
  fallback: PublicMarketplace = "US"
): PublicMarketplace {
  const normalized = (value || "").trim().toUpperCase();
  return isPublicMarketplace(normalized) ? normalized : fallback;
}

export function inferMarketplaceFromCountry(
  countryCode: string | null | undefined,
  fallback: PublicMarketplace = "US"
): PublicMarketplace {
  const normalizedCountry = (countryCode || "").trim().toUpperCase();
  return CLOUDFLARE_COUNTRY_TO_MARKETPLACE[normalizedCountry] || fallback;
}

export function getMarketplaceCookieValue(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((part) => part.trim());
  const preferredEntry = cookies.find((part) => part.startsWith("preferred_marketplace="));
  if (!preferredEntry) {
    return null;
  }

  return decodeURIComponent(preferredEntry.split("=")[1] || "");
}

export function resolvePreferredMarketplace(input: {
  searchParams: URLSearchParams;
  cookieHeader?: string | null;
  countryHeader?: string | null;
  fallback?: PublicMarketplace;
}): PublicMarketplace {
  const fallback = input.fallback || "US";
  const fromQuery = input.searchParams.get("market");
  if (isPublicMarketplace(fromQuery)) {
    return fromQuery;
  }

  const fromCookie = getMarketplaceCookieValue(input.cookieHeader);
  if (isPublicMarketplace(fromCookie)) {
    return fromCookie;
  }

  return inferMarketplaceFromCountry(input.countryHeader, fallback);
}
