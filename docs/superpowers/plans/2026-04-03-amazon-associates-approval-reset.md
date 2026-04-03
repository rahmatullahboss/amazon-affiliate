# Amazon Associates Approval Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the visible compliance and positioning changes that make DealsRky easier for Amazon reviewers to validate and make the public site read like an editorial recommendation brand instead of a thin deals directory.

**Architecture:** Keep the existing routing and redirect architecture intact, but introduce a small shared affiliate-copy helper so product and bridge pages use the same CTA, disclosure, and destination wording. Limit backend work in this phase to reviewer-access fixes in the redirect and bot-guard path, then update public-page copy and add a lightweight Terms page plus a content-governance checklist.

**Tech Stack:** React Router 7, React 19, TypeScript, Hono, Vitest, Cloudflare Workers/D1/KV

---

## File Map

### Existing files to modify

- `server/middleware/bot-guard.ts`
  - Reviewer-access logic for redirect requests
- `server/routes/redirect.ts`
  - Redirect-path metadata validation and public redirect behavior
- `app/utils/product-detail.ts`
  - Public product-page CTA/callout helpers
- `app/routes/product-detail.tsx`
  - Product CTA text, inline disclosure, outbound rel attributes
- `app/routes/bridge.tsx`
  - Bridge CTA text, inline disclosure, outbound rel attributes, destination clarity
- `app/routes/home.tsx`
  - Homepage positioning and marketplace messaging
- `app/routes/deals.tsx`
  - Deals index framing and editorial copy
- `app/components/Footer.tsx`
  - Terms link in the public footer
- `app/routes.ts`
  - Public Terms route registration

### New files to create

- `app/utils/affiliate-copy.ts`
  - Shared CTA/disclosure/destination strings for product and bridge pages
- `app/routes/terms.tsx`
  - Public Terms page
- `test/unit/affiliate-copy.test.ts`
  - Tests for CTA/disclosure/destination strings
- `test/unit/reviewer-access.test.ts`
  - Tests for reviewer-access user-agent handling
- `docs/amazon-associates-content-checklist.md`
  - Manual publishing and product-review checklist for approval prep

### Existing tests to modify

- `test/api/redirect.test.ts`
  - Redirect access and tagged-link behavior checks
- `test/unit/product-detail.test.ts`
  - Product-detail helper assertions that will change with the new CTA/callout behavior

---

### Task 1: Allow Amazon Review Validation Through Redirect Paths

**Files:**
- Modify: `server/middleware/bot-guard.ts`
- Modify: `server/routes/redirect.ts`
- Modify: `test/api/redirect.test.ts`
- Create: `test/unit/reviewer-access.test.ts`

- [ ] **Step 1: Write the failing reviewer-access tests**

```ts
import { describe, expect, it } from "vitest";
import { isSuspiciousRequest } from "../../server/middleware/bot-guard";

describe("reviewer access handling", () => {
  it("allows Amazon review traffic even when the user-agent contains bot markers", () => {
    expect(
      isSuspiciousRequest(
        "Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)"
      )
    ).toBe(false);
  });

  it("still blocks obvious scripted clients such as curl", () => {
    expect(isSuspiciousRequest("curl/8.7.1")).toBe(true);
  });
});
```

```ts
it("P0-approval-001: allows public redirect validation for Amazon review traffic", async () => {
  await DbFactory.seedAgent(env.DB, 1, "admin-agent", "Admin");
  await env.DB.prepare(
    `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
     VALUES (91, 'B0REVIEW123', 'Review Product', 'https://m.media-amazon.com/images/I/test.jpg', 'US', 'active', 1)`
  ).run();
  await env.DB.prepare(
    `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_site_primary, is_active)
     VALUES (92, 1, 'review-tag-20', 'US', 1, 1, 1)`
  ).run();

  const waitPromises: Promise<unknown>[] = [];
  const res = await apiApp.fetch(
    new Request("http://localhost/go/p/us/B0REVIEW123", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)",
      },
    }),
    env as any,
    {
      waitUntil: (promise: Promise<unknown>) => waitPromises.push(promise),
      passThroughOnException: () => {},
    } as any
  );

  await Promise.all(waitPromises);

  expect(res.status).toBe(302);
  expect(res.headers.get("Location")).toContain("tag=review-tag-20");
});
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run:

```bash
npm test -- test/unit/reviewer-access.test.ts test/api/redirect.test.ts
```

Expected:

- `Cannot find module '../../test/unit/reviewer-access.test.ts'` or missing test file failure
- redirect test fails with `403` before the bot-guard change

- [ ] **Step 3: Implement the reviewer-access allowlist**

Update `server/middleware/bot-guard.ts` to split user-agent handling into a small allowlist-first flow:

```ts
const REVIEWER_ALLOWLIST = [
  /Amazonbot/i,
];

