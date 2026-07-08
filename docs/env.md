# Environment and Cloudflare Bindings

This document lists the runtime bindings, environment variables, and sensitive configuration used by DealsRKY.

Do not commit real credentials, private keys, tokens, or production secrets. Keep sensitive values in the deployment environment or Wrangler secret storage.

## 1. Cloudflare bindings

Configured in `wrangler.jsonc` and typed in `server/utils/types.ts`.

| Binding | Type | Purpose |
| --- | --- | --- |
| `DB` | D1 database | Durable application database. Stores users, agents, products, tracking IDs, mappings, clicks, views, blogs, reports, settings, and audit data. |
| `KV` | KV namespace | Cache/performance layer for redirect context and similar lookup data. D1 remains the source of truth. |
| `BLOG_IMAGES` | R2 bucket | Stores blog cover/content images. Served through `/api/public/blog-images/*`. |
| `AI` | Workers AI binding | Optional AI runtime binding for blog generation or future AI features. |

## 2. Public/runtime variables

These values can be configured as non-secret environment variables.

| Variable | Required | Purpose |
| --- | --- | --- |
| `ENVIRONMENT` | Yes | Runtime environment label such as `production`, `staging`, or `local`. |
| `SUPPORTED_MARKETPLACES` | Yes | Comma-separated marketplace list. Current production config uses `US,CA,UK,DE,IT,FR,ES`. |
| `PUBLIC_APP_URL` | Recommended | Canonical public origin used for redirects, sitemap, generated links, blog prompts, and public URLs. |
| `DEFAULT_AMAZON_TAG` | Recommended fallback | Generic default Amazon tracking tag. Used only when marketplace-specific or agent-specific tracking is not available. |
| `DEFAULT_AMAZON_TAG_US` | Marketplace-dependent | Default US tracking tag. |
| `DEFAULT_AMAZON_TAG_CA` | Marketplace-dependent | Default Canada tracking tag. |
| `DEFAULT_AMAZON_TAG_UK` | Marketplace-dependent | Default UK tracking tag. |
| `DEFAULT_AMAZON_TAG_DE` | Marketplace-dependent | Default Germany tracking tag. |
| `DEFAULT_AMAZON_TAG_FR` | Marketplace-dependent | Default France tracking tag. |
| `DEFAULT_AMAZON_TAG_ES` | Marketplace-dependent | Default Spain tracking tag. |
| `DEFAULT_AMAZON_TAG_IT` | Marketplace-dependent | Default Italy tracking tag. |
| `BLOG_IMAGES_PUBLIC_BASE_URL` | Optional | Public base URL for blog images if served through a custom public URL instead of the API route. |
| `BLOG_AI_PRIMARY_MODEL` | Optional | Primary AI model selection for blog generation. Empty value means service defaults/fallbacks decide. |
| `BLOG_AI_NEURON_DAILY_LIMIT` | Optional | Daily generation budget/limit used by blog generation logic. |
| `OLLAMA_CLOUD_BASE_URL` | Optional | External model provider base URL. |
| `OLLAMA_CLOUD_MODEL` | Optional | External model provider model name. |
| `LWA_CREATORS_SCOPE` | Optional | Amazon Creators API OAuth scope. Current config defaults to `creatorsapi::read`. |
| `TELEGRAM_BOT_TOKEN` | Secret in real deployments | Telegram bot token. It may appear as an empty placeholder in config, but real values must be secret-managed. |
| `TELEGRAM_WEBHOOK_SECRET` | Secret in real deployments | Telegram webhook secret. It may appear as an empty placeholder in config, but real values must be secret-managed. |

## 3. Secrets

These values should not be committed to the repository.

| Secret | Required | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | Yes | Signs/verifies application authentication tokens. `/api/health` warns if missing. |
| `ADMIN_USERNAME` | Optional/legacy | Optional admin bootstrap credential depending on seed/login workflow. |
| `ADMIN_PASSWORD` | Optional/legacy | Optional admin bootstrap credential depending on seed/login workflow. |
| `AMAZON_API_KEY` | Optional if LWA is configured | Primary RapidAPI/Amazon product-data key used by product ingestion fallback. |
| `AMAZON_API_KEY_FALLBACK` | Optional | Secondary product-data key used when the primary key fails or is rate-limited. |
| `ZYTE_API_KEY` | Optional if LWA/RapidAPI is configured | Zyte API key used as a lower-cost Amazon product-data fallback before RapidAPI/SerpApi. |
| `LWA_CLIENT_ID` | Optional if Amazon API key is configured | Login with Amazon client ID for Amazon Creators API product data. |
| `LWA_CLIENT_SECRET` | Optional if Amazon API key is configured | Login with Amazon client secret for Amazon Creators API product data. |
| `OLLAMA_CLOUD_API_KEY` | Optional | External model provider API key for blog generation fallback. |
| `RESEND_API_KEY` | Optional | Resend API key for password reset or email flows. |
| `RESEND_FROM_EMAIL` | Optional | Sender email address for Resend. |
| `RESEND_REPLY_TO` | Optional | Reply-to email address for Resend. |
| `GOOGLE_CLIENT_ID` | Optional | Google sign-in client ID. |
| `IP_SALT` | Recommended | Salt used when hashing IPs for analytics/privacy. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Optional | Google service account email for Google Sheets sync. Required only if sheet sync is enabled. |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Optional | Google service account private key for Google Sheets sync. Required only if sheet sync is enabled. |
| `SHEET_WEBHOOK_SECRET` | Optional | Secret for validating sheet-related webhook calls. |
| `TELEGRAM_BOT_TOKEN` | Optional | Required only for Telegram bot integration. |
| `TELEGRAM_WEBHOOK_SECRET` | Optional | Required only for Telegram webhook validation. |

