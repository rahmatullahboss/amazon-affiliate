---
title: Telegram Agent Bot (Curated Catalog)
date: 2026-04-12
status: Proposed
---

# Telegram Agent Bot (Curated Catalog)

## Goal
Provide a Telegram DM-only bot where each agent sees only the admin-approved product list, can view country + order requirement, and gets an agent-specific order link.

## Non-Goals
- No group/channel broadcast.
- No open/public catalog.
- No order tracking workflow.
- No admin approval or publishing from Telegram.

## Approach Summary
Use a Telegram webhook in the Worker. Agents bind themselves via a one-time code. The curated list is the existing agent↔product mappings. Telegram replies show product detail and a direct agent bridge link.

## Data Model Changes
### Agents
- `telegram_chat_id` (TEXT, nullable)
- `telegram_bind_code` (TEXT, nullable, short code)

### Products
- `order_requirement` (TEXT, nullable)

No new catalog table. Mappings already define the approved list.

## Bot UX
### Bind Flow
1. Agent receives a bind code from admin.
2. Agent sends: `/start CODE`
3. Bot validates code, binds `telegram_chat_id`, clears code, confirms.

### Commands
- `/products` -> list curated products (paginated).
- `/products <country>` -> list curated products filtered by marketplace.
- Product selection -> detail + `Get Order Link` button.

### Product Detail
- Title
- Image (if available)
- Marketplace/country
- Order requirement
- CTA button -> agent-specific bridge link

## Admin UX
### Agents Page
- Button to generate bind code.
- Read-only display of bound `telegram_chat_id`.

### Products Page
- `order_requirement` field in product edit.

### Mappings Page
No change. Approved list is already defined by mappings.

## Link Resolution
Agent-specific link is built using:
- agent slug (or marketplace-specific alias slug if available)
- marketplace code
- product ASIN

Preferred route:
`https://dealsrky.com/{publicSlug}/{country}/{asin}`

## API / Routing
### New public endpoint
`POST /api/public/telegram/webhook`
- Verifies `x-telegram-bot-api-secret-token`
- Parses message
- Routes commands

### New internal helpers
- `findAgentByBindCode`
- `bindChatIdToAgent`
- `listMappedProductsForAgent`
- `buildAgentProductLink`

## Security
- Webhook secret enforced.
- Chat must be bound to an agent.
- Bind code is single-use and cleared after success.
- Only DM supported; ignore groups/channels.

## Error Handling
- Invalid code: reply with a short error.
- Unbound chat: prompt `/start CODE`.
- No products: show empty state guidance.
- Missing marketplace data: omit filter and show fallback list.

## Testing
- Bind code success and failure paths.
- Webhook secret validation.
- Product list pagination and filter.
- Link generation uses correct slug and marketplace.

## Rollout
1. Migration to add columns.
2. Deploy bot endpoint with secret unset (safe).
3. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET`.
4. Configure webhook URL.

