# Per-Agent Ordered Items Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-agent, admin-only "Ordered Items" page that surfaces the existing `amazon_conversions` data as ranked top-products lists, plus a small UI tweak on the existing agents list and a sidebar nav entry.

**Architecture:** A new Hono route handler `GET /api/agents/:id/ordered-items` under the existing `adminOnly` middleware runs two SQL aggregation queries against D1 (summary + paginated product list). A new admin page `app/routes/admin/agent-ordered-items.tsx` consumes it via the standard loader pattern. The agents list page gains a "View Top Products" button per row; the sidebar gains a new entry. No new tables, no new indexes, no new ingestion paths.

**Tech Stack:** Hono, TypeScript, React, React Router, Cloudflare D1, Zod, Vitest, Playwright, Tailwind CSS (admin dark theme).

**Spec:** `docs/superpowers/specs/2026-06-10-per-agent-ordered-items-tracking-design.md`

**Working directory:** `/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate`

---

## File Structure

| File | Responsibility | Status |
|---|---|---|
| `server/routes/agents.ts` | Add `agents.get('/:id/ordered-items', ...)` handler | Modify |
| `server/schemas/index.ts` | Add `orderedItemsQuerySchema` (Zod query validator) | Modify |
| `app/routes/admin/agent-ordered-items.tsx` | New admin page: summary tiles + product list | Create |
| `app/routes.ts` | Register the new admin page route | Modify |
| `app/routes/admin/agents.tsx` | Add "View Top Products" CTA to each row | Modify |
| `app/routes/admin/layout.tsx` | Add "Ordered Items" entry to admin nav (admin + super_admin only) | Modify |
| `test/api/agent-ordered-items.test.ts` | Vitest tests for the new endpoint | Create |
| `test/api/schema-ordered-items.test.ts` | Vitest tests for the new Zod schema | Create |
| `e2e/agent-ordered-items.spec.ts` | Playwright happy-path E2E | Create |

---

## Task 1: Add Zod query schema with default and whitelist behavior

**Files:**
- Modify: `/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate/server/schemas/index.ts:269-280` (append after `discoverAgentSheetTabsSchema`)

- [ ] **Step 1: Add the schema at the end of the file**

