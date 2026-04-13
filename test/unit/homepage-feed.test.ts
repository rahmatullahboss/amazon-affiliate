import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { DbFactory } from "../factories/db";
import { getHomepageFeedRows } from "../../server/services/homepage-feed";

describe("homepage feed service", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM tracking_ids").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM agents").run();
  });

  it("returns homepage-enabled agent mappings before generic fallback products", async () => {
    await DbFactory.seedAgent(env.DB, 71, "alpha", "Alpha");
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, category, status, is_active)
       VALUES
       (971, 'B0HOME0001', 'Mapped Homepage Product', 'https://example.com/mapped.webp', 'US', 'Tools', 'active', 1),
       (972, 'B0HOME0002', 'Fallback Product', 'https://example.com/fallback.webp', 'US', 'Tools', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES (871, 71, 'alpha-us-20', 'US', 1, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (id, agent_id, product_id, tracking_id, is_active, show_on_homepage)
       VALUES (771, 71, 971, 871, 1, 1)`
    ).run();

    const results = await getHomepageFeedRows(env.DB, "US", 12);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      asin: "B0HOME0001",
      agent_slug: "alpha",
      source_type: "mapping",
    });
  });

  it("falls back to generic active products when no homepage mappings are configured", async () => {
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, category, status, is_active)
       VALUES (981, 'B0HOME0011', 'Generic Product', 'https://example.com/generic.webp', 'DE', 'General', 'active', 1)`
    ).run();

    const results = await getHomepageFeedRows(env.DB, "DE", 12);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      asin: "B0HOME0011",
      agent_slug: null,
      source_type: "fallback",
    });
  });
});
