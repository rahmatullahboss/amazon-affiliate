import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { apiApp } from "../../server/api";
import { DbFactory } from "../factories/db";
import { generateAdminToken } from "../factories/token";
import { clearCreatorsTokenCacheForTests } from "../../server/services/creators-api";

describe("Creators API fallback chain", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof fetch;
  let savedLwaClientId: string | undefined;
  let savedLwaClientSecret: string | undefined;
  let savedLwaScope: string | undefined;
  let savedAmazonApiKey: string | undefined;
  let savedAmazonApiKeyFallback: string | undefined;

  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM admin_users").run();
    clearCreatorsTokenCacheForTests();

    savedLwaClientId = (env as { LWA_CLIENT_ID?: string }).LWA_CLIENT_ID;
    savedLwaClientSecret = (env as { LWA_CLIENT_SECRET?: string }).LWA_CLIENT_SECRET;
    savedLwaScope = (env as { LWA_CREATORS_SCOPE?: string }).LWA_CREATORS_SCOPE;
    savedAmazonApiKey = (env as { AMAZON_API_KEY?: string }).AMAZON_API_KEY;
    savedAmazonApiKeyFallback = (env as { AMAZON_API_KEY_FALLBACK?: string }).AMAZON_API_KEY_FALLBACK;
    (env as { LWA_CLIENT_ID?: string }).LWA_CLIENT_ID = "test-lwa-id";
    (env as { LWA_CLIENT_SECRET?: string }).LWA_CLIENT_SECRET = "test-lwa-secret";
    (env as { LWA_CREATORS_SCOPE?: string }).LWA_CREATORS_SCOPE = "creatorsapi::read";
    (env as { AMAZON_API_KEY?: string }).AMAZON_API_KEY = undefined;
    (env as { AMAZON_API_KEY_FALLBACK?: string }).AMAZON_API_KEY_FALLBACK = undefined;

    originalFetch = globalThis.fetch;
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    (env as { LWA_CLIENT_ID?: string }).LWA_CLIENT_ID = savedLwaClientId;
    (env as { LWA_CLIENT_SECRET?: string }).LWA_CLIENT_SECRET = savedLwaClientSecret;
    (env as { LWA_CREATORS_SCOPE?: string }).LWA_CREATORS_SCOPE = savedLwaScope;
    (env as { AMAZON_API_KEY?: string }).AMAZON_API_KEY = savedAmazonApiKey;
    (env as { AMAZON_API_KEY_FALLBACK?: string }).AMAZON_API_KEY_FALLBACK = savedAmazonApiKeyFallback;

    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("invokes Creators API when LWA credentials are configured", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "mock-lwa-token", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          asin: "B0FALL0001",
          title: "Creators Title",
          mainImage: { url: "https://m.media-amazon.com/images/I/creators.jpg" },
          features: ["Feature 1", "Feature 2"],
          category: "Test Category",
          description: "A test product from the Creators API.",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    await DbFactory.seedAdmin(env.DB);
    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await apiApp.fetch(
      new Request("http://localhost/api/products/fetch-asin", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({ asin: "B0FALL0001", marketplace: "US" }),
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    expect(response.status).toBeLessThan(400);
    expect(fetchMock).toHaveBeenCalled();
    const calledUrls = fetchMock.mock.calls.map(([c]) => String(c));
    expect(
      calledUrls.some((u) => u.includes("api.amazon.com/auth/o2/token"))
    ).toBe(true);
    expect(
      calledUrls.some((u) => u.includes("creatorsapi-na.amazon.com"))
    ).toBe(true);
  });

  it("refreshes an existing product with Creators API when RapidAPI keys are absent", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "mock-lwa-token", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          asin: "B0FALL0002",
          title: "Creators Refreshed Title",
          mainImage: { url: "https://m.media-amazon.com/images/I/refreshed.jpg" },
          features: ["Refreshed feature"],
          category: "Refreshed Category",
          description: "Refreshed from the Creators API.",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    await DbFactory.seedAdmin(env.DB);
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (9902, 'B0FALL0002', 'Old Title', 'https://example.com/old.jpg', 'US', 'active', 1)`
    ).run();
    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await apiApp.fetch(
      new Request("http://localhost/api/products/9902/refresh", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: "http://localhost",
        },
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    expect(response.status).toBe(200);
    const product = await env.DB
      .prepare("SELECT title FROM products WHERE id = 9902")
      .first<{ title: string }>();
    expect(product?.title).toBe("Creators Refreshed Title");
  });
});
