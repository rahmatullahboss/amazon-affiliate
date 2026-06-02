import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCreatorsTokenCacheForTests,
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
});
