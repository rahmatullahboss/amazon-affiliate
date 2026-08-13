# Decisions — DealsRky Monetization

## 2026-08-12
- Support both Adsterra and Monetag, but activate only one provider at a time.
- Use only the DealsRky publisher account's exact generated tag/code; never invent or hardcode a zone ID.
- Use a dismissible non-Popunder format. Prefer Adsterra Social Bar or Monetag Vignette for the current requirement.
- Protect Amazon conversion by default-denying monetization on tracking shortcuts and bridge/redirect routes.
- Do not intercept, delay, or wrap Amazon CTA clicks.
- Default ad load delay is 10 seconds.
- Do not load web monetization scripts inside the native Capacitor app.
- Keep the integration disabled until the real publisher tag is configured and verified.
- Do not deploy automatically.

## 2026-08-13 adversarial hardening
- The session cap is global per browser tab, not per provider. Changing provider cannot create a second injection attempt in the same tab.
- The session claim is retained after script failure; failure does not authorize a retry on another route.
- If tab-scoped storage is unavailable, monetization fails closed.
- Activation requires `ADS_TAG_ADAPTER=single-script-src`; provider + script URL alone is intentionally insufficient.
- `single-script-src` may be selected only when the complete real publisher tag is actually a single external script source with no required inline config, companion script, service worker, or required extra attributes.
- If the real tag has any other structure, implement a provider-specific exact adapter before enabling. Do not blindly extract `src`.
- Public-to-protected navigation uses document reload where third-party runtime persistence would otherwise cross into bridge/admin/portal routes.
- Use `WorkerBindings = Env & Bindings` at the Worker boundary so Cloudflare-generated bindings and the application's runtime binding contract are both represented without unsafe type casts.
- Monetag MultiTag is not acceptable for this requirement because it includes Onclick/Popunder. Use a standalone non-Popunder format instead.
