# Amazon Affiliate Platform — Final Implementation Plan

## 1. Product Definition

This project is no longer a copy of the old `DealsRky` WordPress site and no longer depends on Google Sheets.

The final product is a **fully in-house Amazon affiliate platform** with:

- a custom public affiliate frontend
- an admin panel for business operations
- an agent portal for ASIN submission and link generation
- a bridge landing page + redirect engine
- app-side traffic tracking
- Amazon report-based sales attribution

### Core Business Goal

Enable 30-40 agents to promote Amazon products through a custom site while keeping:

- agent-specific landing links
- fast and compliant buyer flow
- client-owned affiliate attribution
- agent-level performance visibility
- low operational friction

### Canonical Buyer Flow

```text
Agent logs in -> adds/selects ASIN -> gets unique link
Buyer opens agent link -> sees compliant landing page
Buyer clicks "Buy on Amazon" -> redirect engine injects agent tracking ID
Amazon receives visitor under client's affiliate setup
Amazon reports later show sales by tracking ID
Admin imports report -> system reconciles sales to agent
```

---

## 2. Final Strategic Decisions

### 2.1 What We Are Building

We are building a **custom Amazon affiliate platform**, not a generic e-commerce clone.

### 2.2 What We Are Not Building

- no WordPress clone
- no DealsRky theme copy
- no Google Sheet driven production workflow
- no static price-heavy storefront
- no fake product catalog disconnected from affiliate reality

### 2.3 Source of Truth

- `D1` is the operational database
- `KV` is the performance cache layer
- `Amazon tracking IDs` are the source of truth for actual sale attribution

### 2.4 Tracking Model

The platform should assume **one client-owned Amazon Associates setup** with **multiple tracking IDs**, ideally one per agent and marketplace where needed.

This is the cleanest model because:

- the client remains the affiliate owner
- agents remain internal sales/acquisition contributors
- app-side traffic and Amazon-side sales can be reconciled

If the client does not create separate tracking IDs per agent, then the system can still track traffic but **cannot reliably attribute real sales per agent**.

---

## 3. Current Codebase Review

## 3.1 What Already Exists

The current repo already provides a solid technical foundation:

- Cloudflare Worker entrypoint
- React Router SSR application
- Hono API
- D1 schema for agents, products, tracking IDs, mappings, clicks, page views
- admin authentication
- product CRUD
- agent CRUD
- tracking ID CRUD
- mapping CRUD
- redirect route
- bridge route
- click/view analytics foundation

## 3.2 What Is Incorrect or Outdated

The current implementation has several direction-level problems:

- the public UI drifted toward copying the old DealsRky site
- implementation planning still assumes Google Sheets as a major workflow
- there is no agent portal
- the analytics layer does not solve real business attribution
- the dedicated analytics UI is incomplete
- the buyer bridge CTA currently bypasses the redirect engine on the main landing page path
- parts of the product ingestion pipeline still rely on placeholder/mock-style product data

## 3.3 Current Maturity Assessment

Current state is best described as:

**Foundation complete, business workflow incomplete**

That means:

- infra and backend patterns are usable
- the final product model is not yet encoded in the app
- the public frontend needs redesign
- the portal and sales attribution systems still need to be built

---

## 4. Final System Scope

The final system has four major modules.

## 4.1 Public Affiliate Frontend

Purpose:

- host original, compliant affiliate pages
- render bridge landing pages for agent links
- provide enough trust and content for legitimacy

Must include:

- homepage
- product detail pages
- category/index pages if needed
- bridge landing pages
- disclosure page
- privacy page
- contact page

## 4.2 Redirect and Tracking Engine

Purpose:

- resolve agent + product to the correct Amazon URL
- inject the correct tracking ID
- track views and CTA clicks
- protect the redirect path

Must include:

- tracked landing page -> tracked redirect flow
- rate limiting
- bot detection
- duplicate-click suppression for analytics quality
- KV-cached redirect context

## 4.3 Admin Operations Panel

Purpose:

- manage users, agents, products, tracking IDs, reports, analytics

Must include:

- admin login
- admin user management
- agent management
- tracking ID management
- product moderation
- analytics dashboard
- report import/export
- audit logging

## 4.4 Agent Portal

Purpose:

- replace Google Sheets completely
- let agents work inside the system

Must include:

- agent login
- ASIN submission
- agent product list
- link copy/generation
- traffic stats
- later: order/commission view

---

## 5. Final Information Architecture

## 5.1 Public Routes

```text
/                          Home
/products                  Product listing/search
/products/:asin            Product detail
/category/:slug            Category page
/:agentSlug/:asin          Agent bridge page
/disclosure                Affiliate disclosure
/privacy                   Privacy policy
/contact                   Contact page
```

## 5.2 Admin Routes

