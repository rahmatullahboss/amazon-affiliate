export interface BlogDraftInput {
  title: string;
  content: string;
  cta_url: string;
}

function prependHttpsIfNeeded(value: string): string {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (/^(www\.)/i.test(value) || /^amazon\./i.test(value)) {
    return `https://${value}`;
  }

  return value;
}

export function normalizeOptionalUrl(value: string): string {
  return prependHttpsIfNeeded(value.trim());
}

export function validateBlogDraft(input: BlogDraftInput): string | null {
  if (!input.title.trim()) {
    return "Title is required";
  }

  if (input.content.trim().length < 50) {
    return "Content must be at least 50 characters";
  }

  if (!input.cta_url.trim()) {
    return null;
  }

  const normalizedUrl = normalizeOptionalUrl(input.cta_url);

  try {
    const parsed = new URL(normalizedUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "CTA URL must start with http:// or https://";
    }
  } catch {
    return "CTA URL must be a valid full URL";
  }

  return null;
}
