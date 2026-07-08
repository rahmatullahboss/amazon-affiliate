# DealsRKY Amazon Affiliate Bridge

DealsRKY is a Cloudflare-native Amazon affiliate platform. It provides a public editorial storefront, agent-specific bridge links, an admin operations panel, and an agent portal for ASIN submission, link generation, and performance tracking.

This is not a generic e-commerce store. It is built around Amazon Associates compliance and tracking-ID based attribution.

## Core buyer flow

```text
Agent logs in
  -> submits or selects an ASIN
  -> receives a unique promotional link
Buyer opens the link
  -> sees a compliant DealsRKY landing or bridge page
  -> clicks View on Amazon
Redirect engine resolves product, agent, marketplace, and tracking tag
  -> sends buyer to Amazon with the correct tracking tag
Amazon reports later show orders by tracking ID
Admin reviews/imports reporting data for attribution
```

## Tech stack

- React 19 and React Router 7 for SSR/front-end routing
- Hono for the API layer
- Cloudflare Workers as the runtime
- Cloudflare D1 for relational data
- Cloudflare KV for redirect/cache data
- Cloudflare R2 for blog images
- Cloudflare Workers AI / external model provider hooks for blog generation
- Tailwind CSS 4 for styling
- Capacitor Android shell for mobile packaging
- Vitest for unit/API tests
- Playwright for browser/E2E tests

## Main folders

```text
app/                  React Router app, public pages, admin UI, portal UI
server/               Hono API routes, services, middleware, schemas, shared types
workers/              Cloudflare Worker entrypoint
migrations/           D1 database migrations
public/               Static public assets
scripts/              Seed/import/maintenance scripts
test/                 Unit, API, and Playwright tests
docs/                 Project documentation, specs, runbooks
_bmad-output/         Planning/test-design outputs from prior project workflow
android/              Capacitor Android project
```

## Important entrypoints

- Worker entrypoint: `workers/app.ts`
- API app: `server/api.ts`
- Front-end route config: `app/routes.ts`
- Cloudflare config: `wrangler.jsonc`
- Shared Cloudflare bindings/types: `server/utils/types.ts`
- Product ingestion/fallback logic: `server/services/product-ingestion.ts`
- Amazon Creators API integration: `server/services/creators-api.ts`
- Redirect engine: `server/routes/redirect.ts`

## Public routes

Defined in `app/routes.ts`:

```text
/                         Home
/deals                    Product listing
/deals/:asin              Product detail
/category/:slug           Category page
/blog                     Blog listing
/blog/:slug               Blog post
/about                    About page
/contact                  Contact page
/privacy                  Privacy policy
/disclosure               Affiliate disclosure
/terms                    Terms page
/t/:trackingTag/:asin     Tracking shortcut
/:agent                   Agent storefront
/:agent/:country/:asin    Country-aware bridge page
/:agent/:asin             Legacy bridge page
```

## Admin routes

```text
/admin/login
/admin
/admin/users
/admin/agents
/admin/products
/admin/sheet-control
/admin/product-submissions
/admin/tracking
/admin/mappings
/admin/analytics
/admin/reports
/admin/audit-logs
/admin/blogs
/admin/site-branding
/admin/social-links
```

Admin APIs are mounted under `/api` and protected by role-based middleware in `server/api.ts`.

## Agent portal routes

```text
/portal/login
/portal/register
/portal/google-external
/portal/forgot-password
/portal/reset-password
/portal/complete-signup
/portal
/portal/dashboard
/portal/asins/new
/portal/products
/portal/links
/portal/tracking
/portal/analytics
```

Portal APIs are mounted under `/api/portal` and require an authenticated `agent`, `admin`, or `super_admin` role.

## API route map

Public API routes:

```text
GET /api/health
/go/*                         Redirect engine
/api/page/*                   Bridge/page data endpoint
/api/auth/*                   Authentication
/api/public/*                 Public content APIs
/api/public/telegram/*        Telegram public endpoint
/api/webhooks/*               Webhooks
/api/public/blog-images/*     R2-backed blog image response
```

