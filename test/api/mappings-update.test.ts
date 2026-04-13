import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { apiApp } from "../../server/api";
import { DbFactory } from "../factories/db";
import { generateAdminToken } from "../factories/token";

describe("Mappings update API", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM tracking_ids").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM agents").run();
    await env.DB.prepare("DELETE FROM users").run();
  });

  it("lets admin replace a product mapping with another active tag for the same agent", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 41, "mapping-agent", "Mapping Agent");
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (901, 'B0MAP00001', 'Mapping Product', 'https://example.com/product.webp', 'US', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES
       (801, 41, 'mapping-old-20', 'US', 1, 1),
       (802, 41, 'mapping-new-20', 'US', 0, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (id, agent_id, product_id, tracking_id, custom_title, is_active)
       VALUES (701, 41, 901, 801, NULL, 1)`
    ).run();

    const adminToken = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await apiApp.fetch(
      new Request("http://localhost/api/mappings/701", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          tracking_id: 802,
        }),
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    expect(response.status).toBe(200);

    const mapping = await env.DB.prepare(
      `SELECT tracking_id
       FROM agent_products
       WHERE id = 701`
    ).first<{ tracking_id: number }>();

    expect(mapping?.tracking_id).toBe(802);
  });

  it("bulk assigns one active tag across selected products for the same agent", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 42, "bulk-agent", "Bulk Agent");
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES
       (911, 'B0MAP00011', 'Bulk Product 1', 'https://example.com/p1.webp', 'US', 'active', 1),
       (912, 'B0MAP00012', 'Bulk Product 2', 'https://example.com/p2.webp', 'US', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES
       (811, 42, 'bulk-old-20', 'US', 1, 1),
       (812, 42, 'bulk-new-20', 'US', 0, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (id, agent_id, product_id, tracking_id, custom_title, is_active)
       VALUES (711, 42, 911, 811, NULL, 1)`
    ).run();

    const adminToken = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await apiApp.fetch(
      new Request("http://localhost/api/mappings/bulk-assign", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          product_ids: [911, 912],
          agent_id: 42,
          tracking_id: 812,
        }),
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    expect(response.status).toBe(200);

    const { results } = await env.DB.prepare(
      `SELECT product_id, tracking_id
       FROM agent_products
       WHERE agent_id = 42
       ORDER BY product_id ASC`
    ).all<{ product_id: number; tracking_id: number }>();

    expect(results).toEqual([
      { product_id: 911, tracking_id: 812 },
      { product_id: 912, tracking_id: 812 },
    ]);
  });

  it("rejects bulk assignment when selected products do not match the tag marketplace", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 43, "market-agent", "Market Agent");
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES
       (921, 'B0MAP00021', 'US Product', 'https://example.com/us.webp', 'US', 'active', 1),
       (922, 'B0MAP00022', 'DE Product', 'https://example.com/de.webp', 'DE', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES (821, 43, 'market-us-20', 'US', 1, 1)`
    ).run();

    const adminToken = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await apiApp.fetch(
      new Request("http://localhost/api/mappings/bulk-assign", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          product_ids: [921, 922],
          agent_id: 43,
          tracking_id: 821,
        }),
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    expect(response.status).toBe(400);

    const payload = (await response.json()) as { error?: string; message?: string };
    expect(payload.error || payload.message).toContain("Selected tag is for US");
  });
});
