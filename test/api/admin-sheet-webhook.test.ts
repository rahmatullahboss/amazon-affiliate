import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import webhooks from "../../server/routes/webhooks";

describe("admin sheet row webhook", () => {
  const testEnv = () => ({
    DB: env.DB,
    KV: env.KV,
    BLOG_IMAGES: env.BLOG_IMAGES,
    AI: env.AI,
    ENVIRONMENT: "test",
    SUPPORTED_MARKETPLACES: "US,CA,UK,DE,FR,IT",
    JWT_SECRET: "test-secret",
    SHEET_WEBHOOK_SECRET: "correct",
    PUBLIC_APP_URL: "https://dealsrky.com",
  });

  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM tracking_ids").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM agents").run();

    await env.DB.prepare(
      `INSERT INTO agents (id, slug, name, is_active)
       VALUES (701, 'adminsheet', 'Admin Sheet', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (
         id, agent_id, tag, marketplace, is_default, is_site_primary, is_active
       ) VALUES (7001, 701, 'admin-us-20', 'US', 0, 1, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (7002, 'B0WEBHK001', 'Webhook Product', 'https://img.test/webhook.jpg', 'US', 'active', 1)`
    ).run();
  });

  it("rejects an invalid webhook secret", async () => {
    const response = await webhooks.fetch(
      new Request("http://localhost/sheet-row-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": "wrong",
        },
        body: JSON.stringify({ rows: [] }),
      }),
      testEnv() as never
    );

    expect(response.status).toBe(401);
  });

  it("returns generated links for valid existing rows", async () => {
    const response = await webhooks.fetch(
      new Request("http://localhost/sheet-row-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": "correct",
        },
        body: JSON.stringify({
          rows: [
            {
              rowNumber: 2,
              asin: "B0WEBHK001",
              marketplace: "US",
              trackingTag: "",
              customTitle: "",
            },
          ],
        }),
      }),
      testEnv() as never
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      results: [
        {
          rowNumber: 2,
          status: "existing",
          productTitle: "Webhook Product",
          resolvedTrackingTag: "admin-us-20",
          bridgePageUrl: "https://dealsrky.com/adminsheet/us/B0WEBHK001",
        },
      ],
    });
  });

  it("normalizes accidental wrapping quotes without renaming the website tag", async () => {
    const response = await webhooks.fetch(
      new Request("http://localhost/sheet-row-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": "correct",
        },
        body: JSON.stringify({
          rows: [
            {
              rowNumber: 2,
              asin: "B0WEBHK001",
              marketplace: "US",
              trackingTag: 'admin-us-20"',
              previousResolvedTrackingTag: "admin-us-20",
              customTitle: "",
            },
          ],
        }),
      }),
      testEnv() as never
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      results: [
        {
          rowNumber: 2,
          resolvedTrackingTag: "admin-us-20",
        },
      ],
    });

    const tracking = await env.DB.prepare(
      "SELECT tag FROM tracking_ids WHERE id = 7001"
    ).first<{ tag: string }>();
    expect(tracking?.tag).toBe("admin-us-20");
  });

  it("uses the previous agent slug to write a website-renamed tag back to the sheet", async () => {
    await env.DB.prepare(
      `INSERT INTO agents (id, slug, name, is_active)
       VALUES (702, 'other-agent', 'Other Agent', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (
         id, agent_id, tag, marketplace, is_default, is_site_primary, is_active
       ) VALUES (7003, 702, 'other-agent-20', 'US', 1, 0, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active)
       VALUES
         (701, 7002, 7001, 1),
         (702, 7002, 7003, 1)`
    ).run();
    await env.DB.prepare(
      "UPDATE tracking_ids SET tag = 'admin-us-live-20' WHERE id = 7001"
    ).run();

    const response = await webhooks.fetch(
      new Request("http://localhost/sheet-row-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": "correct",
        },
        body: JSON.stringify({
          rows: [
            {
              rowNumber: 2,
              asin: "B0WEBHK001",
              marketplace: "US",
              trackingTag: "admin-us-20",
              previousResolvedTrackingTag: "admin-us-20",
              previousAgentSlug: "adminsheet",
            },
          ],
        }),
      }),
      testEnv() as never
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      results: [
        {
          rowNumber: 2,
          resolvedTrackingTag: "admin-us-live-20",
          bridgePageUrl: "https://dealsrky.com/adminsheet/us/B0WEBHK001",
        },
      ],
    });
  });

  it("returns partial when one row fails without blocking valid rows", async () => {
    const response = await webhooks.fetch(
      new Request("http://localhost/sheet-row-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": "correct",
        },
        body: JSON.stringify({
          rows: [
            {
              rowNumber: 2,
              asin: "B0WEBHK001",
              marketplace: "US",
            },
            {
              rowNumber: 3,
              asin: "bad",
              marketplace: "US",
            },
          ],
        }),
      }),
      testEnv() as never
    );

    const payload = (await response.json()) as {
      status: string;
      results: Array<{ status: string }>;
    };

    expect(response.status).toBe(200);
    expect(payload.status).toBe("partial");
    expect(payload.results.map((row) => row.status)).toEqual(["existing", "failed"]);
  });

  it("rejects requests larger than 100 rows with 400", async () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      rowNumber: index + 2,
      asin: `B${String(index).padStart(9, "0")}`,
      marketplace: "US",
    }));

    const response = await webhooks.fetch(
      new Request("http://localhost/sheet-row-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": "correct",
        },
        body: JSON.stringify({ rows }),
      }),
      testEnv() as never
    );

    expect(response.status).toBe(400);
  });
});
