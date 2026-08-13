# Project Map — DealsRky Monetization

## Relevant architecture
- `app/routes.ts`: public, admin, portal, tracking shortcut, and Amazon bridge route definitions.
- `app/routes/public-layout.tsx`: shared Header/Footer wrapper and loader for all public routes; monetization is mounted here.
- `app/components/MonetizationAds.tsx`: client-side delayed, session-capped network script loader.
- `app/utils/monetization.ts`: typed environment parsing, provider selection, HTTPS URL validation, delay clamping, and conversion-route eligibility.
- `app/utils/native-auth.ts`: native Capacitor detection; web monetization is disabled in the native app.
- `app/utils/social-links.ts`: public-layout loader data shape, now also carrying monetization config.
- `wrangler.jsonc`: Cloudflare Worker variables for provider selection and publisher script URLs.
- `test/unit/monetization.test.ts`: pure unit coverage for configuration and route safety.
- `docs/monetization-ads.md`: operator activation and verification guide.

## Conversion-critical routes excluded from ads
- `/t/:trackingTag/:asin`
- `/:agent/:country/:asin`
- `/:agent/:asin`
- Admin and portal routes

## Eligible route policy
- Home and one-segment public pages/storefronts.
- Known content/deal two-segment routes under `/deals`, `/category`, and `/blog`.
- Unknown multi-segment routes default to no ads.
