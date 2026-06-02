# Amazon Creators API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Amazon Creators API the primary ASIN-based product data provider via LWA client_credentials OAuth, with the existing RapidAPI (pa-api) implementation kept as fallback.

**Architecture:** New `server/services/creators-api.ts` handles LWA token caching and product fetch. The existing `fetchAmazonProductDataWithFallback` chain is extended with a new Creators API step between the WP bridge and the RapidAPI fallback. New optional `lwaClientId` / `lwaClientSecret` fields are plumbed through `ensureProductRecord` and all its call sites; the existing surface remains backward-compatible.

**Tech Stack:** TypeScript, Hono, Cloudflare Workers, D1, Vitest, `vi.stubGlobal('fetch')` for unit tests, `wrangler secret put` for credentials.

**Spec:** `docs/superpowers/specs/2026-06-02-amazon-creators-api-integration-design.md`

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `server/services/creators-api.ts` | LWA token cache + Creators API product fetch + marketplace routing + error translation | CREATE |
| `test/unit/creators-api.test.ts` | Unit tests for token cache, routing, mapping, errors, 401 retry | CREATE |
| `server/services/product-ingestion.ts` | Extend `fetchAmazonProductDataWithFallback` + `ensureProductRecord` + `refreshProductRecord` with LWA fields | MODIFY |
| `server/utils/types.ts` | Add `LWA_CLIENT_ID` / `LWA_CLIENT_SECRET` / `LWA_CREATORS_SCOPE` to `Bindings` | MODIFY |
| `wrangler.jsonc` | Add `LWA_CREATORS_SCOPE` to `vars`, document secrets | MODIFY |
| `server/routes/products.ts` | Forward LWA fields to `ensureProductRecord` (2 sites) + `fetchAmazonProductDataWithFallback` (2 sites) | MODIFY |
| `server/routes/portal.ts` | Forward LWA fields to `ensureProductRecord` (1 site) | MODIFY |
| `server/services/sheet-control.ts` | Forward LWA fields to `ensureProductRecord` (1 site) | MODIFY |
| `server/services/sheet-sync.ts` | Forward LWA fields to `ensureProductRecord` (1 site) | MODIFY |
| `server/services/dynamic-links.ts` | Forward LWA fields to `ensureProductRecord` (2 sites) | MODIFY |
| `test/unit/wzone-product-provider.test.ts` | Add LWA fields to existing `fetchAmazonProductDataWithFallback` calls | MODIFY |
| `test/api/products-regenerate.test.ts` | Add LWA fields to existing `ensureProductRecord` call | MODIFY |

---

### Task 1: Add LWA bindings to AppEnv types

**Files:**
- Modify: `server/utils/types.ts:2-42`

- [ ] **Step 1: Add the three LWA fields**

Open `server/utils/types.ts` and add the following three lines to the `Bindings` type, after the existing `WP_BRIDGE_KEY?: string;` line (line 27):

```ts
  LWA_CLIENT_ID?: string;
  LWA_CLIENT_SECRET?: string;
  LWA_CREATORS_SCOPE?: string;
```

- [ ] **Step 2: Verify typecheck still passes**

Run: `npx tsc --noEmit -p tsconfig.cloudflare.json`
Expected: Only the 2 pre-existing errors in `robots[.]txt.tsx` and `sitemap[.]xml.tsx` (unrelated). No new errors.

- [ ] **Step 3: Commit**

```bash
git add server/utils/types.ts
git commit -m "feat(creators-api): add LWA env bindings to AppEnv"
```

---

### Task 2: Add LWA scope to wrangler.jsonc

**Files:**
- Modify: `wrangler.jsonc:40-69`

- [ ] **Step 1: Add `LWA_CREATORS_SCOPE` to vars**

In `wrangler.jsonc`, inside the `vars` block (line 40-57), add the following line after `"OLLAMA_CLOUD_MODEL"` (line 56):

