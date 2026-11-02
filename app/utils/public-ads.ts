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

// The publisher requires a DIFFERENT approved code for each banner on one page.
// Insert the keys from Adsterra's GET CODE for three extra 320x50 zones here.
// Never copy the primary key into these slots. Until supplied they stay invisible
// (no empty box / request). Zone names can be reused on *different* pages.
export type AdditionalBannerZone = "secondary" | "tertiary" | "quaternary";
export const ADSTERRA_ADDITIONAL_BANNER_KEYS: Record<AdditionalBannerZone, string> = {
  secondary: "",
  tertiary: "",
  quaternary: "",
};

export const BANNER_PLACEMENTS = {
  "public-under-header": "primary",
  "product-after-breadcrumbs": "primary",
  "home-after-categories": "secondary",
  "home-after-first-row": "tertiary",
  "collection-before-grid": "secondary",
  "collection-before-footer": "tertiary",
  "product-before-editorial": "secondary",
  "product-before-share": "tertiary",
  "product-before-footer": "quaternary",
} as const;

export type BannerPlacement = keyof typeof BANNER_PLACEMENTS;

export function isProductDetailAdPath(pathname: string): boolean {
  return /^\/deals\/[a-z0-9]{10}\/?$/i.test(pathname);
}
export function resolveApprovedBannerZone(
  placement: string,
  extraKeys: Readonly<Record<AdditionalBannerZone, string>> = ADSTERRA_ADDITIONAL_BANNER_KEYS,
): { key: string; src: string; options: Omit<typeof ADSTERRA_BANNER_OPTIONS, "key"> & { key: string } } | null {
  if (!Object.prototype.hasOwnProperty.call(BANNER_PLACEMENTS, placement)) return null;
  const slot = BANNER_PLACEMENTS[placement as BannerPlacement];
  const key = slot === "primary" ? ADSTERRA_BANNER_KEY : extraKeys[slot].trim();
  if (!/^[a-f0-9]{32}$/.test(key)) return null;
  // A supplied zone must not duplicate another zone's key on the same page.
  const otherKeys = slot === "primary"
    ? Object.values(extraKeys)
    : [ADSTERRA_BANNER_KEY, ...Object.entries(extraKeys)
      .filter(([otherSlot]) => otherSlot !== slot)
      .map(([, otherKey]) => otherKey.trim())];
  if (slot !== "primary" && otherKeys.includes(key)) return null;
  return {
    key,
    src: `https://www.highrevenueformat.com/${key}/invoke.js`,
    options: { ...ADSTERRA_BANNER_OPTIONS, key },
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
