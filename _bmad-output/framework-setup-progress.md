---
stepsCompleted: ['step-01-preflight', 'step-02-select-framework', 'step-03-scaffold-framework', 'step-04-docs-and-scripts', 'step-05-validate-and-summary']
lastStep: 'step-05-validate-and-summary'
lastSaved: '2026-03-28'
---

## Step 01: Preflight Checks

**Stack Detection:**
- Stack Detected: `fullstack`
- Architecture: React Router frontend + Cloudflare Workers (Hono) backend using D1 and KV.
- Bundler: Vite (@cloudflare/vite-plugin)

**Prerequisites Validation:**
- `package.json` exists in project root.
- No existing E2E/Unit testing framework found (`playwright.config`, `vitest.config`, or `cypress.config`).
- Status: **Ready to proceed with framework scaffolding.**

**Project Context gathered:**
- Target environment: Cloudflare Pages / Workers.
- Relevant architectures docs: `_bmad-output/test-design-qa.md` and `_bmad-output/test-design-architecture.md` are present.
- Needs: API mock adapters for Google Sheets out-of-process. Local D1 and KV simulators (via Miniflare).

## Step 02: Framework Selection

**Selected Frameworks:**
1. **Backend / Unit / API Integration:** `Vitest`
   - **Reasoning:** Since the backend uses Cloudflare Workers and Hono, `vitest` combined with `@cloudflare/vitest-pool-workers` is the officially supported and highest-performance method for simulating the `env` bindings (D1, KV) locally. It is lightning fast and shares the Vite pipeline.
2. **Frontend / E2E Visual:** `Playwright`
   - **Reasoning:** Project is fullstack. E2E tests for the Amazon Storefront require a real browser context. Playwright excels at parallel execution and fits the TEA architectural recommendations.

## Step 03: Scaffold Framework

**Actions Taken:**
- Execution Mode Resolved: `sequential` (manual standard run)
- Created directory structure for `fullstack`: `test/e2e/`, `test/unit/`, `test/factories/`
- Generated Framework Configs:
  - `vitest.config.ts`: Configured with `@cloudflare/vitest-pool-workers` pulling directly from `./wrangler.jsonc` (loads D1, KV simulator automatically).
  - `playwright.config.ts`: Added `webServer` block binding to `npm run dev` at `http://localhost:5173`. Added `chromium` and `mobile-chrome` devices.
- Fixtures & Factories:
  - Added a basic Faker factory: `test/factories/agent.ts`
- Environment Setup:
  - Installed dependencies via NPM: `vitest`, `@cloudflare/vitest-pool-workers`, `@playwright/test`, `@faker-js/faker`.
  - Installed Playwright WebKit/Chromium via CLI.
- Sample Tests:
  - `test/unit/sample.test.ts`: Added bindings check for D1 (`env.DB`) and KV (`env.KV`).
  - `test/e2e/sample.spec.ts`: Added storefront title verification using local Vite server.

Next step requested: `./step-04-docs-and-scripts.md`

## Step 04: Docs and Scripts
- Created `test/README.md` detailing the Vitest and Playwright separation.
- Included commands to run tests, E2E debug flows, and general architecture constraints.

## Step 05: Validate & Summary
- **Validation**: All components (configs, factories, test runners, directories, `package.json` scripts) are deployed correctly. No preflight failures or missing tools detected.
- **Framework Selected**: Vitest (`@cloudflare/vitest-pool-workers`) + Playwright
- **Artifacts Created**:
  - `playwright.config.ts`, `vitest.config.ts`
  - `test/README.md`, `test/e2e/sample.spec.ts`, `test/unit/sample.test.ts`
  - `test/factories/agent.ts`
- **Next Steps**: Hand-off to `bmad-testarch-automate` or start creating implementation code using TEA architectural principles.