Append the following block to `server/schemas/index.ts` (right after the existing `discoverAgentSheetTabsSchema` at the end of the file, before the file's last line if any):

```ts
export const ORDERED_ITEMS_SORT_BY = ['ordered_items', 'revenue', 'commission'] as const;
export type OrderedItemsSortBy = (typeof ORDERED_ITEMS_SORT_BY)[number];

export const ORDERED_ITEMS_SORT_DIR = ['asc', 'desc'] as const;
export type OrderedItemsSortDir = (typeof ORDERED_ITEMS_SORT_DIR)[number];

export const ORDERED_ITEMS_MARKETPLACES = [...MARKETPLACES, 'all'] as const;
export type OrderedItemsMarketplace = (typeof ORDERED_ITEMS_MARKETPLACES)[number];

export const orderedItemsQuerySchema = z.object({
  sortBy: z
    .enum(ORDERED_ITEMS_SORT_BY)
    .optional()
    .default('ordered_items'),
  sortDir: z
    .enum(ORDERED_ITEMS_SORT_DIR)
    .optional()
    .default('desc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
  marketplace: z.enum(ORDERED_ITEMS_MARKETPLACES).optional().default('all'),
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.node.json 2>&1 | head -20`
Expected: no errors related to the new schema.

- [ ] **Step 3: Commit**

```bash
git add server/schemas/index.ts
git commit -m "feat(schemas): add orderedItemsQuerySchema for /api/agents/:id/ordered-items"
```

---

## Task 2: Write failing schema validation tests

**Files:**
- Create: `/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate/test/api/schema-ordered-items.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { orderedItemsQuerySchema } from "../../server/schemas";

describe("orderedItemsQuerySchema", () => {
  it("applies defaults when no params provided", () => {
    const parsed = orderedItemsQuerySchema.parse({});
    expect(parsed).toEqual({
      sortBy: "ordered_items",
      sortDir: "desc",
      page: 1,
      pageSize: 50,
      marketplace: "all",
    });
  });

  it("accepts valid sortBy/sortDir/marketplace values", () => {
    const parsed = orderedItemsQuerySchema.parse({
      sortBy: "revenue",
      sortDir: "asc",
      marketplace: "US",
      page: "2",
      pageSize: "25",
    });
    expect(parsed).toEqual({
      sortBy: "revenue",
      sortDir: "asc",
      page: 2,
      pageSize: 25,
      marketplace: "US",
    });
  });

  it("rejects negative page", () => {
    expect(() => orderedItemsQuerySchema.parse({ page: "0" })).toThrow();
    expect(() => orderedItemsQuerySchema.parse({ page: "-1" })).toThrow();
  });

  it("rejects pageSize greater than 100", () => {
    expect(() => orderedItemsQuerySchema.parse({ pageSize: "101" })).toThrow();
  });

  it("rejects unknown sortBy", () => {
    expect(() => orderedItemsQuerySchema.parse({ sortBy: "garbage" })).toThrow();
  });

  it("rejects unknown sortDir", () => {
    expect(() => orderedItemsQuerySchema.parse({ sortDir: "sideways" })).toThrow();
  });

  it("rejects unknown marketplace", () => {
    expect(() => orderedItemsQuerySchema.parse({ marketplace: "ZZ" })).toThrow();
  });

  it("accepts every marketplace in MARKETPLACES plus 'all'", () => {
    for (const m of ["US", "CA", "UK", "DE", "IT", "FR", "ES", "all"]) {
      const parsed = orderedItemsQuerySchema.parse({ marketplace: m });
      expect(parsed.marketplace).toBe(m);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -s vitest run test/api/schema-ordered-items.test.ts 2>&1 | tail -20`
Expected: FAIL — `orderedItemsQuerySchema` is not exported from `server/schemas` (TS error or module not found).

- [ ] **Step 3: Commit the failing test**

```bash
git add test/api/schema-ordered-items.test.ts
git commit -m "test(schema): add orderedItemsQuerySchema validation tests (red)"
```

---

## Task 3: Make schema tests pass (Task 1 already did this)

**Files:**
- (no new code — Task 1 already added the schema)

- [ ] **Step 1: Run the test to verify it now passes**

Run: `pnpm -s vitest run test/api/schema-ordered-items.test.ts 2>&1 | tail -15`
Expected: PASS — all 8 cases green.

- [ ] **Step 2: Commit nothing further**

The schema was committed in Task 1 step 3. No additional commit needed.

---

## Task 4: Add the SQL aggregation service function with no handler

**Files:**
- Create: `/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate/server/services/agent-ordered-items.ts`

- [ ] **Step 1: Create the service file**

Write the following to `server/services/agent-ordered-items.ts`:

```ts
import type { D1Database } from "@cloudflare/workers-types";
import {
  ORDERED_ITEMS_SORT_BY,
  type OrderedItemsMarketplace,
  type OrderedItemsSortBy,
  type OrderedItemsSortDir,
} from "../schemas";

export interface AgentOrderedItemsSummary {
  totalOrdered: number;
  totalShipped: number;
  totalRevenue: number;
  totalCommission: number;
  totalReturned: number;
  marketplaceBreakdown: Array<{
    marketplace: string;
    orderedItems: number;
    revenue: number;
    commission: number;
  }>;
}

export interface AgentOrderedItemsProduct {
  productId: number | null;
  asin: string | null;
  title: string | null;
  imageUrl: string | null;
  totalOrderedItems: number;
  totalShippedItems: number;
  totalRevenue: number;
  totalCommission: number;
  totalReturned: number;
  firstOrderedAt: string | null;
  lastOrderedAt: string | null;
}

export interface AgentOrderedItemsPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface AgentOrderedItemsResult {
  summary: AgentOrderedItemsSummary;
  products: AgentOrderedItemsProduct[];
  pagination: AgentOrderedItemsPagination;
}

export interface AgentOrderedItemsQuery {
  sortBy: OrderedItemsSortBy;
  sortDir: OrderedItemsSortDir;
  page: number;
  pageSize: number;
  marketplace: OrderedItemsMarketplace;
}

const SORT_COLUMN_BY_KEY: Record<OrderedItemsSortBy, string> = {
  ordered_items: "total_ordered_items",
  revenue: "total_revenue",
  commission: "total_commission",
};

export function resolveSortColumn(sortBy: string): string {
  if ((ORDERED_ITEMS_SORT_BY as readonly string[]).includes(sortBy)) {
    return SORT_COLUMN_BY_KEY[sortBy as OrderedItemsSortBy];
  }
  return SORT_COLUMN_BY_KEY.ordered_items;
}

function marketplaceClause(marketplace: OrderedItemsMarketplace): string {
  return marketplace === "all" ? "" : "AND ac.marketplace = ?";
}

function marketplaceBindValue(
  marketplace: OrderedItemsMarketplace
): string | null {
  return marketplace === "all" ? null : marketplace;
}

export async function fetchAgentOrderedItems(
  db: D1Database,
  agentId: number,
  query: AgentOrderedItemsQuery
): Promise<AgentOrderedItemsResult> {
  const marketplaceParam = marketplaceBindValue(query.marketplace);
  const sortColumn = resolveSortColumn(query.sortBy);
  const sortDir = query.sortDir === "asc" ? "ASC" : "DESC";

  // ── Summary query (totals, optionally filtered by marketplace) ────────────
  const summaryBindings: Array<number | string> = [agentId];
  if (marketplaceParam) summaryBindings.push(marketplaceParam);

  const summaryRow = await db
    .prepare(
      `SELECT
         COALESCE(SUM(ac.ordered_items), 0) AS total_ordered,
         COALESCE(SUM(ac.shipped_items), 0) AS total_shipped,
         COALESCE(SUM(ac.revenue_amount), 0) AS total_revenue,
         COALESCE(SUM(ac.commission_amount), 0) AS total_commission,
         COALESCE(SUM(
            CASE WHEN ac.ordered_items > ac.shipped_items
                 THEN ac.ordered_items - ac.shipped_items
                 ELSE 0
            END
         ), 0) AS total_returned
       FROM amazon_conversions ac
       JOIN tracking_ids t
         ON t.tag = ac.tracking_tag
        AND t.marketplace = ac.marketplace
       WHERE t.agent_id = ?
         ${marketplaceClause(query.marketplace)}`
    )
    .bind(...summaryBindings)
    .first<{
      total_ordered: number;
      total_shipped: number;
      total_revenue: number;
      total_commission: number;
      total_returned: number;
    }>();

  // ── Marketplace breakdown (always all marketplaces, never filtered) ───────
  const breakdownResult = await db
    .prepare(
      `SELECT
         ac.marketplace AS marketplace,
         COALESCE(SUM(ac.ordered_items), 0) AS ordered_items,
         COALESCE(SUM(ac.revenue_amount), 0) AS revenue,
         COALESCE(SUM(ac.commission_amount), 0) AS commission
       FROM amazon_conversions ac
       JOIN tracking_ids t
         ON t.tag = ac.tracking_tag
        AND t.marketplace = ac.marketplace
       WHERE t.agent_id = ?
       GROUP BY ac.marketplace
       ORDER BY ac.marketplace ASC`
    )
    .bind(agentId)
    .all<{
      marketplace: string;
      ordered_items: number;
      revenue: number;
      commission: number;
    }>();

  // ── Count total distinct (product_id, asin) groups for pagination ─────────
  const listBindings: Array<number | string> = [agentId];
  if (marketplaceParam) listBindings.push(marketplaceParam);

  const countResult = await db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM (
         SELECT 1
         FROM amazon_conversions ac
         JOIN tracking_ids t
           ON t.tag = ac.tracking_tag
          AND t.marketplace = ac.marketplace
         LEFT JOIN products p
           ON p.asin = ac.asin
          AND p.marketplace = ac.marketplace
         WHERE t.agent_id = ?
           ${marketplaceClause(query.marketplace)}
         GROUP BY p.id, ac.asin
       )`
    )
    .bind(...listBindings)
    .first<{ total: number }>();

  const totalItems = Number(countResult?.total ?? 0);
  const totalPages = totalItems === 0
    ? 0
    : Math.ceil(totalItems / query.pageSize);

  // ── Product list (paginated, sorted) ──────────────────────────────────────
  const offset = (query.page - 1) * query.pageSize;
  const productBindings: Array<number | string> = [...listBindings, query.pageSize, offset];

  const productRows = await db
    .prepare(
      `SELECT
         p.id            AS product_id,
         ac.asin         AS asin,
         p.title         AS title,
         p.image_url     AS image_url,
         SUM(ac.ordered_items)    AS total_ordered_items,
         SUM(ac.shipped_items)    AS total_shipped_items,
         SUM(ac.revenue_amount)   AS total_revenue,
         SUM(ac.commission_amount) AS total_commission,
         SUM(
            CASE WHEN ac.ordered_items > ac.shipped_items
                 THEN ac.ordered_items - ac.shipped_items
                 ELSE 0
            END
         ) AS total_returned,
         MIN(ac.raw_date) AS first_ordered_at,
         MAX(ac.raw_date) AS last_ordered_at
       FROM amazon_conversions ac
       JOIN tracking_ids t
         ON t.tag = ac.tracking_tag
        AND t.marketplace = ac.marketplace
       LEFT JOIN products p
         ON p.asin = ac.asin
        AND p.marketplace = ac.marketplace
       WHERE t.agent_id = ?
         ${marketplaceClause(query.marketplace)}
       GROUP BY p.id, ac.asin
       ORDER BY ${sortColumn} ${sortDir}, ac.asin ASC
       LIMIT ? OFFSET ?`
    )
    .bind(...productBindings)
    .all<{
      product_id: number | null;
      asin: string | null;
      title: string | null;
      image_url: string | null;
      total_ordered_items: number;
      total_shipped_items: number;
      total_revenue: number;
      total_commission: number;
      total_returned: number;
      first_ordered_at: string | null;
      last_ordered_at: string | null;
    }>();

  return {
    summary: {
      totalOrdered: Number(summaryRow?.total_ordered ?? 0),
      totalShipped: Number(summaryRow?.total_shipped ?? 0),
      totalRevenue: Number(summaryRow?.total_revenue ?? 0),
      totalCommission: Number(summaryRow?.total_commission ?? 0),
      totalReturned: Number(summaryRow?.total_returned ?? 0),
      marketplaceBreakdown: (breakdownResult.results ?? []).map((r) => ({
        marketplace: r.marketplace,
        orderedItems: Number(r.ordered_items),
        revenue: Number(r.revenue),
        commission: Number(r.commission),
      })),
    },
    products: (productRows.results ?? []).map((r) => ({
      productId: r.product_id,
      asin: r.asin,
      title: r.title,
      imageUrl: r.image_url,
      totalOrderedItems: Number(r.total_ordered_items),
      totalShippedItems: Number(r.total_shipped_items),
      totalRevenue: Number(r.total_revenue),
      totalCommission: Number(r.total_commission),
      totalReturned: Number(r.total_returned),
      firstOrderedAt: r.first_ordered_at,
      lastOrderedAt: r.last_ordered_at,
    })),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages,
    },
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.node.json 2>&1 | head -20`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/services/agent-ordered-items.ts
git commit -m "feat(service): add fetchAgentOrderedItems aggregation function"
```

