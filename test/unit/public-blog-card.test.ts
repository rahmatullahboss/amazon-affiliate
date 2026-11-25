import { describe, expect, it } from "vitest";
import { toPublicBlogCard, type PublicBlogCardRow } from "../../server/services/public-blog-card";

describe("public blog card payload", () => {
  it("keeps display data but does not serialize the article body or storage key", () => {
    const row: PublicBlogCardRow = {
      id: 1, title: "Buying guide", slug: "buying-guide", excerpt: "Short summary",
      content: "Long article body. ".repeat(2000), cover_image_key: null,
      cover_image_alt: "Guide", generation_source: "ai", generation_marketplace: "US",
      is_featured: 1, published_at: "2026-11-24", updated_at: "2026-11-24",
    };
    const card = toPublicBlogCard({ BLOG_IMAGES_PUBLIC_BASE_URL: "" }, row);
    expect(card).toMatchObject({ title: row.title, slug: row.slug, excerpt_text: row.excerpt, generation_marketplace: "US", cover_image_url: null });
    expect(card.reading_minutes).toBeGreaterThan(1);
    expect(card).not.toHaveProperty("content");
    expect(card).not.toHaveProperty("cover_image_key");
    expect(JSON.stringify(card).length).toBeLessThan(1000);
  });
});
