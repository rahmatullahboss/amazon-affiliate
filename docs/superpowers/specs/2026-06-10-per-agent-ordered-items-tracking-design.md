# Per-Agent Ordered Items Tracking Design

## Scope

This change adds a per-agent, admin-only "Ordered Items" view to the existing admin dashboard. It surfaces the data already collected in `amazon_conversions` (populated by manual CSV imports of Amazon Associates earnings reports) as ranked, per-product top-sellers lists inside each agent's profile page.

It does **not** introduce new ingestion paths. Amazon's Creators API (and its predecessor PA-API) expose only product catalog data (`GetItems`, `SearchItems`, `GetVariations`, `GetBrowseNodes`) — order/earnings data is not available programmatically. CSV import via `POST /api/analytics/reports/import` remains the only ingestion channel.

It also does **not** re-implement features that already ship: agent delete/deactivate (see `server/routes/agents.ts:230+`) and sheet upload/control (see `server/routes/sheets.ts`, `server/routes/sheet-control.ts`) are out of scope.

## Goals

- Give admins a per-agent dashboard showing which products drive the most orders, revenue, and commission for that agent.
- Reuse the existing `amazon_conversions` data set (no new ingestion, no new tables, no new indexes).
- Match existing codebase patterns: `adminOnly` middleware, Zod-validated query params, audit-logged admin actions, no-cache-on-fresh-query approach, empty/loading/error states on every screen.
- Keep the feature self-contained: one new API endpoint, one new admin page, one small UI tweak on the existing agents list.

## Non-Goals

- No automated ingestion from Amazon (Creators API, S3 polling, third-party scrapers, scheduled jobs).
- No cross-agent leaderboard / global top products page.
- No public/visitor visibility of top products.
- No time-range filter (7d/30d/90d/custom) — all-time cumulative only.
- No CSV / Excel / PDF export.
- No sparkline charts, no month-over-month deltas, no charts of any kind.
- No in-row date breakdown modal/popover.
- No agent delete / deactivate changes (already shipped).
- No sheet upload / sheet control changes (already shipped).

## Architecture & Data Flow

1. Admin opens `/admin/agents`, sees the existing agents table.
2. Admin clicks a new "View Top Products" CTA on a row → navigates to `/admin/agents/:id/ordered-items`.
3. New admin route loader fires `GET /api/agents/:id/ordered-items` with optional query params: `sortBy`, `sortDir`, `page`, `pageSize`, `marketplace`.
4. New server route handler (in `server/routes/agents.ts`) runs two SQL queries against D1:
   - **Summary query** — totals across all `amazon_conversions` rows joined to the agent's `tracking_ids`.
   - **Product list query** — same JOIN, `GROUP BY p.id, ac.asin`, paginated and sorted.
5. Response includes `{ agent, summary, products, pagination, sort, marketplace }`.
6. UI renders summary tiles, marketplace filter, sort controls, and a paginated product table. Each row is a `<Link>` to existing `/admin/products/:id`.

### Data source

`amazon_conversions` (existing) → `JOIN tracking_ids ON t.tag = ac.tracking_tag AND t.marketplace = ac.marketplace` → `LEFT JOIN products ON p.asin = ac.asin AND p.marketplace = ac.marketplace`.

The existing index `idx_amazon_conversions_tracking (tracking_tag, marketplace, raw_date)` (see `migrations/0003_users_and_portal.sql:52-53`) supports the JOIN and `marketplace` filter. No new migration is needed.

### Components

- **New server route handler**: `server/routes/agents.ts` adds `agents.get('/:id/ordered-items', ...)`. Already mounted under `adminOnly` via `server/api.ts:115`. No new mount point required.
- **New Zod schema**: `orderedItemsQuerySchema` in `server/schemas/index.ts`, validated via `zValidator('query', ...)` (matches the pattern used by `importAmazonReportSchema` at line 230).
- **New admin page**: `app/routes/admin/agent-ordered-items.tsx` → URL `/admin/agents/:id/ordered-items`. Register as a new flat route in `app/routes.ts` (the existing admin section uses flat routes, see `app/routes.ts:30-45` — pattern is `route("path/:id/suffix", "routes/admin/file.tsx")`).
- **Existing admin page tweak**: `app/routes/admin/agents.tsx` (the agents list) gets a "View Top Products" button per row.
- **Existing sidebar tweak**: `app/routes/admin/layout.tsx` gets a new entry "Ordered Items" pointing to `/admin/agents` (the existing list page, which now serves as the entry point to per-agent drill-downs).

## API Contract

**Endpoint:** `GET /api/agents/:id/ordered-items`

