

# Project Memory — Amazon affiliate
> 150 notes | Score threshold: >40

## Safety — Never Run Destructive Commands

> Dangerous commands are actively monitored.
> Critical/high risk commands trigger error notifications in real-time.

- **NEVER** run `rm -rf`, `del /s`, `rmdir`, `format`, or any command that deletes files/directories without EXPLICIT user approval.
- **NEVER** run `DROP TABLE`, `DELETE FROM`, `TRUNCATE`, or any destructive database operation.
- **NEVER** run `git push --force`, `git reset --hard`, or any command that rewrites history.
- **NEVER** run `npm publish`, `docker rm`, `terraform destroy`, or any irreversible deployment/infrastructure command.
- **NEVER** pipe remote scripts to shell (`curl | bash`, `wget | sh`).
- **ALWAYS** ask the user before running commands that modify system state, install packages, or make network requests.
- When in doubt, **show the command first** and wait for approval.

**Stack:** Unknown stack

## Important Warnings

- **⚠️ GOTCHA: Fixed null crash in TrackingId** — -     if (tRes.ok) { const d = await tRes.json(); setTrackingIds(d.tra

## Project Standards

- Strengthened types Overhaul — offloads heavy computation off the main thread
- Fixed null crash in Mapping — confirmed 3x
- Strengthened types Navigate
- Strengthened types Contact
- Updated API endpoint Annotations — reduces initial bundle size with code spli... — confirmed 5x
- Strengthened types Route — wraps unsafe operation in error boundary
- Strengthened types Route — parallelizes async operations for speed
- Strengthened types HeroBanner — parallelizes async operations for speed

## Known Fixes

- ❌ -       if (!res.ok) { const d = await res.json(); throw new Error(d.error); } → ✅ Fixed null crash in Mapping

## Recent Decisions

- decision in product-detail.tsx
- decision in home.tsx
- Optimized Argument — offloads heavy computation off the main thread
- Optimized Argument — hardens HTTP security headers

## Verified Best Practices

- Agent generates new migration for every change (squash related changes)
- Agent installs packages without checking if already installed

## Available Tools (ON-DEMAND only)
- `query(q)` — Deep search when stuck
- `find(query)` — Full-text lookup
> Context above IS your context. Do NOT call load() at startup.
