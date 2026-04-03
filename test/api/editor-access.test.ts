import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { apiApp } from "../../server/api";
import { DbFactory } from "../factories/db";
import { generateEditorToken } from "../factories/token";

describe("Editor access control", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM users").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM blog_posts").run();
  });

  it("allows editors to load products and blogs", async () => {
    await DbFactory.seedAdmin(env.DB);
    await env.DB.prepare(
      `INSERT INTO users (id, username, password_hash, role, is_active)
       VALUES (2, 'editor', 'hash', 'editor', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (6101, 'B0EDIT0001', 'Desk Lamp', 'https://example.com/lamp.webp', 'US', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO blog_posts (id, title, slug, content, status, is_featured, is_deleted)
       VALUES (6201, 'Editor Post', 'editor-post', 'Post body', 'draft', 0, 0)`
    ).run();

    const token = await generateEditorToken("editor", env.JWT_SECRET || "test-secret");

    const [productsResponse, blogsResponse] = await Promise.all([
      apiApp.fetch(
        new Request("http://localhost/api/products", {
          headers: {
            Authorization: `Bearer ${token}`,
            Origin: "http://localhost",
          },
        }),
        env as never,
        { waitUntil: () => undefined } as never
      ),
      apiApp.fetch(
        new Request("http://localhost/api/blogs", {
          headers: {
            Authorization: `Bearer ${token}`,
            Origin: "http://localhost",
          },
        }),
        env as never,
        { waitUntil: () => undefined } as never
      ),
    ]);

    expect(productsResponse.status).toBe(200);
    expect(blogsResponse.status).toBe(200);
  });

  it("blocks editors from admin-only user management", async () => {
    await DbFactory.seedAdmin(env.DB);
    await env.DB.prepare(
      `INSERT INTO users (id, username, password_hash, role, is_active)
       VALUES (2, 'editor', 'hash', 'editor', 1)`
    ).run();

    const token = await generateEditorToken("editor", env.JWT_SECRET || "test-secret");

    const response = await apiApp.fetch(
      new Request("http://localhost/api/users", {
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: "http://localhost",
        },
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    expect(response.status).toBe(403);
  });
});
