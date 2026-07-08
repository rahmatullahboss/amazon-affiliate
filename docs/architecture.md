# DealsRKY Architecture

This document explains how the DealsRKY Amazon affiliate platform is structured, how requests move through the system, and which files own the main business workflows.

## 1. System overview

DealsRKY runs as a single Cloudflare Worker application with two major layers:

```text
Cloudflare Worker
  -> Hono API for /api/* and /go/*
  -> React Router SSR for public/admin/portal pages
  -> D1 database for durable relational data
  -> KV for cache and redirect acceleration
  -> R2 for blog images
  -> Scheduled worker for blog publishing/generation and optional sheet sync
```

The Worker entrypoint is `workers/app.ts`. It decides whether an incoming request should go to the Hono API or React Router SSR.

## 2. Runtime request routing

`workers/app.ts` handles request dispatch in this order:

```text
Incoming request
  -> canonical public URL redirect check
  -> favicon redirect
  -> robots.txt response
  -> sitemap.xml response
  -> common bot probe protection
  -> /go/* fast path to Hono API
  -> /api/public/blog-images/* direct R2-backed image response
  -> /api/* to Hono API
  -> everything else to React Router SSR
```

Important behavior:

- `/go/*` is routed directly to the API because redirect latency matters.
- `/api/*` routes are handled by Hono in `server/api.ts`.
- Public pages, admin pages, and portal pages are handled by React Router.
- HTML responses receive no-cache/security headers before being returned.
- Unknown HTML routes redirect to `/` after SSR returns a 404.

## 3. Application layers

### 3.1 Frontend layer

Location: `app/`

Responsibilities:

- Public website pages
- Product/deal pages
- Agent storefronts
- Bridge pages
- Admin panel UI
- Agent portal UI
- Client-side utilities such as marketplace handling, public link generation, share links, and SEO helpers

Route ownership:

- Route definitions: `app/routes.ts`
- Public layout: `app/routes/public-layout.tsx`
- Admin layout: `app/routes/admin/layout.tsx`
- Portal layout: `app/routes/portal/layout.tsx`

### 3.2 API layer

Location: `server/routes/` and `server/api.ts`

Responsibilities:

- API routing and middleware
- Authenticated admin and portal APIs
- Public content APIs
- Redirect engine
- Webhooks
- Blog image responses
- Health check

`server/api.ts` mounts route groups and applies access control:

```text
Public:
  /api/health
  /go
  /api/page
  /api/auth
  /api/public
  /api/public/telegram
  /api/webhooks

Authenticated portal:
  /api/portal

Authenticated editor/admin content:
  /api/products
  /api/blogs
  /api/social-links

Authenticated admin-only:
  /api/agents
  /api/users
  /api/tracking
  /api/mappings
  /api/analytics
  /api/sheets
  /api/sheet-control
  /api/site-branding
  /api/audit-logs
```

### 3.3 Service layer

Location: `server/services/`

Responsibilities:

- Business logic
- Data mapping
- Product ingestion
- Editorial generation
- Blog management
- Analytics aggregation
- Sheet sync
- Google integration
- Amazon Creators API / RapidAPI fallback handling
- Cache helpers

Important services:

```text
analytics.ts             Analytics aggregation
audit-log.ts             Admin/user activity logging
auth.ts                  Password/session helpers
blog.ts                  Blog persistence and R2 image helpers
blog-generation.ts       AI-assisted blog generation and scheduled publishing
creators-api.ts          Amazon Creators API integration
product-ingestion.ts     ASIN normalization, product fetch, fallback chain, product upsert
product-editorial.ts     Editorial/review text generation helpers
sheet-control.ts         Agent sheet source control and scheduled sync orchestration
sheet-sync.ts            Google Sheet product import flow
site-branding.ts         Public site branding settings
social-links.ts          Public/social link settings
```

### 3.4 Data layer

Location: `migrations/`, Cloudflare D1 binding `DB`

The D1 database stores durable application data, including:

- users
- agents
- products
- tracking IDs
- agent-product mappings
- clicks
- page views
- analytics/reporting data
- blog posts
- site branding
- social links
- sheet sync configuration
- audit logs

Shared row types live in `server/utils/types.ts`.

### 3.5 Cache layer

Location: Cloudflare KV binding `KV`

KV is used for performance-sensitive cache data such as redirect context and other reusable lookup results. Cache writes should not be treated as source-of-truth writes. D1 remains the source of truth.

### 3.6 Asset layer

Location: Cloudflare R2 binding `BLOG_IMAGES`

R2 stores blog images. Public blog image responses are served through:

```text
/api/public/blog-images/*
```

The response helper is `createBlogImageResponse` in `server/services/blog.ts`.

## 4. Role model

Roles are defined in `server/utils/types.ts` and used by auth middleware.

```text
super_admin
admin
editor
agent
```

Current access model:

- `agent`, `admin`, and `super_admin` can access portal API routes.
- `editor`, `admin`, and `super_admin` can access content-management APIs such as products, blogs, and social links.
- `admin` and `super_admin` can access admin-only operations such as users, agents, tracking IDs, mappings, analytics, sheets, site branding, and audit logs.

Auth middleware lives in `server/middleware/auth.ts`.

## 5. Core business modules

## 5.1 Public affiliate frontend

Purpose:

- Present DealsRKY as an editorial/recommendation site.
- Provide product and category browsing.
- Show compliance-friendly Amazon CTA copy.
- Avoid presenting stale fixed Amazon pricing as authoritative.
- Expose disclosure, privacy, terms, about, and contact pages.

Important files:

```text
app/routes/home.tsx
app/routes/deals.tsx
app/routes/product-detail.tsx
app/routes/category.tsx
app/routes/blog.tsx
app/routes/blog-post.tsx
app/routes/disclosure.tsx
app/components/home/*
app/components/product/ImageGallery.tsx
app/utils/product-detail.ts
app/utils/seo.ts
```

## 5.2 Agent storefront and bridge flow

Purpose:

- Give each agent a public storefront/link surface.
- Route buyers through a compliant bridge page before Amazon.
- Track page views and CTA clicks.
- Resolve the correct product, agent, marketplace, and tracking tag.

Important files:

```text
app/routes/agent-storefront.tsx
app/routes/bridge.tsx
app/routes/bridge-legacy.tsx
app/routes/tracking-shortcut.tsx
server/routes/page.ts
server/routes/redirect.ts
server/services/dynamic-links.ts
server/services/public-slugs.ts
server/utils/url.ts
```

Bridge flow:

```text
Buyer opens /:agent/:country/:asin
  -> React Router loader resolves bridge data through D1/API helpers
  -> page view is recorded asynchronously
  -> page renders product/editorial context and Amazon CTA
Buyer clicks CTA
  -> browser requests /go/... or an equivalent redirect path
  -> redirect route checks bot/rate-limit protections
  -> redirect route resolves tracking context from KV or D1
  -> click analytics is recorded
  -> user receives 302 redirect to Amazon with tag
```

## 5.3 Redirect and tracking engine

Purpose:

- Resolve the Amazon destination URL.
- Inject the correct tracking tag.
- Keep redirect latency low.
- Reduce bot and duplicate-click noise.
- Preserve analytics quality.

Important files:

```text
server/routes/redirect.ts
server/middleware/bot-guard.ts
server/middleware/rate-limit.ts
server/services/analytics.ts
server/utils/types.ts
```

Expected redirect behavior:

```text
/go/* request
  -> bot detection
  -> rate limiting
  -> KV redirect context lookup
  -> D1 fallback lookup if cache miss
  -> KV warm/write for future requests
  -> async analytics insert/dedupe
  -> 302 redirect to Amazon
```

## 5.4 Admin operations panel

Purpose:

- Manage users, agents, products, tracking IDs, mappings, reports, analytics, blogs, branding, social links, and audit logs.

Important files:

```text
app/routes/admin/*
server/routes/users.ts
server/routes/agents.ts
server/routes/products.ts
server/routes/tracking.ts
server/routes/mappings.ts
server/routes/analytics.ts
server/routes/audit-logs.ts
server/routes/blogs.ts
server/routes/site-branding.ts
server/routes/social-links.ts
```

## 5.5 Agent portal

Purpose:

- Let agents work without relying on Google Sheets as the primary workflow.
- Submit ASINs.
- View approved products.
- Copy generated links.
- View traffic/performance information.

Important files:

```text
app/routes/portal/*
server/routes/portal.ts
app/utils/portal-links.ts
app/utils/portal-product-links.ts
```

## 5.6 Product ingestion

Purpose:

- Normalize ASIN input.
- Fetch product details from available product-data providers.
- Store product records in D1.
- Support both admin and portal workflows.

Important files:

```text
server/services/product-ingestion.ts
server/services/creators-api.ts
server/routes/products.ts
server/routes/portal.ts
server/services/sheet-sync.ts
```

Product fetch fallback chain:

```text
Manual/existing data
  -> WP bridge if configured
  -> Amazon Creators API if LWA credentials are configured
  -> RapidAPI/Amazon API keys if configured
  -> typed failure with AmazonProductFetchError
```