export function isReviewerUserAgent(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  return REVIEWER_ALLOWLIST.some((pattern) => pattern.test(userAgent));
}

export function isSuspiciousRequest(userAgent: string | undefined): boolean {
  if (isReviewerUserAgent(userAgent)) {
    return false;
  }

  if (!userAgent) return true;
  if (userAgent.length < 15) return true;

  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}
```

Keep the rest of the bot patterns intact.

- [ ] **Step 4: Keep redirect validation code aligned with the new helper**

In `server/routes/redirect.ts`, keep using `isSuspiciousRequest(userAgent)` through `getRedirectRequestMetadata()`, but do not add extra Amazonbot-specific branching there. The file should rely on the updated helper only.

The final shape around the existing metadata guard should remain:

```ts
async function getRedirectRequestMetadata(c: Context<AppEnv>): Promise<RedirectRequestMetadata> {
  const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "";
  const userAgent = c.req.header("user-agent") || "";

  if (isSuspiciousRequest(userAgent)) {
    throw new HTTPException(403, { message: "Access denied" });
  }

  return { ip, userAgent };
}
```

- [ ] **Step 5: Run the tests to verify reviewer access works**

Run:

```bash
npm test -- test/unit/reviewer-access.test.ts test/api/redirect.test.ts
```

Expected:

- reviewer-access unit test passes
- redirect API test passes with `302`

- [ ] **Step 6: Commit**

```bash
git add server/middleware/bot-guard.ts server/routes/redirect.ts test/unit/reviewer-access.test.ts test/api/redirect.test.ts
git commit -m "fix: allow Amazon review validation on redirects"
```

---

### Task 2: Unify CTA Copy, Disclosure, and Amazon Destination Messaging

**Files:**
- Create: `app/utils/affiliate-copy.ts`
- Modify: `app/utils/product-detail.ts`
- Modify: `app/routes/product-detail.tsx`
- Modify: `app/routes/bridge.tsx`
- Create: `test/unit/affiliate-copy.test.ts`
- Modify: `test/unit/product-detail.test.ts`

- [ ] **Step 1: Write the failing copy-helper tests**

```ts
import { describe, expect, it } from "vitest";
import {
  AMAZON_DESTINATION_NOTE,
  AMAZON_PRIMARY_CTA_LABEL,
  INLINE_AFFILIATE_DISCLOSURE,
} from "../../app/utils/affiliate-copy";

describe("affiliate copy", () => {
  it("uses an explicit Amazon CTA label", () => {
    expect(AMAZON_PRIMARY_CTA_LABEL).toBe("View on Amazon");
  });

  it("keeps the inline disclosure short and specific", () => {
    expect(INLINE_AFFILIATE_DISCLOSURE).toContain("Amazon Associate");
    expect(INLINE_AFFILIATE_DISCLOSURE).toContain("qualifying purchases");
  });

  it("explains that the user is leaving DealsRky for Amazon", () => {
    expect(AMAZON_DESTINATION_NOTE).toContain("Amazon");
    expect(AMAZON_DESTINATION_NOTE).toContain("leave DealsRky");
  });
});
```

Update `test/unit/product-detail.test.ts` so the public callout assertions match the new intent:

```ts
it("returns a country-specific guidance callout for generic public product pages", () => {
  const callout = getPublicProductPageCallout();

  expect(callout.eyebrow).toBe("Amazon destination");
  expect(callout.title).toContain("Amazon");
  expect(callout.body).toContain("leave DealsRky");
});
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run:

```bash
npm test -- test/unit/affiliate-copy.test.ts test/unit/product-detail.test.ts
```

Expected:

- missing file/module failure for `app/utils/affiliate-copy.ts`
- existing product-detail helper assertion fails against the old callout values

- [ ] **Step 3: Add a shared affiliate-copy helper**

Create `app/utils/affiliate-copy.ts`:

```ts
export const AMAZON_PRIMARY_CTA_LABEL = "View on Amazon";
export const AMAZON_SECONDARY_CTA_LABEL = "Check on Amazon";
export const INLINE_AFFILIATE_DISCLOSURE =
  "Affiliate link. As an Amazon Associate, DealsRky earns from qualifying purchases.";
export const AMAZON_DESTINATION_NOTE =
  "You will leave DealsRky and continue to Amazon for current pricing, delivery details, reviews, and checkout.";
```

- [ ] **Step 4: Update the product-detail helper output**

In `app/utils/product-detail.ts`, change the generic public callout shape returned by `getPublicProductPageCallout()` so it matches the new messaging:

```ts
export function getPublicProductPageCallout() {
  return {
    eyebrow: "Amazon destination",
    title: "Continue to Amazon when you are ready",
    body:
      "Use this page for product research first. When you choose a marketplace, you will leave DealsRky and continue to Amazon for current pricing, delivery details, reviews, and checkout.",
  };
}
```

- [ ] **Step 5: Wire the new copy into the product-detail page**

Update the CTA/disclosure area in `app/routes/product-detail.tsx`:

```tsx
import {
  AMAZON_DESTINATION_NOTE,
  AMAZON_PRIMARY_CTA_LABEL,
  INLINE_AFFILIATE_DISCLOSURE,
} from "../utils/affiliate-copy";
```

```tsx
<div className="mt-4">
  <a
    href={`/go/p/${selectedMarketplace.toLowerCase()}/${product.asin}`}
    className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
    rel="nofollow sponsored"
  >
    {AMAZON_PRIMARY_CTA_LABEL}
  </a>
  <p className="mt-3 text-sm leading-6 text-gray-600">
    {AMAZON_DESTINATION_NOTE}
  </p>
  <p className="mt-2 text-xs leading-5 text-gray-500">
    {INLINE_AFFILIATE_DISCLOSURE}
  </p>
</div>
```

- [ ] **Step 6: Wire the same copy into the bridge page**

In `app/routes/bridge.tsx`, import the same helper and replace the current CTA text:

```tsx
import {
  AMAZON_DESTINATION_NOTE,
  AMAZON_PRIMARY_CTA_LABEL,
  AMAZON_SECONDARY_CTA_LABEL,
  INLINE_AFFILIATE_DISCLOSURE,
} from "../utils/affiliate-copy";
```

Apply these replacements in the CTA block:

```tsx
<a
  href={data.redirectUrl}
  rel="nofollow sponsored"
  onClick={handleAmazonClick("primary")}
  className="hidden items-center justify-center rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover sm:inline-flex"
>
  {AMAZON_PRIMARY_CTA_LABEL}
</a>
<a
  href={data.redirectUrl}
  rel="nofollow sponsored"
  onClick={handleAmazonClick("secondary")}
  className="hidden items-center justify-center rounded-full border border-gray-300 px-6 py-3.5 text-sm font-bold text-gray-700 transition-colors hover:border-primary hover:text-primary sm:inline-flex"
>
  {AMAZON_SECONDARY_CTA_LABEL}
</a>
<p className="mt-4 text-sm leading-6 text-gray-600">{AMAZON_DESTINATION_NOTE}</p>
<p className="mt-2 text-xs leading-5 text-gray-500">{INLINE_AFFILIATE_DISCLOSURE}</p>
```

For the mobile CTA:

```tsx
<a
  href={data.redirectUrl}
  rel="nofollow sponsored"
  onClick={handleAmazonClick("mobile")}
  className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
>
  {AMAZON_PRIMARY_CTA_LABEL}
</a>
```

- [ ] **Step 7: Run the tests to verify the copy changes pass**

Run:

```bash
npm test -- test/unit/affiliate-copy.test.ts test/unit/product-detail.test.ts test/api/redirect.test.ts
```

Expected:

- copy helper tests pass
- product-detail helper tests pass
- redirect tests still pass after rel/CTA changes

- [ ] **Step 8: Commit**

```bash
git add app/utils/affiliate-copy.ts app/utils/product-detail.ts app/routes/product-detail.tsx app/routes/bridge.tsx test/unit/affiliate-copy.test.ts test/unit/product-detail.test.ts
git commit -m "fix: clarify Amazon CTAs and inline disclosures"
```

---

### Task 3: Add a Public Terms Page and Footer Wiring

**Files:**
- Create: `app/routes/terms.tsx`
- Modify: `app/routes.ts`
- Modify: `app/components/Footer.tsx`