```jsonc
    "LWA_CREATORS_SCOPE": "creatorsapi::read",
```

- [ ] **Step 2: Add secrets documentation**

After line 67 (`// - OLLAMA_CLOUD_MODEL (optional fallback)`) and before line 68 (`// - TELEGRAM_BOT_TOKEN`), add:

```jsonc
  // - LWA_CLIENT_ID (Amazon Creators API Login with Amazon client ID)
  // - LWA_CLIENT_SECRET (Amazon Creators API Login with Amazon client secret)
```

- [ ] **Step 3: Validate JSONC**

Run: `npx --yes jsonc-parser-cli wrangler.jsonc 2>/dev/null || node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('wrangler.jsonc','utf8').replace(/\\/\\/.*$/gm,'').replace(/,\s*([}\]])/g,'\$1')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add wrangler.jsonc
git commit -m "feat(creators-api): add LWA_CREATORS_SCOPE default and secret docs"
```

---

### Task 3: Create creators-api.ts skeleton with type definitions

**Files:**
- Create: `server/services/creators-api.ts`

- [ ] **Step 1: Create the file with exports and stubbed functions**

Create `server/services/creators-api.ts` with the following content:

```ts
import type { Marketplace } from "../schemas";
import {
  AmazonProductData,
  AmazonProductFetchError,
  createAmazonProductFetchError,
} from "./product-ingestion";

export interface CreatorsApiInput {
  asin: string;
  marketplace: Marketplace;
  lwaClientId: string;
  lwaClientSecret: string;
  scope?: string;
}

export interface CreatorsTokenCacheEntry {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CreatorsTokenCacheEntry>();

export function clearCreatorsTokenCacheForTests(): void {
  tokenCache.clear();
}

export function getCreatorsRegionBaseUrl(marketplace: Marketplace): string {
  if (marketplace === "US" || marketplace === "CA") {
    return "https://creatorsapi-na.amazon.com";
  }
  return "https://creatorsapi-eu.amazon.com";
}

export async function getCreatorsAccessToken(
  clientId: string,
  clientSecret: string,
  scope: string
): Promise<string> {
  void clientId;
  void clientSecret;
  void scope;
  throw new Error("not implemented");
}

export async function fetchCreatorsProduct(
  input: CreatorsApiInput
): Promise<AmazonProductData> {
  void input;
  throw new Error("not implemented");
}

export function mapCreatorsProductResponse(
  payload: unknown
): AmazonProductData {
  void payload;
  throw new Error("not implemented");
}

export { AmazonProductFetchError, createAmazonProductFetchError };
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit -p tsconfig.cloudflare.json`
Expected: Only the 2 pre-existing errors. No new errors from `creators-api.ts`.

- [ ] **Step 3: Commit**

```bash
git add server/services/creators-api.ts
git commit -m "feat(creators-api): scaffold service with types and region routing"
```

---

### Task 4: TDD — marketplace region routing

**Files:**
- Test: `test/unit/creators-api.test.ts`
- Modify: `server/services/creators-api.ts`

- [ ] **Step 1: Write the failing test**

Create `test/unit/creators-api.test.ts` with the following content:

```ts
import { describe, expect, it } from "vitest";
import { getCreatorsRegionBaseUrl } from "../../server/services/creators-api";

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
```

- [ ] **Step 2: Run the test to verify it passes (already implemented in Task 3)**

Run: `npx vitest run test/unit/creators-api.test.ts`
Expected: PASS (the routing was already stubbed in Task 3)

- [ ] **Step 3: If for any reason routing was not yet implemented, ensure `getCreatorsRegionBaseUrl` returns the right values**

The current implementation in Task 3 already handles this. No change needed.

- [ ] **Step 4: Commit**

```bash
git add test/unit/creators-api.test.ts
git commit -m "test(creators-api): cover marketplace region routing"
```

---

### Task 5: TDD — response mapping

**Files:**
- Test: `test/unit/creators-api.test.ts`
- Modify: `server/services/creators-api.ts`

