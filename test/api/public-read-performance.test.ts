import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";

describe("public read query plans on migrated D1", () => {
  const queries = [
    { index: "idx_products_public_updated", sql: `SELECT id, asin, title, image_url, category, marketplace FROM products
      WHERE is_active = 1 AND status = 'active' AND is_adult = 0 AND marketplace = ?
      ORDER BY updated_at DESC, id DESC LIMIT 6`, args: ["US"] },
    { index: "idx_products_public_category_created", sql: `SELECT id, asin, title, image_url, category, marketplace FROM products
      WHERE category = ? AND marketplace = ? AND is_active = 1 AND status = 'active' AND is_adult = 0
      ORDER BY created_at DESC, id DESC LIMIT 24 OFFSET 24`, args: ["Home", "US"] },
    { index: "idx_blog_public_comparison", sql: `SELECT id, title, slug, excerpt, content, cover_image_key, cover_image_alt, generation_source, generation_marketplace, is_featured, published_at, updated_at FROM blog_posts
      WHERE is_deleted = 0 AND status = 'published' AND generation_topic = 'automated_comparison' AND generation_marketplace = ?
      ORDER BY published_at DESC, id DESC LIMIT 2`, args: ["US"] },
  ];

  for (const query of queries) {
    it(`uses ${query.index} without a temporary sort`, async () => {
      const plan = (phase: string) => env.DB.prepare("EXPLAIN QUERY PLAN " + query.sql + " /* " + phase + " */").bind(...query.args).all<{detail: string}>();
      const after = (await plan("after")).results.map(row => row.detail).join("\n");
      expect(after).toContain(query.index);
      expect(after).not.toContain("TEMP B-TREE");
      // In this disposable test database, prove the old plan needs extra work.
      await env.DB.prepare("DROP INDEX " + query.index).run();
      const before = (await plan("before")).results.map(row => row.detail).join("\n");
      expect(before).not.toContain(query.index);
      console.log({ index: query.index, before, after });
    });
  }
});
