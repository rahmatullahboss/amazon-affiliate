# Admin Sheet Row Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin-only immediate row/batch ASIN sync with site-primary tag fallback, generated-link writeback, and a ready-to-import sample Google Sheet.

**Architecture:** Add a focused row-sync service that receives normalized rows directly from Apps Script, resolves an explicit or marketplace site-primary tracking tag, reuses existing products without provider calls, fetches only missing products, upserts the admin mapping, and returns per-row links. Keep full-sheet reconciliation separate and non-refreshing.

**Tech Stack:** TypeScript, Hono, Cloudflare Workers/D1/KV, Vitest, Google Apps Script, Google Sheets, `@oai/artifact-tool`.

---

### Task 1: Row-sync service tests

**Files:**
- Create: `test/unit/admin-sheet-row-sync.test.ts`
- Create: `server/services/admin-sheet-row-sync.ts`

- [ ] Write failing tests proving blank tags resolve to marketplace site-primary tags.
- [ ] Write a failing test proving existing products do not call the provider.
- [ ] Write a failing test proving missing products call the ingestion path once.
- [ ] Write a failing test proving mixed 100-row batches return independent results.
- [ ] Run `npm test -- test/unit/admin-sheet-row-sync.test.ts` and confirm failures are caused by missing implementation.

### Task 2: Minimal row-sync implementation

**Files:**
- Create: `server/services/admin-sheet-row-sync.ts`
- Modify: `server/services/sheet-sync.ts`

- [ ] Add typed input/result contracts.
- [ ] Resolve explicit tracking tags or active marketplace `is_site_primary` tags.
- [ ] Query product existence before calling `ensureProductRecord`.
- [ ] Upsert the site-primary owner's `agent_products` mapping.
- [ ] Build bridge, storefront, redirect, and order links from the resolved owner/marketplace/ASIN.
- [ ] Process rows independently with a 100-row request limit.
- [ ] Run the targeted unit tests and confirm green.

### Task 3: Webhook API

**Files:**
- Modify: `server/routes/webhooks.ts`
- Create: `test/api/admin-sheet-webhook.test.ts`

- [ ] Write failing API tests for authentication, validation, batch success, and partial failure.
- [ ] Add `POST /api/webhooks/sheet-row-sync`.
- [ ] Return `{status, results}` with row numbers preserved.
- [ ] Run `npm test -- test/api/admin-sheet-webhook.test.ts`.

### Task 4: Apps Script row/batch trigger

**Files:**
- Modify: `docs/google-apps-script-sheet-sync.js`

- [ ] Replace full-sync-on-edit behavior with `New ASINs` row extraction.
- [ ] Trigger only when edited rows have `submit = YES`.
- [ ] Split batches into chunks of 100.
- [ ] Write returned status, title, links, tag, error, and timestamp into the edited rows.
- [ ] Keep `manualFullSync()` for reconciliation and install one edit trigger plus one daily trigger.

### Task 5: Daily reconciliation

**Files:**
- Modify: `workers/app.ts`
- Modify: `server/services/sheet-sync.ts`
- Test: `test/unit/sheet-sync.test.ts`

- [ ] Add a failing test proving existing products in reconciliation do not call an external provider.
- [ ] Route reconciliation to the configured admin input tab.
- [ ] Ensure provider fetch is limited to database-missing ASINs.
- [ ] Change the cron from hourly sheet import to one daily reconciliation schedule while preserving other scheduled work.

### Task 6: Sample workbook

**Files:**
- Create: `outputs/<thread>/DealsRKY_Admin_ASIN_Sync_Template.xlsx`

- [ ] Build `New ASINs`, `Instructions`, and `Marketplaces`.
- [ ] Add marketplace and submit dropdowns, sample rows, output columns, frozen headers, filters, and conditional status colors.
- [ ] Inspect values/formulas and render every sheet.
- [ ] Export the verified workbook and import it as a native Google Sheet.

### Task 7: Verification

**Files:**
- Modify: `.ai-bridge/current-plan.md`
- Modify: `.ai-bridge/codex-status.md`
- Modify: `active-context.md`

- [ ] Run targeted tests.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Review the diff for unrelated changes.
- [ ] Request code review and address critical/important findings.