## 4. Health-check expectations

The health endpoint is:

```text
GET /api/health
```

It reports `degraded` when important runtime requirements are missing.

Current health warnings include:

- `JWT_SECRET` missing.
- No Amazon product-fetch source configured.
- `DB` binding missing.
- `KV` binding missing.
- `BLOG_IMAGES` binding missing.

A valid product-fetch source exists when at least one of these is configured:

```text
LWA_CLIENT_ID + LWA_CLIENT_SECRET
ZYTE_API_KEY
AMAZON_API_KEY
AMAZON_API_KEY_FALLBACK
```

## 5. Product-data provider configuration

Product ingestion is handled mainly by `server/services/product-ingestion.ts` and `server/services/creators-api.ts`.

Provider order:

```text
1. Existing/manual product fields if provided by the caller.
2. WP bridge if configured in the ingestion path.
3. Amazon Creators API if LWA credentials are available.
4. Zyte API product extraction if `ZYTE_API_KEY` is available.
5. RapidAPI/Amazon API keys if available.
6. SerpApi Amazon Product fallback if configured by route/service.
7. Typed failure with AmazonProductFetchError.
```

Related variables:

| Variable | Purpose |
| --- | --- |
| `LWA_CLIENT_ID` | Enables Amazon Creators API token flow. |
| `LWA_CLIENT_SECRET` | Enables Amazon Creators API token flow. |
| `LWA_CREATORS_SCOPE` | OAuth scope for Creators API. |
| `ZYTE_API_KEY` | Zyte API product extraction key used before RapidAPI/SerpApi fallback. |
| `AMAZON_API_KEY` | Primary RapidAPI/Amazon product data key. |
| `AMAZON_API_KEY_FALLBACK` | Secondary product data key. |

If none of these provider credentials are configured, ASIN auto-fetch is disabled and `/api/health` reports a warning.

## 6. Marketplace tracking tags

Marketplace-specific default tags are configured through environment variables.

Current primary marketplace variables:

```text
DEFAULT_AMAZON_TAG_US
DEFAULT_AMAZON_TAG_CA
DEFAULT_AMAZON_TAG_UK
DEFAULT_AMAZON_TAG_DE
DEFAULT_AMAZON_TAG_FR
DEFAULT_AMAZON_TAG_ES
DEFAULT_AMAZON_TAG_IT
```

Important attribution rule:

- Default tags are fallbacks.
- Agent-level attribution should use agent-specific tracking IDs stored in D1.
- True Amazon-side order attribution depends on Amazon report data grouped by tracking ID.
- If multiple agents share one tracking ID, real sales attribution cannot be reliably split per agent.

## 7. Google Sheets configuration

Google Sheets support exists for backward compatibility and import workflows. It should not be treated as the final source of truth.

Related secrets:

```text
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
SHEET_WEBHOOK_SECRET
```

Related files:

```text
server/services/google-sheets.ts
server/services/sheet-sync.ts
server/services/sheet-control.ts
server/routes/sheets.ts
server/routes/sheet-control.ts
```

The scheduled worker only attempts sheet sync when import is enabled and Google service account credentials are present.

## 8. Blog generation configuration

Related variables/secrets:

```text
BLOG_AI_PRIMARY_MODEL
BLOG_AI_NEURON_DAILY_LIMIT
OLLAMA_CLOUD_BASE_URL
OLLAMA_CLOUD_API_KEY
OLLAMA_CLOUD_MODEL
AI
```

Related files:

```text
server/services/blog-generation.ts
server/services/blog.ts
server/routes/blogs.ts
app/routes/admin/blogs.tsx
```

The hourly scheduled worker publishes due scheduled blog posts and attempts scheduled blog draft generation.

## 9. Email configuration

Email/password-reset support is wired through Resend-related variables.

Related variables/secrets:

```text
RESEND_API_KEY
RESEND_FROM_EMAIL
RESEND_REPLY_TO
```

Related file:

```text
server/services/password-reset.ts
```

If these values are missing, password reset or email flows may fail even if the rest of the app is healthy.

## 10. Telegram configuration

Related variables/secrets:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
```

Related files:

```text
server/routes/telegram.ts
app/routes/admin/agents.tsx
```

Use empty placeholders in committed config only when necessary. Real tokens must be configured securely.

## 11. Local development notes

A local environment file may be used for development, but it should remain uncommitted.

Minimum useful local setup:

```text
JWT_SECRET
ENVIRONMENT
SUPPORTED_MARKETPLACES
PUBLIC_APP_URL
DEFAULT_AMAZON_TAG or marketplace-specific default tags
At least one product-data provider credential if testing ASIN auto-fetch
```

When testing Google Sheets, blog generation, email, or Telegram flows, add only the specific credentials needed for that feature.

## 12. Deployment checklist

Before deploying or handing over an environment, confirm:

- D1 database binding exists and migrations are applied.
- KV namespace binding exists.
- R2 blog images bucket binding exists.
- `JWT_SECRET` is configured.
- Product-data provider credentials are configured if ASIN auto-fetch is required.
- Marketplace default tags match the intended Amazon Associates account.
- Agent-specific tracking IDs exist for agent-level attribution.
- `PUBLIC_APP_URL` points to the final canonical domain.
- Amazon Associates compliance pages are public and linked.
- `/api/health` is healthy or any degraded warnings are understood.

## 13. Adding a new environment variable

When adding a new runtime value:

1. Add the type to `server/utils/types.ts`.
2. Add non-sensitive defaults/placeholders to `wrangler.jsonc` only if safe.
3. Keep sensitive values out of source control.
4. Update this document.
5. Add health-check warnings if the variable is required for a critical path.
6. Update tests for behavior that depends on the new variable.