---

## Task 5: Write failing handler tests

**Files:**
- Create: `/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate/test/api/agent-ordered-items.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { apiApp } from "../../server/api";
import { DbFactory } from "../factories/db";
import { generateAdminToken, generateEditorToken } from "../factories/token";

async function seedConversion(
  db: D1Database,
  args: {
    marketplace: string;
    trackingTag: string;
    asin: string | null;
    orderedItems: number;
    shippedItems?: number;
    revenue?: number;
    commission?: number;
    rawDate?: string;
    reportId?: number;
  }
) {
  const reportId = args.reportId ?? 1;
  await db
    .prepare(
      `INSERT INTO amazon_reports
         (id, marketplace, report_type, source_file_name, imported_at)
       VALUES (?, ?, 'tracking_summary', 'seed.csv', datetime('now'))
       ON CONFLICT DO NOTHING`
    )
    .bind(reportId, args.marketplace)
    .run();

  await db
    .prepare(
      `INSERT INTO amazon_conversions
         (report_id, tracking_tag, marketplace, asin, ordered_items, shipped_items,
          revenue_amount, commission_amount, raw_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      reportId,
      args.trackingTag,
      args.marketplace,
      args.asin,
      args.orderedItems,
      args.shippedItems ?? args.orderedItems,
      args.revenue ?? 0,
      args.commission ?? 0,
      args.rawDate ?? "2026-01-01"
    )
    .run();
}