- [ ] **Step 1: Write the failing test**

Add the following `describe` block to `test/unit/creators-api.test.ts` (after the existing `describe("Creators API region routing", ...)` block):

```ts
import { mapCreatorsProductResponse } from "../../server/services/creators-api";

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/unit/creators-api.test.ts`
Expected: FAIL — `mapCreatorsProductResponse` throws "not implemented"

- [ ] **Step 3: Implement `mapCreatorsProductResponse`**

Replace the existing `mapCreatorsProductResponse` function in `server/services/creators-api.ts` with:

```ts
interface CreatorsImageRef {
  url?: string | null;
}

interface CreatorsProductPayload {
  title?: string | null;
  mainImage?: CreatorsImageRef | null;
  category?: string | null;
  description?: string | null;
  features?: string[] | null;
  images?: CreatorsImageRef[] | null;
  aplusImages?: CreatorsImageRef[] | null;
}

function extractImageUrls(
  images: CreatorsImageRef[] | null | undefined
): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .map((image) => image?.url)
    .filter((url): url is string => typeof url === "string" && url.length > 0);
}

export function mapCreatorsProductResponse(
  payload: unknown
): AmazonProductData {
  const product = (payload ?? {}) as CreatorsProductPayload;
  return {
    title: product.title?.trim() ?? "",
    imageUrl: product.mainImage?.url?.trim() ?? "",
    category: product.category?.trim() || null,
    description: product.description?.trim() || null,
    features: Array.isArray(product.features) ? product.features : [],
    productImages: extractImageUrls(product.images),
    aplusImages: extractImageUrls(product.aplusImages),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/unit/creators-api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add test/unit/creators-api.test.ts server/services/creators-api.ts
git commit -m "feat(creators-api): map Creators API product response to AmazonProductData"
```

---

### Task 6: TDD — LWA token fetch with cache

**Files:**
- Test: `test/unit/creators-api.test.ts`
- Modify: `server/services/creators-api.ts`

- [ ] **Step 1: Write the failing test**

Add the following `describe` block to `test/unit/creators-api.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCreatorsTokenCacheForTests,
  getCreatorsAccessToken,
} from "../../server/services/creators-api";

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/unit/creators-api.test.ts`
Expected: FAIL — `getCreatorsAccessToken` throws "not implemented"

- [ ] **Step 3: Implement `getCreatorsAccessToken`**

Replace the existing `getCreatorsAccessToken` function in `server/services/creators-api.ts` with:

```ts
interface CreatorsTokenResponse {
  access_token: string;
  expires_in: number;
}

const TOKEN_REFRESH_BUFFER_MS = 60_000;

export async function getCreatorsAccessToken(
  clientId: string,
  clientSecret: string,
  scope: string
): Promise<string> {
  const cacheKey = `${clientId}:${scope}`;
  const cached = tokenCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now + TOKEN_REFRESH_BUFFER_MS) {
    return cached.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  });

  const response = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (response.status === 401 || response.status === 403) {
    throw createAmazonProductFetchError({
      asin: "",
      marketplace: "US",
      code: "unauthorized",
      message: "LWA token request rejected",
    });
  }

  if (!response.ok) {
    throw createAmazonProductFetchError({
      asin: "",
      marketplace: "US",
      code: "upstream_error",
      message: `LWA token request failed: ${response.status}`,
    });
  }

  const payload = (await response.json()) as Partial<CreatorsTokenResponse>;
  if (typeof payload.access_token !== "string" || typeof payload.expires_in !== "number") {
    throw createAmazonProductFetchError({
      asin: "",
      marketplace: "US",
      code: "invalid_response",
      message: "LWA token response missing access_token or expires_in",
    });
  }

  const token = payload.access_token;
  const expiresAt = now + payload.expires_in * 1000;
  tokenCache.set(cacheKey, { token, expiresAt });
  return token;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/unit/creators-api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add test/unit/creators-api.test.ts server/services/creators-api.ts
git commit -m "feat(creators-api): LWA client_credentials token with TTL cache"
```

