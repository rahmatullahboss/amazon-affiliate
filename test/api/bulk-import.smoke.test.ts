import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { apiApp } from "../../server/api";
import { DbFactory } from "../factories/db";
import { generateAdminToken } from "../factories/token";

describe("Bulk import smoke", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM tracking_ids").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM agents").run();
    await env.DB.prepare("DELETE FROM users").run();
  });

  it("accepts bulk ASIN import requests when batch import is enabled", async () => {
    await DbFactory.seedAdmin(env.DB);
    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await apiApp.fetch(
      new Request("http://localhost/api/products/bulk-import", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          asins: ["B0BULK0001", "B0BULK0002"],
          marketplace: "US",
          default_title_prefix: "Bulk Test",
        }),
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    expect(response.status).toBe(201);

    const { results } = await env.DB.prepare(
      `SELECT asin, marketplace
       FROM products
       WHERE asin IN ('B0BULK0001', 'B0BULK0002')
       ORDER BY asin ASC`
    ).all<{ asin: string; marketplace: string }>();

    expect(results).toEqual([
      { asin: "B0BULK0001", marketplace: "US" },
      { asin: "B0BULK0002", marketplace: "US" },
    ]);
  });
});