describe("GET /api/agents/:id/ordered-items", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM amazon_conversions").run();
    await env.DB.prepare("DELETE FROM amazon_reports").run();
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM tracking_ids").run();
    await env.DB.prepare("DELETE FROM users").run();
    await env.DB.prepare("DELETE FROM agents").run();
    await env.DB.prepare("DELETE FROM admin_users").run();
  });

  it("returns 404 for non-existent agent", async () => {
    const token = await generateAdminToken();
    const res = await apiApp.fetch(
      new Request("http://localhost/api/agents/9999/ordered-items", {
        headers: { Authorization: `Bearer ${token}`, Origin: "http://localhost" },
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for inactive agent", async () => {
    await DbFactory.seedAdmin(env.DB);
    await env.DB
      .prepare("INSERT INTO agents (id, slug, name, is_active) VALUES (501, 'inactive-a', 'Inactive', 0)")
      .run();
    const token = await generateAdminToken();

    const res = await apiApp.fetch(
      new Request("http://localhost/api/agents/501/ordered-items", {
        headers: { Authorization: `Bearer ${token}`, Origin: "http://localhost" },
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );
    expect(res.status).toBe(404);
  });

  it("rejects editor role with 403", async () => {
    const token = await generateEditorToken();
    const res = await apiApp.fetch(
      new Request("http://localhost/api/agents/1/ordered-items", {
        headers: { Authorization: `Bearer ${token}`, Origin: "http://localhost" },
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );
    expect(res.status).toBe(403);
  });

  it("aggregates correctly across multiple tracking tags for the same agent", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 601, "agent-a", "Agent A");
    await DbFactory.seedTrackingId(env.DB, 701, 601, "tag-a-1");
    await DbFactory.seedTrackingId(env.DB, 702, 601, "tag-a-2");
    await DbFactory.seedProduct(env.DB, 801, "ASIN001");
    await DbFactory.seedProduct(env.DB, 802, "ASIN002");

    await seedConversion(env.DB, {
      marketplace: "US",
      trackingTag: "tag-a-1",
      asin: "ASIN001",
      orderedItems: 5,
      revenue: 100,
      commission: 5,
    });
    await seedConversion(env.DB, {
      marketplace: "US",
      trackingTag: "tag-a-2",
      asin: "ASIN002",
      orderedItems: 3,
      revenue: 60,
      commission: 3,
    });

    const token = await generateAdminToken();
    const res = await apiApp.fetch(
      new Request("http://localhost/api/agents/601/ordered-items", {
        headers: { Authorization: `Bearer ${token}`, Origin: "http://localhost" },
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      summary: { totalOrdered: number; totalRevenue: number; totalCommission: number };
      products: Array<{ productId: number; totalOrderedItems: number }>;
    };
    expect(data.summary.totalOrdered).toBe(8);
    expect(data.summary.totalRevenue).toBe(160);
    expect(data.summary.totalCommission).toBe(8);
    expect(data.products).toHaveLength(2);
  });

  it("excludes conversions whose tag does not match the agent's tracking_ids", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 602, "agent-b", "Agent B");
    await DbFactory.seedAgent(env.DB, 603, "agent-c", "Agent C");
    await DbFactory.seedTrackingId(env.DB, 703, 602, "tag-b-1");
    await DbFactory.seedTrackingId(env.DB, 704, 603, "tag-c-1");
    await DbFactory.seedProduct(env.DB, 803, "ASIN003");

    await seedConversion(env.DB, {
      marketplace: "US",
      trackingTag: "tag-b-1",
      asin: "ASIN003",
      orderedItems: 5,
    });
    await seedConversion(env.DB, {
      marketplace: "US",
      trackingTag: "tag-c-1",
      asin: "ASIN003",
      orderedItems: 99,
    });

    const token = await generateAdminToken();
    const res = await apiApp.fetch(
      new Request("http://localhost/api/agents/602/ordered-items", {
        headers: { Authorization: `Bearer ${token}`, Origin: "http://localhost" },
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    const data = (await res.json()) as { summary: { totalOrdered: number } };
    expect(data.summary.totalOrdered).toBe(5);
  });

  it("sorts by ordered_items desc by default", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 604, "agent-d", "Agent D");
    await DbFactory.seedTrackingId(env.DB, 705, 604, "tag-d-1");
    await DbFactory.seedProduct(env.DB, 804, "ASINLOW");
    await DbFactory.seedProduct(env.DB, 805, "ASINHIGH");

    await seedConversion(env.DB, {
      marketplace: "US",
      trackingTag: "tag-d-1",
      asin: "ASINLOW",
      orderedItems: 1,
    });
    await seedConversion(env.DB, {
      marketplace: "US",
      trackingTag: "tag-d-1",
      asin: "ASINHIGH",
      orderedItems: 99,
    });

    const token = await generateAdminToken();
    const res = await apiApp.fetch(
      new Request("http://localhost/api/agents/604/ordered-items", {
        headers: { Authorization: `Bearer ${token}`, Origin: "http://localhost" },
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    const data = (await res.json()) as {
      products: Array<{ asin: string | null }>;
    };
    expect(data.products[0]?.asin).toBe("ASINHIGH");
  });

  it("falls back to ordered_items when sortBy is unknown", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 605, "agent-e", "Agent E");
    await DbFactory.seedTrackingId(env.DB, 706, 605, "tag-e-1");
    await DbFactory.seedProduct(env.DB, 806, "ASIN_A");
    await DbFactory.seedProduct(env.DB, 807, "ASIN_B");

    await seedConversion(env.DB, {
      marketplace: "US",
      trackingTag: "tag-e-1",
      asin: "ASIN_A",
      orderedItems: 1,
      revenue: 999,
    });
    await seedConversion(env.DB, {
      marketplace: "US",
      trackingTag: "tag-e-1",
      asin: "ASIN_B",
      orderedItems: 99,
      revenue: 1,
    });

    const token = await generateAdminToken();
    const res = await apiApp.fetch(
      new Request("http://localhost/api/agents/605/ordered-items?sortBy=garbage", {
        headers: { Authorization: `Bearer ${token}`, Origin: "http://localhost" },
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    const data = (await res.json()) as { products: Array<{ asin: string | null }> };
    expect(data.products[0]?.asin).toBe("ASIN_B");
  });

  it("filters by marketplace", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 606, "agent-f", "Agent F");
    await DbFactory.seedTrackingId(env.DB, 707, 606, "tag-f-us");
    await env.DB
      .prepare("INSERT INTO tracking_ids (id, agent_id, tag, marketplace) VALUES (708, 606, 'tag-f-uk', 'UK')")
      .run();
    await DbFactory.seedProduct(env.DB, 808, "ASINUS");
    await DbFactory.seedProduct(env.DB, 809, "ASINUK");

    await seedConversion(env.DB, {
      marketplace: "US",
      trackingTag: "tag-f-us",
      asin: "ASINUS",
      orderedItems: 5,
    });
    await seedConversion(env.DB, {
      marketplace: "UK",
      trackingTag: "tag-f-uk",
      asin: "ASINUK",
      orderedItems: 99,
    });

    const token = await generateAdminToken();
    const res = await apiApp.fetch(
      new Request("http://localhost/api/agents/606/ordered-items?marketplace=US", {
        headers: { Authorization: `Bearer ${token}`, Origin: "http://localhost" },
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    const data = (await res.json()) as {
      summary: { totalOrdered: number };
      products: Array<{ asin: string | null }>;
    };
    expect(data.summary.totalOrdered).toBe(5);
    expect(data.products).toHaveLength(1);
    expect(data.products[0]?.asin).toBe("ASINUS");
  });

  it("computes totalReturned correctly when shipped < ordered", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 607, "agent-g", "Agent G");
    await DbFactory.seedTrackingId(env.DB, 709, 607, "tag-g-1");
    await DbFactory.seedProduct(env.DB, 810, "ASINRET");

    await seedConversion(env.DB, {
      marketplace: "US",
      trackingTag: "tag-g-1",
      asin: "ASINRET",
      orderedItems: 10,
      shippedItems: 7,
    });

    const token = await generateAdminToken();
    const res = await apiApp.fetch(
      new Request("http://localhost/api/agents/607/ordered-items", {
        headers: { Authorization: `Bearer ${token}`, Origin: "http://localhost" },
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    const data = (await res.json()) as {
      summary: { totalReturned: number };
      products: Array<{ totalReturned: number }>;
    };
    expect(data.summary.totalReturned).toBe(3);
    expect(data.products[0]?.totalReturned).toBe(3);
  });

  it("includes rows with NULL asin with productId null", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 608, "agent-h", "Agent H");
    await DbFactory.seedTrackingId(env.DB, 710, 608, "tag-h-1");

    await seedConversion(env.DB, {
      marketplace: "US",
      trackingTag: "tag-h-1",
      asin: null,
      orderedItems: 1,
    });

    const token = await generateAdminToken();
    const res = await apiApp.fetch(
      new Request("http://localhost/api/agents/608/ordered-items", {
        headers: { Authorization: `Bearer ${token}`, Origin: "http://localhost" },
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    const data = (await res.json()) as {
      products: Array<{ productId: number | null; asin: string | null }>;
    };
    expect(data.products).toHaveLength(1);
    expect(data.products[0]?.productId).toBeNull();
    expect(data.products[0]?.asin).toBeNull();
  });

  it("paginates correctly", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 609, "agent-i", "Agent I");
    await DbFactory.seedTrackingId(env.DB, 711, 609, "tag-i-1");
    for (let i = 0; i < 7; i += 1) {
      await DbFactory.seedProduct(env.DB, 900 + i, `ASIN${i.toString().padStart(3, "0")}`);
      await seedConversion(env.DB, {
        marketplace: "US",
        trackingTag: "tag-i-1",
        asin: `ASIN${i.toString().padStart(3, "0")}`,
        orderedItems: i + 1,
      });
    }

    const token = await generateAdminToken();
    const res = await apiApp.fetch(
      new Request("http://localhost/api/agents/609/ordered-items?pageSize=3&page=2", {
        headers: { Authorization: `Bearer ${token}`, Origin: "http://localhost" },
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    const data = (await res.json()) as {
      products: unknown[];
      pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
    };
    expect(data.pagination).toEqual({ page: 2, pageSize: 3, totalItems: 7, totalPages: 3 });
    expect(data.products).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -s vitest run test/api/agent-ordered-items.test.ts 2>&1 | tail -25`
Expected: FAIL — endpoint does not exist (404 from Hono not found, or 500 if a more general handler swallows the path).

- [ ] **Step 3: Commit the failing test**

```bash
git add test/api/agent-ordered-items.test.ts
git commit -m "test(api): add ordered-items handler tests (red)"
```

---

## Task 6: Wire the handler into the existing agents route

**Files:**
- Modify: `/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate/server/routes/agents.ts:25-30` (imports area)

- [ ] **Step 1: Add the new imports**

Locate the import block at the top of `server/routes/agents.ts`. Add the following import alongside the other schema imports (find the line that imports from `../schemas` and add the new symbol):

```ts
import { orderedItemsQuerySchema, type OrderedItemsMarketplace, type OrderedItemsSortBy, type OrderedItemsSortDir } from "../schemas";
import {
  fetchAgentOrderedItems,
  type AgentOrderedItemsResult,
} from "../services/agent-ordered-items";
```

If the existing import line uses a single destructure, extend it instead. For example, if the file currently has:

```ts
import { someExistingSchema } from "../schemas";
```

change it to:

```ts
import { someExistingSchema, orderedItemsQuerySchema, type OrderedItemsMarketplace, type OrderedItemsSortBy, type OrderedItemsSortDir } from "../schemas";
```

- [ ] **Step 2: Add the handler at the end of the file**

Append the following block at the end of `server/routes/agents.ts` (after the last existing handler). The position is important: this must come **after** the `agents.get('/:id', ...)` handler to avoid being shadowed.

```ts
/**
 * GET /api/agents/:id/ordered-items — Per-agent product-level rollup of amazon_conversions.
 */
agents.get('/:id/ordered-items', zValidator('query', orderedItemsQuerySchema), async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (Number.isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid agent ID' });
  }

  const agent = await c.env.DB
    .prepare('SELECT id, name, slug, is_active FROM agents WHERE id = ?')
    .bind(id)
    .first<{ id: number; name: string; slug: string; is_active: number }>();

  if (!agent || agent.is_active !== 1) {
    throw new HTTPException(404, { message: 'Agent not found' });
  }

  const params = c.req.valid('query');

  const data: AgentOrderedItemsResult = await fetchAgentOrderedItems(
    c.env.DB,
    id,
    {
      sortBy: params.sortBy,
      sortDir: params.sortDir,
      page: params.page,
      pageSize: params.pageSize,
      marketplace: params.marketplace,
    }
  );

  return c.json({
    agent: { id: agent.id, name: agent.name, slug: agent.slug },
    summary: data.summary,
    products: data.products,
    pagination: data.pagination,
    sort: { sortBy: params.sortBy, sortDir: params.sortDir },
    marketplace: params.marketplace,
  });
});
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.node.json 2>&1 | head -20`
Expected: no errors.

- [ ] **Step 4: Run the handler tests to verify they pass**

Run: `pnpm -s vitest run test/api/agent-ordered-items.test.ts 2>&1 | tail -30`
Expected: PASS — all 11 cases green.

- [ ] **Step 5: Run the schema tests to ensure no regression**

Run: `pnpm -s vitest run test/api/schema-ordered-items.test.ts 2>&1 | tail -10`
Expected: PASS.

- [ ] **Step 6: Run the broader agents test suite to ensure no regression**

Run: `pnpm -s vitest run test/api/agents-admin.test.ts 2>&1 | tail -10`
Expected: PASS — existing tests still green.

- [ ] **Step 7: Commit**

```bash
git add server/routes/agents.ts
git commit -m "feat(api): add GET /api/agents/:id/ordered-items handler"
```

---

## Task 7: Register the new admin page route

**Files:**
- Modify: `/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate/app/routes.ts:30-45`

- [ ] **Step 1: Add the route**

In `app/routes.ts`, inside the `route("admin", "routes/admin/layout.tsx", [ ... ])` array, add the new entry. Place it right after the existing `route("agents", "routes/admin/agents.tsx", ...)` line for readability:

```ts
    route("agents/:id/ordered-items", "routes/admin/agent-ordered-items.tsx"),
```

The result should look like:

```ts
  route("admin", "routes/admin/layout.tsx", [
    index("routes/admin/dashboard.tsx"),
    route("users", "routes/admin/users.tsx"),
    route("agents", "routes/admin/agents.tsx"),
    route("agents/:id/ordered-items", "routes/admin/agent-ordered-items.tsx"),
    route("products", "routes/admin/products.tsx"),
    // ... rest unchanged
  ]),
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.cloudflare.json 2>&1 | head -20`
Expected: no errors. (The new file does not exist yet — only a typecheck; missing module would surface in the next task when the file is created.)

- [ ] **Step 3: Commit**

```bash
git add app/routes.ts
git commit -m "feat(routes): register /admin/agents/:id/ordered-items"
```

---

## Task 8: Create the admin page

**Files:**
- Create: `/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate/app/routes/admin/agent-ordered-items.tsx`

- [ ] **Step 1: Create the page file with full implementation**

Write the following to `app/routes/admin/agent-ordered-items.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { extractApiErrorMessage } from "../../utils/api-errors";
import { getAuthToken } from "../../utils/auth-session";

interface AgentInfo {
  id: number;
  name: string;
  slug: string;
}

interface MarketplaceBreakdownRow {
  marketplace: string;
  orderedItems: number;
  revenue: number;
  commission: number;
}

interface Summary {
  totalOrdered: number;
  totalShipped: number;
  totalRevenue: number;
  totalCommission: number;
  totalReturned: number;
  marketplaceBreakdown: MarketplaceBreakdownRow[];
}

interface ProductRow {
  productId: number | null;
  asin: string | null;
  title: string | null;
  imageUrl: string | null;
  totalOrderedItems: number;
  totalShippedItems: number;
  totalRevenue: number;
  totalCommission: number;
  totalReturned: number;
  firstOrderedAt: string | null;
  lastOrderedAt: string | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

interface ResponsePayload {
  agent: AgentInfo;
  summary: Summary;
  products: ProductRow[];
  pagination: Pagination;
  sort: { sortBy: string; sortDir: string };
  marketplace: string;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; data: ResponsePayload }
  | { kind: "not-found"; message: string }
  | { kind: "error"; message: string };

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ordered_items", label: "Most Ordered" },
  { value: "revenue", label: "Highest Revenue" },
  { value: "commission", label: "Highest Commission" },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export default function AgentOrderedItemsPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const sortBy = searchParams.get("sortBy") ?? "ordered_items";
  const sortDir = (searchParams.get("sortDir") ?? "desc") as "asc" | "desc";
  const page = Number(searchParams.get("page") ?? "1");
  const marketplace = searchParams.get("marketplace") ?? "all";

  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    if (!id) {
      setState({ kind: "error", message: "Missing agent id" });
      return;
    }

    const controller = new AbortController();
    setState({ kind: "loading" });

    const url = new URL(`/api/agents/${id}/ordered-items`, window.location.origin);
    url.searchParams.set("sortBy", sortBy);
    url.searchParams.set("sortDir", sortDir);
    url.searchParams.set("page", String(page));
    url.searchParams.set("marketplace", marketplace);

    void (async () => {
      try {
        const response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
          signal: controller.signal,
        });
        if (response.status === 404) {
          setState({ kind: "not-found", message: "Agent not found" });
          return;
        }
        const payload = (await response.json()) as unknown;
        if (!response.ok) {
          throw new Error(
            extractApiErrorMessage(payload, "Failed to load ordered items")
          );
        }
        setState({ kind: "ready", data: payload as ResponsePayload });
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "Failed to load ordered items",
        });
      }
    })();

    return () => controller.abort();
  }, [id, sortBy, sortDir, page, marketplace]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    if (key !== "page") next.set("page", "1");
    setSearchParams(next);
  };

  const toggleDir = () => {
    setParam("sortDir", sortDir === "desc" ? "asc" : "desc");
  };

  const goToPage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
  };

  const data = state.kind === "ready" ? state.data : null;
  const marketplaces = useMemo(() => {
    if (!data) return [] as string[];
    return data.summary.marketplaceBreakdown.map((r) => r.marketplace);
  }, [data]);

  if (state.kind === "not-found") {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center">
          <h1 className="m-0 text-xl font-bold text-[#f0f0f5]">Agent not found</h1>
          <p className="mt-3 text-sm text-red-200">{state.message}</p>
          <Link
            to="/admin/agents"
            className="mt-4 inline-block rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#f0f0f5] hover:bg-white/10"
          >
            Back to Agents
          </Link>
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
          <h1 className="m-0 text-xl font-bold text-[#f0f0f5]">Failed to load</h1>
          <p className="mt-3 text-sm text-red-200">{state.message}</p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setSearchParams(searchParams)}
              className="rounded-lg border-none bg-red-400/20 px-4 py-2 font-semibold text-red-50 hover:bg-red-400/30"
            >
              Retry
            </button>
            <button
              onClick={() => navigate("/admin/agents")}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-semibold text-[#f0f0f5] hover:bg-white/10"
            >
              Back to Agents
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === "loading" || !data) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-6 w-48 animate-pulse rounded bg-white/5" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-white/5 bg-white/5" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  const showEmptyState = data.products.length === 0 && data.summary.totalOrdered === 0;
  const showNoPageResults = data.products.length === 0 && data.summary.totalOrdered > 0;

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link
          to="/admin/agents"
          className="text-sm text-[#a0a0b8] hover:text-white"
        >
          ← Back to Agents
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[#f0f0f5]">
          {data.agent.name} — Ordered Items
        </h1>
        <p className="mt-1 text-sm text-[#a0a0b8]">
          Agent slug: <span className="font-mono">{data.agent.slug}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryTile label="Total Ordered" value={formatNumber(data.summary.totalOrdered)} />
        <SummaryTile label="Total Shipped" value={formatNumber(data.summary.totalShipped)} />
        <SummaryTile label="Total Revenue" value={formatCurrency(data.summary.totalRevenue)} />
        <SummaryTile label="Total Commission" value={formatCurrency(data.summary.totalCommission)} />
        <SummaryTile
          label="Total Returned"
          value={formatNumber(data.summary.totalReturned)}
          tone={data.summary.totalReturned > 0 ? "danger" : "default"}
        />
      </div>

      {!showEmptyState && (
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col text-sm text-[#a0a0b8]">
            <span className="mb-1">Marketplace</span>
            <select
              value={marketplace}
              onChange={(e) => setParam("marketplace", e.target.value)}
              className="rounded-lg border border-white/10 bg-[#12121a] px-3 py-2 text-sm text-[#f0f0f5]"
            >
              <option value="all">All marketplaces</option>
              {marketplaces.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm text-[#a0a0b8]">
            <span className="mb-1">Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => setParam("sortBy", e.target.value)}
              className="rounded-lg border border-white/10 bg-[#12121a] px-3 py-2 text-sm text-[#f0f0f5]"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={toggleDir}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-[#f0f0f5] hover:bg-white/10"
            aria-label={`Sort direction: ${sortDir === "desc" ? "descending" : "ascending"}`}
          >
            {sortDir === "desc" ? "↓ Desc" : "↑ Asc"}
          </button>
        </div>
      )}

      {showEmptyState && (
        <div className="rounded-2xl border border-white/5 bg-white/5 p-8 text-center">
          <h2 className="m-0 text-lg font-bold text-[#f0f0f5]">No order data yet</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-[#a0a0b8]">
            Import an Amazon Associates earnings CSV report to populate this view.
            Reports are imported from /admin/analytics → Import Report.
          </p>
          <Link
            to="/admin/analytics"
            className="mt-5 inline-block rounded-lg bg-[#ff9900] px-4 py-2 text-sm font-semibold text-black hover:bg-[#ffad33]"
          >
            Go to Import Report
          </Link>
        </div>
      )}

      {showNoPageResults && (
        <div className="rounded-2xl border border-white/5 bg-white/5 p-6 text-center">
          <p className="m-0 text-sm text-[#a0a0b8]">No products on this page.</p>
          <button
            onClick={() => goToPage(1)}
            className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#f0f0f5] hover:bg-white/10"
          >
            Back to page 1
          </button>
        </div>
      )}

      {!showEmptyState && data.products.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-white/5 bg-white/5">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-[#a0a0b8]">
              <tr>
                <th className="px-4 py-3">Product</th>
                <SortHeader column="ordered_items" label="Ordered" active={sortBy === "ordered_items"} dir={sortDir} onClick={() => setParam("sortBy", "ordered_items")} />
                <th className="px-4 py-3">Shipped</th>
                <th className="px-4 py-3">Returned</th>
                <SortHeader column="revenue" label="Revenue" active={sortBy === "revenue"} dir={sortDir} onClick={() => setParam("sortBy", "revenue")} />
                <SortHeader column="commission" label="Commission" active={sortBy === "commission"} dir={sortDir} onClick={() => setParam("sortBy", "commission")} />
                <th className="px-4 py-3">First seen</th>
                <th className="px-4 py-3">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((row) => {
                const rowKey = `${row.asin ?? "noasin"}-${row.productId ?? "noid"}`;
                return (
                  <tr key={rowKey} className="border-t border-white/5">
                    <td className="px-4 py-3">
                      {row.productId !== null ? (
                        <Link
                          to={`/admin/products/${row.productId}`}
                          className="flex items-center gap-3 text-[#f0f0f5] hover:text-[#ffad33]"
                        >
                          {row.imageUrl ? (
                            <img
                              src={row.imageUrl}
                              alt=""
                              className="h-10 w-10 rounded object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded bg-white/10" />
                          )}
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {row.title ?? row.asin ?? "Unknown"}
                            </div>
                            {row.asin && (
                              <div className="text-xs text-[#a0a0b8]">{row.asin}</div>
                            )}
                          </div>
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded bg-white/10" />
                          <div>
                            <div className="text-[#a0a0b8]">Unknown</div>
                            <span className="mt-1 inline-block rounded bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#a0a0b8]">
                              Not in catalog
                            </span>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono">{formatNumber(row.totalOrderedItems)}</td>
                    <td className="px-4 py-3 font-mono">{formatNumber(row.totalShippedItems)}</td>
                    <td className="px-4 py-3 font-mono">
                      {row.totalReturned > 0 ? (
                        <span className="rounded bg-red-500/15 px-2 py-0.5 text-red-300">
                          {formatNumber(row.totalReturned)}
                        </span>
                      ) : (
                        formatNumber(row.totalReturned)
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono">{formatCurrency(row.totalRevenue)}</td>
                    <td className="px-4 py-3 font-mono">{formatCurrency(row.totalCommission)}</td>
                    <td className="px-4 py-3 text-[#a0a0b8]">{row.firstOrderedAt ?? "—"}</td>
                    <td className="px-4 py-3 text-[#a0a0b8]">{row.lastOrderedAt ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!showEmptyState && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-[#a0a0b8]">
          <span>
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={data.pagination.page <= 1}
              onClick={() => goToPage(data.pagination.page - 1)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-semibold text-[#f0f0f5] hover:bg-white/10 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={data.pagination.page >= data.pagination.totalPages}
              onClick={() => goToPage(data.pagination.page + 1)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-semibold text-[#f0f0f5] hover:bg-white/10 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  const valueClass =
    tone === "danger" ? "text-red-300" : "text-[#f0f0f5]";
  return (
    <div className="rounded-xl border border-white/5 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wide text-[#a0a0b8]">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${valueClass}`}>{value}</div>
    </div>
  );
}

function SortHeader({
  column,
  label,
  active,
  dir,
  onClick,
}: {
  column: string;
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th className="px-4 py-3">
      <button
        onClick={onClick}
        className={`flex items-center gap-1 text-xs uppercase tracking-wide ${
          active ? "text-[#ffad33]" : "text-[#a0a0b8] hover:text-white"
        }`}
        aria-label={`Sort by ${label}`}
      >
        {label}
        {active && <span aria-hidden>{dir === "desc" ? "↓" : "↑"}</span>}
      </button>
    </th>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.cloudflare.json 2>&1 | head -20`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/routes/admin/agent-ordered-items.tsx
git commit -m "feat(admin): per-agent ordered-items page"
```

---

## Task 9: Add "View Top Products" CTA to agents list

**Files:**
- Modify: `/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate/app/routes/admin/agents.tsx:883-908`

- [ ] **Step 1: Locate the action buttons container**

In `app/routes/admin/agents.tsx`, find the `<div className="flex flex-wrap gap-2 shrink-0">` block at line 883 (the row action buttons). Add a new button before the existing "Edit Profile" button. The new button uses React Router's `Link`:

```tsx
                    <Link
                      to={`/admin/agents/${agent.id}/ordered-items`}
                      className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                    >
                      View Top Products
                    </Link>
```

Verify that `Link` is already imported at the top of the file. If not, add `Link` to the `react-router` import.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.cloudflare.json 2>&1 | head -20`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/routes/admin/agents.tsx
git commit -m "feat(admin): add View Top Products CTA on each agent row"
```

---

## Task 10: Add "Ordered Items" sidebar nav entry

**Files:**
- Modify: `/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate/app/routes/admin/layout.tsx:211-227`

- [ ] **Step 1: Add the new entry**

In the `navItems` array for non-editor users (the `user.role === "editor" ? [...] : [...]` block), add a new entry right after the existing "Agents" entry. The new entry points to `/admin/agents` (the same as the Agents entry, since the list page is the entry point):

```tsx
        { to: "/admin/agents", label: "Ordered Items", icon: "📊" },
        { to: "/admin/agents", label: "Agents", icon: "👥" },
```

Wait — that duplicates the path. Instead, replace the existing "Agents" entry with the more descriptive one, and add a "Top Products" entry under it OR simply rename "Agents" to be discoverable for both purposes. Recommended: add the entry as a separate link to the same page so the user can find it from the sidebar without having to navigate into the Agents detail. The result:

```tsx
        { to: "/admin/agents", label: "Agents", icon: "👥" },
        { to: "/admin/agents", label: "Ordered Items", icon: "📊" },
```

Verify both `to` values point to the same URL — this is intentional; clicking either takes the admin to the agents list, where the per-row "View Top Products" buttons are the entry point to the new feature. The two nav entries give a discoverable signal that ordered-items data lives under "Agents".

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.cloudflare.json 2>&1 | head -20`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/routes/admin/layout.tsx
git commit -m "feat(admin): add Ordered Items nav entry to sidebar"
```

---

## Task 11: Add E2E happy-path test

**Files:**
- Create: `/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate/e2e/agent-ordered-items.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "test-password";

test("admin can navigate to per-agent ordered items", async ({ page }) => {
  await page.goto("/admin/login");
  await page.fill('input[name="username"]', ADMIN_EMAIL);
  await page.fill('input[name="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin(\/|$)/);

  await page.goto("/admin/agents");
  await page.waitForLoadState("networkidle");

  // Click the first "View Top Products" CTA, if any agent rows are present.
  const cta = page.getByRole("link", { name: "View Top Products" }).first();
  if ((await cta.count()) > 0) {
    await cta.click();
    await page.waitForURL(/\/admin\/agents\/\d+\/ordered-items$/);

    // The page header must contain "Ordered Items".
    await expect(page.getByRole("heading", { name: /— Ordered Items$/ })).toBeVisible();

    // Tiles must render with their labels.
    await expect(page.getByText("Total Ordered", { exact: true })).toBeVisible();
    await expect(page.getByText("Total Revenue", { exact: true })).toBeVisible();

    // Marketplace filter and sort dropdowns must be present.
    await expect(page.locator("select").first()).toBeVisible();
  } else {
    test.skip(true, "No agents with rows present in this environment");
  }
});

test("ordered items page shows empty state for agent with no conversions", async ({ page }) => {
  await page.goto("/admin/login");
  await page.fill('input[name="username"]', ADMIN_EMAIL);
  await page.fill('input[name="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin(\/|$)/);

  // Try a likely-empty agent id; if the agent does not exist, the 404 path is exercised.
  await page.goto("/admin/agents/99999/ordered-items");
  await page.waitForLoadState("networkidle");

  // Either 404 message or "No order data yet" empty state is acceptable.
  const notFound = page.getByRole("heading", { name: "Agent not found" });
  const empty = page.getByRole("heading", { name: "No order data yet" });
  await expect(notFound.or(empty)).toBeVisible();
});
```

- [ ] **Step 2: Verify the test file typechecks**

Run: `npx tsc --noEmit -p tsconfig.cloudflare.json 2>&1 | head -20`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add e2e/agent-ordered-items.spec.ts
git commit -m "test(e2e): add ordered-items happy-path and empty-state tests"
```

---

## Task 12: Full verification — run all tests and typecheck

- [ ] **Step 1: Run all API tests**

Run: `pnpm -s vitest run test/api 2>&1 | tail -20`
Expected: all green, including the new files in `test/api/agent-ordered-items.test.ts` and `test/api/schema-ordered-items.test.ts`. No regressions in existing tests.

- [ ] **Step 2: Run full typecheck**

Run: `npx tsc --noEmit -p tsconfig.cloudflare.json 2>&1 | head -20 && npx tsc --noEmit -p tsconfig.node.json 2>&1 | head -20`
Expected: no errors from either project.

- [ ] **Step 3: Run lint (if configured)**

Run: `pnpm run lint 2>&1 | tail -20` (or `npm run lint` if `pnpm` is not used). If a lint script is not defined, skip and note it.
Expected: no errors. If lint reports warnings only, that is acceptable.

- [ ] **Step 4: Build (if available)**

Run: `pnpm run build 2>&1 | tail -10`
Expected: build succeeds. Cloudflare Workers / Vite build output ends with no errors.

- [ ] **Step 5: Manual smoke (optional, requires running local D1)**

If a local D1 environment is set up (see `package.json` scripts), apply migrations and seed a couple of conversion rows manually, then visit `/admin/agents/:id/ordered-items` in the browser to confirm the page renders end-to-end. If local D1 is not available, document this as "manual verification deferred to staging".

- [ ] **Step 6: Commit (only if any fixes were needed)**

If Steps 1-5 produced fixes, commit them with a descriptive message. If everything passes, no commit is needed.

---

## Self-Review (writer's checklist)

- [x] **Spec coverage:**
  - Goal 1 (per-agent dashboard for orders) → Tasks 6, 8
  - Goal 2 (reuse existing data) → Task 4 (no migration; uses existing tables and index)
  - Goal 3 (match existing patterns: `adminOnly` middleware, Zod-validated query params) → Tasks 1, 6
  - Goal 4 (one new API endpoint + one new page + small UI tweak) → Tasks 6, 8, 9, 10
  - "No migration" non-goal → confirmed: no `migrations/*.sql` file is created in any task
  - "No cache" non-goal → confirmed: handler returns fresh SQL; UI does not cache
  - "Admin only" non-goal → confirmed: `adminOnly` middleware path; editor test in Task 5
  - "All-time cumulative" non-goal → confirmed: no `date_filter` param in schema; SQL has no date clause
  - "No export" non-goal → confirmed: no export button in UI
  - "No cross-agent" non-goal → confirmed: route requires `:id`; per-agent summary in DB query
  - "No public visibility" non-goal → confirmed: route is under `/admin/`; middleware is adminOnly
  - "Click → product detail" → Task 8 row link
  - "Sidebar entry" → Task 10
  - "Empty state" → Task 8 showEmptyState branch
  - "4-5 summary tiles" → Task 8 (5 tiles)
  - "Marketplace filter" → Task 1 schema, Task 8 dropdown
  - "Sort toggle" → Task 1 schema, Task 8 dropdown
  - "Sort direction toggle" → Task 8 button
  - "No drill-down modal" → confirmed: no modal in Task 8
  - "Per-product row navigation" → Task 8 Link to `/admin/products/:productId`
- [x] **Placeholder scan:** No "TBD", "TODO", "implement later", "fill in details", "add appropriate error handling", "similar to Task N". All code blocks contain complete code. All test code shows real assertions.
- [x] **Type consistency:** `AgentOrderedItemsQuery` (Task 4) is used in Task 6 with the exact field names. The handler in Task 6 reads `params.sortBy`, `params.sortDir`, `params.page`, `params.pageSize`, `params.marketplace` — matching the schema in Task 1. The response shape in Task 6 (`agent`, `summary`, `products`, `pagination`, `sort`, `marketplace`) matches the `ResponsePayload` interface in Task 8. Sort column keys `ordered_items`, `revenue`, `commission` are consistent across Tasks 1, 4, 6, 8.
- [x] **Routes:** Task 7 registers the new admin page as a flat child of `route("admin", ...)`. No conflict with existing `/admin/agents` route because the path is `/admin/agents/:id/ordered-items`, which is more specific. The handler in Task 6 is placed after the generic `agents.get('/:id', ...)` handler in `agents.ts` to avoid parameter shadowing (since Hono's routing matches the first registered route — verified by reading existing handler order in the file).
