import type { BlogCardSummary } from "../../app/utils/blog";
import type { Bindings } from "../utils/types";
import { buildBlogExcerpt, buildBlogImageUrl, estimateReadingMinutes } from "./blog";

export const PUBLIC_BLOG_CARD_COLUMNS = `id, title, slug, excerpt, content,
  cover_image_key, cover_image_alt, generation_source, generation_marketplace,
  is_featured, published_at, updated_at`;

export type PublicBlogCardRow = Omit<BlogCardSummary, "excerpt_text" | "cover_image_url" | "reading_minutes"> & {
  content: string;
  cover_image_key: string | null;
};

export function toPublicBlogCard(env: Pick<Bindings, "BLOG_IMAGES_PUBLIC_BASE_URL">, row: PublicBlogCardRow): BlogCardSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    excerpt_text: buildBlogExcerpt(row.content, row.excerpt),
    cover_image_url: buildBlogImageUrl(env, row.cover_image_key),
    cover_image_alt: row.cover_image_alt,
    generation_source: row.generation_source,
    generation_marketplace: row.generation_marketplace,
    is_featured: row.is_featured,
    published_at: row.published_at,
    updated_at: row.updated_at,
    reading_minutes: estimateReadingMinutes(row.content),
  };
}
