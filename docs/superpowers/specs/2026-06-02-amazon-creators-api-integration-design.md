# Amazon Creators API Integration Design

## Scope

This change makes the Amazon Creators API the primary product data provider for ASIN-based product ingestion, with the existing RapidAPI (pa-api) implementation kept as fallback.

This unlocks ASIN fetches without paying for RapidAPI, and gives us a first-party Amazon data source for product title/image/description/features that supports all 7 marketplaces we currently serve.

## Goals

- Add an LWA (Login with Amazon) client_credentials OAuth flow that yields a cached access token.
- Add a `creators-api.ts` service that calls Creators API's product endpoints and maps responses to the existing `AmazonProductData` shape.
- Insert the Creators API provider between the WP bridge and the RapidAPI fallback in `fetchAmazonProductDataWithFallback`.
- Cover all 7 supported marketplaces (US, CA, UK, DE, IT, FR, ES) with appropriate regional Creators API endpoints.
- Translate all Creators API failure modes into the existing `AmazonProductFetchError` codes so downstream code does not change.

## Non-Goals

- No creator-specific endpoints (earnings, content creation, OAuth user authorization). Only the product data endpoints are in scope.
- No removal of pa-api/RapidAPI or WP bridge — both stay as fallbacks.
- No new admin UI surface — the integration is invisible to the UI; the existing `/api/products` flow already calls `ensureProductRecord` which calls `fetchAmazonProductDataWithFallback`.
- No per-isolate or durable token cache. Each Workers isolate manages its own in-memory token cache (Cloudflare Workers' natural isolation model).

## Architecture

```
ensureProductRecord(db, asin, marketplace, ...)
  ↓
fetchAmazonProductDataWithFallback(input)
  ↓
[1] WP bridge (if WP_BRIDGE_URL + WP_BRIDGE_KEY configured)        — existing, unchanged
  ↓ on miss / failure
[2] Creators API (if LWA_CLIENT_ID + LWA_CLIENT_SECRET configured)  — NEW
  ↓ on miss / failure
[3] RapidAPI pa-api keys (if AMAZON_API_KEY configured)            — existing, unchanged
  ↓
AmazonProductData → DB upsert
```

Each step is independent. A failure in step 2 does not skip step 3 unless all of 2 and 3 are exhausted.

## Components

### 1. `server/services/creators-api.ts` (NEW)

Exports:

```ts
export interface CreatorsApiInput {
  asin: string;
  marketplace: Marketplace;
  lwaClientId: string;
  lwaClientSecret: string;
}

export async function fetchCreatorsProduct(input: CreatorsApiInput): Promise<AmazonProductData>;
export async function getCreatorsAccessToken(clientId: string, clientSecret: string): Promise<string>;
```

#### LWA token management

- `getCreatorsAccessToken` issues `POST https://api.amazon.com/auth/o2/token` with:
  - `grant_type=client_credentials`
  - `client_id`, `client_secret`
  - `scope=creatorsapi::read` (or whatever scope is approved — implementation will read the env override `LWA_CREATORS_SCOPE` defaulting to `creatorsapi::read`)
- Returns the `access_token` string.
- Caches per `clientId` in module-scoped `Map<string, { token: string; expiresAt: number }>`.
- Refreshes 60 seconds before `expires_in`.
- On 401 from any Creators API call, drops the cached token and forces a fresh fetch once.
- Token cache is in-memory only (Workers isolate local) — acceptable because each isolate fetches at most once per token lifetime (default 3600s).

#### Product fetch

- `fetchCreatorsProduct` calls the regional Creators API endpoint for the marketplace.
- Marketplace → region map:
  - `US`, `CA` → `creatorsapi-na.amazon.com`
  - `UK`, `DE`, `IT`, `FR`, `ES` → `creatorsapi-eu.amazon.com`
- Endpoint shape: `GET /products/{asin}?marketplace={code}` (exact path verified during implementation; the actual LWA scope and endpoint may require the official Creators API docs).
- Response is mapped to the existing `AmazonProductData` interface:
  - `title` ← product title
  - `imageUrl` ← primary product image
  - `category` ← browse node name (nullable)
  - `description` ← product description (nullable)
  - `features` ← bullet points array
  - `productImages` ← additional images
  - `aplusImages` ← A+ content images
- Missing fields default to empty/nullable so the upsert still works.

#### Error translation

- 401/403 → `AmazonProductFetchError({ code: "unauthorized" })`
- 404 → `AmazonProductFetchError({ code: "not_found" })`
- 429 → `AmazonProductFetchError({ code: "rate_limited" })`
- 5xx / network errors → `AmazonProductFetchError({ code: "upstream_error" })`
- JSON parse failure → `AmazonProductFetchError({ code: "invalid_response" })`

### 2. `server/services/product-ingestion.ts` (MODIFY)

Add new fields to `FetchAmazonProductDataWithFallbackInput`:

```ts
lwaClientId?: string;
lwaClientSecret?: string;
```

Insert Creators API step between WP bridge and RapidAPI:

```ts
if (!wpConfigured) {
  const lwaConfigured = !!(input.lwaClientId && input.lwaClientSecret);
  if (lwaConfigured) {
    try {
      return await fetchCreatorsProduct({
        asin: input.asin,
        marketplace: input.marketplace,
        lwaClientId: input.lwaClientId!,
        lwaClientSecret: input.lwaClientSecret!,
      });
    } catch (error) {
      if (!(error instanceof AmazonProductFetchError)) throw error;
      // fall through to RapidAPI
      preferredError = pickPreferredFetchError(preferredError, error);
    }
  }
}

// existing RapidAPI loop
```

The same change is mirrored in `ensureProductRecord` (which currently passes `apiKey`/`fallbackApiKeys`/`wpBridgeUrl`/`wpBridgeKey` to `fetchAmazonProductDataWithFallback`) — add `lwaClientId`/`lwaClientSecret` there too.

All call sites of `ensureProductRecord` must be updated to forward the new fields. Call sites are in:
- `server/routes/products.ts`
- `server/routes/portal.ts`
- `server/services/sheet-sync.ts` (if it exists)
- Anywhere else `ensureProductRecord` is invoked

A grep pass during implementation will find all sites.

### 3. `server/utils/types.ts` (MODIFY)

Add to `Env`:

```ts
LWA_CLIENT_ID?: string;
LWA_CLIENT_SECRET?: string;
LWA_CREATORS_SCOPE?: string;
```

The env binding mirrors existing patterns (e.g. `AMAZON_API_KEY`).

### 4. `wrangler.jsonc` (MODIFY)

Add under `vars` (or `env.production.vars` if secrets-only):

```jsonc
"LWA_CREATORS_SCOPE": "creatorsapi::read"
```

`LWA_CLIENT_ID` and `LWA_CLIENT_SECRET` are configured as secrets via `wrangler secret put`, not committed to the file. Local dev uses `.dev.vars`.

## Data Flow

1. Admin or portal action calls an endpoint that triggers `ensureProductRecord({ asin, marketplace, ... })`.
2. `ensureProductRecord` checks D1 for an existing product. If absent, it needs to fetch.
3. It calls `fetchAmazonProductDataWithFallback` with the new `lwaClientId` / `lwaClientSecret` fields populated from `c.env`.
4. The fallback chain runs (WP → Creators → RapidAPI). First success wins.
5. Returned `AmazonProductData` is upserted into `products` with status `active`.
6. The rest of the existing flow (editorial generation, mapping, etc.) is unchanged.

## Testing

### Unit tests — `test/unit/creators-api.test.ts`

- Token caching: same `clientId` returns same token; expired token triggers re-fetch.
- Marketplace routing: `US` → `creatorsapi-na`, `UK` → `creatorsapi-eu`.
- Response mapping: minimal JSON → `AmazonProductData` with nullable fields respected.
- Error translation: 401 → `unauthorized`, 404 → `not_found`, 429 → `rate_limited`, 500 → `upstream_error`, malformed JSON → `invalid_response`.
- 401 retry: first call 401 → drop cache → second call succeeds.

All unit tests use `vi.stubGlobal('fetch', vi.fn())` to avoid real network calls (matching existing test patterns).

### Integration tests — extend `test/api/products-wzone-bridge.test.ts` or add a new test

- E2E: ensure `ensureProductRecord` returns a product when Creators API is configured and returns a mock product.
- Fallback: when Creators API returns 404, the WP bridge or RapidAPI path is tried (existing behavior preserved).
- The existing `products-update`, `products-regenerate`, `products-pagination`, and `bulk-import` tests should continue to pass unchanged because the public surface of `ensureProductRecord` is backward-compatible.

### Manual verification

After deploy:
- `curl /api/products` with a new ASIN triggers `ensureProductRecord`, which calls Creators API.
- KV cache and `health` endpoint continue to report healthy with the new env vars set.
- `/api/health` warning is removed once `LWA_CLIENT_ID` and `LWA_CLIENT_SECRET` are configured (creators provider takes over from `api_not_configured`).

## Migration

No data migration. New env vars are added; existing functionality is preserved as fallback. If the env vars are not set, the existing behavior (WP bridge / RapidAPI) continues to work.

## Risks

- **Approval uncertainty** — the user has client_id/secret but is not sure if Amazon has approved them. This is a runtime concern, not a design one. If Creators API returns 401, the fallback chain activates. The spec does not change based on approval status.
- **Endpoint discovery** — exact path/format of Creators API product endpoints and required scopes need to be confirmed against the official docs during implementation. The spec uses placeholders (`/products/{asin}`); the implementation will verify the exact contract. The service interface (LWA token + ASIN-based fetch) does not depend on the exact endpoint.
- **Rate limits** — Creators API rate limits are TBD per Amazon docs. If hit, the existing `rate_limited` error code propagates and the fallback chain continues. The cache for `health` endpoint may surface this.
- **Token expiry edge cases** — clock skew between Workers isolate and LWA is mitigated by the 60-second refresh buffer.

## Out of Scope (Future Specs)

- Per-creator OAuth authorization flow (authorization code grant with refresh tokens).
- Creator earnings/reporting endpoints.
- Content/feed creation endpoints.
- Removing pa-api or WP bridge once Creators API proves reliable in production.
- Persisting tokens across Worker isolates (KV-backed shared cache).
