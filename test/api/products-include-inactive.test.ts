import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { apiApp } from "../../server/api";
import { DbFactory } from "../factories/db";
import { generateAdminToken } from "../factories/token";

async function fetchProducts(query: string, token: string) {
  return apiApp.fetch(
    new Request(`http://localhost/api/products${query}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: "http://localhost",
      },
    }),
    env as never,
    { waitUntil: () => undefined } as never
  );
}

describe("Products list includeInactive filter", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM admin_users").run();
  });

  it("hides soft-deleted products by default", async () => {
    await DbFactory.seedAdmin(env.DB);
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, category, status, is_active)
       VALUES
         (1201, 'B0INACT0001', 'Active Product A', 'https://example.com/a.webp', 'US', 'Testing', 'active', 1),
         (1202, 'B0INACT0002', 'Active Product B', 'https://example.com/b.webp', 'US', 'Testing', 'active', 1),
         (1203, 'B0INACT0003', 'Inactive Product', 'https://example.com/c.webp', 'US', 'Testing', 'rejected', 0)`
    ).run();

    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await fetchProducts("?marketplace=US&pageSize=10", token);

    expect(response.status).toBe(200);

    const data = (await response.json()) as {
      products: Array<{ id: number; is_active: number }>;
      summary: { totalProducts: number; activeProducts: number };
      pagination: { totalItems: number; totalPages: number };
    };

    expect(data.products.map((p) => p.id)).toEqual([1201, 1202]);
    expect(data.products.every((p) => p.is_active === 1)).toBe(true);
    expect(data.summary.totalProducts).toBe(2);
    expect(data.summary.activeProducts).toBe(2);
    expect(data.pagination.totalItems).toBe(2);
  });

  it("returns soft-deleted products when includeInactive=true", async () => {
    await DbFactory.seedAdmin(env.DB);
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, category, status, is_active)
       VALUES
         (1211, 'B0INACT0011', 'Active Product A', 'https://example.com/a.webp', 'US', 'Testing', 'active', 1),
         (1212, 'B0INACT0012', 'Active Product B', 'https://example.com/b.webp', 'US', 'Testing', 'active', 1),
         (1213, 'B0INACT0013', 'Inactive Product', 'https://example.com/c.webp', 'US', 'Testing', 'rejected', 0)`
    ).run();

    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await fetchProducts(
      "?marketplace=US&pageSize=10&includeInactive=true",
      token
    );

    expect(response.status).toBe(200);

    const data = (await response.json()) as {
      products: Array<{ id: number; is_active: number }>;
      summary: { totalProducts: number; activeProducts: number };
      pagination: { totalItems: number; totalPages: number };
    };

    expect(data.products.map((p) => p.id).sort((a, b) => a - b)).toEqual([1211, 1212, 1213]);
    expect(data.summary.totalProducts).toBe(3);
    expect(data.summary.activeProducts).toBe(2);
    expect(data.pagination.totalItems).toBe(3);
  });

  it("treats includeInactive values other than 'true' as the default (hide inactive)", async () => {
    await DbFactory.seedAdmin(env.DB);
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, category, status, is_active)
       VALUES
         (1221, 'B0INACT0021', 'Active Product', 'https://example.com/a.webp', 'US', 'Testing', 'active', 1),
         (1222, 'B0INACT0022', 'Inactive Product', 'https://example.com/b.webp', 'US', 'Testing', 'rejected', 0)`
    ).run();

    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await fetchProducts("?marketplace=US&includeInactive=yes", token);

    expect(response.status).toBe(200);

    const data = (await response.json()) as {
      products: Array<{ id: number }>;
      pagination: { totalItems: number };
    };

    expect(data.products.map((p) => p.id)).toEqual([1221]);
    expect(data.pagination.totalItems).toBe(1);
  });
});