- [ ] **Step 1: Write the failing route registration expectation**

Add this assertion in a new small route-config smoke test block inside `test/unit/affiliate-copy.test.ts` or an adjacent unit file if you prefer to keep route assertions separate:

```ts
import routes from "../../app/routes";

it("registers a public terms route", () => {
  expect(JSON.stringify(routes)).toContain("terms");
});
```

- [ ] **Step 2: Run the route smoke test to verify it fails**

Run:

```bash
npm test -- test/unit/affiliate-copy.test.ts
```

Expected:

- route-config assertion fails because `terms` is not yet present

- [ ] **Step 3: Create the Terms page**

Create `app/routes/terms.tsx` with the same public-page pattern used by About/Privacy:

```tsx
import type { Route } from "./+types/terms";
import { buildSeoMeta } from "../utils/seo";

export function meta({}: Route.MetaArgs) {
  return buildSeoMeta({
    title: "Terms of Use | DealsRky",
    description: "Terms of use for DealsRky public visitors and affiliate-link readers.",
    path: "/terms",
  });
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f8f8_0%,#ffffff_24%,#f4f6f6_100%)] py-16">
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-sm md:p-12">
          <div className="border-b border-gray-100 pb-8">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">Terms</p>
            <h1 className="mt-3 text-3xl font-black text-gray-950 md:text-4xl">Terms of Use</h1>
          </div>
          <div className="mt-8 space-y-8 text-sm leading-7 text-gray-600 md:text-base">
            <section>
              <h2 className="text-xl font-bold text-gray-900">Informational use</h2>
              <p className="mt-3">
                DealsRky publishes editorial product information for research and discovery. Content on this site is informational and does not create a purchase contract.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-bold text-gray-900">Retailer responsibility</h2>
              <p className="mt-3">
                Final pricing, stock, delivery, returns, and checkout are handled by Amazon or the final retailer, not by DealsRky.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-bold text-gray-900">Affiliate relationship</h2>
              <p className="mt-3">
                Some links on DealsRky are affiliate links. As an Amazon Associate, DealsRky earns from qualifying purchases.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-bold text-gray-900">Contact</h2>
              <p className="mt-3">
                Questions about site usage can be sent through the DealsRky contact page.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Register the route and footer link**

In `app/routes.ts`, add:

```ts
route("terms", "routes/terms.tsx"),
```

Place it in the public content routes next to Privacy/Disclosure/About/Contact.

In `app/components/Footer.tsx`, add:

```tsx
<Link to="/terms" className="hover:text-white">
  Terms of Use
</Link>
```

Put it in the existing Policies section.

- [ ] **Step 5: Run the test to verify the route is wired**

Run:

```bash
npm test -- test/unit/affiliate-copy.test.ts
```

Expected:

- the route-config assertion passes

- [ ] **Step 6: Commit**

```bash
git add app/routes/terms.tsx app/routes.ts app/components/Footer.tsx test/unit/affiliate-copy.test.ts
git commit -m "feat: add public terms page"
```

---

### Task 4: Reposition Homepage and Deals Page Copy Toward Editorial Guidance

**Files:**
- Modify: `app/routes/home.tsx`
- Modify: `app/routes/deals.tsx`

- [ ] **Step 1: Add a failing copy regression test**

Create a simple assertion block in `test/unit/affiliate-copy.test.ts` that locks the new positioning language:

```ts
const HOME_COPY = {
  heroEyebrow: "Buying Guides & Curated Picks",
  heroTitle: "Research products with confidence before you buy on Amazon.",
  dealsTitle: "Browse Curated Product Picks",
};

it("uses editorial homepage and deals framing instead of live-deals language", () => {
  expect(HOME_COPY.heroEyebrow).toContain("Buying Guides");
  expect(HOME_COPY.heroTitle).toContain("Amazon");
  expect(HOME_COPY.dealsTitle).toContain("Curated");
});
```

This test should fail first because those strings do not yet exist in the implementation.

- [ ] **Step 2: Run the copy test to verify it fails**

Run:

```bash
npm test -- test/unit/affiliate-copy.test.ts
```

Expected:

- the new editorial-copy assertions fail against the current constants or missing values

- [ ] **Step 3: Update homepage messaging**

In `app/routes/home.tsx`, replace the current hero and marketplace language:

```tsx
<p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-primary">
  Buying Guides & Curated Picks
