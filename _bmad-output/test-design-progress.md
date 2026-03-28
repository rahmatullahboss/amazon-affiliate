---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'completion'
lastSaved: '2026-03-28'
inputDocuments: [
  'implementation_plan.md',
  'tea-index.csv',
  'test-levels-framework.md',
  'risk-governance.md',
  'adr-quality-readiness-checklist.md',
  'test-quality.md'
]
---

## Step 01: Detect Mode

**Selected Mode:** System-Level Test Design

**Reason:** 
The project has a comprehensive `implementation_plan.md` which acts as the PRD and overall Architecture Document. It outlines the core components (Cloudflare Workers, D1, KV, React Router UI) and final system scope (Admin, Agent Portal, Redirect Engine, Public Frontend). This provides the necessary foundational system-level context required for a holistic risk assessment and testing strategy.

## Step 02: Load Context

**Loaded Configuration:**
- Stack Detected: `fullstack` (React Router frontend + Hono/Cloudflare Workers backend)
- Core knowledge fragments selected.

**Loaded Input Documents:**
- `implementation_plan.md` (Project Context/PRD/Architecture) // Note: Superseded by codebase reality
- `test-levels-framework.md` (Test Levels and Selection Matrix)
- `risk-governance.md` (Risk Scoring and Mitigation Workflows)
- `adr-quality-readiness-checklist.md` (Readiness and Testability Checklist)
- `test-quality.md` (Definition of Done for test quality)

## Step 03: Testability & Risk Assessment

### 🚨 Testability Concerns (Actionable)
- **KV Cache Invalidation:** Testing the cache invalidation boundaries for tracking configurations will require dedicated test utilities or interceptors to avoid flakiness.
- **Cloudflare Dependencies:** End-to-end (E2E) and integration tests must run against `miniflare`/`wrangler` local to simulate D1 and KV correctly, rather than generic SQLite. Wait timings for D1 persistence might introduce flakiness.
- **Google Sheets Mocking:** Since the existing Google Sheets sync logic is retained, API mocking for external Google APIs is required to prevent tests from failing due to rate limits or missing credentials.

### ✅ Testability Assessment Summary
- **Controllability:** High. Hono backend makes API logic highly unit-testable. Cloudflare D1 can be deterministically seeded using local test databases.
- **Observability:** High. The core domain involves custom `page_views` and `clicks` tables, which makes asserting "did a track happen?" very easy to query programmatically in tests.

### ⚠️ Risk Assessment Matrix

| Risk | Category | Prob (1-3) | Imp (1-3) | Score | Mitigation Plan |
|------|----------|------------|-----------|-------|-----------------|
| 🚨 **Amazon TOS Violation** (fake prices, unapproved UI) | SEC/BUS | 2 | 3 | **6 (HIGH)** | UI Component tests ensuring disclosure and static CTAs. E2E visual checks on the public affiliate frontend. |
| 🚨 **Redirect Engine Tracking Failure** (wrong ID injected) | DATA/BUS | 2 | 3 | **6 (HIGH)** | Deep Integration and E2E coverage of the `/go/:agentSlug/:asin` route to assert correct URL generation. |
| 🚨 **Cross-Agent Data Leak** (Agent A sees Agent B's data) | DATA/SEC | 2 | 3 | **6 (HIGH)** | Integration tests on all `/portal/*` endpoints acting as different users to assert 403/404s. |
| 🚨 **Google Sheets Sync Failure** | OPS/DATA | 3 | 2 | **6 (HIGH)** | Integration and Unit tests for the parser and API boundary, preventing malformed data from corrupting D1. |
| ⚠️ **Rate Limit Blocks on Portal** | PERF | 2 | 2 | **4 (MED)** | Logic-level unit tests for the rate limiter. |

## Step 04: Coverage Plan & Execution Strategy

### 1. Coverage Matrix (Based on Codebase Truth)

| Component Area | Atomic Test Scenario | Test Level | Priority |
|----------------|----------------------|------------|----------|
| **Redirect Engine** | Injects valid `tracking_id` based on Agent Slug and ASIN. | Integration | P0 |
| **Redirect Engine** | Handles deleted/invalid Agent Slugs by falling back to Admin ID. | Integration | P0 |
| **Auth/RBAC** | Prevents Agents from accessing `/admin/*` routes. | Integration | P0 |
| **Auth/RBAC** | Validates JWTs effectively, revoking expired sessions. | Unit | P1 |
| **Affiliate Storefront** | Renders Amazon Disclosure exactly as required by TOS. | UI Component | P0 |
| **Affiliate Storefront** | Loads Deals/Categories UI without breaking layout on empty state. | E2E | P2 |
| **Portals (Admin/Agent)** | Generates correct custom Share Links for an Agent. | API Integration | P1 |
| **Portals (Admin/Agent)** | Creates records in `page_views` and `clicks` correctly. | API Integration | P1 |
| **Google Sheets Sync** | Parses sheet rows and upserts generic products into D1 securely. | Integration | P1 |
| **Google Sheets Sync** | Handles rate-limits and network errors gracefully cleanly failing the job. | Unit | P2 |
| **Middleware** | Bot Guard blocks suspicious User-Agents. | Unit | P2 |

### 2. Execution Strategy

* **Pull Request (PR) Suite (< 5 min):**
  * All Unit Tests (Zod schemas, Bot Guard, Rate Limit algorithms).
  * API Integration Tests (Hono routes via local `env.DB` simulation with Miniflare).
* **Nightly Suite:**
  * Playwright E2E UI tests across Public Storefront, Admin Panel, and Agent Portal.
  * Google Sheets sync extensive integration simulating large payload ingestion.

### 3. Resource Estimates

* **P0 Scenarios:** ~15–25 hours (Setting up D1/Miniflare environment takes the bulk initially, exact routing logic tests are fast).
* **P1 Scenarios:** ~15–20 hours.
* **P2/P3 Scenarios:** ~10–15 hours.
* **Total Timeline:** ~40-60 hours (approx 1.5 - 2 sprints) for a highly robust, automated CI setup.

### 4. Quality Gates

* **Gate 1 (Commit):** Zod Types and Hono API static types check must pass (`tsc --noEmit`).
* **Gate 2 (PR):** P0 Pass rate = 100%. Coverage of `server/routes/redirect.ts` must be ≥ 90%.
* **Gate 3 (Deploy):** P1 Pass rate ≥ 95%. No known high-risk (Score ≥ 6) regressions. E2E UI Smoke Test passes.

## Step 05: Output Generation (Complete)

- Workflow Mode: System-Level
- Outputs Generated:
  - `test-design-architecture.md`
  - `test-design-qa.md`
  - `test-design/DealsRKY-handoff.md`

All required execution rules followed. Workflow successfully completed.
