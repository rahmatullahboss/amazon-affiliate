# Country And Category Template Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic country-aware and category-aware editorial template engine for product `review_content`, plus an admin-only regenerate action that reuses saved product data without new Amazon API calls.

**Architecture:** Extract content generation into a focused template module with category normalization, marketplace tone rules, variant selection, and final review assembly. Integrate it into product ingestion for new products and expose a protected regeneration endpoint plus admin UI action for existing products.

**Tech Stack:** TypeScript, Hono, React, D1, Vitest

---

### Task 1: Extract the template engine into a dedicated service

**Files:**
- Create: `server/services/product-editorial.ts`
- Modify: `server/services/product-ingestion.ts`
- Test: `test/services/product-editorial.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  buildProductEditorialReview,
  normalizeEditorialCategory,
} from "../../server/services/product-editorial";

describe("product editorial templates", () => {
  it("maps noisy category labels into stable editorial groups", () => {
    expect(normalizeEditorialCategory("Vacuum Cleaners")).toBe("cleaning");
    expect(normalizeEditorialCategory("Kitchen & Dining")).toBe("kitchen");
    expect(normalizeEditorialCategory("Unknown Vertical")).toBe("generic");
  });

  it("produces different deterministic review content across marketplaces", () => {
    const usReview = buildProductEditorialReview({
      asin: "B0TEMPLATE1",
      marketplace: "US",
      title: "Cordless Vacuum",
      category: "Vacuum Cleaners",
      description: "A lightweight cordless vacuum for daily floor cleanup.",
      features: ["Up to 40 minutes runtime", "LED floor head", "Easy bin emptying"],
      variantOffset: 0,
    });

    const deReview = buildProductEditorialReview({
      asin: "B0TEMPLATE1",
      marketplace: "DE",
      title: "Cordless Vacuum",
      category: "Vacuum Cleaners",
      description: "A lightweight cordless vacuum for daily floor cleanup.",
      features: ["Up to 40 minutes runtime", "LED floor head", "Easy bin emptying"],
      variantOffset: 0,
    });

    expect(usReview).not.toBeNull();
    expect(deReview).not.toBeNull();
    expect(usReview).not.toBe(deReview);
  });

  it("changes content when the variant offset changes", () => {
    const first = buildProductEditorialReview({
      asin: "B0TEMPLATE2",
      marketplace: "IT",
      title: "Espresso Machine",
      category: "Coffee Machines",
      description: "Compact espresso machine for small kitchens.",
      features: ["Milk frother", "Slim footprint", "Simple controls"],
      variantOffset: 0,
    });

    const second = buildProductEditorialReview({
      asin: "B0TEMPLATE2",
      marketplace: "IT",
      title: "Espresso Machine",
      category: "Coffee Machines",
      description: "Compact espresso machine for small kitchens.",
      features: ["Milk frother", "Slim footprint", "Simple controls"],
      variantOffset: 1,
    });

    expect(first).not.toBe(second);
  });

  it("falls back gracefully when description and features are sparse", () => {
    const review = buildProductEditorialReview({
      asin: "B0TEMPLATE3",
      marketplace: "UK",
      title: "Desk Lamp",
      category: null,
      description: null,
      features: [],
      variantOffset: 0,
    });

    expect(review).toContain("Desk Lamp");
    expect(review).toContain("Amazon");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -s vitest run test/services/product-editorial.test.ts`
Expected: FAIL because `server/services/product-editorial.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export type EditorialCategory =
  | "home"
  | "kitchen"
  | "cleaning"
  | "beauty"
  | "fashion"
  | "electronics"
  | "outdoor"
  | "fitness"
  | "baby"
  | "pet"
  | "generic";

interface EditorialInput {
  asin: string;
  marketplace: string;
  title: string;
  category: string | null;
  description: string | null;
  features: string[];
  variantOffset?: number;
}

export function normalizeEditorialCategory(value: string | null | undefined): EditorialCategory {
  // keyword-based mapping with generic fallback
}

export function buildProductEditorialReview(input: EditorialInput): string | null {
  // normalize category
  // sanitize description and features
  // choose a marketplace/category variant deterministically
  // assemble intro + fit/use-case + feature bullets + closing note
}
```

- [ ] **Step 4: Integrate the new builder into product ingestion**

```ts
const reviewContent = buildProductEditorialReview({
  asin,
  marketplace,
  title,
  category,
  description,
  features: resolvedFeatures,
  variantOffset: 0,
});
```

Replace all current `buildEditorialReviewContent()` calls in `server/services/product-ingestion.ts` with the new shared builder, keeping existing update behavior intact.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm -s vitest run test/services/product-editorial.test.ts`
Expected: PASS

### Task 2: Add an admin-only regeneration endpoint with no API fetch

**Files:**
- Modify: `server/routes/products.ts`
- Modify: `server/services/product-ingestion.ts`
- Test: `test/api/products-regenerate.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { apiApp } from "../../server/api";
import { DbFactory } from "../factories/db";
import { generateAdminToken } from "../helpers/auth";

