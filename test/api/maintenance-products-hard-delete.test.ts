import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { apiApp } from "../../server/api";
import { DbFactory } from "../factories/db";
import { generateAdminToken } from "../factories/token";

async function hardDeleteProducts(productIds: number[], token: string) {
  return apiApp.fetch(
    new Request("http://localhost/api/maintenance/products/hard-delete", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Origin: "http://localhost",
      },
      body: JSON.stringify({ productIds }),
    }),
    env as never,
    { waitUntil: () => undefined } as never
  );
}

describe("Product maintenance hard-delete API", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM page_views").run();
    await env.DB.prepare("DELETE FROM clicks").run();
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM tracking_ids").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM agents").run();
    await env.DB.prepare("DELETE FROM admin_users").run();
  });

  it("deletes a product together with mappings, clicks, and page views", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 901, "delete-agent", "Delete Agent");
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (902, 'B0DELETE01', 'Delete Product', 'https://example.com/delete.webp', 'US', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES (903, 901, 'delete-agent-20', 'US', 1, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (id, agent_id, product_id, tracking_id, is_active)
       VALUES (904, 901, 902, 903, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO clicks (agent_id, product_id, tracking_tag)
       VALUES (901, 902, 'delete-agent-20')`
    ).run();
    await env.DB.prepare(
      `INSERT INTO page_views (agent_id, product_id)
       VALUES (901, 902)`
    ).run();

    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");
    const response = await hardDeleteProducts([902], token);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { deleted?: number };
    expect(payload.deleted).toBe(1);

    for (const table of ["products", "agent_products", "clicks", "page_views"]) {
      const result = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM ${table}`
      ).first<{ count: number }>();
      expect(result?.count).toBe(0);
    }
  });
});
