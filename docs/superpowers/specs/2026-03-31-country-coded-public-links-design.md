# Country-Coded Public Links Design

## Goal

Make public links country-fixed in the path so the selected marketplace never resolves to another marketplace when the same ASIN exists for one agent in multiple countries.

## Canonical URLs

- Bridge page: `/:agent/:country/:asin`
- Redirect route: `/go/:agent/:country/:asin`
- Tracking shortcut stays `t/:trackingTag/:asin`, but it must resolve to the canonical bridge path with country included.

`country` is the normalized marketplace slug:

- `us`
- `ca`
- `uk`
- `de`
- `it`
- `fr`
- `es`

## Compatibility Rules

- Existing `/:agent/:asin` links must keep working.
- Existing `/go/:agent/:asin` links must keep working.
- Existing `?m=<MARKETPLACE>` query-param links must keep working.
- Legacy links should redirect to the canonical country-coded path instead of rendering directly.

## Resolution Rules

When a request already contains `:country`, that country is authoritative and must be used as the marketplace filter.

When a legacy request does not contain `:country`, marketplace resolution order is:

1. `?m=` query param if present and valid
2. Exact existing agent+asin mapping using that agent's stored/default marketplace selection
3. Dynamic link resolution fallback

Once the marketplace is resolved, the request should redirect to the canonical country-coded path.

## Data and Routing Impact

- Add new public routes for `/:agent/:country/:asin` and `/go/:agent/:country/:asin`
- Keep legacy routes in place only as redirect/compatibility entry points
- Update portal/admin/public URL generators to emit canonical country-coded links
- Update bridge, page API, redirect engine, and cache helpers to accept path marketplace input
- Preserve query-param handling for backward compatibility

## Error Handling

- If country slug is invalid, treat the route as not found and keep current public 404-to-homepage behavior
- If agent or ASIN cannot be resolved, keep current not-found behavior
- If legacy resolution cannot determine a valid marketplace, keep current fallback/not-found behavior

## Testing

- Canonical bridge URL renders the selected marketplace
- Canonical redirect URL sends users to the matching Amazon domain/tag
- Legacy bridge URLs redirect to canonical bridge URLs
- Legacy redirect URLs redirect to canonical redirect URLs
- Legacy `?m=` links still resolve correctly
- Tracking shortcut produces a canonical country-coded bridge URL

