# Active Context — Amazon Affiliate

> Updated: 2026-07-13
> CodexPro reads this on every `workspace_summary` call. Keep current.

## Current task

All current Admin Sheet tracking-sync changes were verified, committed, and pushed to the repository default branch.

## Branch / worktree

- Active branch: `master`.
- `origin/HEAD` points to `origin/master`; this repository has no `main` branch, so the user's request to merge into main was applied to the actual default branch, `master`.
- No deployment was performed; deploy only with explicit user instruction.

## Files touched this session

- `server/services/admin-sheet-row-sync.ts`
  - Supports switching to existing tags, creating new tags, and reactivating inactive agents/tags from Admin Sheet input.
  - Preserves the previous global tracking tag instead of renaming it.
  - Keeps the website mapping authoritative when the sheet value has not intentionally changed.
  - Writes safe audit-log entries for auto-created agents and tracking tags.
- `test/unit/admin-sheet-row-sync.test.ts`
  - Added coverage for auto-created agents/tags, existing-agent tag creation, and same-agent mapping reconciliation.
  - Fixed a test fixture that incorrectly created a second active site-primary US tag, violating the unique marketplace constraint.
- `docs/superpowers/specs/2026-06-25-admin-sheet-row-sync-design.md`
  - Updated the synchronization behavior documentation.
- `active-context.md`
  - Updated session state and verification evidence.

## Product-page disclosure request

- `app/routes/product-detail.tsx` already renders the Amazon affiliate disclosure inside the shared highlighted destination/pricing callout and does not render a second disclosure below the `View on Amazon` CTA.
- Because the shared `/deals/:asin` route is used for dynamic product pages, the existing source already applies this placement to all product pages.

## Verification

- Initial full test run exposed one invalid test fixture: a second active `is_site_primary = 1` US tag violated `idx_tracking_ids_site_primary_marketplace`.
- Targeted test: `test/unit/admin-sheet-row-sync.test.ts` — 11/11 passed.
- Full test suite: 44 files, 245 tests passed.
- `npm run typecheck` passed.
- `npm run build` passed.
- `git diff --check` passed.

## Git result

- Feature commit: `2687ac1` — `feat: sync and create tracking tags from admin sheet`.
- Pushed successfully to `origin/master`.

## Pending decisions / next concrete step

- Retry one real ASIN row from the Admin Sheet and verify the new tag/agent behavior against the live D1 database.
- A real Zyte API key is still needed for live Zyte fallback verification.
- Deploy only when the user explicitly requests deployment.

## Operational reminders

- CodexPro MCP is live at `https://aff.online-bazar.top/mcp?codexpro_token=[REDACTED_SECRET]`
- Profile: `~/.codexpro/profiles/05ebc342a8080fb254121b0d.json`. Mode `agent`, write `workspace`, bash `full`, auth on.
- Local MCP: `http://127.0.0.1:8790/mcp`.
- Daily use: `cd "/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate" && codexpro start`.

> This file is updated by the agent at the end of every turn so the next session has fresh state.
