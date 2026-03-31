export interface BlogPostSummary {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  excerpt_text?: string;
  content: string;
  cover_image_key?: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  status: "draft" | "published";
  is_featured: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  reading_minutes: number;
}

export function slugifyClientTitle(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function formatBlogDate(value: string | null): string {
  if (!value) {
    return "Draft";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export function splitBlogContent(content: string): string[] {
  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
