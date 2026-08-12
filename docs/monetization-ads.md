# DealsRky Monetization Ads

## Purpose
DealsRky supports Adsterra and Monetag native ad scripts while protecting the Amazon affiliate conversion path.

## Safety behavior
- Only one provider is active at a time.
- The provider script loads only on public browsing/content pages.
- Amazon tracking shortcuts and agent bridge/redirect routes never load the ad script.
- Admin and portal routes never load the ad script.
- Native Capacitor app sessions never load the web ad script.
- Loading is delayed by 10 seconds by default.
- A successful injection is capped to one per browser tab session.
- DealsRky does not intercept, delay, or wrap Amazon CTA clicks.
- The close/dismiss control must come from the ad network's native dismissible format. Do not use Popunder for this requirement.

## Cloudflare variables
The integration is disabled by default.

- `ADS_ENABLED`: `true` to activate; otherwise disabled.
- `ADS_PROVIDER`: `adsterra` or `monetag`.
- `ADSTERRA_SCRIPT_URL`: exact HTTPS external script URL supplied by Adsterra for the chosen native dismissible format.
- `MONETAG_SCRIPT_URL`: exact HTTPS external script URL supplied by Monetag for the chosen native dismissible format.
- `ADS_LOAD_DELAY_MS`: delay before the script loads; default `10000`, clamped between `3000` and `60000`.

## Recommended formats
Use the publisher dashboard's native dismissible Interstitial, Vignette, or Social Bar/In-Page style format that provides its own close/dismiss behavior. Avoid Popunder because it adds a new-tab interruption to the affiliate journey.

## Activation example
For Adsterra, set `ADS_PROVIDER=adsterra`, set the exact publisher-generated `ADSTERRA_SCRIPT_URL`, then set `ADS_ENABLED=true`.

For Monetag, set `ADS_PROVIDER=monetag`, set the exact publisher-generated `MONETAG_SCRIPT_URL`, then set `ADS_ENABLED=true`.

Do not invent a zone ID or copy another publisher's script. Activation requires the exact script URL from the DealsRky publisher account.

## Verification before production
1. Confirm only one network script is present in the browser DOM.
2. Confirm the ad appears only after the configured delay.
3. Close the ad using the network-native close control.
4. Confirm it does not appear again in the same tab session.
5. Confirm `/t/...`, agent bridge routes, admin, portal, and native app do not load the script.
6. Confirm `View on Amazon` continues immediately without ad interception.