describe("products regenerate content API", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM admin_users").run();
  });

  it("regenerates review content without calling the Amazon API", async () => {
    await DbFactory.seedAdmin(env.DB);
    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, category, description, features, review_content, status, is_active)
       VALUES (9001, 'B0REGEN123', 'Cordless Vacuum', 'http://img.com/vac.jpg', 'DE', 'Vacuum Cleaners', 'Daily cleaning helper.', '["Quiet motor","Lightweight body","Wall mount"]', 'old copy', 'active', 1)`
    ).run();

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await apiApp.fetch(
      new Request("http://localhost/api/products/9001/regenerate-content", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
      env as any,
      { waitUntil: () => undefined } as any
    );

    const payload = await response.json() as { product: { review_content: string } };
    expect(response.status).toBe(200);
    expect(payload.product.review_content).not.toBe("old copy");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -s vitest run test/api/products-regenerate.test.ts`
Expected: FAIL because the route does not exist yet.

- [ ] **Step 3: Add a helper that regenerates from saved product data**

```ts
export async function regenerateProductEditorialContent(input: {
  db: D1Database;
  productId: number;
}): Promise<ProductRecord> {
  // load current product
  // parse features JSON
  // derive next variant offset from current content or stored seed rule
  // update review_content and updated_at
  // return refreshed product row
}
```

- [ ] **Step 4: Add the protected admin route**

```ts
products.post("/:id/regenerate-content", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  const product = await regenerateProductEditorialContent({
    db: c.env.DB,
    productId: id,
  });

  return c.json({
    product,
    message: "Product content regenerated successfully",
  });
});
```

Also add audit logging and cache invalidation using the existing product update patterns.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm -s vitest run test/api/products-regenerate.test.ts`
Expected: PASS

### Task 3: Add admin UI support for single-product regeneration

**Files:**
- Modify: `app/routes/admin/products.tsx`
- Test: `test/api/products-regenerate.test.ts`

- [ ] **Step 1: Add the UI state and action**

```tsx
const [regeneratingProductId, setRegeneratingProductId] = useState<number | null>(null);

async function handleRegenerateContent(productId: number) {
  setRegeneratingProductId(productId);
  setError("");

  try {
    const response = await fetch(`/api/products/${productId}/regenerate-content`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    const payload = await response.json() as { message?: string };
    if (!response.ok) {
      throw new Error(payload.message || "Failed to regenerate content");
    }

    setSheetMessage(payload.message || "Product content regenerated.");
    await fetchProducts(productPagination.page);
  } catch (requestError) {
    setError(requestError instanceof Error ? requestError.message : "Failed to regenerate content");
  } finally {
    setRegeneratingProductId(null);
  }
}
```

- [ ] **Step 2: Add the per-product button**

```tsx
<button
  type="button"
  onClick={() => void handleRegenerateContent(product.id)}
  disabled={regeneratingProductId === product.id}
>
  {regeneratingProductId === product.id ? "Regenerating..." : "Regenerate Content"}
</button>
```

Use the same visual patterns as existing refresh/delete buttons and keep the button admin-only on this page.

- [ ] **Step 3: Run tests and local type checks**

Run: `pnpm -s vitest run test/api/products-regenerate.test.ts`
Expected: PASS

Run: `pnpm -s tsc -p tsconfig.json --noEmit`
Expected: PASS

### Task 4: Verify end-to-end editorial generation behavior

**Files:**
- Test: `test/services/product-editorial.test.ts`
- Test: `test/api/products-regenerate.test.ts`
- Modify: `server/services/product-editorial.ts`
- Modify: `server/services/product-ingestion.ts`

- [ ] **Step 1: Add the final regression cases**

```ts
it("keeps generated output stable for the same product seed", () => {
  const first = buildProductEditorialReview(input);
  const second = buildProductEditorialReview(input);
  expect(first).toBe(second);
});

it("creates review content during ensureProductRecord for newly imported products", async () => {
  const product = await ensureProductRecord({
    db: env.DB,
    asin: "B0AUTO1234",
    marketplace: "US",
    title: "Air Fryer",
    imageUrl: "http://img.com/airfryer.jpg",
    category: "Kitchen Appliances",
    description: "Compact air fryer for weeknight meals.",
    features: ["Digital controls", "Basket design", "Fast preheat"],
    updateExistingFromInput: true,
  });

  expect(product.review_content).toContain("Air Fryer");
});
```

- [ ] **Step 2: Run the focused suite**

Run: `pnpm -s vitest run test/services/product-editorial.test.ts test/api/products-regenerate.test.ts`
Expected: PASS

- [ ] **Step 3: Run final verification**

Run: `pnpm -s vitest run test/services/product-editorial.test.ts test/api/products-regenerate.test.ts test/api/redirect.test.ts test/api/portal-tracking.test.ts`
Expected: PASS

Run: `pnpm -s tsc -p tsconfig.json --noEmit`
Expected: PASS

Run: `pnpm -s build`
Expected: PASS

## Self-Review

- Spec coverage: the plan covers the shared template engine, country/category variation, deterministic selection, new import integration, admin-only regeneration, and verification.
- Placeholder scan: no `TBD`, `TODO`, or vague “handle later” steps remain.
- Type consistency: shared builder naming uses `buildProductEditorialReview()` throughout, and regeneration uses `regenerateProductEditorialContent()` consistently.
