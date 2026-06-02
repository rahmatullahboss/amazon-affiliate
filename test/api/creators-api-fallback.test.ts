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

  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM admin_users").run();
    clearCreatorsTokenCacheForTests();

    savedLwaClientId = (env as { LWA_CLIENT_ID?: string }).LWA_CLIENT_ID;
    savedLwaClientSecret = (env as { LWA_CLIENT_SECRET?: string }).LWA_CLIENT_SECRET;
    savedLwaScope = (env as { LWA_CREATORS_SCOPE?: string }).LWA_CREATORS_SCOPE;
    (env as { LWA_CLIENT_ID?: string }).LWA_CLIENT_ID = "test-lwa-id";
    (env as { LWA_CLIENT_SECRET?: string }).LWA_CLIENT_SECRET = "test-lwa-secret";
    (env as { LWA_CREATORS_SCOPE?: string }).LWA_CREATORS_SCOPE = "creatorsapi::read";

    originalFetch = globalThis.fetch;
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    (env as { LWA_CLIENT_ID?: string }).LWA_CLIENT_ID = savedLwaClientId;
    (env as { LWA_CLIENT_SECRET?: string }).LWA_CLIENT_SECRET = savedLwaClientSecret;
    (env as { LWA_CREATORS_SCOPE?: string }).LWA_CREATORS_SCOPE = savedLwaScope;

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
});
