export const PUBLIC_SITE_URL = "https://dealsrky.com";
export const DEFAULT_OG_IMAGE_URL = `${PUBLIC_SITE_URL}/dealsrky-logo.svg`;
export const DEFAULT_SITE_TITLE = "DealsRky Product Picks";
export const DEFAULT_SITE_DESCRIPTION =
  "Browse curated product pages, compare featured picks, and continue to the final retailer page with a clear preview.";

function containsAmazonTrademark(value: string | null | undefined): boolean {
  return /amazon/i.test(value?.trim() || "");
}

export interface SiteBrandingMeta {
  ogSiteName: string;
  ogDescription: string;
  ogImageUrl: string;
}

export function toSiteBrandingMeta(input?: {
  og_site_name?: string | null;
  og_description?: string | null;
  og_image_url?: string | null;
}): SiteBrandingMeta {
  const candidateSiteName = input?.og_site_name?.trim() || "";
  const candidateDescription = input?.og_description?.trim() || "";
  const candidateImageUrl = input?.og_image_url?.trim() || "";

  return {
    ogSiteName: containsAmazonTrademark(candidateSiteName)
      ? DEFAULT_SITE_TITLE
      : candidateSiteName || DEFAULT_SITE_TITLE,
    ogDescription: candidateDescription || DEFAULT_SITE_DESCRIPTION,
    ogImageUrl:
      containsAmazonTrademark(candidateImageUrl) || candidateImageUrl.length === 0
        ? DEFAULT_OG_IMAGE_URL
        : candidateImageUrl,
  };
}

export function buildCanonicalUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, PUBLIC_SITE_URL).toString();
}

export function buildSeoMeta(input: {
  title: string;
  description: string;
  path: string;
  imageUrl?: string;
  robots?: string;
}) {
  const canonicalUrl = buildCanonicalUrl(input.path);
  const meta: Array<Record<string, string>> = [
    { title: input.title },
    { name: "description", content: input.description },
    { property: "og:title", content: input.title },
    { property: "og:description", content: input.description },
    { property: "og:url", content: canonicalUrl },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: input.imageUrl ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: input.title },
    { name: "twitter:description", content: input.description },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
  ];

  if (input.imageUrl) {
    meta.push(
      { property: "og:image", content: input.imageUrl },
      { name: "twitter:image", content: input.imageUrl }
    );
  }

  meta.push({ property: "og:site_name", content: DEFAULT_SITE_TITLE });

  if (input.robots) {
    meta.push({ name: "robots", content: input.robots });
  }

  return meta;
}
