export const PUBLIC_SITE_URL = "https://dealsrky.com";

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

  if (input.robots) {
    meta.push({ name: "robots", content: input.robots });
  }

  return meta;
}
