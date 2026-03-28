

# Project Memory — Amazon affiliate
> 238 notes | Score threshold: >40

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

## 📝 NOTE: 1 uncommitted file(s) in working tree.\n\n## Important Warnings

- **gotcha in flow-c-ascii.md** — File updated (external): .qwen/skills/wds-4-ux-design/data/page-creati
- **⚠️ GOTCHA: Fixed null crash in TrackingId** — -     if (tRes.ok) { const d = await tRes.json(); setTrackingIds(d.tra

## Project Standards

- what-changed in manifest.yaml — confirmed 3x
- Strengthened types Compatible — ensures atomic multi-step database operations
- Strengthened types Overhaul — offloads heavy computation off the main thread
- Fixed null crash in Mapping — confirmed 3x
- Strengthened types Navigate
- Strengthened types Contact
- Updated API endpoint Annotations — reduces initial bundle size with code spli... — confirmed 5x
- Strengthened types Route — wraps unsafe operation in error boundary

## Known Fixes

- ❌ -       if (!res.ok) { const d = await res.json(); throw new Error(d.error); } → ✅ Fixed null crash in Mapping

## Recent Decisions

- Optimized Amazon — offloads heavy computation off the main thread
- Optimized impliedFormat — offloads heavy computation off the main thread
- decision in SKILL.md
- decision in booking-example.md

## Learned Patterns

- Always: what-changed in 6ff324b00a136583bcd892a64686650ed4ed5f9c69e6fd52e861d3cc87186247.sqlite-shm — confirmed 15x (seen 2x)
- Decision: Optimized Argument — offloads heavy computation off the main thread (seen 2x)
- Always: what-changed in 6ff324b00a136583bcd892a64686650ed4ed5f9c69e6fd52e861d3cc87186247.sqlite-shm — confirmed 12x (seen 3x)
- Agent generates new migration for every change (squash related changes)
- Agent installs packages without checking if already installed

## Available Tools (ON-DEMAND only)
- `query(q)` — Deep search when stuck
- `find(query)` — Full-text lookup
> Context above IS your context. Do NOT call load() at startup.
