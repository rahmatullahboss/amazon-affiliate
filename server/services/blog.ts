import type { Bindings } from "../utils/types";

export const BLOG_STATUSES = ["draft", "published"] as const;
export type BlogStatus = (typeof BLOG_STATUSES)[number];

export interface BlogPostRecord {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image_key: string | null;
  cover_image_alt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  status: BlogStatus;
  is_featured: number;
  is_deleted: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function slugifyBlogTitle(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "post";
}

export async function createUniqueBlogSlug(
  db: D1Database,
  input: { title: string; slug?: string | null; excludeId?: number }
): Promise<string> {
  const baseSlug = slugifyBlogTitle(input.slug?.trim() || input.title);

  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const query = input.excludeId
      ? db
          .prepare(
            `SELECT id
             FROM blog_posts
             WHERE slug = ? AND is_deleted = 0 AND id != ?
             LIMIT 1`
          )
          .bind(candidate, input.excludeId)
      : db
          .prepare(
            `SELECT id
             FROM blog_posts
             WHERE slug = ? AND is_deleted = 0
             LIMIT 1`
          )
          .bind(candidate);

    const existing = await query.first<{ id: number }>();
    if (!existing) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

export function buildBlogExcerpt(content: string, explicitExcerpt?: string | null): string {
  const trimmedExplicit = explicitExcerpt?.trim();
  if (trimmedExplicit) {
    return trimmedExplicit.slice(0, 220);
  }

  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.slice(0, 220);
}

export function estimateReadingMinutes(content: string): number {
  const words = content
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.ceil(words / 220));
}

export function buildBlogImageUrl(env: Pick<Bindings, "BLOG_IMAGES_PUBLIC_BASE_URL">, key: string | null): string | null {
  if (!key) {
    return null;
  }

  const publicBaseUrl = env.BLOG_IMAGES_PUBLIC_BASE_URL?.trim();
  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/+$/, "")}/${key}`;
  }

  return `/api/public/blog-images/${key}`;
}

export function buildBlogImageKey(extension: string): string {
  const safeExtension = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "webp";
  const randomPart = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `blog-${Date.now()}-${randomPart}.${safeExtension}`;
}
