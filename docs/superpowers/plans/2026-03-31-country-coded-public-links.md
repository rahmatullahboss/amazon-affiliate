# Country-Coded Public Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make public bridge and redirect URLs canonical as `/:agent/:country/:asin` and auto-redirect legacy links to the country-coded canonical path without breaking existing links.

**Architecture:** Add explicit country-aware public routes, keep legacy routes as compatibility entry points, and centralize marketplace normalization/canonical URL building in shared helpers. Update page loading, redirect resolution, tracking shortcut generation, and portal/admin link generation so every new public URL is marketplace-fixed while legacy query-param links continue to work.

**Tech Stack:** React Router, Hono, TypeScript, Cloudflare Workers, Vitest, D1, KV

---

### Task 1: Add URL helper coverage for country-coded canonical paths

**Files:**
- Modify: `server/utils/url.ts`
- Test: `test/api/portal-tracking.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('builds canonical bridge and redirect URLs with country path segments', async () => {
  const agentId = 91;

  await DbFactory.seedAgent(env.DB, agentId, 'path-agent', 'Path Agent');
  await env.DB.prepare(
    `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
     VALUES (901, 'B0PATH1234', 'Path Product', 'http://img.com/p.jpg', 'IT', 'active', 1)`
  ).run();
  await env.DB.prepare(
    `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
     VALUES (902, ?, 'path-agent-it-21', 'IT', 1, 1)`
  ).bind(agentId).run();
  await env.DB.prepare(
    `INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active)
     VALUES (?, 901, 902, 1)`
  ).bind(agentId).run();

  const req = new Request('http://localhost/api/portal/links', {
    headers: { Cookie: 'session=admin-session' },
  });

  const res = await apiApp.fetch(req, env as any, adminCtx as any);
  const json = await res.json() as { links: Array<{ bridgePageUrl: string; redirectUrl: string }> };

  expect(json.links[0]?.bridgePageUrl).toContain('/path-agent/it/B0PATH1234');
  expect(json.links[0]?.redirectUrl).toContain('/go/path-agent/it/B0PATH1234');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -s vitest run test/api/portal-tracking.test.ts`
Expected: FAIL because URLs still use `/:agent/:asin` plus `?m=IT`

- [ ] **Step 3: Write minimal implementation**

```ts
export function normalizeMarketplaceSlug(value: string | null | undefined): string | null {
  const normalized = normalizeMarketplaceHint(value);
  return normalized ? normalized.toLowerCase() : null;
}

export function buildCanonicalBridgePath(agentSlug: string, asin: string, marketplace: string): string {
  const country = normalizeMarketplaceSlug(marketplace);
  return country ? `/${agentSlug}/${country}/${asin}` : `/${agentSlug}/${asin}`;
}

export function buildCanonicalRedirectPath(agentSlug: string, asin: string, marketplace: string): string {
  const country = normalizeMarketplaceSlug(marketplace);
  return country ? `/go/${agentSlug}/${country}/${asin}` : `/go/${agentSlug}/${asin}`;
}
```

- [ ] **Step 4: Update URL generation call sites**

```ts
bridgePageUrl: `${origin}${buildCanonicalBridgePath(row.agent_slug, row.asin, row.marketplace)}`,
redirectUrl: `${origin}${buildCanonicalRedirectPath(row.agent_slug, row.asin, row.marketplace)}`,
```

