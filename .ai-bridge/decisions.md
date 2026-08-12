# Decisions — DealsRky Monetization

## 2026-08-12
- Support both Adsterra and Monetag, but activate only one provider at a time to avoid stacking intrusive ads.
- Use only the publisher account's exact native external script URL; never invent or hardcode a zone ID.
- Prefer a native dismissible Interstitial/Vignette/Social Bar style format; do not use Popunder for the client's single-closeable-ad requirement.
- Protect Amazon conversion by default-denying monetization on tracking shortcuts and bridge/redirect routes.
- Do not intercept Amazon CTA clicks.
- Delay network script loading by 10 seconds by default and cap injection to one successful attempt per browser tab session.
- Do not load web monetization scripts inside the native Capacitor app.
- Keep the integration disabled until a real publisher script URL is configured.
- Do not deploy without an explicit deploy instruction.