**Auth:** `adminOnly` middleware (admin, super_admin) — same as existing `GET /api/agents`.

**Query params (all optional):**

| Param | Type | Default | Notes |
|---|---|---|---|
| `sortBy` | enum | `ordered_items` | One of `ordered_items`, `revenue`, `commission`. Whitelisted; unknown values fall back to `ordered_items`. |
| `sortDir` | enum | `desc` | One of `asc`, `desc`. |
| `page` | int ≥ 1 | `1` | Page number. |
| `pageSize` | int 1-100 | `50` | Items per page. |
| `marketplace` | enum or `all` | `all` | `US`, `UK`, `DE`, `IT`, `FR`, `ES`, `CA`, or `all`. |

**Validation:** Zod schema in `server/schemas/index.ts`, validated with `zValidator('query', ...)` per existing patterns.

**Response (200):**

```ts
{
  agent: { id: number; name: string; slug: string },
  summary: {
    totalOrdered: number,
    totalShipped: number,
    totalRevenue: number,
    totalCommission: number,
    totalReturned: number,
    marketplaceBreakdown: Array<{
      marketplace: string,
      orderedItems: number,
      revenue: number,
      commission: number
    }>
  },
  products: Array<{
    productId: number | null,         // null if conversion row has no matching product
    asin: string | null,
    title: string | null,
    imageUrl: string | null,
    totalOrderedItems: number,
    totalShippedItems: number,
    totalRevenue: number,
    totalCommission: number,
    totalReturned: number,
    firstOrderedAt: string | null,
    lastOrderedAt: string | null
  }>,
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number },
  sort: { sortBy: string; sortDir: string },
  marketplace: string
}
```

**Errors:**

| Status | Cause |
|---|---|
| 400 | Invalid `:id` (NaN) or query params fail Zod validation |
| 404 | Agent not found, or agent `is_active = 0` |
| 401 / 403 | Auth — handled by `adminOnly` middleware |
| 500 | Unhandled DB error — caught by global `app.onError` at `server/api.ts:129` |

### SQL — summary query

```sql
SELECT
  COALESCE(SUM(ac.ordered_items), 0)                                            AS total_ordered,
  COALESCE(SUM(ac.shipped_items), 0)                                             AS total_shipped,
  COALESCE(SUM(ac.revenue_amount), 0)                                            AS total_revenue,
  COALESCE(SUM(ac.commission_amount), 0)                                         AS total_commission,
  COALESCE(SUM(CASE WHEN ac.ordered_items > ac.shipped_items
                    THEN ac.ordered_items - ac.shipped_items
                    ELSE 0 END), 0)                                              AS total_returned
FROM amazon_conversions ac
JOIN tracking_ids t ON t.tag = ac.tracking_tag AND t.marketplace = ac.marketplace
WHERE t.agent_id = ?
  [AND ac.marketplace = ?]
```

The same query, with `GROUP BY ac.marketplace` instead of aggregation, produces `marketplaceBreakdown`.

### SQL — product list query

```sql
SELECT
  p.id                                                                              AS product_id,
  ac.asin                                                                           AS asin,
  p.title                                                                           AS title,
  p.image_url                                                                       AS image_url,
  SUM(ac.ordered_items)                                                             AS total_ordered_items,
  SUM(ac.shipped_items)                                                             AS total_shipped_items,
  SUM(ac.revenue_amount)                                                            AS total_revenue,
  SUM(ac.commission_amount)                                                         AS total_commission,
  SUM(CASE WHEN ac.ordered_items > ac.shipped_items
           THEN ac.ordered_items - ac.shipped_items
           ELSE 0 END)                                                              AS total_returned,
  MIN(ac.raw_date)                                                                  AS first_ordered_at,    -- raw_date is YYYY-MM-DD text; MIN/MAX work as string comparison
  MAX(ac.raw_date)                                                                  AS last_ordered_at
FROM amazon_conversions ac
JOIN tracking_ids t ON t.tag = ac.tracking_tag AND t.marketplace = ac.marketplace
LEFT JOIN products p ON p.asin = ac.asin AND p.marketplace = ac.marketplace
WHERE t.agent_id = ?
  [AND ac.marketplace = ?]
GROUP BY p.id, ac.asin
ORDER BY {sortColumn} {sortDir}
LIMIT ? OFFSET ?
```

`{sortColumn}` is mapped from `sortBy` via a TypeScript switch (whitelist to prevent SQL injection):

| `sortBy` | SQL column |
|---|---|
| `ordered_items` | `total_ordered_items` |
| `revenue` | `total_revenue` |
| `commission` | `total_commission` |
| (any other) | `total_ordered_items` (default fallback) |

