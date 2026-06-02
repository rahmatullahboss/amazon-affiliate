import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCreatorsTokenCacheForTests,
  fetchCreatorsProduct,
  getCreatorsAccessToken,
  getCreatorsRegionBaseUrl,
  mapCreatorsProductResponse,
} from "../../server/services/creators-api";

describe("Creators API region routing", () => {
  it("routes US and CA to the North America endpoint", () => {
    expect(getCreatorsRegionBaseUrl("US")).toBe("https://creatorsapi-na.amazon.com");
    expect(getCreatorsRegionBaseUrl("CA")).toBe("https://creatorsapi-na.amazon.com");
  });

  it("routes UK, DE, IT, FR, ES to the Europe endpoint", () => {
    for (const marketplace of ["UK", "DE", "IT", "FR", "ES"] as const) {
      expect(getCreatorsRegionBaseUrl(marketplace)).toBe(
        "https://creatorsapi-eu.amazon.com"
      );
    }
  });
});

describe("Creators API response mapping", () => {
  it("maps a full payload to AmazonProductData", () => {
    const result = mapCreatorsProductResponse({
      asin: "B0TEST0001",
      title: "Test Product",
      mainImage: { url: "https://example.com/main.jpg" },
      category: "Electronics",
      description: "A test product",
      features: ["Feature 1", "Feature 2"],
      images: [
        { url: "https://example.com/1.jpg" },
        { url: "https://example.com/2.jpg" },
      ],
      aplusImages: [{ url: "https://example.com/aplus.jpg" }],
    });

    expect(result).toEqual({
      title: "Test Product",
      imageUrl: "https://example.com/main.jpg",
      category: "Electronics",
      description: "A test product",
      features: ["Feature 1", "Feature 2"],
      productImages: ["https://example.com/1.jpg", "https://example.com/2.jpg"],
      aplusImages: ["https://example.com/aplus.jpg"],
    });
  });

  it("returns nulls and empty arrays when fields are missing", () => {
    const result = mapCreatorsProductResponse({});
    expect(result).toEqual({
      title: "",
      imageUrl: "",
      category: null,
      description: null,
      features: [],
      productImages: [],
      aplusImages: [],
    });
  });

  it("skips image entries with missing url", () => {
    const result = mapCreatorsProductResponse({
      title: "T",
      mainImage: { url: "https://example.com/main.jpg" },
      images: [
        { url: "https://example.com/1.jpg" },
        { url: null },
        {},
        { url: "https://example.com/2.jpg" },
      ],
    });
    expect(result.productImages).toEqual([
      "https://example.com/1.jpg",
      "https://example.com/2.jpg",
    ]);
  });

  it("returns empty result when payload is null", () => {
    const result = mapCreatorsProductResponse(null);
    expect(result).toEqual({
      title: "",
      imageUrl: "",
      category: null,
      description: null,
      features: [],
      productImages: [],
      aplusImages: [],
    });
  });

  it("returns empty result when payload is undefined", () => {
    const result = mapCreatorsProductResponse(undefined);
    expect(result).toEqual({
      title: "",
      imageUrl: "",
      category: null,
      description: null,
      features: [],
      productImages: [],
      aplusImages: [],
    });
  });

  it("trims whitespace-only strings to empty or null", () => {
    const result = mapCreatorsProductResponse({
      title: "   ",
      mainImage: { url: "  " },
      category: "  ",
      description: "  ",
    });
    expect(result).toEqual({
      title: "",
      imageUrl: "",
      category: null,
      description: null,
      features: [],
      productImages: [],
      aplusImages: [],
    });
  });

  it("returns empty features when features is not an array", () => {
    const result = mapCreatorsProductResponse({ features: "not an array" });
    expect(result.features).toEqual([]);
  });

  it("returns empty aplusImages when missing or null", () => {
    expect(mapCreatorsProductResponse({}).aplusImages).toEqual([]);
    expect(mapCreatorsProductResponse({ aplusImages: null }).aplusImages).toEqual([]);
  });

  it("skips aplusImage entries with missing url", () => {
    const result = mapCreatorsProductResponse({
      aplusImages: [
        { url: "https://example.com/aplus-1.jpg" },
        { url: null },
        {},
        { url: "https://example.com/aplus-2.jpg" },
      ],
    });
    expect(result.aplusImages).toEqual([
      "https://example.com/aplus-1.jpg",
      "https://example.com/aplus-2.jpg",
    ]);
  });
});

