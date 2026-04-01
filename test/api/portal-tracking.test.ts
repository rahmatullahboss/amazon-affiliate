import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { apiApp } from "../../server/api";
import { DbFactory } from "../factories/db";
import { generateAdminToken, generateAgentToken } from "../factories/token";

describe("Portal Tracking API", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM agent_slug_aliases").run();
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM tracking_ids").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM agents").run();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows only one portal-managed tag per marketplace", async () => {
    await DbFactory.seedAgent(env.DB, 22, "multi-tag-agent", "Multi Tag Agent");
    const token = await generateAgentToken(22, "multi-tag-agent", env.JWT_SECRET || "test-secret");
    const ctx = { passThroughOnException: () => {}, waitUntil: () => {} } as const;

    const firstResponse = await apiApp.fetch(
      new Request("http://localhost/api/portal/tracking", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          tag: "agent-us-primary-20",
          label: "Primary",
          marketplace: "US",
        }),
      }),
      env as any,
      ctx as any
    );

    const secondResponse = await apiApp.fetch(
      new Request("http://localhost/api/portal/tracking", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          tag: "agent-us-secondary-20",
          label: "Secondary",
          marketplace: "US",
        }),
      }),
      env as any,
      ctx as any
    );

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(409);

    const { results } = await env.DB.prepare(
      `SELECT tag, marketplace, is_default
       FROM tracking_ids
       WHERE agent_id = ?
       ORDER BY created_at ASC`
    )
      .bind(22)
      .all<{ tag: string; marketplace: string; is_default: number }>();

    expect(results).toHaveLength(1);
    expect(results.every((row) => row.marketplace === "US")).toBe(true);
    expect(results.filter((row) => row.is_default === 1)).toHaveLength(1);
  });

  it("returns live import capabilities for the portal products page", async () => {
    await DbFactory.seedAgent(env.DB, 25, "portal-cap-agent", "Portal Capability Agent");
    const token = await generateAgentToken(25, "portal-cap-agent", env.JWT_SECRET || "test-secret");
    const ctx = { passThroughOnException: () => {}, waitUntil: () => {} } as const;

    const response = await apiApp.fetch(
      new Request("http://localhost/api/portal/products", {
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: "http://localhost",
        },
      }),
      env as any,
      ctx as any
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      importCapabilities?: {
        newAsinImportEnabled: boolean;
        batchAsinImportEnabled: boolean;
      };
    };

    expect(payload.importCapabilities).toEqual({
      newAsinImportEnabled: true,
      batchAsinImportEnabled: false,
    });
  });

  it("does not expose tracking tags in portal products or links payloads", async () => {
    await DbFactory.seedAgent(env.DB, 29, "privacy-agent", "Privacy Agent");
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES (704, 29, 'privacy-agent-us-20', 'US', 1, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (804, 'B0PRIVACY1', 'Privacy Product', 'http://img.com/privacy.jpg', 'US', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (id, agent_id, product_id, tracking_id, custom_title, is_active)
       VALUES (904, 29, 804, 704, NULL, 1)`
    ).run();

    const token = await generateAgentToken(29, "privacy-agent", env.JWT_SECRET || "test-secret");
    const ctx = { passThroughOnException: () => {}, waitUntil: () => {} } as const;

    const [productsResponse, linksResponse] = await Promise.all([
      apiApp.fetch(
        new Request("http://localhost/api/portal/products", {
          headers: { Authorization: `Bearer ${token}`, Origin: "http://localhost" },
        }),
        env as any,
        ctx as any
      ),
      apiApp.fetch(
        new Request("http://localhost/api/portal/links", {
          headers: { Authorization: `Bearer ${token}`, Origin: "http://localhost" },
        }),
        env as any,
        ctx as any
      ),
    ]);

    expect(productsResponse.status).toBe(200);
    expect(linksResponse.status).toBe(200);

    const productsPayload = (await productsResponse.json()) as {
      products: Array<Record<string, unknown>>;
    };
    const linksPayload = (await linksResponse.json()) as {
      links: Array<Record<string, unknown>>;
    };

    expect(productsPayload.products[0]).not.toHaveProperty("tracking_tag");
    expect(linksPayload.links[0]).not.toHaveProperty("trackingTag");
  });

  it("returns marketplace-aware links after portal product submission", async () => {
    await DbFactory.seedAgent(env.DB, 26, "italy-agent", "Italy Agent");
    await env.DB.prepare(
      `INSERT INTO users (id, username, email, password_hash, role, agent_id, is_active)
       VALUES (126, 'italy-agent', 'italy@example.com', 'hash', 'agent', 26, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES (701, 26, 'italy-agent-21', 'IT', 1, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (801, 'B0ITALY123', 'Italy Product', 'http://img.com/it.jpg', 'IT', 'active', 1)`
    ).run();

    const token = await generateAgentToken(26, "italy-agent", env.JWT_SECRET || "test-secret");
    const ctx = { passThroughOnException: () => {}, waitUntil: () => {} } as const;

    const response = await apiApp.fetch(
      new Request("http://localhost/api/portal/products/submit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          asin: "B0ITALY123",
          marketplace: "IT",
          custom_title: null,
        }),
      }),
      env as any,
      ctx as any
    );

    expect(response.status).toBe(201);

    const payload = (await response.json()) as {
      link: string;
      redirectLink: string;
      product: { marketplace: string };
    };

    expect(payload.product.marketplace).toBe("IT");
    expect(payload.link).toContain("/italy-agent/it/B0ITALY123");
    expect(payload.redirectLink).toContain("/go/italy-agent/it/B0ITALY123");
  });

  it("returns canonical country-coded links from the portal links endpoint", async () => {
    await DbFactory.seedAgent(env.DB, 28, "portal-links-agent", "Portal Links Agent");
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (803, 'B0PORTAL123', 'Portal Links Product', 'http://img.com/portal.jpg', 'IT', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES (703, 28, 'portal-links-agent-21', 'IT', 1, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, custom_title, is_active)
       VALUES (28, 803, 703, NULL, 1)`
    ).run();

    const adminToken = await generateAdminToken(env.JWT_SECRET || "test-secret");
    const ctx = { passThroughOnException: () => {}, waitUntil: () => {} } as const;

    const response = await apiApp.fetch(
      new Request("http://localhost/api/portal/links", {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          Origin: "http://localhost",
        },
      }),
      env as any,
      ctx as any
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      links: Array<{ bridgePageUrl: string; redirectUrl: string; marketplace: string }>;
      dynamicBridgeTemplates?: unknown;
    };

    expect(payload.dynamicBridgeTemplates).toBeUndefined();

    expect(new URL(payload.links[0]!.bridgePageUrl).pathname).toBe(
      "/portal-links-agent/it/B0PORTAL123"
    );
    expect(new URL(payload.links[0]!.redirectUrl).pathname).toBe(
      "/go/portal-links-agent/it/B0PORTAL123"
    );
  });

  it("prefers marketplace-specific slug aliases in portal product and links URLs", async () => {
    await DbFactory.seedAgent(env.DB, 32, "base-agent", "Base Agent");
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES (707, 32, 'base-agent-it-21', 'IT', 1, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_slug_aliases (id, agent_id, tracking_id, marketplace, slug, is_active)
       VALUES (1, 32, 707, 'IT', 'base-agent-it', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (806, 'B0ALIAS01', 'Alias Product', 'http://img.com/alias.jpg', 'IT', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (id, agent_id, product_id, tracking_id, is_active)
       VALUES (906, 32, 806, 707, 1)`
    ).run();

    const token = await generateAgentToken(32, "base-agent", env.JWT_SECRET || "test-secret");
    const ctx = { passThroughOnException: () => {}, waitUntil: () => {} } as const;

    const [productsResponse, linksResponse] = await Promise.all([
      apiApp.fetch(
        new Request("http://localhost/api/portal/products", {
          headers: { Authorization: `Bearer ${token}`, Origin: "http://localhost" },
        }),
        env as any,
        ctx as any
      ),
      apiApp.fetch(
        new Request("http://localhost/api/portal/links", {
          headers: { Authorization: `Bearer ${token}`, Origin: "http://localhost" },
        }),
        env as any,
        ctx as any
      ),
    ]);

    const productsPayload = (await productsResponse.json()) as {
      products: Array<{ bridge_page_url: string; redirect_url: string }>;
    };
    const linksPayload = (await linksResponse.json()) as {
      links: Array<{ bridgePageUrl: string; redirectUrl: string }>;
    };

    expect(new URL(productsPayload.products[0]!.bridge_page_url).pathname).toBe("/base-agent-it/it/B0ALIAS01");
    expect(new URL(productsPayload.products[0]!.redirect_url).pathname).toBe("/go/base-agent-it/it/B0ALIAS01");
    expect(new URL(linksPayload.links[0]!.bridgePageUrl).pathname).toBe("/base-agent-it/it/B0ALIAS01");
    expect(new URL(linksPayload.links[0]!.redirectUrl).pathname).toBe("/go/base-agent-it/it/B0ALIAS01");
  });

  it("lets admin load portal products and performance data", async () => {
    await DbFactory.seedAgent(env.DB, 30, "admin-view-agent", "Admin View Agent");
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES (705, 30, 'admin-view-us-20', 'US', 1, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (805, 'B0ADMIN01', 'Admin View Product', 'http://img.com/admin.jpg', 'US', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (id, agent_id, product_id, tracking_id, custom_title, is_active)
       VALUES (905, 30, 805, 705, NULL, 1)`
    ).run();

    const adminToken = await generateAdminToken(env.JWT_SECRET || "test-secret");
    const ctx = { passThroughOnException: () => {}, waitUntil: () => {} } as const;

    const [productsResponse, performanceResponse] = await Promise.all([
      apiApp.fetch(
        new Request("http://localhost/api/portal/products", {
          headers: { Authorization: `Bearer ${adminToken}`, Origin: "http://localhost" },
        }),
        env as any,
        ctx as any
      ),
      apiApp.fetch(
        new Request("http://localhost/api/portal/performance", {
          headers: { Authorization: `Bearer ${adminToken}`, Origin: "http://localhost" },
        }),
        env as any,
        ctx as any
      ),
    ]);

    expect(productsResponse.status).toBe(200);
    expect(performanceResponse.status).toBe(200);

    const productsPayload = (await productsResponse.json()) as {
      products: Array<{ asin: string }>;
    };
    const performancePayload = (await performanceResponse.json()) as {
      totalClicks: number;
      totalViews: number;
    };

    expect(productsPayload.products.some((product) => product.asin === "B0ADMIN01")).toBe(true);
    expect(performancePayload.totalClicks).toBeTypeOf("number");
    expect(performancePayload.totalViews).toBeTypeOf("number");
  });

  it("lets admin load tracking tags", async () => {
    await DbFactory.seedAgent(env.DB, 31, "admin-tags-agent", "Admin Tags Agent");
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active, is_portal_editable)
       VALUES (706, 31, 'admin-tags-us-20', 'US', 1, 1, 1)`
    ).run();

    const adminToken = await generateAdminToken(env.JWT_SECRET || "test-secret");
    const ctx = { passThroughOnException: () => {}, waitUntil: () => {} } as const;

    const response = await apiApp.fetch(
      new Request("http://localhost/api/portal/tracking", {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          Origin: "http://localhost",
        },
      }),
      env as any,
      ctx as any
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      canCreate: boolean;
      trackingIds: Array<{ tag: string }>;
    };

    expect(payload.canCreate).toBe(false);
    expect(payload.trackingIds.some((trackingId) => trackingId.tag === "admin-tags-us-20")).toBe(true);
  });

  it("lets admin save and update a marketplace-specific alias slug for a tag", async () => {
    await DbFactory.seedAgent(env.DB, 33, "alias-admin-agent", "Alias Admin Agent");
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active, is_portal_editable)
       VALUES (708, 33, 'alias-admin-us-20', 'US', 1, 1, 0)`
    ).run();

    const adminToken = await generateAdminToken(env.JWT_SECRET || "test-secret");
    const ctx = { passThroughOnException: () => {}, waitUntil: () => {} } as const;

    const createResponse = await apiApp.fetch(
      new Request("http://localhost/api/tracking/708", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          alias_slug: "alias-admin-us",
        }),
      }),
      env as any,
      ctx as any
    );

    expect(createResponse.status).toBe(200);

    const createdAlias = await env.DB.prepare(
      `SELECT slug
       FROM agent_slug_aliases
       WHERE tracking_id = ? AND marketplace = ?`
    )
      .bind(708, "US")
      .first<{ slug: string }>();

    expect(createdAlias?.slug).toBe("alias-admin-us");

    const updateResponse = await apiApp.fetch(
      new Request("http://localhost/api/tracking/708", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          alias_slug: "alias-admin-us-new",
        }),
      }),
      env as any,
      ctx as any
    );

    expect(updateResponse.status).toBe(200);

    const updatedAlias = await env.DB.prepare(
      `SELECT slug
       FROM agent_slug_aliases
       WHERE tracking_id = ? AND marketplace = ?`
    )
      .bind(708, "US")
      .first<{ slug: string }>();

    expect(updatedAlias?.slug).toBe("alias-admin-us-new");
  });

  it("returns canonical country-coded links from the mappings links endpoint", async () => {
    await DbFactory.seedAgent(env.DB, 27, "mappings-agent", "Mappings Agent");
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (802, 'B0MAPS1234', 'Mappings Product', 'http://img.com/maps.jpg', 'IT', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES (702, 27, 'mappings-agent-21', 'US', 1, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, custom_title, is_active)
       VALUES (27, 802, 702, NULL, 1)`
    ).run();

    const adminToken = await generateAdminToken(env.JWT_SECRET || "test-secret");
    const ctx = { passThroughOnException: () => {}, waitUntil: () => {} } as const;
    const response = await apiApp.fetch(
      new Request("http://localhost/api/mappings/links/mappings-agent", {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          Origin: "http://localhost",
        },
      }),
      env as any,
      ctx as any
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      links: Array<{ bridgePageUrl: string; directRedirectUrl: string }>;
    };

    expect(payload.links).toHaveLength(1);
    expect(new URL(payload.links[0]!.bridgePageUrl).pathname).toBe(
      "/mappings-agent/it/B0MAPS1234"
    );
    expect(new URL(payload.links[0]!.directRedirectUrl).pathname).toBe(
      "/go/mappings-agent/it/B0MAPS1234"
    );
  });

  it("can switch the default tag within the same marketplace", async () => {
    await DbFactory.seedAgent(env.DB, 23, "default-switch-agent", "Default Switch Agent");
    const token = await generateAgentToken(23, "default-switch-agent", env.JWT_SECRET || "test-secret");
    const ctx = { passThroughOnException: () => {}, waitUntil: () => {} } as const;

    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, label, marketplace, is_default, is_active)
       VALUES
       (501, 23, 'default-switch-1-20', 'First', 'DE', 1, 1),
       (502, 23, 'default-switch-2-20', 'Second', 'DE', 0, 1)`
    ).run();

    const response = await apiApp.fetch(
      new Request("http://localhost/api/portal/tracking/502/default", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: "http://localhost",
        },
      }),
      env as any,
      ctx as any
    );

    expect(response.status).toBe(200);

    const { results } = await env.DB.prepare(
      `SELECT id, is_default
       FROM tracking_ids
       WHERE agent_id = ? AND marketplace = 'DE'
       ORDER BY id ASC`
    )
      .bind(23)
      .all<{ id: number; is_default: number }>();

    expect(results).toEqual([
      { id: 501, is_default: 0 },
      { id: 502, is_default: 1 },
    ]);
  });

  it("returns a marketplace-specific reason when live product data is unavailable", async () => {
    await DbFactory.seedAgent(env.DB, 24, "es-agent", "ES Agent");
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES (601, 24, 'es-agent-21', 'ES', 1, 1)`
    ).run();

    const token = await generateAgentToken(24, "es-agent", env.JWT_SECRET || "test-secret");
    const ctx = { passThroughOnException: () => {}, waitUntil: () => {} } as const;
    const previousApiKey = env.AMAZON_API_KEY;
    (env as { AMAZON_API_KEY?: string }).AMAZON_API_KEY = "test-api-key";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      })
    );

    const response = await apiApp.fetch(
      new Request("http://localhost/api/portal/products/submit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          asin: "https://www.amazon.es/gp/product/B0ES123456",
          marketplace: "ES",
          custom_title: null,
        }),
      }),
      env as any,
      ctx as any
    );

    (env as { AMAZON_API_KEY?: string }).AMAZON_API_KEY = previousApiKey;

    expect(response.status).toBe(502);

    const payload = (await response.json()) as { error?: string; message?: string };
    const message = payload.error || payload.message || "";
    expect(message).toContain("amazon.es");
    expect(message).toContain("correct country");
  });
});
