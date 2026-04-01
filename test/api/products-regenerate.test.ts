import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { apiApp } from "../../server/api";
import { DbFactory } from "../factories/db";
import { generateAdminToken } from "../factories/token";
import { ensureProductRecord } from "../../server/services/product-ingestion";

describe("Products regenerate content API", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM tracking_ids").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM agents").run();
    await env.DB.prepare("DELETE FROM admin_users").run();
  });

  it("regenerates review content without calling the Amazon API", async () => {
    await DbFactory.seedAdmin(env.DB);
    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, category, description, features, review_content, status, is_active)
       VALUES (9001, 'B0REGEN123', 'Cordless Vacuum', 'http://img.com/vac.jpg', 'DE', 'Vacuum Cleaners', 'Daily cleaning helper.', '["Quiet motor","Lightweight body","Wall mount"]', 'old copy', 'active', 1)`
    ).run();

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await apiApp.fetch(
      new Request("http://localhost/api/products/9001/regenerate-content", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: "http://localhost",
        },
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    const payload = (await response.json()) as { product: { review_content: string } };

    expect(response.status).toBe(200);
    expect(payload.product.review_content).not.toBe("old copy");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("creates review content during ensureProductRecord for newly imported products", async () => {
    const product = await ensureProductRecord({
      db: env.DB,
      asin: "B0AUTO1234",
      marketplace: "US",
      title: "Air Fryer",
      imageUrl: "http://img.com/airfryer.jpg",
      category: "Kitchen Appliances",
      description: "Compact air fryer for weeknight meals.",
      features: ["Digital controls", "Basket design", "Fast preheat"],
      updateExistingFromInput: true,
    });

    expect(product.review_content).toContain("Air Fryer");
  });

  it("bulk regenerates review content for the selected products only", async () => {
    await DbFactory.seedAdmin(env.DB);
    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, category, description, features, review_content, status, is_active)
       VALUES
       (9101, 'B0BULK0001', 'Cordless Vacuum', 'http://img.com/vac.jpg', 'DE', 'Vacuum Cleaners', 'Daily cleaning helper.', '["Quiet motor","Lightweight body","Wall mount"]', 'old copy 1', 'active', 1),
       (9102, 'B0BULK0002', 'Espresso Machine', 'http://img.com/coffee.jpg', 'IT', 'Coffee Machines', 'Compact coffee setup.', '["Milk frother","Slim footprint","Simple controls"]', 'old copy 2', 'active', 1),
       (9103, 'B0BULK0003', 'Desk Lamp', 'http://img.com/lamp.jpg', 'UK', 'Home Decor', 'Desk lighting for reading.', '["Warm light","Compact base","Quick setup"]', 'old copy 3', 'active', 1)`
    ).run();

    const response = await apiApp.fetch(
      new Request("http://localhost/api/products/regenerate-content", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          productIds: [9101, 9103],
        }),
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      summary: { requested: number; regenerated: number };
    };

    expect(payload.summary).toEqual({
      requested: 2,
      regenerated: 2,
    });

    const { results } = await env.DB.prepare(
      `SELECT id, review_content
       FROM products
       WHERE id IN (9101, 9102, 9103)
       ORDER BY id ASC`
    ).all<{ id: number; review_content: string }>();

    expect(results[0]?.review_content).not.toBe("old copy 1");
    expect(results[1]?.review_content).toBe("old copy 2");
    expect(results[2]?.review_content).not.toBe("old copy 3");
  });

  it("bulk regenerates all products matching the selected marketplace filter", async () => {
    await DbFactory.seedAdmin(env.DB);
    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, category, description, features, review_content, status, is_active)
       VALUES
       (9201, 'B0FILT0001', 'Cordless Vacuum', 'http://img.com/vac.jpg', 'DE', 'Vacuum Cleaners', 'Daily cleaning helper.', '["Quiet motor","Lightweight body","Wall mount"]', 'old de 1', 'active', 1),
       (9202, 'B0FILT0002', 'Floor Mop', 'http://img.com/mop.jpg', 'DE', 'Cleaning Supplies', 'Simple floor cleanup.', '["Wide pad","Quick dry","Easy rinse"]', 'old de 2', 'active', 1),
       (9203, 'B0FILT0003', 'Desk Lamp', 'http://img.com/lamp.jpg', 'UK', 'Home Decor', 'Desk lighting for reading.', '["Warm light","Compact base","Quick setup"]', 'old uk 3', 'active', 1)`
    ).run();

    const response = await apiApp.fetch(
      new Request("http://localhost/api/products/regenerate-content", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          marketplace: "DE",
        }),
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      summary: { requested: number; regenerated: number };
    };

    expect(payload.summary).toEqual({
      requested: 2,
      regenerated: 2,
    });

    const { results } = await env.DB.prepare(
      `SELECT id, review_content
       FROM products
       WHERE id IN (9201, 9202, 9203)
       ORDER BY id ASC`
    ).all<{ id: number; review_content: string }>();

    expect(results[0]?.review_content).not.toBe("old de 1");
    expect(results[1]?.review_content).not.toBe("old de 2");
    expect(results[2]?.review_content).toBe("old uk 3");
  });
});
