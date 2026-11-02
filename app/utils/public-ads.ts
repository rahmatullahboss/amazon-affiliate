// Exact publisher-supplied Adsterra tags (31 Oct 2026).
// Banner: 320×50 iframe, directly beneath the public header.
// Social Bar: script appended at document.body end on eligible public web pages.
export const ADSTERRA_BANNER_KEY = "96bcee9a814ac7bb10afc9289bfc457d";
export const ADSTERRA_BANNER_SCRIPT_SRC =
  "https://www.highrevenueformat.com/96bcee9a814ac7bb10afc9289bfc457d/invoke.js";
export const ADSTERRA_BANNER_CONTAINER_ID = "dealsrky-adsterra-banner-320x50";
export const ADSTERRA_BANNER_OPTIONS = {
  key: ADSTERRA_BANNER_KEY,
  format: "iframe",
  height: 50,
  width: 320,
  params: {},
} as const;

// Owner-requested multi-placement mode: reuse the existing publisher code
// at the marked in-page locations. Adsterra recommends separate codes per
// banner on a single page (statistics and CPM may be affected). Keep the
// repeated requests explicit, never substitute an app-created iframe or
// change the publisher-provided script/configuration.
export const BANNER_PLACEMENTS = {
  "public-under-header": true,
  "product-after-breadcrumbs": true,
  "home-after-categories": true,
  "home-after-first-row": true,
  "collection-before-grid": true,
  "collection-before-footer": true,
  "product-before-editorial": true,
  "product-before-share": true,
  "product-before-footer": true,
} as const;

export function isProductDetailAdPath(pathname: string): boolean {
  return /^\/deals\/[a-z0-9]{10}\/?$/i.test(pathname);
}

export function resolveApprovedBannerZone(
  placement: string,
): { key: string; src: string; options: typeof ADSTERRA_BANNER_OPTIONS } | null {
  if (!Object.prototype.hasOwnProperty.call(BANNER_PLACEMENTS, placement)) return null;
  return {
    key: ADSTERRA_BANNER_KEY,
    src: ADSTERRA_BANNER_SCRIPT_SRC,
    options: ADSTERRA_BANNER_OPTIONS,
  };
}

export const ADSTERRA_SOCIAL_BAR_SCRIPT_SRC =
  "https://pl30967644.profitableratecpmnetwork.com/27/9f/b2/279fb283fc6df4ba2e60428705c80920.js";

export const AD_COOLDOWN_MS = 5 * 60 * 1000;

export function shouldEnablePublicAds(isNativeApp: boolean): boolean {
  return !isNativeApp;
}

export function isEligiblePublicAdPath(path: string): boolean {
  // PublicLayout owns public pages; keep these hard exclusions even if route
  // nesting changes, while supporting newly introduced public URLs automatically.
  const excludedPrefixes = [
    "/admin", "/portal", "/agent", "/t", "/go", "/api",
    "/auth", "/login", "/register", "/reset-password",
  ];
  return path.startsWith("/") && !path.startsWith("//") &&
    !excludedPrefixes.some(prefix => path === prefix || path.startsWith(prefix + "/"));
}

export function getAdPageIdentity(pathname: string, search: string): string {
  // Treat marketplace/query variants of the same ASIN as the same destination.
  if (/^\/deals\/[a-z0-9]{10}$/i.test(pathname)) return pathname.toLowerCase();
  return pathname + search;
}

export function canLoadAdAt(now: number, lastLoadedAt: number | null): boolean {
  return lastLoadedAt === null || (now >= lastLoadedAt && now - lastLoadedAt >= AD_COOLDOWN_MS);
}
