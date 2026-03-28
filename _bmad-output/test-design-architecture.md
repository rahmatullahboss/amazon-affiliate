---
stepsCompleted: []
lastStep: ''
lastSaved: ''
workflowType: 'testarch-test-design'
inputDocuments: []
---

# Test Design for Architecture: DealsRKY Affiliate Bridge

**Purpose:** Architectural concerns, testability gaps, and NFR requirements for review by Architecture/Dev teams. Serves as a contract between QA and Engineering on what must be addressed before test development begins.

**Date:** 2026-03-28
**Author:** Murat (BMAD TEA)
**Status:** Architecture Review Pending
**Project:** DealsRKY Amazon Affiliate
**PRD Reference:** implementation_plan.md (Outdated) -> Codebase Truth
**ADR Reference:** N/A

---

## Executive Summary

**Scope:** Testing strategy for the standalone DealsRKY Amazon Affiliate Bridge, covering the Redirect Engine, Agent Portal, Admin Panel, Public Affiliate Storefront, and Google Sheets Synchronization.

**Business Context** (from PRD):

- **Revenue/Impact:** Ensures zero Amazon TOS violations, accurate commission attribution, and high-performance redirect latency.
- **Problem:** Shifting from legacy WP-like Deals Store to a programmatic Affiliate Redirection Bridge without breaking current Google Sheets sync workflows.
- **GA Launch:** Phase 1 Target.

**Architecture** (from actual codebase):

- **Key Decision 1:** Cloudflare Workers + Hono for API.
- **Key Decision 2:** D1 for relational state, KV for rapid redirect caching.
- **Key Decision 3:** React Router v7 for both SSR public storefront and SPA admin/portal.
- **Key Decision 4:** Maintained legacy Google Sheets integration for Phase 1.

**Expected Scale** (from ADR):

- Sub-50ms redirect response times via KV.
- ~50 Agents concurrently using the system.

**Risk Summary:**

- **Total risks**: 5
- **High-priority (≥6)**: 4 risks requiring immediate mitigation
- **Test effort**: ~11 core tests (~1.5-2 weeks for QA setup and execution)

---

## Quick Guide

### 🚨 BLOCKERS - Team Must Decide (Can't Proceed Without)

**Pre-Implementation Critical Path** - These MUST be completed before QA can write integration tests:

1. **Test-Env-1: Local D1/KV Simulators** - Need established `miniflare` or Wrangler setup routines for CI pipelines so we can hydrate the D1 schema without hitting production. (recommended owner: DevOps/Backend)

**What we need from team:** Complete these 1 items pre-implementation or test development is blocked.

---

### ⚠️ HIGH PRIORITY - Team Should Validate (We Provide Recommendation, You Approve)

1. **R-04: Google Sheets Edge-Cases** - Need an agreed Mocking pattern for Google APIs. Using `msw` or `undici` interceptors to simulate Google API payloads. (implementation phase)
2. **R-03: Cross-Agent Data Leak** - Ensure test factory allows generating multiple distinct Agent bearer tokens to assert unauthorized access.

**What we need from team:** Review recommendations and approve.

---

### 📋 INFO ONLY - Solutions Provided (Review, No Decisions Needed)

1. **Test strategy**: Heavy API Integration + E2E Playwright. (Unit tests reserved for stateless parsers and Zod schemas).
2. **Tooling**: Vitest (Unit/Integration) + Playwright (E2E).
3. **Tiered CI/CD**: PR (Unit + API Integration) vs Nightly (E2E Playwright).
4. **Coverage**: 11 test scenarios prioritized P0-P2 with risk-based classification.
5. **Quality gates**: 100% P0 pass rate, 95% P1.

**What we need from team:** Just review and acknowledge.

---

## For Architects and Devs - Open Topics 👷

### Risk Assessment

**Total risks identified**: 5 (4 high-priority score ≥6, 1 medium, 0 low)

#### High-Priority Risks (Score ≥6) - IMMEDIATE ATTENTION

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **R-01** | **SEC/BUS** | Amazon TOS Violation (fake prices, unapproved UI) | 2 | 3 | **6 (HIGH)** | UI Component tests ensuring disclosure and static CTAs. E2E visual checks. | Dev | GA |
| **R-02** | **DATA/BUS** | Redirect Engine Tracking Failure (wrong ID injected) | 2 | 3 | **6 (HIGH)** | Deep Integration and E2E coverage of the `/go/:agentSlug/:asin` route. | QA | Beta |
| **R-03** | **DATA/SEC** | Cross-Agent Data Leak (Agent A sees Agent B's data) | 2 | 3 | **6 (HIGH)** | Integration tests acting as different users to assert 403/404s. | QA | GA |
| **R-04** | **OPS/DATA** | Google Sheets Sync Failure / Rate limits | 3 | 2 | **6 (HIGH)** | Unit tests for parser, Mocked integration tests. | Backend | Beta |

#### Medium-Priority Risks (Score 3-5)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-05 | PERF | Rate Limit Blocks on Portal | 2 | 2 | 4 | Logic-level unit tests for the rate limiter boundary. | QA |

---

### Testability Concerns and Architectural Gaps

**🚨 ACTIONABLE CONCERNS - Architecture Team Must Address**

#### 1. Blockers to Fast Feedback (WHAT WE NEED FROM ARCHITECTURE)

| Concern | Impact | What Architecture Must Provide | Owner | Timeline |
| --- | --- | --- | --- | --- |
| **External Auth/Sheets Mocking** | Integration tests will flake rapidly | Provide a mock adapter or factory setup for Google Services in `test/` environment. | Backend | Pre-Integration |

#### 2. Architectural Improvements Needed (WHAT SHOULD BE CHANGED)

1. **Centralized User Schema**
   - **Current problem**: Both `admin_users` and `users` tables exist.
   - **Required change**: Consolidate role checks to reduce test matrix complexity.
   - **Owner**: Backend
   - **Timeline**: N/A (User requested not to drop legacy for now)

---

### Testability Assessment Summary

**📊 CURRENT STATE - FYI**

#### What Works Well

- ✅ Pure Function routing via Hono allows extremely fast in-process API testing.
- ✅ Custom analytics tables (`clicks`, `page_views`) make asserting tracking events fully observable in local DB.

#### Accepted Trade-offs (No Action Required)

For Phase 1, the following trade-offs are acceptable:

- **Google Sheets Reliability** - We will continue to test the legacy Google Sheets integration as P1 instead of removing it, per stakeholder request.

---

### Risk Mitigation Plans (High-Priority Risks ≥6)

#### R-01: Amazon TOS Violation (Score: 6) - CRITICAL

**Mitigation Strategy:**

1. Implement Playwright visual E2E tests for the Public UI.
2. Ensure specific components have `data-testid="amazon-disclosure"`.
3. Fail CI if "Amazon" string does not appear in footer/disclosure.

#### R-02: Redirect Engine Tracking Failure (Score: 6) - CRITICAL

**Mitigation Strategy:**

1. Parameterize `vitest` suite to loop through 10+ combinations of Agent IDs, Amazon URLs, and Missing IDs.
2. Assert the 302 Location header strictly matches the regex `&tag=EXPECTED_TRACKING_ID`.

---

**Next Steps for Architecture Team:**
1. Review Quick Guide (🚨/⚠️/📋) and provide Google API mock strategies.
