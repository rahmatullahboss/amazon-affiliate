---
stepsCompleted: []
lastStep: ''
lastSaved: ''
workflowType: 'testarch-test-design'
inputDocuments: []
---

# Test Design for QA: DealsRKY Affiliate Bridge

**Purpose:** Test execution recipe for QA team. Defines what to test, how to test it, and what QA needs from other teams.

**Date:** 2026-03-28
**Author:** Murat (BMAD TEA)
**Status:** Draft
**Project:** DealsRKY Amazon Affiliate

**Related:** See Architecture doc (test-design-architecture.md) for testability concerns and architectural blockers.

---

## Executive Summary

**Scope:** The DealsRKY Affiliate platform including Redirect Tracking, Portals (Admin/Agent), Public Storefront, and Google Sheets Sync Engine.

**Risk Summary:**

- Total Risks: 5 (4 high-priority score ≥6, 1 medium, 0 low)
- Critical Categories: Data Integrity, Business Logic (TOS), Security.

**Coverage Summary:**

- P0 tests: ~4 (critical paths, tracking, security)
- P1 tests: ~4 (sync integration, auth)
- P2 tests: ~3 (edge cases, rate limits)
- **Total**: ~11 tests (~1.5 to 2 weeks with 1 QA)

---

## Dependencies & Test Blockers

**CRITICAL:** QA cannot proceed without these items from other teams.

### QA Infrastructure Setup (Pre-Implementation)

1. **Test Data Factories** - QA
   - `Agent` and `Admin` factory helpers to inject localized D1 records.
   - SQLite DB resets between `vitest` runs.

2. **Test Environments** - QA
   - Local: `miniflare` + `vitest` for API tests. Playwright connecting to local `wrangler dev` server.

---

## Risk Assessment

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Score | QA Test Coverage |
| --- | --- | --- | --- | --- |
| **R-01** | SEC/BUS | Amazon TOS Violation | **6** | UI Component/E2E visual checks |
| **R-02** | DATA/BUS | Redirect Tracking Failure | **6** | Integration tests on `/go/*` route |
| **R-03** | DATA/SEC | Cross-Agent Data Leak | **6** | Integration API tests as different roles |
| **R-04** | OPS/DATA | Google Sheets Sync Failure | **6** | Mocked integration tests of sync pipeline |

---

## Tooling & Access

| Tool or Service | Purpose | Access Required | Status |
| --- | --- | --- | --- |
| Cloudflare Workers | Server runtime testing | Local Wrangler CLI | Ready |
| Playwright | UI and Affilate tests | Local npm install | Pending |

---

## Test Coverage Plan

### P0 (Critical)

**Criteria:** Blocks core functionality + High risk (≥6) + No workaround + Affects majority of users

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| **P0-001** | Injects valid `tracking_id` based on Agent Slug and ASIN. | API Integration | R-02 | Core business logic. Assert HTTP 302 location header. |
| **P0-002** | Handles deleted/invalid Agent Slugs by falling back to Admin ID. | API Integration | R-02 | Edge case but critical for revenue preservation. |
| **P0-003** | Prevents Agents from accessing `/admin/*` routes. | API Integration | R-03 | Security boundary check. |
| **P0-004** | Renders Amazon Disclosure exactly as required by TOS. | UI Component | R-01 | Text-search E2E or Component test for disclosure string. |

### P1 (High)

**Criteria:** Important features + Medium risk (3-4) + Common workflows + Workaround exists but difficult

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| **P1-001** | Validates JWTs effectively, revoking expired sessions. | Unit | R-03 | |
| **P1-002** | Generates correct custom Share Links for an Agent. | API Integration | R-02 | |
| **P1-003** | Creates records in `page_views` and `clicks` correctly. | API Integration | R-02 | |
| **P1-004** | Parses Google sheet rows and upserts products into D1 securely. | Integration | R-04 | Uses mocked Google API adapter. |

### P2 (Medium)

**Criteria:** Secondary features + Low risk (1-2) + Edge cases + Regression prevention

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| **P2-001** | Loads Deals/Categories UI without breaking layout on empty state. | E2E | R-01 | |
| **P2-002** | Handles Sheets rate-limits completely gracefully. | Unit | R-04 | |
| **P2-003** | Bot Guard blocks suspicious User-Agents. | Unit | R-05 | |

---

## Execution Strategy

**Philosophy:** Run backend integration aggressively in PRs; UI tests deferred to nightly or merged PRs depending on speed.

### Every PR: Vitest Tests (< 1 min)
- All P0-P2 Unit and API Integration tests via `vitest` + `miniflare`.

### Nightly: Playwright UI tests
- P0-004, P2-001 (Storefront Visual/E2E Tests).

---

## Appendix: Knowledge Base References

- **Test Quality**: `test-quality.md` - Definition of Done (no hard waits, <300 lines, <1.5 min)