## UI

**File:** `app/routes/admin/agent-ordered-items.tsx` (NEW)

### Layout

1. **Header bar**
   - Back link: `← Back to Agents` → `/admin/agents`
   - Title: `{agent.name} — Ordered Items`
   - Subtitle: agent slug + summary line

2. **Summary tiles (4-5 cards)**
   - Total Ordered Items
   - Total Shipped Items
   - Total Revenue (formatted `$X,XXX.XX`)
   - Total Commission (formatted `$X,XXX.XX`)
   - Total Returned Items (red badge if > 0)

3. **Marketplace filter + sort controls**
   - Marketplace dropdown: `All marketplaces` (default) plus the distinct marketplaces from `summary.marketplaceBreakdown`.
   - Sort dropdown: `Most Ordered` (default) | `Highest Revenue` | `Highest Commission`.
   - Sort direction toggle: `↑` / `↓` (default `desc`).

4. **Empty state** (when `products.length === 0` AND `summary.totalOrdered === 0`)
   - Heading: "No order data yet"
   - Body: "Import an Amazon Associates earnings CSV report to populate this view. Reports are imported from /admin/analytics → Import Report."
   - CTA button: `Go to Import Report` → `/admin/analytics`

5. **Products table** (when data exists)
   - Columns: Image (small thumb) | Title (with ASIN as secondary text) | Ordered | Shipped | Returned | Revenue | Commission | First seen | Last seen
   - Each row is a `<Link to={'/admin/products/' + productId}>` when `productId` is non-null. When `productId` is null (conversion has no matching product in catalog), the row is plain text with a "Not in catalog" badge and no link.
   - Sort indicator on the active column.

6. **Pagination footer**
   - `Page X of Y` + Prev/Next buttons. Disabled at edges.
   - Page size is fixed at 50 (matches API default). No page-size selector in the UI.

7. **Loading & error states** (per project standards in `AGENTS.md`)
   - Loading: skeleton rows + tile placeholders (no spinner alone).
   - Error: error banner with retry button on any 4xx/5xx (uses existing `extractApiErrorMessage` utility at `app/utils/api-errors.ts`, already imported in `app/routes/admin/products.tsx:8`).
   - 404: "Agent not found" with back link.

### Reuse

- `MarketplaceSelector` (`app/components/MarketplaceSelector.tsx`) — drop in if its API matches; otherwise inline a styled `<select>`.
- Existing styles for tiles, badges, table cells from other admin pages (`app/routes/admin/products.tsx`, `app/routes/admin/agents.tsx`).

### Existing-page tweaks

- **`app/routes/admin/agents.tsx`** (existing agents list): add a "View Top Products" button per row linking to `/admin/agents/{id}/ordered-items`.
- **`app/routes/admin/layout.tsx`** (sidebar): add a new entry "Ordered Items" → `/admin/agents`. (The existing agents list is the entry point; per-agent drill-down lives at the URL above.)

## Error Handling

### API

