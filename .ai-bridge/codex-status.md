# Codex Status — DealsRky Monetization

## Status
Ad monetization hardening is implementation-verified on `task/dealsrky-monetization-ads-20260812`. Ads remain disabled pending the exact DealsRky publisher-generated tag and browser verification of the selected network format.

## Adversarial review findings fixed
- Replaced provider-specific session keys with one global per-tab claim so switching providers cannot produce a second injection in the same tab session.
- Script-load failure no longer clears the claim, preventing retry on a later route.
- `sessionStorage` failure now fails closed instead of weakening the one-per-tab guarantee.
- Added an explicit `ADS_TAG_ADAPTER` gate. Provider + URL alone cannot enable ads.
- The only current adapter is `single-script-src`; multi-part/inline/attribute-dependent publisher tags must not be reduced to a guessed URL.
- Agent storefront product links now use document navigation into protected bridge routes so previously loaded third-party runtime cannot survive an SPA transition.
- Public Header links to portal/admin use document navigation for the same isolation reason.
- Added the monetization variables to the application binding contract.
- Resolved clean type-generation mismatch by using `WorkerBindings = Env & Bindings` at the Worker boundary rather than unsafe casts.
- Added/updated monetization tests for the explicit adapter gate.

## Safety properties verified in source
- Adsterra and Monetag are supported but only one configured provider is selected.
- Ads default OFF in committed Wrangler config.
- No zone ID or publisher script is hardcoded.
- Public browsing/content routes can load ads; `/t/:trackingTag/:asin`, `/:agent/:country/:asin`, `/:agent/:asin`, admin, portal, and native Capacitor are denied/not mounted.
- `View on Amazon` remains a direct anchor; monetization has no click interceptor/wrapper.
- Default delay remains 10 seconds.
- Maximum one injection attempt per browser tab session across providers.
- Provider-native close/dismiss behavior is required; Popunder is explicitly excluded operationally.

## Verification — 2026-08-13
- `npx vitest run test/unit/monetization.test.ts`: PASS — 21/21 tests.
- `npm test`: PASS — 52/52 test files, 294/294 tests.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- Vitest emits non-failing worker/AI binding, listener-count, and teardown warnings; command exit status is successful with zero failed tests.

## PR #2
- Title: `feat: add conversion-safe Adsterra/Monetag monetization`
- Base: `master`
- Head: `task/dealsrky-monetization-ads-20260812`
- State at review: OPEN, DRAFT, GitHub reports mergeable.
- No merge and no production deployment performed.

## Live activation dependency
Provide the complete publisher-generated tag from the selected DealsRky account, preferably Adsterra Social Bar or Monetag Vignette for the current non-Popunder requirement. If the exact tag is not a plain supported single external script source, implement its exact structure before enabling.

## Readiness
Code verification is green and the feature remains safely disabled. It is suitable to continue PR review/merge as disabled infrastructure, but live ad activation is not ready until the real tag is supplied and browser-tested.
