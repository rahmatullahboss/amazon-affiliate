import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import {
  backfillMissingDefaultProductMappings,
  ensureDefaultProductMapping,
} from "../../server/services/default-product-mapping";

describe("default product tracking mappings", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM tracking_ids").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM agents").run();
  });

  it("prefers the site-primary tag and creates one active mapping", async () => {
    await env.DB.prepare(
      `INSERT INTO agents (id, slug, name, is_active) VALUES
         (9801, 'fallback-owner', 'Fallback Owner', 1),
         (9802, 'primary-owner', 'Primary Owner', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (
         id, agent_id, tag, marketplace, is_default, is_site_primary, is_active
       ) VALUES
         (9811, 9801, 'fallback9801-20', 'US', 1, 0, 1),
         (9812, 9802, 'primary9802-20', 'US', 1, 1, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, is_active, status)
       VALUES (9821, 'B0TEST9821', 'Normal Product', 'https://example.com/product.jpg', 'US', 1, 'active')`
    ).run();

    const target = await ensureDefaultProductMapping(env.DB, 9821, "US");
    const mapping = await env.DB.prepare(
      `SELECT agent_id, tracking_id, is_active
       FROM agent_products
       WHERE product_id = 9821`
    ).first<{ agent_id: number; tracking_id: number; is_active: number }>();

    expect(target?.trackingId).toBe(9812);
    expect(mapping).toEqual({ agent_id: 9802, tracking_id: 9812, is_active: 1 });
  });

  it("does not replace an existing active product mapping", async () => {
    await env.DB.prepare(
      `INSERT INTO agents (id, slug, name, is_active) VALUES
         (9831, 'existing-owner', 'Existing Owner', 1),
         (9832, 'default-owner', 'Default Owner', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (
         id, agent_id, tag, marketplace, is_default, is_site_primary, is_active
       ) VALUES
         (9841, 9831, 'existing9831-20', 'US', 1, 0, 1),
         (9842, 9832, 'default9832-20', 'US', 1, 1, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, is_active, status)
       VALUES (9851, 'B0TEST9851', 'Mapped Product', 'https://example.com/product.jpg', 'US', 1, 'active')`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active)
       VALUES (9831, 9851, 9841, 1)`
    ).run();

    const target = await ensureDefaultProductMapping(env.DB, 9851, "US");
    const mappings = await env.DB.prepare(
      `SELECT agent_id, tracking_id
       FROM agent_products
       WHERE product_id = 9851 AND is_active = 1`
    ).all<{ agent_id: number; tracking_id: number }>();

    expect(target).toBeNull();
    expect(mappings.results).toEqual([{ agent_id: 9831, tracking_id: 9841 }]);
  });

  it("backfills every missing product that has a marketplace default", async () => {
    await env.DB.prepare(
      `INSERT INTO agents (id, slug, name, is_active)
       VALUES (9861, 'uk-default', 'UK Default', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (
         id, agent_id, tag, marketplace, is_default, is_site_primary, is_active
       ) VALUES (9871, 9861, 'ukdefault9861-21', 'UK', 1, 0, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, is_active, status) VALUES
         (9881, 'B0TEST9881', 'First Product', 'https://example.com/1.jpg', 'UK', 1, 'active'),
         (9882, 'B0TEST9882', 'Second Product', 'https://example.com/2.jpg', 'UK', 1, 'active')`
    ).run();

    const result = await backfillMissingDefaultProductMappings(env.DB, "UK");
    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM agent_products WHERE is_active = 1"
    ).first<{ count: number }>();

    expect(result).toEqual({ checked: 2, assigned: 2, skippedWithoutDefault: 0 });
    expect(count?.count).toBe(2);
  });
});