describe("Creators API LWA token cache", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearCreatorsTokenCacheForTests();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches a token via LWA client_credentials grant", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "token-1", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const token = await getCreatorsAccessToken("client-id", "client-secret", "creatorsapi::read");

    expect(token).toBe("token-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.amazon.com/auth/o2/token");
    expect(init.method).toBe("POST");
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("client_credentials");
    expect(body.get("client_id")).toBe("client-id");
    expect(body.get("client_secret")).toBe("client-secret");
    expect(body.get("scope")).toBe("creatorsapi::read");
  });

  it("returns the cached token on subsequent calls within the TTL", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "token-1", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    await getCreatorsAccessToken("client-id", "client-secret", "creatorsapi::read");
    const token = await getCreatorsAccessToken("client-id", "client-secret", "creatorsapi::read");

    expect(token).toBe("token-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes the token after expiry", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(0);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "token-1", expires_in: 100 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    await getCreatorsAccessToken("client-id", "client-secret", "creatorsapi::read");

    nowSpy.mockReturnValue(200_000);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "token-2", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const token = await getCreatorsAccessToken("client-id", "client-secret", "creatorsapi::read");

    expect(token).toBe("token-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });

  it("caches per clientId independently", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "token-a", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "token-b", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const a = await getCreatorsAccessToken("client-a", "secret-a", "creatorsapi::read");
    const b = await getCreatorsAccessToken("client-b", "secret-b", "creatorsapi::read");
    const aAgain = await getCreatorsAccessToken("client-a", "secret-a", "creatorsapi::read");

    expect(a).toBe("token-a");
    expect(b).toBe("token-b");
    expect(aAgain).toBe("token-a");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws unauthorized when LWA returns 401", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "invalid_client" }), { status: 401 })
    );
    await expect(
      getCreatorsAccessToken("client-id", "client-secret", "creatorsapi::read")
    ).rejects.toMatchObject({ name: "AmazonProductFetchError", code: "unauthorized" });
  });

  it("throws unauthorized when LWA returns 403", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "forbidden" }), { status: 403 })
    );
    await expect(
      getCreatorsAccessToken("client-id", "client-secret", "creatorsapi::read")
    ).rejects.toMatchObject({ name: "AmazonProductFetchError", code: "unauthorized" });
  });

  it("throws upstream_error when LWA returns 500", async () => {
    fetchMock.mockResolvedValueOnce(new Response("internal error", { status: 500 }));
    await expect(
      getCreatorsAccessToken("client-id", "client-secret", "creatorsapi::read")
    ).rejects.toMatchObject({ name: "AmazonProductFetchError", code: "upstream_error" });
  });

  it("throws invalid_response when LWA response is missing access_token", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ expires_in: 3600 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    await expect(
      getCreatorsAccessToken("client-id", "client-secret", "creatorsapi::read")
    ).rejects.toMatchObject({ name: "AmazonProductFetchError", code: "invalid_response" });
  });

  it("throws invalid_response when LWA response is missing expires_in", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "x" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    await expect(
      getCreatorsAccessToken("client-id", "client-secret", "creatorsapi::read")
    ).rejects.toMatchObject({ name: "AmazonProductFetchError", code: "invalid_response" });
  });

  it("refreshes the token when called within the 60s refresh buffer", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(0);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "token-1", expires_in: 100 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    await getCreatorsAccessToken("client-id", "client-secret", "creatorsapi::read");

    nowSpy.mockReturnValue(50_000);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "token-2", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const token = await getCreatorsAccessToken("client-id", "client-secret", "creatorsapi::read");

    expect(token).toBe("token-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });
});