```text
/admin/login
/admin
/admin/users
/admin/agents
/admin/tracking
/admin/products
/admin/product-submissions
/admin/analytics
/admin/reports
/admin/audit
```

## 5.3 Agent Routes

```text
/portal/login
/portal
/portal/asins/new
/portal/products
/portal/links
/portal/analytics
```

---

## 6. Data Model

## 6.1 Core Tables

### users

Used for authentication and authorization.

Fields:

- `id`
- `email`
- `password_hash`
- `role` (`super_admin`, `admin`, `agent`)
- `agent_id` nullable
- `is_active`
- `created_at`
- `updated_at`

### agents

Business identity of the internal agent.

Fields:

- `id`
- `slug`
- `name`
- `email`
- `phone`
- `status`
- `created_at`
- `updated_at`

### tracking_ids

Client-owned Amazon tracking IDs mapped to agents.

Fields:

- `id`
- `agent_id`
- `marketplace`
- `tracking_tag`
- `label`
- `is_default`
- `is_active`
- `created_at`
- `updated_at`

### products

Canonical product rows, unique by `asin + marketplace`.

Fields:

- `id`
- `asin`
- `marketplace`
- `title`
- `image_url`
- `description`
- `features`
- `category`
- `brand`
- `status` (`pending`, `active`, `rejected`, `archived`)
- `source` (`api`, `manual`)
- `fetched_at`
- `created_at`
- `updated_at`

### agent_products

Controls which agents can promote which products.

Fields:

- `id`
- `agent_id`
- `product_id`
- `tracking_id`
- `custom_title`
- `status`
- `submitted_by_user_id`
- `created_at`
- `updated_at`

### page_views

Landing page view events.

### clicks

CTA click events routed through the redirect engine.

### amazon_reports

Metadata for uploaded/imported Amazon reports.

Fields:

- `id`
- `marketplace`
- `report_type`
- `period_start`
- `period_end`
- `source_file_name`
- `imported_by_user_id`
- `imported_at`

### amazon_conversions

Parsed report rows tied to tracking IDs.

Fields:

- `id`
- `report_id`
- `tracking_tag`
- `marketplace`
- `asin`
- `ordered_items`
- `shipped_items`
- `revenue_amount`
- `commission_amount`
- `raw_date`

### audit_logs

Tracks important admin and system actions.

---

## 7. End-to-End Workflow

## 7.1 Agent Product Submission

```text
Agent logs in
-> submits ASIN + marketplace
-> system checks if product already exists
-> if not, fetches metadata from allowed source
-> creates/updates product
-> creates agent_product row for that agent
-> assigns correct tracking ID
-> link becomes available for copy
```

## 7.2 Buyer Journey

```text
Buyer opens /:agentSlug/:asin
-> SSR landing page renders image/title/disclosure
-> page view is logged
-> CTA points to /go/:agentSlug/:asin
-> redirect engine resolves tracking tag
-> click is logged
-> buyer is redirected to Amazon
```

## 7.3 Sales Attribution

```text
Client downloads Amazon tracking report
-> admin imports report into platform
-> system maps tracking_tag to agent
-> orders, revenue, commission become visible per agent
```

---

## 8. Amazon Compliance Guardrails

The system should be built around policy-safe behavior, not shortcuts.

### Required

- visible affiliate disclosure
- original landing page content
- explicit Amazon CTA
- no forced redirects
- privacy/contact/disclosure pages
- clear destination behavior

### Avoid

- cloaked or disguised destination URLs
- fake urgency widgets
- static cached prices from unofficial sources
- thin copy-paste storefront pages
- bulk low-quality autogenerated content

### Product Page Content Rule

Every buyer-facing page should contain enough original presentation to look like a legitimate affiliate destination:

- product title
- product image
- short descriptive copy
- basic trust messaging
- affiliate disclosure
- clear CTA to Amazon

Bridge pages should stay minimal, but not empty.

---

## 9. Security and Reliability

## 9.1 Security

- role-based authorization
- JWT/session validation
- brute-force protection on login
- rate limits on sensitive endpoints
- input validation through Zod
- prepared SQL statements only
- no hardcoded secrets in repo
- audit logs for sensitive operations

## 9.2 Performance

- D1 for canonical reads/writes
- KV cache for hot redirect/page data
- SSR for public pages
- cache invalidation on product/tag/mapping changes
- lightweight bridge rendering

## 9.3 Reliability

- health endpoint
- import error handling
- product fetch retry strategy
- graceful fallback if product fetch fails
- soft-delete for business-critical records

---

## 10. Implementation Phases

## Phase 0 — Direction Reset

Goal:

Remove outdated assumptions and align the repo with the final product.

Tasks:

- rewrite implementation plan
- freeze Google Sheet assumptions
- stop cloning the old DealsRky storefront
- define new site architecture and route map
- define final data ownership model

Status:

- in progress now via this document

## Phase 1 — Core Engine Correction