---

### Task 7: TDD — fetchCreatorsProduct with error translation and 401 retry

**Files:**
- Test: `test/unit/creators-api.test.ts`
- Modify: `server/services/creators-api.ts`

- [ ] **Step 1: Write the failing test**

Add the following `describe` block to `test/unit/creators-api.test.ts`:

```ts
import { fetchCreatorsProduct } from "../../server/services/creators-api";

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
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/unit/creators-api.test.ts`
Expected: FAIL — `fetchCreatorsProduct` throws "not implemented"

- [ ] **Step 3: Implement `fetchCreatorsProduct`**

Replace the existing `fetchCreatorsProduct` function in `server/services/creators-api.ts` with:

```ts
export async function fetchCreatorsProduct(
  input: CreatorsApiInput
): Promise<AmazonProductData> {
  const scope = input.scope ?? "creatorsapi::read";
  const baseUrl = getCreatorsRegionBaseUrl(input.marketplace);
  const url = `${baseUrl}/products/${encodeURIComponent(input.asin)}?marketplace=${encodeURIComponent(input.marketplace)}`;

  const performFetch = async (accessToken: string) => {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (response.status === 404) {
      throw createAmazonProductFetchError({
        asin: input.asin,
        marketplace: input.marketplace,
        code: "not_found",
      });
    }
    if (response.status === 429) {
      throw createAmazonProductFetchError({
        asin: input.asin,
        marketplace: input.marketplace,
        code: "rate_limited",
      });
    }
    if (response.status === 401 || response.status === 403) {
      return { kind: "unauthorized" as const, response };
    }
    if (response.status >= 500) {
      throw createAmazonProductFetchError({
        asin: input.asin,
        marketplace: input.marketplace,
        code: "upstream_error",
      });
    }
    if (!response.ok) {
      throw createAmazonProductFetchError({
        asin: input.asin,
        marketplace: input.marketplace,
        code: "upstream_error",
        message: `Creators API responded with ${response.status}`,
      });
    }
    return { kind: "ok" as const, response };
  };

  let accessToken = await getCreatorsAccessToken(
    input.lwaClientId,
    input.lwaClientSecret,
    scope
  );

  let result = await performFetch(accessToken);
  if (result.kind === "unauthorized") {
    const cacheKey = `${input.lwaClientId}:${scope}`;
    tokenCache.delete(cacheKey);
    accessToken = await getCreatorsAccessToken(
      input.lwaClientId,
      input.lwaClientSecret,
      scope
    );
    result = await performFetch(accessToken);
    if (result.kind === "unauthorized") {
      throw createAmazonProductFetchError({
        asin: input.asin,
        marketplace: input.marketplace,
        code: "unauthorized",
      });
    }
  }

  try {
    const payload = (await result.response.json()) as unknown;
    return mapCreatorsProductResponse(payload);
  } catch {
    throw createAmazonProductFetchError({
      asin: input.asin,
      marketplace: input.marketplace,
      code: "invalid_response",
    });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/unit/creators-api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add test/unit/creators-api.test.ts server/services/creators-api.ts
git commit -m "feat(creators-api): product fetch with regional routing, error translation, 401 retry"
```

---

### Task 8: Extend fetchAmazonProductDataWithFallback to call Creators API

**Files:**
- Modify: `server/services/product-ingestion.ts:36-54` (input type) and `:451-503` (function body)
- Modify: `server/services/product-ingestion.ts:505-704` (ensureProductRecord signature + internal call)
- Modify: `server/services/product-ingestion.ts:706-744` (refreshProductRecord signature + internal call)

- [ ] **Step 1: Add LWA fields to `EnsureProductInput`**

In `server/services/product-ingestion.ts`, locate the `EnsureProductInput` interface (line 36) and add the following fields after `wpBridgeKey?: string;` (line 43):