describe("Creators API product fetch", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearCreatorsTokenCacheForTests();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the regional endpoint with the bearer token and maps the response", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "token-1", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          asin: "B0TEST0001",
          title: "Test Product",
          mainImage: { url: "https://example.com/main.jpg" },
          features: ["Bullet 1"],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const result = await fetchCreatorsProduct({
      asin: "B0TEST0001",
      marketplace: "US",
      lwaClientId: "client-id",
      lwaClientSecret: "client-secret",
    });

    expect(result.title).toBe("Test Product");
    expect(result.imageUrl).toBe("https://example.com/main.jpg");
    expect(result.features).toEqual(["Bullet 1"]);

    const productCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(productCall[0]).toBe("https://creatorsapi-na.amazon.com/products/B0TEST0001?marketplace=US");
    const init = productCall[1];
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-1");
  });

  it("uses the EU endpoint for UK marketplace", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "token-1", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ title: "UK Product" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    await fetchCreatorsProduct({
      asin: "B0UK00001",
      marketplace: "UK",
      lwaClientId: "client-id",
      lwaClientSecret: "client-secret",
    });

    const productCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(productCall[0]).toBe("https://creatorsapi-eu.amazon.com/products/B0UK00001?marketplace=UK");
  });

  it("translates 404 to not_found", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "token-1", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    fetchMock.mockResolvedValueOnce(new Response("not found", { status: 404 }));

    await expect(
      fetchCreatorsProduct({
        asin: "B0MISSING",
        marketplace: "US",
        lwaClientId: "client-id",
        lwaClientSecret: "client-secret",
      })
    ).rejects.toMatchObject({ name: "AmazonProductFetchError", code: "not_found" });
  });

  it("translates 429 to rate_limited", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "token-1", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    fetchMock.mockResolvedValueOnce(new Response("slow down", { status: 429 }));

    await expect(
      fetchCreatorsProduct({
        asin: "B0RATE00",
        marketplace: "US",
        lwaClientId: "client-id",
        lwaClientSecret: "client-secret",
      })
    ).rejects.toMatchObject({ name: "AmazonProductFetchError", code: "rate_limited" });
  });

  it("translates 500 to upstream_error", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "token-1", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    fetchMock.mockResolvedValueOnce(new Response("oops", { status: 500 }));

    await expect(
      fetchCreatorsProduct({
        asin: "B0FAIL000",
        marketplace: "US",
        lwaClientId: "client-id",
        lwaClientSecret: "client-secret",
      })
    ).rejects.toMatchObject({ name: "AmazonProductFetchError", code: "upstream_error" });
  });

  it("translates malformed JSON to invalid_response", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "token-1", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    fetchMock.mockResolvedValueOnce(new Response("not json", { status: 200 }));

    await expect(
      fetchCreatorsProduct({
        asin: "B0BAD0001",
        marketplace: "US",
        lwaClientId: "client-id",
        lwaClientSecret: "client-secret",
      })
    ).rejects.toMatchObject({ name: "AmazonProductFetchError", code: "invalid_response" });
  });

  it("retries once with a fresh token on 401 from the product endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "stale", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    fetchMock.mockResolvedValueOnce(new Response("expired", { status: 401 }));
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "fresh", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ title: "Recovered", mainImage: { url: "https://example.com/r.jpg" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const result = await fetchCreatorsProduct({
      asin: "B0RETRY01",
      marketplace: "US",
      lwaClientId: "client-id",
      lwaClientSecret: "client-secret",
    });

    expect(result.title).toBe("Recovered");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("throws unauthorized when product endpoint returns 403 after a retry", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "token-1", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    fetchMock.mockResolvedValueOnce(new Response("forbidden", { status: 403 }));
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "token-2", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    fetchMock.mockResolvedValueOnce(new Response("forbidden", { status: 403 }));

    await expect(
      fetchCreatorsProduct({
        asin: "B0TEST001",
        marketplace: "US",
        lwaClientId: "client-id",
        lwaClientSecret: "client-secret",
      })
    ).rejects.toMatchObject({ name: "AmazonProductFetchError", code: "unauthorized" });
  });

  it("translates 502 to upstream_error", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "token-1", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    fetchMock.mockResolvedValueOnce(new Response("bad gateway", { status: 502 }));

    await expect(
      fetchCreatorsProduct({
        asin: "B0BADGW01",
        marketplace: "US",
        lwaClientId: "client-id",
        lwaClientSecret: "client-secret",
      })
    ).rejects.toMatchObject({ name: "AmazonProductFetchError", code: "upstream_error" });
  });

  it("translates 400 to upstream_error with status message", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "token-1", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    fetchMock.mockResolvedValueOnce(new Response("bad request", { status: 400 }));

    await expect(
      fetchCreatorsProduct({
        asin: "B0BADREQ1",
        marketplace: "US",
        lwaClientId: "client-id",
        lwaClientSecret: "client-secret",
      })
    ).rejects.toMatchObject({
      name: "AmazonProductFetchError",
      code: "upstream_error",
    });
  });

  it("forwards a custom scope to the LWA token endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "token-1", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ title: "Scoped Product" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    await fetchCreatorsProduct({
      asin: "B0SCOPE01",
      marketplace: "US",
      lwaClientId: "client-id",
      lwaClientSecret: "client-secret",
      scope: "my-custom::scope",
    });

    const lwaCall = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(lwaCall[1].body as string);
    expect(body.get("scope")).toBe("my-custom::scope");
  });
});
