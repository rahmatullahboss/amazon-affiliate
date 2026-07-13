# Admin Sheet Row Sync Design

## Goal

Provide an admin-only Google Sheet where adding one or many ASIN rows immediately imports only those rows, fetches Amazon product data only for products not already stored, assigns the marketplace site-primary admin tracking tag when the row leaves the tag blank, and writes generated DealsRKY links and status back to the same rows.

## Workbook

The workbook has the base tabs plus optional country-specific ASIN tabs:

- `New ASINs`: editable admin input and per-row output; marketplace is selected per row.
- `ASINs-US`, `ASINs-CA`, `ASINs-UK`, `ASINs-DE`, `ASINs-FR`, `ASINs-IT`: optional editable country tabs; marketplace is detected from the tab name, so admins do not need to select country per row.
- `Instructions`: concise operating instructions and field definitions.
- `Marketplaces`: protected reference data for the six supported marketplaces.

`New ASINs` columns:

1. `asin` — required ten-character ASIN.
2. `marketplace` — required dropdown: `US`, `CA`, `UK`, `DE`, `FR`, `IT`.
3. `tracking_tag` — optional; blank resolves to the active marketplace `is_site_primary` tag.
4. `custom_title` — optional.
5. `submit` — admin selects `YES` after completing the row.
6. `sync_status` — system output: `Pending`, `Processing`, `Live`, `Existing`, or `Failed`.
7. `product_title` — system output.
8. `bridge_page_url` — system output.
9. `storefront_url` — system output.
10. `redirect_url` — system output.
11. `order_link` — system output.
12. `resolved_tracking_tag` — system output.
13. `error_message` — system output.
14. `synced_at` — system output in ISO UTC.

## Immediate Sync

An installable Apps Script edit trigger watches `New ASINs` and the optional country tabs. It sends all edited rows whose `submit` value is `YES`, allowing pasted batches of 10, 20, 100, or more rows in one request. The Apps Script menu also provides bulk actions to mark the current tab or all country tabs as `YES`.

The webhook validates and processes each row independently:

- Existing `ASIN + marketplace`: reuse stored product data and make no Amazon provider call.
- Missing `ASIN + marketplace`: fetch once through Creators API, RapidAPI primary, RapidAPI fallback, then SerpAPI.
- Explicit tracking tag: require an active matching tag for the marketplace.
- Blank tracking tag: resolve the active marketplace site-primary tag.
- Create or update the `agent_products` mapping owned by the site-primary tag's admin agent.
- Return generated links and per-row status.

Apps Script writes the response into the output columns for the matching rows.

## Bidirectional Tracking Tag Sync

`tracking_tag` is the editable desired value, while `resolved_tracking_tag` stores the last tag confirmed by the website.

- After a successful sync, Apps Script writes the website-confirmed tag into both columns.
- When `tracking_tag` differs from the previous `resolved_tracking_tag`, the row may switch to an existing tag or create a new tag without renaming the previous global `tracking_ids` record.
- If a row already has a resolved tag, a new unknown tag is created for that same agent. If the row has no previous resolved tag, the website creates an active agent automatically using the normalized tag as its name and slug, then creates the tag for that agent.
- Existing inactive agents or tags are reactivated when the exact marketplace tag is submitted again.
- Wrapping quotes, smart quotes, zero-width characters, and outer whitespace are removed before a tag is matched; other invalid formats are rejected.
- When both values still match but that agent's live product mapping now points to a different website tag, the website value wins and is written back to the sheet. The sheet does not revert the website unless an admin intentionally edits `tracking_tag` so it differs from `resolved_tracking_tag`.
- Clearing a previously resolved tag resets the row to the marketplace site-primary tag.

## Reconciliation

The hourly scheduled reconciliation checks a rotating batch of up to 100 submitted rows and repairs missing product mappings, statuses, generated links, and website-to-sheet tracking-tag changes. The rotating cap prevents a large workbook from holding the Apps Script lock long enough to delay immediate ASIN edits. Existing products are never refreshed from Amazon during reconciliation. A provider call occurs only if a submitted ASIN is absent from the database.

## Failure Handling

Rows fail independently. Invalid ASINs, unsupported marketplaces, unavailable tags, and provider failures return a specific row error without blocking valid rows in the same batch. A batch is capped at 100 rows per webhook request; larger pastes are split by Apps Script.

## Security

The webhook requires `X-Webhook-Secret`. Product provider credentials stay in Cloudflare Worker secrets. The Sheet contains no API credentials except the Apps Script project property used for the webhook secret.