Important notes:

- `normalizeAsin`, `isValidAsin`, and `extractAsinFromInput` centralize ASIN parsing.
- `ensureProductRecord` is the main product upsert path.
- Creators API errors should be translated into the shared `AmazonProductFetchError` codes.
- If no product fetch provider is configured, `/api/health` reports degraded status.

## 5.7 Blog/content system

Purpose:

- Publish original editorial content.
- Improve Amazon Associates compliance posture.
- Support manual and scheduled/AI-assisted blog generation.

Important files:

```text
app/routes/blog.tsx
app/routes/blog-post.tsx
app/routes/admin/blogs.tsx
server/routes/blogs.ts
server/services/blog.ts
server/services/blog-generation.ts
```

Scheduled behavior:

```text
Hourly cron
  -> publish due scheduled blog posts
  -> attempt scheduled blog draft generation
```

## 5.8 Sheet sync compatibility

Purpose:

- Keep backward-compatible support for Google Sheet based imports where configured.
- Support master sheet / per-agent sheet source sync.
- Avoid treating Sheets as the long-term primary source of truth.

Important files:

```text
server/routes/sheets.ts
server/routes/sheet-control.ts
server/services/google-sheets.ts
server/services/sheet-control.ts
server/services/sheet-sync.ts
server/services/sheet-rows.ts
```

Scheduled behavior:

```text
Hourly cron
  -> if ASIN import is enabled
  -> verify Google service account credentials exist
  -> sync agent sheet sources
  -> sync configured master sheet if active
```

## 6. Data ownership and source of truth

```text
D1                    Durable source of truth
KV                    Cache/performance layer
R2                    Blog image storage
Amazon tracking IDs   Real sale attribution source after Amazon reports are available
Google Sheets         Optional import compatibility layer, not final source of truth
```

Business attribution rule:

- App-side clicks/views show traffic behavior.
- Real orders/commission require Amazon-side reports by tracking ID.
- If agents do not have separate tracking IDs, true agent-level sales attribution is limited.

## 7. Marketplace model

The production config currently lists these marketplaces:

```text
US, CA, UK, DE, IT, FR, ES
```

Marketplace-sensitive logic appears in:

```text
server/utils/types.ts
server/services/product-ingestion.ts
server/services/creators-api.ts
app/utils/marketplace.ts
app/components/MarketplaceSelector.tsx
```

Before enabling a new marketplace, confirm:

- Amazon domain mapping exists.
- Tracking tag exists.
- Product fetch provider supports the marketplace.
- Public copy and URLs are correct.
- Amazon Associates compliance requirements are satisfied.

## 8. Security and compliance boundaries

Important protections:

- Secure headers via Hono middleware.
- CSRF middleware for most routes.
- Auth middleware for protected APIs.
- Role-based access control.
- Bot/rate-limit checks for redirect routes.
- Reviewer-friendly `robots.txt` behavior.
- Amazon disclosure pages and CTA-adjacent disclosure copy.

Important compliance docs:

```text
docs/amazon-associates-content-checklist.md
docs/amazon-associates-live-review-runbook.md
```

## 9. Scheduled worker responsibilities

The scheduled handler in `workers/app.ts` runs hourly based on `wrangler.jsonc`.

Responsibilities:

```text
1. Publish due scheduled blog posts.
2. Attempt scheduled blog draft generation.
3. If ASIN import is enabled and Google credentials exist:
   - sync agent sheet sources
   - sync configured master sheet
```

Scheduled work should be idempotent. Failures should be logged without blocking unrelated scheduled tasks where possible.

## 10. Change safety guidelines

Before changing a workflow:

1. Identify whether the source of truth is D1, KV, R2, Amazon reports, or an external provider.
2. Check existing service helpers before creating a new utility.
3. Preserve existing role restrictions unless the product decision explicitly changes.
4. Add/update tests for changed service logic.
5. Update this document or `README.md` when changing core flows.

High-risk files:

```text
workers/app.ts
server/api.ts
server/routes/redirect.ts
server/services/product-ingestion.ts
server/services/creators-api.ts
server/services/sheet-sync.ts
server/middleware/auth.ts
server/utils/types.ts
migrations/*.sql
```

## 11. Recommended onboarding path

For a new developer or AI agent:

1. Read `README.md`.
2. Read this architecture document.
3. Read `docs/env.md`.
4. Read `implementation_plan.md` for product/business context.
5. Open `app/routes.ts` and `server/api.ts` to understand routing.
6. Open the specific route/service files for the feature being modified.
7. Run typecheck and relevant tests after code changes.
