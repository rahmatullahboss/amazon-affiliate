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
  generation_source: "manual" | "ai";
  generation_provider: string | null;
  generation_topic: string | null;
  generation_focus_asin: string | null;
  generation_marketplace: string | null;
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

  if (/^https?:\/\//i.test(key)) {
    return key;
  }

  const publicBaseUrl = env.BLOG_IMAGES_PUBLIC_BASE_URL?.trim();
  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/+$/, "")}/${key}`;
  }

  return `/api/public/blog-images/${key}`;
}

export async function createBlogImageResponse(
  env: Pick<Bindings, "BLOG_IMAGES">,
  pathname: string
): Promise<Response> {
  const prefix = "/api/public/blog-images/";
  const keyIndex = pathname.indexOf(prefix);

  if (keyIndex === -1) {
    return Response.json(
      {
        error: "Invalid image path",
        status: 400,
      },
      { status: 400 }
    );
  }

  const encodedKey = pathname.slice(keyIndex + prefix.length);
  const key = decodeURIComponent(encodedKey);

  if (!key) {
    return Response.json(
      {
        error: "Missing image key",
        status: 400,
      },
      { status: 400 }
    );
  }

  const object = await env.BLOG_IMAGES.get(key);
  if (!object) {
    return Response.json(
      {
        error: "Image not found",
        status: 404,
      },
      { status: 404 }
    );
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, {
    status: 200,
    headers,
  });
}

export function buildStoredImageKey(prefix: string, extension: string): string {
  const safeExtension = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "webp";
  const randomPart = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${prefix}-${Date.now()}-${randomPart}.${safeExtension}`;
}

export function buildBlogImageKey(extension: string): string {
  return buildStoredImageKey("blog", extension);
}