</p>
<h1 className="max-w-xl text-4xl font-black leading-tight text-gray-950 md:text-6xl">
  Research products with confidence before you buy on Amazon.
</h1>
<p className="mt-6 max-w-xl text-base leading-7 text-gray-600 md:text-lg">
  DealsRky publishes concise buying guidance, curated recommendations, and marketplace-aware product pages so you can compare options before continuing to Amazon for current pricing and checkout.
</p>
```

Replace the marketplace panel header:

```tsx
<p className="text-xs uppercase tracking-[0.3em] text-primary/80">
  Supported Marketplaces
</p>
<h2 className="mt-2 text-2xl font-bold">Research First, Then Continue</h2>
```

Replace the lower panel note:

```tsx
<p className="text-sm leading-6 text-white/85">
  Use DealsRky to review product context and compare marketplace availability before you continue to Amazon.
</p>
```

- [ ] **Step 4: Update deals-page framing**

In `app/routes/deals.tsx`, replace the page header:

```tsx
<h1 className="text-3xl md:text-5xl font-black text-gray-800 mb-2">
  Browse Curated Product Picks
</h1>
<p className="text-gray-600 max-w-lg mx-auto text-sm md:text-base">
  Explore marketplace-aware recommendations and use each product page for research before continuing to Amazon.
</p>
```

Update the empty-state text:

```tsx
<h3 className="font-bold text-gray-800">No curated picks available yet</h3>
<p className="text-gray-500 text-sm">
  We are reviewing the next batch of public product pages. Please check back soon.
</p>
```

- [ ] **Step 5: Run the copy test again**

Run:

```bash
npm test -- test/unit/affiliate-copy.test.ts
```

Expected:

- editorial copy assertions pass

- [ ] **Step 6: Commit**

```bash
git add app/routes/home.tsx app/routes/deals.tsx test/unit/affiliate-copy.test.ts
git commit -m "feat: reposition public pages as editorial recommendations"
```

---

### Task 5: Add a Content Audit and Publishing Checklist

**Files:**
- Create: `docs/amazon-associates-content-checklist.md`

- [ ] **Step 1: Write the checklist document**

Create `docs/amazon-associates-content-checklist.md`:

```md
# Amazon Associates Approval Content Checklist

## Blog Publishing Target

- [ ] Publish at least 10 original blog posts
- [ ] Keep each post indexed and linked from `/blog`
- [ ] Avoid generic filler or spun summaries

## Public Product Audit

- [ ] Review 20 to 30 public product pages manually
- [ ] Confirm each product uses the correct marketplace
- [ ] Confirm each page has a meaningful editorial summary
- [ ] Confirm the CTA says Amazon explicitly
- [ ] Confirm inline disclosure is visible near the CTA
- [ ] Confirm each outbound flow resolves to a tagged Amazon URL

## Copy Audit

- [ ] Remove “best prices today”, “latest deals”, and similar urgency-led claims from key public pages
- [ ] Keep “Amazon” visible in CTA-adjacent destination messaging
- [ ] Keep policy links visible in the footer

## Reapplication Readiness

- [ ] Test public product pages in US, UK, and DE manually
- [ ] Confirm `robots.txt` no longer blocks Amazon review traffic
- [ ] Confirm new Terms page is live
- [ ] Confirm disclosure, privacy, about, and contact pages are public
```

- [ ] **Step 2: Verify the file exists and is readable**

Run:

```bash
sed -n '1,200p' docs/amazon-associates-content-checklist.md
```

Expected:

- the checklist renders with all four sections present

- [ ] **Step 3: Commit**

```bash
git add docs/amazon-associates-content-checklist.md
git commit -m "docs: add Amazon approval content checklist"
```

---

## Self-Review

### Spec Coverage

- reviewer access fixes: Task 1
- CTA clarity + inline disclosure + outbound rel attributes: Task 2
- Terms page: Task 3
- homepage/deals positioning rewrite: Task 4
- content expansion governance: Task 5

### Placeholder Scan

- no `TODO`, `TBD`, or “implement later” placeholders remain
- each code task includes an actual code block
- each test step includes an exact command

### Type Consistency

- shared CTA/disclosure strings are defined in `app/utils/affiliate-copy.ts`
- `getPublicProductPageCallout()` remains the product-detail helper source of truth
- route registration stays in `app/routes.ts`