```ts
  lwaClientId?: string;
  lwaClientSecret?: string;
  lwaScope?: string;
```

- [ ] **Step 2: Add LWA fields to `fetchAmazonProductDataWithFallback` input**

Locate `fetchAmazonProductDataWithFallback` (line 451) and add the following fields to its input type after `wpBridgeKey?: string;` (line 457):

```ts
  lwaClientId?: string;
  lwaClientSecret?: string;
  lwaScope?: string;
```

- [ ] **Step 3: Add the import and the Creators API step**

Add the following import at the top of `server/services/product-ingestion.ts` (after the existing imports near line 9):

```ts
import { fetchCreatorsProduct } from "./creators-api";
```

Inside `fetchAmazonProductDataWithFallback`, locate the WP bridge block (lines 459-471) and add the Creators API call immediately after the `wpConfigured` check closes. Replace the closing `}` of `if (wpConfigured) { ... }` block and the start of the RapidAPI section to insert the Creators step. The new code path should be:

```ts
  if (wpConfigured) {
    return fetchProductFromWordPress({
      wpBridgeUrl: input.wpBridgeUrl?.trim() ?? "",
      wpBridgeKey: input.wpBridgeKey?.trim() ?? "",
      asin: input.asin,
      marketplace: input.marketplace,
    });
  }

  const lwaConfigured = !!(input.lwaClientId && input.lwaClientSecret);
  if (lwaConfigured) {
    try {
      return await fetchCreatorsProduct({
        asin: input.asin,
        marketplace: input.marketplace as Marketplace,
        lwaClientId: input.lwaClientId!,
        lwaClientSecret: input.lwaClientSecret!,
        scope: input.lwaScope,
      });
    } catch (error) {
      if (!(error instanceof AmazonProductFetchError)) {
        throw error;
      }
      preferredError = pickPreferredFetchError(preferredError, error);
    }
  }

  const apiKeys = resolveAmazonApiKeys(input);
```

Add this import to the top of the file (next to the existing `Marketplace` references if any):

```ts
import type { Marketplace } from "../schemas";
```

- [ ] **Step 4: Plumb LWA fields through `ensureProductRecord`**

Locate the internal call to `fetchAmazonProductDataWithFallback` inside `ensureProductRecord` (line 541) and extend the call:

```ts
      fetched = await fetchAmazonProductDataWithFallback({
        asin,
        marketplace,
        primaryApiKey: input.apiKey,
        fallbackApiKeys: input.fallbackApiKeys,
        wpBridgeUrl: input.wpBridgeUrl,
        wpBridgeKey: input.wpBridgeKey,
        lwaClientId: input.lwaClientId,
        lwaClientSecret: input.lwaClientSecret,
        lwaScope: input.lwaScope,
      });
```

Also extend the `hasAnyFetchSource` check (line 535) to include LWA credentials:

```ts
      const hasAnyFetchSource =
        resolvedApiKeys.length > 0 ||
        isWordPressBridgeConfigured({
          WP_BRIDGE_URL: input.wpBridgeUrl,
          WP_BRIDGE_KEY: input.wpBridgeKey,
        }) ||
        !!(input.lwaClientId && input.lwaClientSecret);
```

- [ ] **Step 5: Plumb LWA fields through `refreshProductRecord`**

Locate `refreshProductRecord` (line 706) and add the same three optional fields to its input type. Then update the call to `fetchAmazonProductDataWithFallback` (line 716) to pass them, and update the call to `ensureProductRecord` (line 725) to pass them too.

