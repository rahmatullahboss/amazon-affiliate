import { PUBLIC_SITE_URL } from "./seo";

export function normalizeShareUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return new URL(url, PUBLIC_SITE_URL).toString();
}

export function buildShareLinks(input: { url: string; title: string }) {
  const normalizedUrl = normalizeShareUrl(input.url);
  const encodedUrl = encodeURIComponent(normalizedUrl);
  const encodedTitle = encodeURIComponent(input.title);
  const combinedText = encodeURIComponent(`${input.title} ${normalizedUrl}`);

  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    whatsapp: `https://wa.me/?text=${combinedText}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
  };
}