| Condition | Response |
|---|---|
| `:id` is NaN | 400 with message |
| Query params fail Zod validation | 400 with Zod error message |
| Agent not found | 404 `{ message: 'Agent not found' }` |
| Agent `is_active = 0` | 404 `{ message: 'Agent not found' }` (treat as not-found from caller's perspective) |
| Auth failure | 401 / 403 via `adminOnly` middleware |
| Unhandled DB error | 500 via global `app.onError` at `server/api.ts:129` |

### UI

- Loading: skeleton placeholders, no spinners alone.
- Empty: "No order data yet" + import-CTA.
- 4xx: inline error banner with retry button.
- 5xx: generic error banner with retry button.
- 404: "Agent not found" with back link to `/admin/agents`.

### Edge cases

- `ac.asin` is NULL → `productId` and `title` and `imageUrl` are NULL. Row is rendered as plain text with "Not in catalog" badge and no link.
- Conversion rows with `marketplace` not matching any `tracking_ids` row for the agent → excluded by the JOIN (correct: they don't belong to this agent).
- Agent with zero `tracking_ids` → summary returns zeros, products array is empty, empty state shown.
- `sortBy` whitelist: unknown values fall back to `ordered_items`; never 500.
- `page` requested beyond `totalPages` → returns empty `products` array with correct `pagination` metadata; UI shows "No products on this page" with a back-to-page-1 link.

## Testing

### Unit (Vitest) — handler

- Returns 404 for non-existent agent id.
- Returns 404 for inactive agent.
- Sums correctly across multiple `tracking_ids` belonging to the same agent.
- Excludes conversions whose `tracking_tag`+`marketplace` does not match any of the agent's `tracking_ids`.
- `sortBy=ordered_items` orders by `total_ordered_items` desc by default.
- `sortBy=revenue` orders by `total_revenue` desc.
- `sortBy=commission` orders by `total_commission` desc.
- `sortDir=asc` reverses the order.
- `marketplace=US` narrows both summary and product list to that marketplace.
- `marketplace=all` returns global totals.
- Pagination: page 2 returns the next 50 rows; totalPages is correct.
- Rows with NULL `asin` are included with `productId = null` and `title = null`.
- `sortBy=garbage` falls back to `ordered_items` (no 500).

### Unit — schema

- Default values applied when params missing.
- Rejects negative `page`.
- Rejects `pageSize > 100`.
- Rejects invalid `sortBy`, `sortDir`, `marketplace`.

### Component render tests

- Renders 4-5 summary tiles with formatted numbers.
- Empty state visible when `products` is empty and `summary.totalOrdered === 0`.
- Loading skeleton visible during pending loader.
- Error banner with retry button on 4xx/5xx.
- Marketplace dropdown is populated from `summary.marketplaceBreakdown`.
- Sort change triggers a new loader fetch.
- Pagination prev/next disabled at edges.

### E2E (Playwright)

**Happy path**
- Login as admin → navigate to `/admin/agents` → click "View Top Products" on a known agent → summary tiles render with non-zero values → product list renders → change sort to "Highest Revenue" → products re-order → click a product row → navigates to `/admin/products/:id` → back → change marketplace filter → list updates → click Next page → pagination works.

**Empty state**
- Find (or seed) an agent with zero conversions → "No order data yet" + CTA visible → click CTA → navigates to `/admin/analytics`.

**Auth**
- Login as `editor` → navigate directly to `/admin/agents/:id/ordered-items` → 403 / redirect per project auth pattern.
- Direct API call with editor token → 403.

**Sort + filter**
- Combination: `sortBy=commission`, `sortDir=asc`, `marketplace=US`, `page=2` → verify response shape and ordering.

### Manual smoke

- Insert sample conversion rows via existing `seed_blogs_approval_pack.sql` pattern or a one-off script; verify totals match SQL sum.

## Out of Scope (explicit)

| Item | Status |
|---|---|
| Automated ingestion (Creators API / S3 polling / scheduled jobs) | Out — Creators API does not expose order data; CSV import remains the only path. |
| Cross-agent leaderboard / "Global Top Products" page | Out — per-agent scope only. |
| Public / visitor visibility of top products | Out — admin only. |
| Time-range filter (7d / 30d / 90d / custom) | Out — all-time cumulative only. |
| CSV / Excel / PDF export | Out — view only. |
| Sparkline / month-over-month charts | Out — summary tiles only. |
| In-row date breakdown modal/popover | Out — click navigates to existing `/admin/products/:id`. |
| Agent delete / deactivate flow | Already shipped — `server/routes/agents.ts:230+`. |
| Sheet upload (individual sheet management) | Already shipped — `server/routes/sheets.ts`, `admin/sheets.tsx`. |
| Sheet control (master sheet management) | Already shipped — `server/routes/sheet-control.ts`, `admin/sheet-control.tsx`. |

## Migration Impact

None. No new tables, columns, or indexes. The existing `idx_amazon_conversions_tracking` index covers the new query patterns.

## Security & Privacy

- Admin-only: enforced by `adminOnly` middleware (admin, super_admin). Editor and agent roles cannot access the page or API.
- The new endpoint must not be added to `adminContent` (which permits `editor`).
- No PII is added to the response. Conversion data is aggregate-only.
- Audit log: optional. Read-only analytics view; no `entityType`/`entityId` mutation. No new `writeAuditLog` call needed (matches the pattern of `GET /api/agents`).

## Files Touched

### New
- `app/routes/admin/agent-ordered-items.tsx`
- `server/schemas/index.ts` — append `orderedItemsQuerySchema` (or new file `server/schemas/agents.ts` if preferred by repo convention)
- Test files for handler, schema, and component

### Modified
- `server/routes/agents.ts` — add `agents.get('/:id/ordered-items', ...)` handler
- `app/routes/admin/agents.tsx` (existing list) — add "View Top Products" button per row
- `app/routes/admin/layout.tsx` (sidebar) — add "Ordered Items" nav entry pointing to `/admin/agents`

### Unchanged
- `migrations/*` — no migration
- `server/services/creators-api.ts` — unrelated
- `server/routes/sheets.ts`, `server/routes/sheet-control.ts` — out of scope
- `server/routes/agents.ts` existing handlers (delete/deactivate) — out of scope