```ts
export async function refreshProductRecord(input: {
  db: D1Database;
  apiKey?: string;
  fallbackApiKeys?: string[];
  wpBridgeUrl?: string;
  wpBridgeKey?: string;
  lwaClientId?: string;
  lwaClientSecret?: string;
  lwaScope?: string;
  asin: string;
  marketplace: string;
  status?: string;
}): Promise<ProductRecord> {
  const fetched = await fetchAmazonProductDataWithFallback({
    asin: input.asin,
    marketplace: input.marketplace,
    primaryApiKey: input.apiKey,
    fallbackApiKeys: input.fallbackApiKeys,
    wpBridgeUrl: input.wpBridgeUrl,
    wpBridgeKey: input.wpBridgeKey,
    lwaClientId: input.lwaClientId,
    lwaClientSecret: input.lwaClientSecret,
    lwaScope: input.lwaScope,
  });

  return ensureProductRecord({
    db: input.db,
    asin: input.asin,
    marketplace: input.marketplace,
    apiKey: input.apiKey,
    fallbackApiKeys: input.fallbackApiKeys,
    wpBridgeUrl: input.wpBridgeUrl,
    wpBridgeKey: input.wpBridgeKey,
    lwaClientId: input.lwaClientId,
    lwaClientSecret: input.lwaClientSecret,
    lwaScope: input.lwaScope,
    title: fetched.title,
    imageUrl: fetched.imageUrl,
    category: fetched.category,
    description: fetched.description,
    features: fetched.features,
    productImages: fetched.productImages,
    aplusImages: fetched.aplusImages,
    status: input.status || "active",
    updateExistingFromInput: true,
    requireRealProductData: true,
  });
}
```

- [ ] **Step 6: Verify typecheck**

Run: `npx tsc --noEmit -p tsconfig.cloudflare.json`
Expected: Only the 2 pre-existing errors. No new errors.

- [ ] **Step 7: Run existing unit tests to confirm no regression**

