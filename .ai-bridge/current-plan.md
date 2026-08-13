# DealsRky Monetization Ads Plan

## Goal
Add conversion-safe Adsterra/Monetag monetization to public DealsRky browsing/content pages without carrying ad runtime into Amazon bridge/tracking routes, private routes, or the native app.

## Implemented approach
1. Keep ads disabled by default and support exactly one selected provider at a time.
2. Require an explicit supported tag adapter (`single-script-src`) in addition to provider and exact script URL.
3. Load only on monetization-eligible public routes after a default 10-second delay.
4. Deny tracking shortcuts, both agent bridge route shapes, admin, portal, and native Capacitor sessions.
5. Enforce one injection attempt per browser tab session across providers; fail closed when tab storage is unavailable and do not retry after script failure.
6. Preserve provider placement: Monetag Vignette-style script in `head`, Adsterra Social Bar-style script at `body` end.
7. Keep Amazon affiliate CTAs untouched.
8. Use hard document navigation when public UI crosses into protected bridge/admin/portal routes so previously loaded third-party runtime cannot persist through SPA navigation.
9. Keep activation blocked until the complete real publisher-generated tag is inspected. If it is multi-part, inline-configured, or requires extra attributes, implement that exact adapter rather than extracting a guessed script URL.
10. Keep docs, tests, and `.ai-bridge` state aligned with executable verification.

## Verification completed — 2026-08-13
- `npx vitest run test/unit/monetization.test.ts`: 21/21 passed.
- `npm test`: 52/52 test files, 294/294 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- Source review confirms the `View on Amazon` CTA remains a direct anchor and is not intercepted by monetization code.
- PR #2 remains open/draft against `master`; no merge or production deploy performed.

## Remaining activation dependency
Obtain the complete publisher-generated tag from the chosen DealsRky Adsterra or Monetag account. Production ads remain OFF until its exact structure is verified and browser-level provider behavior is checked.

## Deployment gate
Do not merge or deploy automatically. The verified code can remain safely disabled while the real publisher tag is pending.
