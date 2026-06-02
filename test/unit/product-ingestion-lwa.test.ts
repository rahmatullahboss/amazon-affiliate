import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import {
  ensureProductRecord,
  fetchAmazonProductDataWithFallback,
  refreshProductRecord,
} from "../../server/services/product-ingestion";
import { clearCreatorsTokenCacheForTests } from "../../server/services/creators-api";

const TEST_ASIN = "B0LWA00001";
const TEST_MARKET = "US";

function buildLwaTokenResponse(): Response {
  return new Response(
    JSON.stringify({ access_token: "mock-lwa-token", expires_in: 3600 }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

function buildCreatorsProductResponse(
  title = "Creators Sourced Product"
): Response {
  return new Response(
    JSON.stringify({
      asin: TEST_ASIN,
      title,
      mainImage: { url: "https://m.media-amazon.com/images/I/creators.jpg" },
      features: ["Feature 1"],
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

function buildRapidApiResponse(title = "RapidAPI Sourced Product"): Response {
  return new Response(
    JSON.stringify({
      data: {
        product_title: title,
        product_photo: "https://m.media-amazon.com/images/I/rapidapi.jpg",
        product_photos: ["https://m.media-amazon.com/images/I/rapidapi.jpg"],
        product_category: "Test Category",
        product_description: "RapidAPI description",
        about_product: ["RapidAPI feature"],
        aplus_images: [],
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

describe("fetchAmazonProductDataWithFallback LWA branching", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    clearCreatorsTokenCacheForTests();
    originalFetch = globalThis.fetch;
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  it("uses Creators API when LWA credentials are configured", async () => {
    fetchMock.mockResolvedValueOnce(buildLwaTokenResponse());
    fetchMock.mockResolvedValueOnce(buildCreatorsProductResponse());

    const result = await fetchAmazonProductDataWithFallback({
      asin: TEST_ASIN,
      marketplace: TEST_MARKET,
      lwaClientId: "id",
      lwaClientSecret: "secret",
    });

    expect(result.title).toBe("Creators Sourced Product");
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(
      urls.some((u) => u.includes("creatorsapi-na.amazon.com"))
    ).toBe(true);
  });

  it("falls back to API keys when LWA returns not_found", async () => {
    fetchMock.mockResolvedValueOnce(buildLwaTokenResponse());
    fetchMock.mockResolvedValueOnce(new Response("not found", { status: 404 }));
    fetchMock.mockResolvedValueOnce(buildRapidApiResponse());

    const result = await fetchAmazonProductDataWithFallback({
      asin: TEST_ASIN,
      marketplace: TEST_MARKET,
      lwaClientId: "id",
      lwaClientSecret: "secret",
      primaryApiKey: "rapidapi-key",
    });

    expect(result.title).toBe("RapidAPI Sourced Product");
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(
      urls.some((u) => u.includes("real-time-amazon-data.p.rapidapi.com"))
    ).toBe(true);
  });

  it("throws api_not_configured when LWA fails and no API keys configured", async () => {
    fetchMock.mockResolvedValueOnce(buildLwaTokenResponse());
    fetchMock.mockResolvedValueOnce(new Response("not found", { status: 404 }));

    await expect(
      fetchAmazonProductDataWithFallback({
        asin: TEST_ASIN,
        marketplace: TEST_MARKET,
        lwaClientId: "id",
        lwaClientSecret: "secret",
      })
    ).rejects.toMatchObject({
      name: "AmazonProductFetchError",
      code: "api_not_configured",
    });
  });

  it("throws api_not_configured when neither LWA nor API keys configured", async () => {
    await expect(
      fetchAmazonProductDataWithFallback({
        asin: TEST_ASIN,
        marketplace: TEST_MARKET,
      })
    ).rejects.toMatchObject({
      name: "AmazonProductFetchError",
      code: "api_not_configured",
    });
  });

  it("prefers LWA over API keys when both are configured", async () => {
    fetchMock.mockResolvedValueOnce(buildLwaTokenResponse());
    fetchMock.mockResolvedValueOnce(buildCreatorsProductResponse());

    await fetchAmazonProductDataWithFallback({
      asin: TEST_ASIN,
      marketplace: TEST_MARKET,
      lwaClientId: "id",
      lwaClientSecret: "secret",
      primaryApiKey: "rapidapi-key",
    });

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(
      urls.some((u) => u.includes("creatorsapi-na.amazon.com"))
    ).toBe(true);
    expect(
      urls.filter((u) => u.includes("real-time-amazon-data.p.rapidapi.com"))
    ).toHaveLength(0);
  });
});

describe("ensureProductRecord LWA branching", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof fetch;

  beforeEach(async () => {
    clearCreatorsTokenCacheForTests();
    await env.DB.prepare("DELETE FROM products").run();
    originalFetch = globalThis.fetch;
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
    await env.DB.prepare("DELETE FROM products").run();
  });

  it("new product fetches via LWA when configured and no explicit title/image", async () => {
    fetchMock.mockResolvedValueOnce(buildLwaTokenResponse());
    fetchMock.mockResolvedValueOnce(buildCreatorsProductResponse("From Creators"));

    const product = await ensureProductRecord({
      db: env.DB,
      asin: TEST_ASIN,
      marketplace: TEST_MARKET,
      lwaClientId: "id",
      lwaClientSecret: "secret",
    });

    expect(product.title).toBe("From Creators");
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(
      urls.some((u) => u.includes("creatorsapi-na.amazon.com"))
    ).toBe(true);

    const stored = await env.DB
      .prepare("SELECT title FROM products WHERE asin = ? AND marketplace = ?")
      .bind(TEST_ASIN, TEST_MARKET)
      .first<{ title: string }>();
    expect(stored?.title).toBe("From Creators");
  });

  it("new product with explicit title and image skips LWA fetch", async () => {
    const product = await ensureProductRecord({
      db: env.DB,
      asin: TEST_ASIN,
      marketplace: TEST_MARKET,
      title: "Explicit Title",
      imageUrl: "https://example.com/explicit.jpg",
      lwaClientId: "id",
      lwaClientSecret: "secret",
    });

    expect(product.title).toBe("Explicit Title");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("considers LWA as a fetch source without API keys (requireRealProductData)", async () => {
    fetchMock.mockResolvedValueOnce(buildLwaTokenResponse());
    fetchMock.mockResolvedValueOnce(buildCreatorsProductResponse("LWA Only"));

    const product = await ensureProductRecord({
      db: env.DB,
      asin: TEST_ASIN,
      marketplace: TEST_MARKET,
      lwaClientId: "id",
      lwaClientSecret: "secret",
      requireRealProductData: true,
    });

    expect(product.title).toBe("LWA Only");
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(
      urls.some((u) => u.includes("creatorsapi-na.amazon.com"))
    ).toBe(true);
  });

  it("existing product does not trigger LWA fetch when updateExistingFromInput is false", async () => {
    await env.DB
      .prepare(
        `INSERT INTO products (asin, title, image_url, marketplace, status) VALUES (?, ?, ?, ?, 'active')`
      )
      .bind(TEST_ASIN, "Existing Title", "https://example.com/existing.jpg", TEST_MARKET)
      .run();

    const product = await ensureProductRecord({
      db: env.DB,
      asin: TEST_ASIN,
      marketplace: TEST_MARKET,
      title: "Should Be Ignored",
      lwaClientId: "id",
      lwaClientSecret: "secret",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(product.title).toBe("Existing Title");
  });

  it("existing product update with updateExistingFromInput does not trigger LWA fetch", async () => {
    await env.DB
      .prepare(
        `INSERT INTO products (asin, title, image_url, marketplace, status) VALUES (?, ?, ?, ?, 'active')`
      )
      .bind(TEST_ASIN, "Existing Title", "https://example.com/existing.jpg", TEST_MARKET)
      .run();

    const product = await ensureProductRecord({
      db: env.DB,
      asin: TEST_ASIN,
      marketplace: TEST_MARKET,
      title: "Updated Title",
      updateExistingFromInput: true,
      lwaClientId: "id",
      lwaClientSecret: "secret",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(product.title).toBe("Updated Title");
  });
});

describe("refreshProductRecord LWA branching", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof fetch;

  beforeEach(async () => {
    clearCreatorsTokenCacheForTests();
    await env.DB.prepare("DELETE FROM products").run();
    originalFetch = globalThis.fetch;
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
    await env.DB.prepare("DELETE FROM products").run();
  });

  it("refreshes product using LWA when configured", async () => {
    await env.DB
      .prepare(
        `INSERT INTO products (asin, title, image_url, marketplace, status) VALUES (?, ?, ?, ?, 'active')`
      )
      .bind(TEST_ASIN, "Placeholder", "https://example.com/placeholder.jpg", TEST_MARKET)
      .run();

    fetchMock.mockResolvedValueOnce(buildLwaTokenResponse());
    fetchMock.mockResolvedValueOnce(
      buildCreatorsProductResponse("Refreshed From Creators")
    );

    const product = await refreshProductRecord({
      db: env.DB,
      asin: TEST_ASIN,
      marketplace: TEST_MARKET,
      apiKey: "rapidapi-fallback-key",
      lwaClientId: "id",
      lwaClientSecret: "secret",
    });

    expect(product.title).toBe("Refreshed From Creators");
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(
      urls.some((u) => u.includes("creatorsapi-na.amazon.com"))
    ).toBe(true);
    expect(
      urls.filter((u) => u.includes("real-time-amazon-data.p.rapidapi.com"))
    ).toHaveLength(0);
  });

  it("falls back to API keys when LWA throws during refresh", async () => {
    await env.DB
      .prepare(
        `INSERT INTO products (asin, title, image_url, marketplace, status) VALUES (?, ?, ?, ?, 'active')`
      )
      .bind(TEST_ASIN, "Placeholder", "https://example.com/placeholder.jpg", TEST_MARKET)
      .run();

    fetchMock.mockResolvedValueOnce(buildLwaTokenResponse());
    fetchMock.mockResolvedValueOnce(new Response("not found", { status: 404 }));
    fetchMock.mockResolvedValueOnce(
      buildRapidApiResponse("Refreshed From RapidAPI")
    );

    const product = await refreshProductRecord({
      db: env.DB,
      asin: TEST_ASIN,
      marketplace: TEST_MARKET,
      apiKey: "rapidapi-key",
      lwaClientId: "id",
      lwaClientSecret: "secret",
    });

    expect(product.title).toBe("Refreshed From RapidAPI");
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(
      urls.some((u) => u.includes("real-time-amazon-data.p.rapidapi.com"))
    ).toBe(true);
  });

  it("throws when LWA fails and no API keys are usable during refresh", async () => {
    fetchMock.mockResolvedValueOnce(buildLwaTokenResponse());
    fetchMock.mockResolvedValueOnce(new Response("not found", { status: 404 }));

    await expect(
      refreshProductRecord({
        db: env.DB,
        asin: TEST_ASIN,
        marketplace: TEST_MARKET,
        apiKey: "",
        lwaClientId: "id",
        lwaClientSecret: "secret",
      })
    ).rejects.toMatchObject({
      name: "AmazonProductFetchError",
      code: "api_not_configured",
    });
  });
});
