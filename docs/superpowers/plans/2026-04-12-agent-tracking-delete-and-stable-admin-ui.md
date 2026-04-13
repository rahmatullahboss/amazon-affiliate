# Agent Tracking Delete And Stable Admin UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to filter active/inactive agents, delete inactive agents safely by remapping live product links to marketplace site-primary tags, delete individual tracking tags with the same remap rule, and keep admin pages stable without jumping back to the top after actions.

**Architecture:** Extend the existing admin `agents` and `tracking` APIs instead of creating new subsystems. Deletion remains safe by enforcing same-marketplace remaps to active site-primary tags before removing agent-owned tracking records, while the React admin pages preserve search/filter/page/edit state locally so actions do not reset the viewport.

**Tech Stack:** Hono, TypeScript, React, Cloudflare D1, Vitest

---

### Task 1: Define backend delete/remap behavior with tests

**Files:**
- Modify: `/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate/test/api/agents-admin.test.ts`
- Modify: `/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate/test/api/portal-tracking.test.ts`
- Modify: `/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate/server/routes/agents.ts`
- Modify: `/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate/server/routes/tracking.ts`

- [ ] **Step 1: Write failing test for deleting an inactive agent**

```ts
it("deletes an inactive agent and remaps linked products to marketplace site-primary tags", async () => {
  // Seed:
  // - inactive agent with US/DE tracking
  // - active site-primary US/DE tags on another owner
  // - agent_products rows linked to the inactive agent tags
  // Assert:
  // - DELETE /api/agents/:id returns 200
  // - agent row no longer exists
  // - tracking_ids for deleted agent no longer exist
  // - agent_products rows now point to site-primary tracking ids for same marketplace
  // - users formerly tied to agent are detached or inactivated per route behavior
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -s vitest run test/api/agents-admin.test.ts`
Expected: FAIL because delete route only deactivates the agent and does not remap or remove tracking.

- [ ] **Step 3: Write failing test for blocking active-agent delete**

```ts
it("rejects delete for an active agent", async () => {
  // Seed active agent
  // Expect DELETE /api/agents/:id to return 409 with a clear inactive-first message
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm -s vitest run test/api/agents-admin.test.ts`
Expected: FAIL because current route allows soft-delete regardless of active state.

- [ ] **Step 5: Write failing test for deleting a tracking tag with live mappings**

```ts
it("deletes a tracking tag and remaps linked agent_products to same-marketplace site-primary tag", async () => {
  // Seed:
  // - tracking tag in use by multiple agent_products rows
  // - active site-primary tag for same marketplace
  // Assert:
  // - DELETE /api/tracking/:id returns 200
  // - old tracking id row removed
  // - agent_products rows now point to site-primary tracking id
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm -s vitest run test/api/portal-tracking.test.ts`
Expected: FAIL because current tracking delete route throws 409 when mappings exist.

- [ ] **Step 7: Implement minimal backend logic**

```ts
// agents.ts
// - reject delete if agent.is_active === 1
// - load agent tracking ids
// - for each marketplace in use, require active site-primary tag owned by a different or surviving owner
// - update agent_products.tracking_id for affected rows
// - delete agent_slug_aliases for those tracking ids
// - delete tracking_ids rows
// - detach users.agent_id and deactivate users
// - delete agent row

// tracking.ts
// - on delete, find same-marketplace site-primary tag
// - remap agent_products rows from old tracking_id to site-primary tracking_id
// - delete alias rows
// - delete tracking row
```

- [ ] **Step 8: Run targeted tests to verify backend passes**

Run: `pnpm -s vitest run test/api/agents-admin.test.ts test/api/portal-tracking.test.ts`
Expected: PASS

### Task 2: Add admin UI filters and actions without page reset

**Files:**
- Modify: `/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate/app/routes/admin/agents.tsx`
- Modify: `/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate/app/routes/admin/tracking.tsx`
- Modify: `/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate/app/utils/agents.ts`

- [ ] **Step 1: Write failing UI-oriented tests for filtering and stable inline state**

```ts
it("filters agents by active state without resetting the current result context", () => {
  // Assert active/inactive filter logic returns only matching cards
});

it("keeps inline edit state on the same card after list updates", () => {
  // Assert helper returns same editing anchor after refresh when item still exists
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -s vitest run test/unit/agents.test.ts`
Expected: FAIL because no active/inactive filter helper or stable anchor helper exists yet.

- [ ] **Step 3: Implement minimal UI behavior**

```tsx
// agents.tsx
// - add status filter: ALL / ACTIVE / INACTIVE
// - show Delete Agent only for inactive agents
// - show Delete All Tracking action on inactive cards
// - keep search/filter/page/edit state after refresh; do not clear current page unless now out of range

// tracking.tsx
// - add Delete action for each row
// - keep current filter/search/page/form state after fetchAll
// - preserve edit mode if edited row still exists
```

- [ ] **Step 4: Run tests to verify UI helpers pass**

Run: `pnpm -s vitest run test/unit/agents.test.ts`
Expected: PASS

### Task 3: Verify end-to-end admin behavior

**Files:**
- Modify: `/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate/test/api/agents-admin.test.ts`
- Modify: `/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate/test/api/portal-tracking.test.ts`

- [ ] **Step 1: Add regression tests for missing site-primary protection**

```ts
it("blocks delete when a required marketplace site-primary tag does not exist", async () => {
  // Expect 409 and explicit marketplace list in error message
});
```

- [ ] **Step 2: Run tests to verify failure mode is correct**

Run: `pnpm -s vitest run test/api/agents-admin.test.ts test/api/portal-tracking.test.ts`
Expected: PASS after implementation with explicit 409s.

- [ ] **Step 3: Run final verification**

Run: `pnpm -s vitest run test/api/agents-admin.test.ts test/api/portal-tracking.test.ts test/unit/agents.test.ts`
Expected: PASS

Run: `pnpm -s tsc -p tsconfig.json --noEmit`
Expected: PASS

Run: `pnpm -s build`
Expected: PASS