Apply this pattern in:
- `server/routes/portal.ts`
- `server/routes/mappings.ts`

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm -s vitest run test/api/portal-tracking.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/utils/url.ts server/routes/portal.ts server/routes/mappings.ts test/api/portal-tracking.test.ts
git commit -m "feat: generate canonical country-coded public links"
```

### Task 2: Add country-coded public routes and canonical bridge rendering

**Files:**
- Modify: `app/routes.ts`
- Modify: `app/routes/bridge.tsx`
- Modify: `server/routes/page.ts`
- Test: `test/api/redirect.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('renders the canonical bridge URL using the country path segment', async () => {
  const agentId = 21;

  await DbFactory.seedAgent(env.DB, agentId, 'canonical-agent', 'Canonical Agent');
  await env.DB.prepare(
    `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
     VALUES (2101, 'B0CANON123', 'Canonical Product', 'http://img.com/c.jpg', 'DE', 'active', 1)`
  ).run();
  await env.DB.prepare(
    `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
     VALUES (2102, ?, 'canonical-de-21', 'DE', 1, 1)`
  ).bind(agentId).run();
  await env.DB.prepare(
    `INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active)
     VALUES (?, 2101, 2102, 1)`
  ).bind(agentId).run();

  const res = await apiApp.fetch(
    new Request('http://localhost/api/page/canonical-agent/de/B0CANON123'),
    env as any,
    basicCtx as any
  );

  const json = await res.json() as { marketplace: string; amazonUrl: string };
  expect(res.status).toBe(200);
  expect(json.marketplace).toBe('DE');
  expect(json.amazonUrl).toContain('amazon.de/dp/B0CANON123');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -s vitest run test/api/redirect.test.ts`
Expected: FAIL because country-coded page API route is not supported yet

- [ ] **Step 3: Write minimal implementation**

```ts
route(':agent/:country/:asin', 'routes/bridge.tsx')
```

```ts
const preferredMarketplace =
  normalizeMarketplaceHint(c.req.param('country')) ?? normalizeMarketplaceHint(c.req.query('m'));
```

```ts
const apiPath = country
  ? `/api/page/${agent}/${country}/${asin}`
  : `/api/page/${agent}/${asin}`;
```

Add matching Hono route:

```ts
page.get('/:agentSlug/:country/:asin', async (c) => {
  const preferredMarketplace = normalizeMarketplaceHint(c.req.param('country'));
  return handlePageRequest(c, preferredMarketplace);
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -s vitest run test/api/redirect.test.ts`
Expected: PASS for the new country-coded bridge coverage

- [ ] **Step 5: Commit**

```bash
git add app/routes.ts app/routes/bridge.tsx server/routes/page.ts test/api/redirect.test.ts
git commit -m "feat: support canonical country-coded bridge routes"
```

### Task 3: Redirect legacy public links to canonical country-coded bridge paths

**Files:**
- Modify: `server/routes/page.ts`
- Modify: `server/services/dynamic-links.ts`
- Modify: `server/services/cache.ts`
- Test: `test/api/redirect.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('redirects legacy bridge URLs to the canonical country-coded path', async () => {
  const agentId = 31;

  await DbFactory.seedAgent(env.DB, agentId, 'legacy-bridge-agent', 'Legacy Bridge Agent');
  await env.DB.prepare(
    `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
     VALUES (3101, 'B0LEGBR123', 'Legacy Bridge Product', 'http://img.com/lb.jpg', 'US', 'active', 1)`
  ).run();
  await env.DB.prepare(
    `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
     VALUES (3102, ?, 'legacy-bridge-us-21', 'US', 1, 1)`
  ).bind(agentId).run();
  await env.DB.prepare(
    `INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active)
     VALUES (?, 3101, 3102, 1)`
  ).bind(agentId).run();

  const res = await apiApp.fetch(
    new Request('http://localhost/legacy-bridge-agent/B0LEGBR123'),
    env as any,
    basicCtx as any
  );

  expect(res.status).toBe(302);
  expect(res.headers.get('Location')).toBe('/legacy-bridge-agent/us/B0LEGBR123');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -s vitest run test/api/redirect.test.ts`
Expected: FAIL because legacy bridge routes still render directly

- [ ] **Step 3: Write minimal implementation**

```ts
const canonicalMarketplace = row.marketplace;
const canonicalPath = buildCanonicalBridgePath(agentSlug, asin, canonicalMarketplace);

if (!preferredMarketplace) {
  throw new HTTPException(302, { res: c.redirect(canonicalPath, 302) });
}
```

Centralize resolution in a shared helper that returns:

```ts
{
  row,
  resolvedMarketplace,
}
```

Cache legacy lookups by resolved marketplace so repeated redirects stay stable.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -s vitest run test/api/redirect.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/routes/page.ts server/services/dynamic-links.ts server/services/cache.ts test/api/redirect.test.ts
git commit -m "feat: redirect legacy bridge URLs to canonical country paths"
```

### Task 4: Add country-coded redirect routes and legacy redirect compatibility

**Files:**
- Modify: `server/routes/redirect.ts`
- Modify: `server/utils/url.ts`
- Test: `test/api/redirect.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('redirects legacy go URLs to canonical country-coded go URLs', async () => {
  const agentId = 41;

  await DbFactory.seedAgent(env.DB, agentId, 'legacy-go-agent', 'Legacy Go Agent');
  await env.DB.prepare(
    `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
     VALUES (4101, 'B0LEGGO123', 'Legacy Go Product', 'http://img.com/lg.jpg', 'IT', 'active', 1)`
  ).run();
  await env.DB.prepare(
    `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
     VALUES (4102, ?, 'legacy-go-it-21', 'IT', 1, 1)`
  ).bind(agentId).run();
  await env.DB.prepare(
    `INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active)
     VALUES (?, 4101, 4102, 1)`
  ).bind(agentId).run();

  const res = await apiApp.fetch(
    new Request('http://localhost/go/legacy-go-agent/B0LEGGO123'),
    env as any,
    basicCtx as any
  );

  expect(res.status).toBe(302);
  expect(res.headers.get('Location')).toBe('/go/legacy-go-agent/it/B0LEGGO123');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -s vitest run test/api/redirect.test.ts`
Expected: FAIL because legacy `/go/:agent/:asin` still goes straight to Amazon

- [ ] **Step 3: Write minimal implementation**

```ts
redirect.get('/:agentSlug/:country/:asin', async (c) => {
  const preferredMarketplace = normalizeMarketplaceHint(c.req.param('country'));
  return handleAgentRedirect(c, preferredMarketplace);
});

redirect.get('/:agentSlug/:asin', async (c) => {
  const resolvedMarketplace = await resolveLegacyMarketplace(...);
  return c.redirect(buildCanonicalRedirectPath(agentSlug, asin, resolvedMarketplace), 302);
});
```

Keep `?m=` support by letting legacy resolution use `normalizeMarketplaceHint(c.req.query('m'))` first.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -s vitest run test/api/redirect.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/routes/redirect.ts server/utils/url.ts test/api/redirect.test.ts
git commit -m "feat: canonicalize legacy redirect links by country"
```

### Task 5: Preserve tracking shortcut and generated links under canonical country paths

**Files:**
- Modify: `app/routes/tracking-shortcut.tsx`
- Modify: `server/routes/portal.ts`
- Modify: `server/routes/mappings.ts`
- Test: `test/api/redirect.test.ts`
- Test: `test/api/portal-tracking.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it('tracking shortcut redirects to the canonical country-coded bridge path', async () => {
  const agentId = 51;

  await DbFactory.seedAgent(env.DB, agentId, 'shortcut-country-agent', 'Shortcut Country Agent');
  await env.DB.prepare(
    `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
     VALUES (5101, 'B0SHORT123', 'Shortcut Product', 'http://img.com/sc.jpg', 'FR', 'active', 1)`
  ).run();
  await env.DB.prepare(
    `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
     VALUES (5102, ?, 'shortcut-country-fr-21', 'FR', 1, 1)`
  ).bind(agentId).run();

  const res = await apiApp.fetch(
    new Request('http://localhost/t/shortcut-country-fr-21/B0SHORT123'),
    env as any,
    basicCtx as any
  );

  expect(res.status).toBe(302);
  expect(res.headers.get('Location')).toBe('/shortcut-country-agent/fr/B0SHORT123');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -s vitest run test/api/redirect.test.ts test/api/portal-tracking.test.ts`
Expected: FAIL because shortcut and generated links still emit non-canonical paths

- [ ] **Step 3: Write minimal implementation**

```ts
return redirect(buildCanonicalBridgePath(agentSlug, asin, marketplace));
```

Replace all remaining generated public link strings with shared canonical builders.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -s vitest run test/api/redirect.test.ts test/api/portal-tracking.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/routes/tracking-shortcut.tsx server/routes/portal.ts server/routes/mappings.ts test/api/redirect.test.ts test/api/portal-tracking.test.ts
git commit -m "feat: emit canonical country-coded links everywhere"
```

### Task 6: Full verification and deploy readiness check

**Files:**
- Modify: `.react-router/types/*` as generated by typegen, if route signatures change

- [ ] **Step 1: Generate route types**

Run: `pnpm exec react-router typegen`
Expected: exits 0 and updates generated route typings if needed

- [ ] **Step 2: Run targeted tests**

Run: `pnpm -s vitest run test/api/redirect.test.ts test/api/portal-tracking.test.ts`
Expected: PASS

- [ ] **Step 3: Run typecheck**

Run: `pnpm -s tsc -p tsconfig.json --noEmit`
Expected: PASS

- [ ] **Step 4: Run production build**

Run: `pnpm -s build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/routes.ts app/routes/bridge.tsx app/routes/tracking-shortcut.tsx server/routes/page.ts server/routes/redirect.ts server/routes/portal.ts server/routes/mappings.ts server/services/cache.ts server/services/dynamic-links.ts server/utils/url.ts test/api/redirect.test.ts test/api/portal-tracking.test.ts .react-router/types
git commit -m "feat: canonicalize public links with country codes"
```

## Self-Review

- Spec coverage: canonical path, legacy auto-redirect, query-param compatibility, shortcut behavior, and generated-link updates all map to Tasks 1-5.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: canonical helpers, route parameters, and marketplace normalization use the same `country`/`marketplace` terminology throughout.

