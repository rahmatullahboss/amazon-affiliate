# Active Context — DealsRky Monetization Ads

## Branch
`task/dealsrky-monetization-ads-20260812`

## Current state
Monetization implementation has been adversarially reviewed and executable verification is green. Ads remain OFF pending the complete real publisher-generated tag/code and browser verification of the selected format.

## Verified behavior
- Supports Adsterra and Monetag with only one selected provider active.
- Requires `ADS_TAG_ADAPTER=single-script-src` in addition to provider and exact script URL.
- Ads default OFF.
- Default load delay is 10 seconds.
- Maximum one injection attempt per browser tab session across providers.
- Session-storage failure fails closed; script-load failure does not permit retry.
- Public browsing/content routes are eligible.
- Tracking shortcut and both agent bridge route shapes are blocked.
- Admin/portal are separate non-ad layouts; public links into them hard-navigate to prevent third-party SPA runtime carry-over.
- Agent storefront product links hard-navigate into protected bridge routes for the same reason.
- Native Capacitor app does not inject web ads.
- Amazon CTA code is untouched and not intercepted/wrapped by monetization.
- No fake zone IDs or publisher scripts are committed.

## Exact-tag safety
The current adapter may be used only when the complete publisher-generated tag is actually a single external script source and does not require inline config, companion scripts, service-worker setup, or required extra script attributes. If the real tag differs, keep ads disabled and implement its exact structure.

For the current non-Popunder requirement:
- Adsterra: prefer Social Bar.
- Monetag: prefer standalone Vignette Banner.
- Do not use Monetag MultiTag because it includes Onclick/Popunder.

## Verification — 2026-08-13
- Monetization targeted tests: 21/21 passed.
- Full `npm test`: 52/52 test files, 294/294 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.

Non-failing test warnings remain around the existing Workers test harness/AI remote binding/listener teardown; there are no failed tests.

## Type boundary fix
Clean Wrangler type generation exposed a pre-existing mismatch between generated `Env` and the application's manual `Bindings`. The Worker entry now uses `WorkerBindings = Env & Bindings`, and monetization vars are declared in the application binding contract. Typecheck passes without unsafe double casts.

## PR #2
`feat: add conversion-safe Adsterra/Monetag monetization` remains open and draft against `master`. GitHub reported it mergeable at review time. It has not been merged or deployed.

## Remaining input
Obtain the full generated tag/code from the chosen DealsRky Adsterra or Monetag publisher account. Do not enable production ads until that exact tag has been reviewed against the adapter and browser-verified.