Protected API route groups:

```text
/api/portal/*                 Agent portal API
/api/products/*               Product/admin content API
/api/blogs/*                  Blog/admin content API
/api/social-links/*           Social links content API
/api/agents/*                 Admin-only agent API
/api/users/*                  Admin-only user API
/api/tracking/*               Admin-only tracking ID API
/api/mappings/*               Admin-only mapping API
/api/analytics/*              Admin-only analytics API
/api/sheets/*                 Admin-only sheet API
/api/sheet-control/*          Admin-only sheet-control API
/api/site-branding/*          Admin-only site-branding API
/api/audit-logs/*             Admin-only audit log API
```

## Local development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Run type checks:

```bash
npm run typecheck
```

Run unit/API tests:

```bash
npm run test
```

Run Playwright E2E tests:

```bash
npm run test:e2e
```

Build the app:

```bash
npm run build
```

Deploy:

```bash
npm run deploy
```

Before deploying, confirm Cloudflare bindings and environment values are configured for the target environment.

## Cloudflare resources

The Cloudflare config is in `wrangler.jsonc`.

Current bindings:

- `DB` — Cloudflare D1 database
- `KV` — Cloudflare KV namespace
- `BLOG_IMAGES` — Cloudflare R2 bucket
- `AI` — Cloudflare Workers AI binding

Cron trigger:

```text
0 * * * *
```

## Environment variables

See [`docs/env.md`](docs/env.md) for the full environment reference.

Sensitive values must be configured through the deployment environment or Wrangler secrets, not committed into source control.

## Product data ingestion

ASIN product ingestion is centralized in `server/services/product-ingestion.ts`.

The intended fallback chain is:

```text
Existing/manual product data
  -> WP bridge if configured
  -> Amazon Creators API if LWA credentials are configured
  -> RapidAPI/Amazon API fallback if configured
  -> typed AmazonProductFetchError on failure
```

The system is configured for these primary marketplaces:

```text
US, CA, UK, DE, IT, FR, ES
```

`server/utils/types.ts` also contains domain mappings for additional marketplaces such as `JP`, `IN`, and `AU`; only enable them after validating tracking IDs, UI copy, and compliance requirements.

## Database migrations

D1 migrations live in `migrations/`.

Review migration SQL before applying it to any remote database. Do not run destructive database operations without an explicit backup and approval.

## Testing documentation

See [`test/README.md`](test/README.md).

Current test scripts:

```bash
npm run test       # Vitest unit/API tests
npm run test:e2e   # Playwright E2E tests
```

Generated Playwright outputs such as `playwright-report/` and `test-results/` are test artifacts, not application source code.

## Compliance documentation

Amazon Associates related review docs:

- [`docs/amazon-associates-content-checklist.md`](docs/amazon-associates-content-checklist.md)
- [`docs/amazon-associates-live-review-runbook.md`](docs/amazon-associates-live-review-runbook.md)

Before Amazon Associates reapplication or appeal, run the live review checklist and save the evidence listed in the runbook.

## Architecture documentation

See [`docs/architecture.md`](docs/architecture.md) for system architecture, data flow, role model, and key service responsibilities.

## Existing planning/spec docs

Feature planning and design specs live under:

```text
docs/superpowers/plans/
docs/superpowers/specs/
_bmad-output/
```

These files are useful for historical decisions and feature context, but the current implementation should be verified against the actual source code before making changes.

## Development rules

Project memory files (`AGENTS.md`, `AGENT.md`, `CLAUDE.md`) contain safety and agent-development rules. Key rules:

- Follow existing project patterns.
- Avoid introducing duplicate utility functions without checking existing code.
- Use proper TypeScript types.
- Always handle loading, empty, and error states in UI work.
- Do not run destructive git, file, database, or deployment commands without explicit approval.

## Recommended handover reading order

1. `README.md`
2. `docs/architecture.md`
3. `docs/env.md`
4. `implementation_plan.md`
5. Relevant feature spec under `docs/superpowers/specs/`
6. Relevant source files under `app/` and `server/`
