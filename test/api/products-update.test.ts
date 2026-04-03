import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { apiApp } from "../../server/api";
import { DbFactory } from "../factories/db";
import { generateEditorToken } from "../factories/token";

describe("Products manual editing API", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM blog_posts").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM users").run();
  });

  it("lets editors update product description, features, and review content", async () => {
    await DbFactory.seedAdmin(env.DB);
    await env.DB.prepare(
      `INSERT INTO users (id, username, password_hash, role, is_active)
       VALUES (2, 'editor', 'hash', 'editor', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO products (
        id, asin, title, image_url, marketplace, category, description, features, review_content, status, is_active
      ) VALUES (
        7001, 'B0EDIT9999', 'Desk Lamp', 'https://example.com/lamp.webp', 'US', 'Lighting',
        'Short description', '["Portable"]', 'Old editorial', 'active', 1
      )`
    ).run();

    const token = await generateEditorToken("editor", env.JWT_SECRET || "test-secret");

    const response = await apiApp.fetch(
      new Request("http://localhost/api/products/7001", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          description: "Detailed buying notes for the lamp.",
          review_content: "Overview\n\nWho it fits\n\nFeature highlights",
          features: ["Touch controls", "USB power", "Warm light"],
        }),
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    expect(response.status).toBe(200);

    const product = await env.DB.prepare(
      `SELECT description, features, review_content
       FROM products
       WHERE id = 7001`
    ).first<{ description: string; features: string; review_content: string }>();

    expect(product?.description).toBe("Detailed buying notes for the lamp.");
    expect(product?.review_content).toContain("Who it fits");
    expect(product?.features).toBe('["Touch controls","USB power","Warm light"]');
  });
});
