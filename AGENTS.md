# amazon-affiliate — Project Memory

> Auto-synced | 234 observations

**Stack:** Unknown stack

## 🛡️ GLOBAL SAFETY RULES

- **NEVER** run `git clean -fd` or `git reset --hard` without checking `git log` and verifying commits exist.
- **NEVER** delete untracked files or folders blindly. Always backup or stash before bulk edits.

## 🧭 ACTIVE CONTEXT

> Always read `.cursor/active-context.md` for exact instructions on the specific file you are currently editing. It updates dynamically.

## 🔴 STOP — READ THESE FIRST

- **Agent: follow existing project patterns — don't introduce a different style** — Agent: follow existing project patterns — don't introduce a different style
- **Agent: don't generate code with "any" type — define proper TypeScript types** — Agent: don't generate code with "any" type — define proper TypeScript types
- **Agent: always handle loading/error states — don't just render data** — Agent: always handle loading/error states — don't just render data
- **Agent: don't use deprecated APIs — check library version, use current API** — Agent: don't use deprecated APIs — check library version, use current API
- **Agent: check existing code before creating utility functions — avoid duplicates** — Agent: check existing code before creating utility functions — avoid duplicates

## 📐 Conventions

- Version your API from day 1 (/api/v1/)
- Use consistent response format across all endpoints
- Implement soft delete for important data — don't hard delete without confirmation
- Handle timezone correctly — store UTC, display in user's timezone
- Make layouts responsive from the start — mobile-first approach
- Disable submit button during form submission — prevent double-submit
- Always add empty states ("No items yet" with call-to-action)
- Always add error states with retry button — not just blank screen

## ⚡ Available Tools (ON-DEMAND only)
- `save(title, content, category)` — Save a note + auto-detect conflicts
- `batch_save(items[])` — Save multiple notes in 1 call
- `query(text)` — Search memory for architecture, past fixes, decisions
- `search(text)` — Full-text search for details
- `check_errors()` — Check compiler errors after edits

> ℹ️ DO NOT call get_context() or get_gotchas() at startup — context above IS your context.

---
*Auto-synced | 2026-03-28*

## 🚦 Mandatory Superpowers Skills

Use the `Skill` tool to invoke these skills at the right moment. Skipping them is a protocol violation.

- **`superpowers:using-superpowers`** — invoke FIRST, before responding to any user message. Establishes how to find and use skills.
- **`superpowers:brainstorming`** — invoke BEFORE any planning, design, or non-trivial implementation. Brainstorm first, plan second, code third.
- **`superpowers:writing-plans`** — invoke when a plan is needed before implementation. Plans contain approach and steps only — NO code blocks in plans.
- **`superpowers:execute-plan`** — invoke when actually executing a written plan.
- **`superpowers:test-driven-development`** — invoke when adding tests or test-driven features.
- **`superpowers:systematic-debugging`** — invoke BEFORE attempting any bug fix. Always debug first, patch second.
- **`superpowers:verification-before-completion`** — invoke before claiming a task is done. Verify, then state completion.
- **`superpowers:requesting-code-review`** — invoke at major milestones or before merging significant work.
- **`superpowers:receiving-code-review`** — invoke when receiving review feedback; do not silently ignore review input.

> 1% rule: even a small chance a skill applies means invoke it. Skills override default behavior but user instructions are highest priority.

## 🔄 Session Memory Files (Maintain Every Turn)

These MD files are the project's persistent memory across ChatGPT sessions via CodexPro. Update them at the appropriate moment — do not let them go stale.

| File | When to update |
|---|---|
| `active-context.md` (project root) | **Every turn** while work is in progress: current task, branch, files touched this session, pending decisions, blockers, next concrete step |
| `.ai-bridge/current-plan.md` | **Before any non-trivial work.** Approach and steps only — never code blocks |
| `.ai-bridge/project-map.md` | **Whenever you explore or map the codebase.** Persistent codebase map the next session reads to skip rediscovery |
| `.ai-bridge/codex-status.md` | After each meaningful change: files touched, tests run, results, blockers, next GPT review focus |
| `.ai-bridge/decisions.md` | When an architectural decision is made and should remain stable |
| `.ai-bridge/open-questions.md` | When something is unresolved and the next session needs to pick it up |

The four files — `active-context.md`, `.ai-bbridge/current-plan.md`, `.ai-bridge/project-map.md`, and this `AGENTS.md` — are the session memory. They must always reflect reality.

> Don't ask the user to confirm every read/edit/bash in this project. Use the safety rules above to decide. Read first, edit second, commit third, deploy only with explicit "deploy" instruction.
