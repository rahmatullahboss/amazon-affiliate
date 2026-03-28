---
title: 'TEA Test Design → BMAD Handoff Document'
version: '1.0'
workflowType: 'testarch-test-design-handoff'
inputDocuments: []
sourceWorkflow: 'testarch-test-design'
generatedBy: 'TEA Master Test Architect'
generatedAt: '2026-03-28'
projectName: 'DealsRKY'
---

# TEA → BMAD Integration Handoff

## Purpose

This document bridges TEA's test design outputs with BMAD's epic/story decomposition workflow (`create-epics-and-stories`). It provides structured integration guidance so that quality requirements, risk assessments, and test strategies flow into implementation planning.

## TEA Artifacts Inventory

| Artifact | Path | BMAD Integration Point |
| --- | --- | --- |
| Test Design Document | `_bmad-output/test-design-qa.md` | Epic quality requirements, story acceptance criteria |
| Risk Assessment | `_bmad-output/test-design-architecture.md` | Epic risk classification, story priority |
| Coverage Strategy | `_bmad-output/test-design-qa.md` | Story test requirements |

## Epic-Level Integration Guidance

### Risk References

- **R-01: Amazon TOS Violation** -> Link to UI compliance epic
- **R-02: Redirect Engines** -> Link to Tracking implementation epic
- **R-03: Security Leak** -> Link to Auth/RBAC epic
- **R-04: Google Sheets** -> Link to Legacy Sync epic

### Quality Gates

- P0 tests must be mapped directly into Acceptance Criteria (AC) for relevant User Stories.
- P1 scenarios should have explicit tasks created for the development team.

## Story-Level Integration Guidance

### P0/P1 Test Scenarios → Story Acceptance Criteria

- **Story: Affiliate Redirect Link Generation**
  - AC: Must return 302 Header to Amazon.
  - AC: URL must contain `&tag={expected_id}`.
  - AC: Missing agents fall back to Admin ID.
  
- **Story: Agent Portal Authorization**
  - AC: API requests to `/admin` endpoints by Agent JWTs return 403 Forbidden.

### Data-TestId Requirements

- `data-testid="amazon-disclosure"` must be present on the public storefront footer layout.
- `data-testid="amazon-buy-button"` must clearly show the static string (e.g., "See Price on Amazon").

## Risk-to-Story Mapping

| Risk ID | Category | Level | Recommended Story/Epic | Test Level |
| --- | --- | --- | --- | --- |
| R-01 | SEC/BUS | High | Affiliate Storefront Frontend | Component/E2E |
| R-02 | DATA/BUS | High | Redirect Engine Core | API Integration |
| R-03 | DATA/SEC | High | IAM / Auth Middlewares | API Integration |
| R-04 | OPS/DATA | High | Sheets Job Worker | Unit / Mock Int |