Goal:

Make the existing redirect/bridge system technically correct.

Tasks:

- change bridge CTA so it always routes through `/go/:agentSlug/:asin`
- ensure page views and clicks are both tracked
- normalize redirect and bridge data contracts
- improve cache invalidation on agent/product/mapping changes
- remove secret exposure and hardcoded API credentials
- harden redirect middleware behavior

Current repo status:

- partially built
- requires correction, not greenfield work

## Phase 2 — Schema Upgrade

Goal:

Move from prototype schema to final production schema.

Tasks:

- add `users`
- extend `agents`
- normalize `tracking_ids`
- extend `products`
- extend `agent_products`
- add `amazon_reports`
- add `amazon_conversions`
- add `audit_logs`
- add indexes and soft-delete/status fields where needed

Current repo status:

- partial schema exists
- final production schema not implemented

## Phase 3 — Auth and Roles

Goal:

Support both admins and agents cleanly.

Tasks:

- implement role-based auth model
- create admin and agent login flows
- attach users to agents
- protect route groups by role
- add session expiry and token handling cleanup

Current repo status:

- admin auth exists
- agent auth does not exist

## Phase 4 — Admin Panel Completion

Goal:

Turn current admin screens into a real operations console.

Tasks:

- finish dashboard
- add admin user management
- improve agents/tracking/product CRUD UX
- add product approval states
- add analytics pages
- add report import UI
- add audit log UI

Current repo status:

- partial admin exists
- analytics/reporting incomplete

## Phase 5 — Agent Portal

Goal:

Replace Google Sheets with in-house workflow.

Tasks:

- agent dashboard
- ASIN submission form
- product submission status
- link generation screen
- own analytics screen
- own profile/settings if needed

Current repo status:

- not built yet

## Phase 6 — Product Ingestion Pipeline

Goal:

Make product creation reliable and operationally safe.

Tasks:

- ASIN validation endpoint
- fetch metadata from approved source
- duplicate reuse by `asin + marketplace`
- moderation states
- manual override fields
- re-fetch/refresh workflow

Current repo status:

- partial product fetch exists
- pipeline is not production-ready

## Phase 7 — New Public Frontend

Goal:

Build the actual branded affiliate site.

Tasks:

- remove cloned storefront direction
- create original homepage
- create original product page design
- create compliant bridge landing page design
- create legal/support pages
- keep site mobile-first and fast

Current repo status:

- public site exists
- direction is wrong and needs redesign

## Phase 8 — Sales Attribution

Goal:

Support real agent-level business reporting.

Tasks:

- define Amazon report import format
- implement report parser
- map `tracking_tag -> agent`
- aggregate orders/revenue/commission
- show per-agent and per-product sales metrics

Current repo status:

- not built
- currently only traffic analytics exist

## Phase 9 — QA, Compliance, Deployment

Goal:

Ship safely.

Tasks:

- full role-based route testing
- redirect correctness testing
- marketplace correctness testing
- analytics integrity checks
- compliance review checklist
- production deploy and smoke tests

---

## 11. Immediate Build Priorities

The best next implementation order inside the repo is:

1. fix bridge CTA and redirect tracking flow
2. redesign schema and create new migrations
3. add role-based `users` system
4. complete admin data model and screens
5. build agent portal
6. redesign public frontend away from the old clone
7. add Amazon report import and sales attribution

This order minimizes rework because:

- redirect correctness is a blocker for trustworthy analytics
- schema affects all future route and UI work
- auth/roles affect admin and portal design
- sales attribution depends on tracking ID discipline and import pipeline

---

## 12. Success Criteria

The project is complete when all of the following are true:

- agents no longer need Google Sheets
- agents can log in and get their own links
- admins can manage agents, products, and tracking IDs
- buyers see a fast, compliant landing page
- all CTA clicks are logged through the redirect engine
- the correct Amazon tracking ID is always injected
- sales can be reconciled per agent from Amazon reports
- the frontend is original and no longer a clone
- the full system runs under a clean, in-house workflow

---

## 13. Non-Negotiable Engineering Rules

- one canonical product row per `asin + marketplace`
- all buyer CTA clicks go through redirect route
- no public page should depend on Google Sheets
- no hardcoded secrets in repo
- no fake pricing
- no cloned UI direction
- no missing error/empty/loading states in portal/admin flows
- all important business records should be soft-delete or status-based

---

## 14. Final Direction Summary

The final system is:

- a custom Amazon affiliate platform
- owned and operated fully in-house
- agent-driven, not Google Sheet driven
- sales-attributable through Amazon tracking IDs
- fast through Cloudflare edge architecture
- compliant through clean bridge patterns and original content

The current repo is a strong foundation, but it still needs:

- flow correction
- schema evolution
- role expansion
- portal implementation
- frontend redesign
- sales attribution layer

That is now the official implementation direction.
