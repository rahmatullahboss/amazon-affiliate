# Active Context — Amazon Affiliate

> Updated: 2026-08-12
> Keep this file current so the next agent can continue without rediscovery.

## Current task

Add conversion-safe Adsterra/Monetag monetization support to DealsRky for the client's request for a single dismissible ad without disrupting Amazon affiliate conversions.

## Branch / worktree

- Active branch: `task/dealsrky-monetization-ads-20260812`.
- Base/default branch: `master`.
- No production deployment has been performed.
- Do not deploy or merge until verification is complete and the user explicitly requests deployment/merge.

## Implementation

- `app/utils/monetization.ts`
  - Typed Adsterra/Monetag provider configuration.
  - Only one provider can be active at a time.
  - Accepts HTTPS and protocol-relative publisher script URLs, normalizing the latter to HTTPS.
  - Default load delay: 10 seconds; allowed range: 3–60 seconds.
  - Protects conversion routes with a default-deny policy for unknown multi-segment routes.
- `app/components/MonetizationAds.tsx`
  - Delayed loading only while the page is visible.
  - At most one successful injection per browser-tab session.
  - No Amazon CTA interception or click wrapping.
  - Disabled in the native Capacitor app.
  - Monetag script targets document head; Adsterra script targets document body.
- `app/routes/public-layout.tsx`
  - Mounts monetization only inside the shared public layout.
- `app/utils/social-links.ts`
  - Public layout loader data includes monetization configuration.
- `wrangler.jsonc`
  - Adds `ADS_ENABLED`, `ADS_PROVIDER`, `ADSTERRA_SCRIPT_URL`, `MONETAG_SCRIPT_URL`, and `ADS_LOAD_DELAY_MS`.
  - Ads remain disabled by default.
- `test/unit/monetization.test.ts`
  - Covers provider selection, script URL validation/normalization, delay clamping, and route safety.
- `docs/monetization-ads.md`
  - Activation and production verification instructions.
- `.ai-bridge/*`
  - Plan, project map, decisions, open activation dependency, and status are documented.

## Conversion safeguards

Ads must not load on:
- `/t/:trackingTag/:asin`
- `/:agent/:country/:asin`
- `/:agent/:asin`
- admin routes
- portal routes
- native Capacitor app sessions

Amazon CTA clicks are not intercepted, delayed, or wrapped by the monetization integration.

## Activation dependency

Live ads are intentionally not enabled yet. Activation requires the exact publisher-generated native dismissible ad tag/script from the DealsRky Adsterra or Monetag account. Do not invent a zone ID or use another publisher's tag.

If the publisher tag contains required inline JavaScript in addition to an external `src`, adapt the integration to that exact tag rather than guessing its structure.

## Verification status

- GitHub source/diff review completed during implementation.
- The feature branch was confirmed ahead of and not behind `master` at the review point.
- Amazon CodexPro connector returned HTTP 502.
- Mac `local_dev` connector also returned HTTP 502.
- Because both executable workspace connectors were unavailable, `npm test`, `npm run typecheck`, and `npm run build` have not yet been run for this branch.

## Next concrete steps

1. Restore either project connector and run targeted monetization tests, full typecheck, and build.
2. Obtain the exact DealsRky publisher-generated dismissible Adsterra or Monetag tag/script.
3. Configure one provider and browser-verify the network-native close button, delayed loading, once-per-session behavior, and zero ad loading on conversion routes.
4. Merge/deploy only after verification and explicit instruction.
