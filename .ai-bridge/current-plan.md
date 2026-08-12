# DealsRky Monetization Ads Plan

## Goal
Add policy-conscious Adsterra/Monetag support to DealsRky without interrupting Amazon affiliate conversion routes.

## Approach
1. Add a typed public monetization configuration derived from Cloudflare Worker environment variables.
2. Support both Adsterra and Monetag, while activating only one provider at a time.
3. Load the selected provider's native external script only on eligible public content/deal pages.
4. Never inject ads on Amazon tracking/bridge redirect routes, admin routes, portal routes, or the native Capacitor app.
5. Delay ad loading and cap it to one successful load per browser tab session.
6. Do not intercept or delay Amazon CTA clicks; the ad network's native dismiss/close behavior remains responsible for the close button.
7. Add unit coverage for configuration parsing, HTTPS script validation, provider selection, delay clamping, and route eligibility.
8. Document how to activate the feature using the exact publisher-provided native Interstitial/Vignette/Social Bar script URL. Do not hardcode or invent publisher IDs.

## Verification
- Run targeted monetization unit tests.
- Run typecheck.
- Run build.
- Review diff for accidental bridge/CTA changes.

## Deployment
No production deployment unless explicitly requested by the user.
