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

  it("allows multiple portal-managed tags per marketplace", async () => {
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
    expect(secondResponse.status).toBe(201);

    const { results } = await env.DB.prepare(
      `SELECT tag, marketplace, is_default
       FROM tracking_ids
       WHERE agent_id = ?
       ORDER BY created_at ASC`
    )
      .bind(22)
      .all<{ tag: string; marketplace: string; is_default: number }>();

    expect(results).toHaveLength(2);
    expect(results.every((row) => row.marketplace === "US")).toBe(true);
    expect(results.filter((row) => row.is_default === 1)).toHaveLength(1);
    expect(results[0]?.tag).toBe("agent-us-primary-20");
    expect(results[1]?.tag).toBe("agent-us-secondary-20");
  });

  it("creates a marketplace slug alias automatically for portal-managed tags", async () => {
    await DbFactory.seedAgent(env.DB, 23, "alias-agent", "Alias Agent");
    const token = await generateAgentToken(23, "alias-agent", env.JWT_SECRET || "test-secret");
    const ctx = { passThroughOnException: () => {}, waitUntil: () => {} } as const;

    const response = await apiApp.fetch(
      new Request("http://localhost/api/portal/tracking", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          tag: "alias-agent-uk-21",
          label: "UK",
          marketplace: "UK",
        }),
      }),
      env as any,
      ctx as any
    );

    expect(response.status).toBe(201);

    const tracking = await env.DB.prepare(
      `SELECT id
       FROM tracking_ids
       WHERE agent_id = ? AND marketplace = ? AND tag = ?`
    )
      .bind(23, "UK", "alias-agent-uk-21")
      .first<{ id: number }>();

    const alias = await env.DB.prepare(
      `SELECT slug
       FROM agent_slug_aliases
       WHERE tracking_id = ? AND marketplace = ?`
    )
      .bind(tracking?.id ?? 0, "UK")
      .first<{ slug: string }>();

    expect(alias?.slug).toBe("alias-agent-uk");
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
      batchAsinImportEnabled: true,
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

  it("lets admin update portal edit access for an existing tag", async () => {
    await DbFactory.seedAgent(env.DB, 34, "portal-access-agent", "Portal Access Agent");
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active, is_portal_editable)
       VALUES (709, 34, 'portal-access-us-20', 'US', 1, 1, 0)`
    ).run();

    const adminToken = await generateAdminToken(env.JWT_SECRET || "test-secret");
    const ctx = { passThroughOnException: () => {}, waitUntil: () => {} } as const;

    const response = await apiApp.fetch(
      new Request("http://localhost/api/tracking/709", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          is_portal_editable: true,
        }),
      }),
      env as any,
      ctx as any
    );

    expect(response.status).toBe(200);

    const updatedTracking = await env.DB.prepare(
      `SELECT is_portal_editable
       FROM tracking_ids
       WHERE id = ?`
    )
      .bind(709)
      .first<{ is_portal_editable: number }>();

    expect(updatedTracking?.is_portal_editable).toBe(1);
  });

  it("lets admin replace the tracking tag while keeping the existing slug alias", async () => {
    await DbFactory.seedAgent(env.DB, 35, "edit-tag-agent", "Edit Tag Agent");
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active, is_portal_editable)
       VALUES (710, 35, 'old-edit-tag-20', 'US', 1, 1, 0)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_slug_aliases (agent_id, tracking_id, marketplace, slug, is_active)
       VALUES (35, 710, 'US', 'mahin', 1)`
    ).run();

    const adminToken = await generateAdminToken(env.JWT_SECRET || "test-secret");
    const ctx = { passThroughOnException: () => {}, waitUntil: () => {} } as const;

    const response = await apiApp.fetch(
      new Request("http://localhost/api/tracking/710", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          tag: "new-edit-tag-20",
          alias_slug: "mahin",
        }),
      }),
      env as any,
      ctx as any
    );

    expect(response.status).toBe(200);

    const updatedTracking = await env.DB.prepare(
      `SELECT tag
       FROM tracking_ids
       WHERE id = ?`
    )
      .bind(710)
      .first<{ tag: string }>();

    const updatedAlias = await env.DB.prepare(
      `SELECT slug
       FROM agent_slug_aliases
       WHERE tracking_id = ? AND marketplace = ?`
    )
      .bind(710, "US")
      .first<{ slug: string }>();

    expect(updatedTracking?.tag).toBe("new-edit-tag-20");
    expect(updatedAlias?.slug).toBe("mahin");
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

  it("accepts fallback Amazon API keys when the primary key is not configured", async () => {
    await DbFactory.seedAgent(env.DB, 62, "fallback-agent", "Fallback Agent");
    await env.DB.prepare(
      `INSERT INTO users (id, username, email, password_hash, role, agent_id, is_active)
       VALUES (162, 'fallback-agent', 'fallback@example.com', 'hash', 'agent', 62, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES (962, 62, 'fallback-agent-us-20', 'US', 1, 1)`
    ).run();

    const token = await generateAgentToken(62, "fallback-agent", env.JWT_SECRET || "test-secret");
    const ctx = { passThroughOnException: () => {}, waitUntil: () => {} } as const;
    const previousPrimaryKey = env.AMAZON_API_KEY;
    const previousFallbackKey = env.AMAZON_API_KEY_FALLBACK;
    (env as { AMAZON_API_KEY?: string }).AMAZON_API_KEY = "";
    (env as { AMAZON_API_KEY_FALLBACK?: string }).AMAZON_API_KEY_FALLBACK = "fallback-key";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            product_title: "Fallback Key Product",
            product_photo: "https://img.example/fallback.webp",
            product_category: "Electronics",
            product_description: "Fallback path product",
            about_product: ["Fast setup"],
            product_photos: ["https://img.example/fallback-1.webp"],
            aplus_images: ["https://img.example/fallback-aplus.webp"],
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
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
          asin: "B0FALLBK01",
          marketplace: "US",
          custom_title: null,
        }),
      }),
      env as any,
      ctx as any
    );

    (env as { AMAZON_API_KEY?: string }).AMAZON_API_KEY = previousPrimaryKey;
    (env as { AMAZON_API_KEY_FALLBACK?: string }).AMAZON_API_KEY_FALLBACK = previousFallbackKey;

    expect(response.status).toBe(201);

    const product = await env.DB.prepare(
      `SELECT title, image_url
       FROM products
       WHERE asin = 'B0FALLBK01' AND marketplace = 'US'`
    ).first<{ title: string; image_url: string }>();

    expect(product).toEqual({
      title: "Fallback Key Product",
      image_url: "https://img.example/fallback.webp",
    });
  });

  it("deletes an admin tracking tag and remaps linked products to the marketplace site-primary tag", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 60, "site-primary-owner", "Site Primary Owner");
    await DbFactory.seedAgent(env.DB, 61, "tracked-agent", "Tracked Agent");
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (860, 'B0DELTRACK1', 'Delete Tracking Product', 'http://img.com/delete.jpg', 'US', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_site_primary, is_active)
       VALUES
         (960, 60, 'site-primary-us-20', 'US', 1, 1, 1),
         (961, 61, 'tracked-agent-us-20', 'US', 1, 0, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (id, agent_id, product_id, tracking_id, custom_title, is_active)
       VALUES (1060, 61, 860, 961, NULL, 1)`
    ).run();

    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");
    const ctx = { passThroughOnException: () => {}, waitUntil: () => {} } as const;

    const response = await apiApp.fetch(
      new Request("http://localhost/api/tracking/961", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: "http://localhost",
        },
      }),
      env as any,
      ctx as any
    );

    expect(response.status).toBe(200);

    const deletedTracking = await env.DB.prepare(
      `SELECT id
       FROM tracking_ids
       WHERE id = 961`
    ).first<{ id: number }>();
    const remapped = await env.DB.prepare(
      `SELECT agent_id, tracking_id
       FROM agent_products
       WHERE id = 1060`
    ).first<{ agent_id: number; tracking_id: number }>();

    expect(deletedTracking).toBeNull();
    expect(remapped).toEqual({ agent_id: 60, tracking_id: 960 });
  });

  it("blocks tracking delete when the marketplace site-primary tag is missing", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 62, "tracked-no-primary", "Tracked No Primary");
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (861, 'B0NOPRIMARY', 'No Primary Product', 'http://img.com/no-primary.jpg', 'DE', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_site_primary, is_active)
       VALUES (962, 62, 'tracked-agent-de-21', 'DE', 1, 0, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (id, agent_id, product_id, tracking_id, custom_title, is_active)
       VALUES (1061, 62, 861, 962, NULL, 1)`
    ).run();

    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");
    const ctx = { passThroughOnException: () => {}, waitUntil: () => {} } as const;

    const response = await apiApp.fetch(
      new Request("http://localhost/api/tracking/962", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: "http://localhost",
        },
      }),
      env as any,
      ctx as any
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "Missing active site-primary tag for marketplace: DE",
    });
  });

  it("deletes a tag and remaps linked products to the marketplace site-primary tag even when queried with force", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 41, "force-delete-agent", "Force Delete Agent");
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_site_primary, is_active)
       VALUES
         (741, 41, 'old-us-tag-20', 'US', 0, 0, 1),
         (742, 41, 'default-us-tag-20', 'US', 1, 1, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (841, 'B0FORCE001', 'Force Product', 'http://img.com/force.jpg', 'US', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (id, agent_id, product_id, tracking_id, is_active)
       VALUES (941, 41, 841, 741, 1)`
    ).run();

    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await apiApp.fetch(
      new Request("http://localhost/api/tracking/741?force=1", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, Origin: "http://localhost" },
      }),
      env as any,
      { waitUntil: () => {} } as any
    );

    expect(response.status).toBe(200);

    const remapped = await env.DB.prepare(
      `SELECT agent_id, tracking_id
       FROM agent_products
       WHERE id = 941`
    ).first<{ agent_id: number; tracking_id: number }>();

    const deletedTag = await env.DB.prepare(
      `SELECT id
       FROM tracking_ids
       WHERE id = 741`
    ).first<{ id: number }>();

    expect(remapped).toEqual({ agent_id: 41, tracking_id: 742 });
    expect(deletedTag).toBeNull();
  });

  it("blocks delete when no replacement site-primary tag exists", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 42, "blocked-force-agent", "Blocked Force Agent");
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES (751, 42, 'old-es-tag-21', 'ES', 0, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (851, 'B0FORCE002', 'Blocked Product', 'http://img.com/blocked.jpg', 'ES', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (id, agent_id, product_id, tracking_id, is_active)
       VALUES (951, 42, 851, 751, 1)`
    ).run();

    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await apiApp.fetch(
      new Request("http://localhost/api/tracking/751?force=1", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, Origin: "http://localhost" },
      }),
      env as any,
      { waitUntil: () => {} } as any
    );

    expect(response.status).toBe(409);
  });
});