Run: `npx vitest run test/unit/wzone-product-provider.test.ts test/api/products-regenerate.test.ts test/api/products-update.test.ts test/api/products-pagination.test.ts test/api/redirect.test.ts`
Expected: PASS (existing tests don't pass the new LWA fields, but they should still pass because the fields are optional)

- [ ] **Step 8: Commit**

```bash
git add server/services/product-ingestion.ts
git commit -m "feat(creators-api): wire Creators API into fetchAmazonProductDataWithFallback chain"
```

---

### Task 9: Plumb LWA fields through server/routes/products.ts

**Files:**
- Modify: `server/routes/products.ts:287` (direct fallback call)
- Modify: `server/routes/products.ts:295` (ensure call)
- Modify: `server/routes/products.ts:858` (regenerate call)

- [ ] **Step 1: Read the current call sites to understand the context**

Run: `grep -n "fetchAmazonProductDataWithFallback\|ensureProductRecord" server/routes/products.ts`

- [ ] **Step 2: Add LWA fields to the three call sites**

For each call site, add the following three lines to the call's argument object:

```ts
        lwaClientId: c.env.LWA_CLIENT_ID,
        lwaClientSecret: c.env.LWA_CLIENT_SECRET,
        lwaScope: c.env.LWA_CREATORS_SCOPE,
```

The three call sites are at lines 287 (in `fetchAmazonProductDataWithFallback` call), 295 (in `ensureProductRecord` call), and 858 (in another `fetchAmazonProductDataWithFallback` call). Each call gets the same three lines added.

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit -p tsconfig.cloudflare.json`
Expected: Only the 2 pre-existing errors.

- [ ] **Step 4: Commit**

```bash
git add server/routes/products.ts
git commit -m "feat(creators-api): forward LWA credentials in admin products route"
```

---

### Task 10: Plumb LWA fields through server/routes/portal.ts

**Files:**
- Modify: `server/routes/portal.ts:917` (ensure call)

- [ ] **Step 1: Locate the call site**

Run: `grep -n "ensureProductRecord" server/routes/portal.ts`

- [ ] **Step 2: Add LWA fields to the call**

Add the following three lines to the call's argument object at line 917:

```ts
      lwaClientId: c.env.LWA_CLIENT_ID,
      lwaClientSecret: c.env.LWA_CLIENT_SECRET,
      lwaScope: c.env.LWA_CREATORS_SCOPE,
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit -p tsconfig.cloudflare.json`
Expected: Only the 2 pre-existing errors.

- [ ] **Step 4: Commit**

```bash
git add server/routes/portal.ts
git commit -m "feat(creators-api): forward LWA credentials in portal route"
```

---

### Task 11: Plumb LWA fields through sheet services

**Files:**
- Modify: `server/services/sheet-control.ts:673` (ensure call)
- Modify: `server/services/sheet-sync.ts:370` (ensure call)

- [ ] **Step 1: Locate the call sites and their surrounding context**

Run: `grep -n "ensureProductRecord" server/services/sheet-control.ts server/services/sheet-sync.ts`

For each call site, look at the surrounding function to identify where the LWA credentials come from. Both call sites are inside functions that receive some kind of input object — the LWA fields need to be threaded from there. If the function does not currently accept an `env` parameter, the LWA fields must be added to the function's input.

- [ ] **Step 2: Add LWA fields to both call sites**

For each call site, add the following three lines to the call's argument object:

```ts
      lwaClientId: <source>,
      lwaClientSecret: <source>,
      lwaScope: <source>,
```

Where `<source>` is one of:
- A field from the function's input parameter
- `env.LWA_CLIENT_ID` (etc.) if the function has access to `env`

If neither source is available, add the three fields to the function's input and pass them through from the caller.

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit -p tsconfig.cloudflare.json`
Expected: Only the 2 pre-existing errors.

- [ ] **Step 4: Commit**

```bash
git add server/services/sheet-control.ts server/services/sheet-sync.ts
git commit -m "feat(creators-api): forward LWA credentials in sheet sync/control services"
```

---

### Task 12: Plumb LWA fields through dynamic-links service

**Files:**
- Modify: `server/services/dynamic-links.ts:473` and `:695` (two ensure calls)

- [ ] **Step 1: Locate the call sites**

Run: `grep -n "ensureProductRecord" server/services/dynamic-links.ts`

- [ ] **Step 2: Add LWA fields to both call sites**

For each call site, add the following three lines to the call's argument object:

```ts
      lwaClientId: <source>,
      lwaClientSecret: <source>,
      lwaScope: <source>,
```

Where `<source>` follows the same pattern as Task 11 — either from the function's input or from `env` if available.

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit -p tsconfig.cloudflare.json`
Expected: Only the 2 pre-existing errors.

- [ ] **Step 4: Commit**

```bash
git add server/services/dynamic-links.ts
git commit -m "feat(creators-api): forward LWA credentials in dynamic-links service"
```

---

### Task 13: Update existing test files to include the new LWA fields

**Files:**
- Modify: `test/unit/wzone-product-provider.test.ts:26` and `:65`
- Modify: `test/api/products-regenerate.test.ts:47`

- [ ] **Step 1: Update `wzone-product-provider.test.ts`**

For each of the two `fetchAmazonProductDataWithFallback({...})` calls (lines 26 and 65), add the new fields at the end of the argument object:

```ts
      lwaClientId: undefined,
      lwaClientSecret: undefined,
      lwaScope: undefined,
```

The fields are optional, so passing `undefined` is a no-op and preserves the existing test behavior (creators is not used).

- [ ] **Step 2: Update `products-regenerate.test.ts`**

Locate the `ensureProductRecord({...})` call at line 47 and add the same three lines at the end of the argument object:

```ts
      lwaClientId: undefined,
      lwaClientSecret: undefined,
      lwaScope: undefined,
```

- [ ] **Step 3: Run the three updated test files**

Run: `npx vitest run test/unit/wzone-product-provider.test.ts test/api/products-regenerate.test.ts test/unit/creators-api.test.ts`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add test/unit/wzone-product-provider.test.ts test/api/products-regenerate.test.ts
git commit -m "test(creators-api): add optional LWA fields to existing provider tests"
```

---

### Task 14: Add a fallback integration test for Creators API

**Files:**
- Create: `test/api/creators-api-fallback.test.ts`

- [ ] **Step 1: Write the test**

Create `test/api/creators-api-fallback.test.ts` with the following content:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { apiApp } from "../../server/api";
import { DbFactory } from "../factories/db";
import { generateAdminToken } from "../factories/token";
import { clearCreatorsTokenCacheForTests } from "../../server/services/creators-api";

describe("Creators API fallback chain", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof fetch;

  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM admin_users").run();
    clearCreatorsTokenCacheForTests();
    originalFetch = globalThis.fetch;
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.stubGlobal("fetch", originalFetch);
    vi.unstubAllMocks();
  });

  it("uses Creators API when LWA credentials are configured", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "creators-token", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          asin: "B0FALL001",
          title: "Creators Product",
          mainImage: { url: "https://example.com/creators.jpg" },
          features: ["Creators feature"],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    (env as { LWA_CLIENT_ID?: string }).LWA_CLIENT_ID = "test-id";
    (env as { LWA_CLIENT_SECRET?: string }).LWA_CLIENT_SECRET = "test-secret";

    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await apiApp.fetch(
      new Request("http://localhost/api/products", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          asin: "B0FALL001",
          title: "Placeholder",
          image_url: "https://placeholder.example/img.jpg",
          marketplace: "US",
        }),
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    expect(response.status).toBeLessThan(400);
    expect(fetchMock).toHaveBeenCalled();
    const calledUrls = fetchMock.mock.calls.map(([url]) => url as string);
    expect(calledUrls.some((url) => url.includes("creatorsapi-na.amazon.com"))).toBe(true);

    delete (env as { LWA_CLIENT_ID?: string }).LWA_CLIENT_ID;
    delete (env as { LWA_CLIENT_SECRET?: string }).LWA_CLIENT_SECRET;
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `npx vitest run test/api/creators-api-fallback.test.ts`
Expected: PASS (the test creates a product with explicit title + image, so the Creators path is triggered to enrich the rest of the fields, and at minimum one call to creatorsapi-na is made)

- [ ] **Step 3: Commit**

```bash
git add test/api/creators-api-fallback.test.ts
git commit -m "test(creators-api): verify Creators API is invoked when LWA credentials are set"
```

---

### Task 15: Run the full test suite and typecheck

- [ ] **Step 1: Run typecheck**

Run: `npx tsc --noEmit -p tsconfig.cloudflare.json`
Expected: Only the 2 pre-existing errors. No new errors.

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: 242 + new tests all pass (at least 242 existing + 9 new from creators-api.test.ts + 1 fallback test = 252 tests minimum). Some pre-existing test counts may have shifted if Task 13 added new tests.

- [ ] **Step 3: Document the new env vars in `.dev.vars.example` if it exists**

If `.dev.vars.example` exists, append the new variables. If it does not exist, skip this step. The variables to document:

```
LWA_CLIENT_ID=
LWA_CLIENT_SECRET=
LWA_CREATORS_SCOPE=creatorsapi::read
```

- [ ] **Step 4: Final commit (only if `.dev.vars.example` was updated)**

```bash
git add .dev.vars.example
git commit -m "docs: document Creators API env vars in .dev.vars.example"
```

---

## Summary

After completing all 15 tasks, the Amazon Creators API is integrated as the primary ASIN-based product data provider with:

- LWA `client_credentials` token management with in-memory TTL cache and 401 retry
- Regional endpoint routing (US/CA → NA, UK/DE/IT/FR/ES → EU)
- Existing `AmazonProductData` shape preserved — no downstream code changes
- 5xx/4xx error translation into existing `AmazonProductFetchError` codes
- New optional `lwaClientId` / `lwaClientSecret` / `lwaScope` fields plumbed through 6 call sites
- Backward compatibility — when LWA credentials are not set, the existing WP bridge / RapidAPI path continues to work
- 10 new unit tests + 1 new integration test covering routing, mapping, token cache, error translation, and 401 retry
