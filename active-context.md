# Active Context — Amazon Affiliate

> Updated: 2026-07-08 (GitHub/local sync after Zyte + tracking maintenance work)
> CodexPro reads this on every `workspace_summary` call. Keep current.

## Current task

Synced local `master` with GitHub `origin/master`, pulled 12 GitHub-only commits, reapplied local uncommitted work, resolved one merge conflict in `server/routes/tracking.ts`, verified, committed, and pushed local work back to GitHub.

## Branch / worktree

`main` / `master` workspace naming is mixed in local git output. Current active branch is `master`; do not deploy unless explicitly requested.

## Files touched this session

- Pulled GitHub tracking-maintenance commits, including maintenance routes, admin UI route, mapping cleanup, and single active tag behavior.
- Resolved conflict between GitHub single-tag enforcement and local site-primary tracking fields in `server/routes/tracking.ts`.
- Kept regular `/api/tracking/:id` delete behavior as remap-to-site-primary; hard deletion remains in the maintenance API.
- Fixed `server/routes/maintenance.ts` body typing so `npm run typecheck` passes.
- Kept prior local Zyte API fallback, admin sheet row sync, docs, tests, and generated admin sheet template assets staged for sync.
- Restored generated Playwright/test-result deletions and did not push those artifact deletions.

## Pending decisions

- Need a real Zyte API key before live verification against Amazon can be run.
- Current product-data fallback order is: manual/existing fields → Creators API → Zyte → RapidAPI → SerpApi → typed error.
- Retry one ASIN row from the sheet and verify product data saves to D1.

## Blockers

- No live Zyte request was executed in this sync because no real Zyte key was verified locally.

## Verification

- `npm run typecheck` passed after sync conflict fixes.
- `npm test -- product-ingestion-lwa admin-sheet-row-sync admin-sheet-webhook portal-tracking agents-admin affiliate-copy` passed: 6 files, 58 tests.
- Vitest/Wrangler emitted non-blocking stderr warnings during shutdown, but the test command exited 0 with all targeted tests passed.

## Next concrete step

After the sync commit is pushed, retry one ASIN row from the sheet and verify product data saves to D1 using the configured live fallback keys.

## Operational reminders

- CodexPro MCP is live at `https://aff.online-bazar.top/mcp?codexpro_token=[REDACTED_SECRET]`
- Profile: `~/.codexpro/profiles/05ebc342a8080fb254121b0d.json`. Mode `agent`, write `workspace`, bash `full`, auth on.
- Local MCP: `http://127.0.0.1:8790/mcp`.
- Daily use: `cd "/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate" && codexpro start`.

> This file is updated by the agent at the END of every turn (or START of the next) so the next session has fresh state.
