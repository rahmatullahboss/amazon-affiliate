# Sheet Tab Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins paste one Google Sheet URL, discover tabs, select the relevant tabs, and save multiple per-tab sources for one agent.

**Architecture:** Keep the existing per-source sync pipeline and expand the source model so each selected tab is stored as its own `agent_sheet_sources` row. Add one discovery API endpoint plus a multi-tab create endpoint, then update the admin UI to drive selection from discovered metadata instead of free-text tab names.

**Tech Stack:** React Router, Hono, Zod, D1, Vitest, Google Sheets API

---

### Task 1: Lock Data Model Expectations With Tests

**Files:**
- Modify: `test/unit/sheet-control.test.ts`

- [ ] Add failing tests for multiple sources per agent, duplicate tab rejection, and discovery response shape.
- [ ] Run the targeted test file and confirm failure is due to missing behavior.

### Task 2: Expand Schema And Persistence

**Files:**
- Create: `migrations/0013_agent_sheet_multi_tab.sql`
- Modify: `server/schemas/index.ts`
- Modify: `server/services/sheet-control.ts`

- [ ] Add migration for `spreadsheet_id`, `sheet_gid`, and composite uniqueness.
- [ ] Update create/update schemas for multi-tab selection and discovery request validation.
- [ ] Update service-layer source creation and listing logic to support multiple rows per agent.
- [ ] Run targeted tests until data-model tests pass.

### Task 3: Add Google Sheets Tab Discovery API

**Files:**
- Modify: `server/services/google-sheets.ts`
- Modify: `server/routes/sheet-control.ts`
- Modify: `test/api/sheet-control.test.ts`
- Modify: `test/unit/sheet-control.test.ts`

- [ ] Add a helper to list spreadsheet tabs from Google metadata.
- [ ] Add an authenticated discovery endpoint.
- [ ] Add tests for successful discovery and failure cases.
- [ ] Run targeted API and unit tests until green.

### Task 4: Update Admin UI To Use Discovery And Multi-Select

**Files:**
- Modify: `app/routes/admin/sheet-control.tsx`

- [ ] Add discovery state, loading/error handling, and tab checkbox selection.
- [ ] Replace free-text tab entry with discover-and-select flow.
- [ ] Submit selected tabs in one request.
- [ ] Verify typecheck coverage for the new client state.

### Task 5: Verification

**Files:**
- Modify: `test/unit/sheet-control.test.ts`
- Modify: `test/api/sheet-control.test.ts`

- [ ] Run targeted unit tests.
- [ ] Run targeted API tests.
- [ ] Run `npm run typecheck`.

