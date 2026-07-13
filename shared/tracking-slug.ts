function normalizeSlugValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\?/i, "")
    .replace(/^tag=/i, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Amazon Associates tags commonly end in -20 or -21. The public website slug
 * uses the readable part before that account suffix while the full tag remains
 * untouched for Amazon attribution.
 */
export function derivePublicSlugFromTrackingTag(value: string): string {
  const normalized = normalizeSlugValue(value);
  const withoutAmazonSuffix = normalized.replace(/-(?:20|21)$/i, "");

  return withoutAmazonSuffix || normalized;
}
