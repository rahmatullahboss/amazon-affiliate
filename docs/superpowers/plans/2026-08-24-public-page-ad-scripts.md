# Public Page Ad Scripts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the three supplied ad snippets to public web pages only, with native Capacitor, admin, portal, redirect, and affiliate CTA flows excluded.

**Architecture:** Keep all publisher constants and runtime gating in `app/components/PublicAds.tsx`. Mount the banner in `PublicLayout` after the header and mount the body-end loader after the footer; inject the single popunder into `document.head` after hydration. No root-level global script or route-level duplication.

**Tech Stack:** React 19, React Router 7, TypeScript, Vitest, React Router build, Cloudflare Workers SSR.

---

### Task 1: Add failing focused ad-contract tests

**Files:**
- Create: `test/unit/public-ads.test.ts`
- Test: `app/components/PublicAds.tsx` after implementation

- [ ] **Step 1: Write the failing tests**

Add tests that import the planned public exports and assert the exact publisher inputs and runtime gate:

```ts
import { describe, expect, it } from "vitest";
import {
  NATIVE_BANNER_CONTAINER_ID,
  NATIVE_BANNER_SCRIPT_SRC,
  POPUNDER_SCRIPT_SRC,
  BOTTOM_SCRIPT_SRC,
  shouldEnablePublicAds,
} from "../../app/components/PublicAds";

describe("public ad contract", () => {
  it("keeps the publisher-supplied script sources and container exact", () => {
    expect(POPUNDER_SCRIPT_SRC).toBe(
      "https://pl30967642.profitableratecpmnetwork.com/8b/f2/cb/8bf2cb651ba536569055a0e78deb5e0c.js"
    );
    expect(NATIVE_BANNER_SCRIPT_SRC).toBe(
      "https://pl30967643.profitableratecpmnetwork.com/c4b4a3c619735916a8b2c83cf2ae6a65/invoke.js"
    );
    expect(NATIVE_BANNER_CONTAINER_ID).toBe(
      "container-c4b4a3c619735916a8b2c83cf2ae6a65"
    );
    expect(BOTTOM_SCRIPT_SRC).toBe(
      "https://pl30967644.profitableratecpmnetwork.com/27/9f/b2/279fb283fc6df4ba2e60428705c80920.js"
    );
  });

  it("enables ads for web pages and disables them for Capacitor", () => {
    expect(shouldEnablePublicAds(false)).toBe(true);
    expect(shouldEnablePublicAds(true)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run test/unit/public-ads.test.ts`

Expected: FAIL because `app/components/PublicAds.tsx` and its exports do not exist yet.

### Task 2: Implement the isolated public ad component

**Files:**
- Create: `app/components/PublicAds.tsx`

- [ ] **Step 1: Add the exact constants and runtime gate**

Export the four exact strings and this pure gate:

```ts
export function shouldEnablePublicAds(isNativeApp: boolean): boolean {
  return !isNativeApp;
}
```

Use `useEffect` and `useState(false)` so no third-party ad markup is emitted before the browser confirms it is not a native Capacitor runtime. After hydration, call `isNativeCapacitorApp()`, set the enabled state for web, and append the popunder source to `document.head` only when no matching script already exists.

- [ ] **Step 2: Render the native banner and body-end loader**

Render the supplied native loader with `async` and `data-cfasync="false"`, followed by the exact container id. Export a second body-end component that uses the same runtime gate and renders only the supplied closing-body loader. Do not add link handlers, timers, wrappers, provider settings, or `dangerouslySetInnerHTML`.

- [ ] **Step 3: Run the focused test and verify GREEN**

Run: `npm test -- --run test/unit/public-ads.test.ts`

Expected: PASS with both contract tests passing.

### Task 3: Mount ads only at the public layout boundary

**Files:**
- Modify: `app/routes/public-layout.tsx`

- [ ] **Step 1: Mount the top and body-end components**

Import `PublicAds` and `PublicAdsBodyEnd`. Render `PublicAds` after `<Header />`, keep `<Outlet />` inside the existing `<main>`, keep the existing `Footer`, and render `PublicAdsBodyEnd` after the footer. Do not modify `app/root.tsx` or any admin, portal, bridge, redirect, or CTA route.

- [ ] **Step 2: Run the focused public tests**

Run: `npm test -- --run test/unit/public-ads.test.ts test/e2e/storefront.spec.ts`

Expected: PASS for the ad contract and existing storefront smoke coverage, subject to the repository's configured e2e environment.

### Task 4: Update project session records and verify the complete change

**Files:**
- Modify: `active-context.md`
- Modify: `.ai-bridge/current-plan.md`
- Modify: `.ai-bridge/codex-status.md`

- [ ] **Step 1: Record the current task and evidence**

Record the public-only scope, files changed, test commands, exact results, and any unresolved external-ad-network limitation. Preserve the pre-existing extension worktree state.

- [ ] **Step 2: Run the full verification gates**

Run:

```bash
npm test -- --run
npm run typecheck
npm run build
git diff --check
git status --short
```

Expected: each command exits successfully; `git diff --check` reports no whitespace errors; status shows only the intended ad/docs/status changes plus the pre-existing dirty `active-context.md`/untracked extension files.

- [ ] **Step 3: Review the final diff**

Confirm the exact three publisher URLs and native container are present once, the public layout is the only route boundary changed, and no deployment, push, database, DNS, or affiliate tracking mutation occurred.
