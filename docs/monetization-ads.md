# DealsRky Monetization Ads

## Purpose
DealsRky supports Adsterra and Monetag on public browsing/content pages while keeping Amazon conversion, private web routes, and the native Capacitor app free of ad injection.

## Safety contract
- Ads are OFF by default.
- Exactly one provider can be active: `adsterra` or `monetag`.
- The default load delay is 10 seconds.
- At most one ad-script injection attempt is allowed per browser tab session, regardless of provider.
- If `sessionStorage` is unavailable, injection fails closed.
- A failed network/script load keeps the tab-session claim and is not retried on another route.
- The loader never intercepts, wraps, or delays Amazon CTA clicks.
- `/t/:trackingTag/:asin`, `/:agent/:country/:asin`, and `/:agent/:asin` are denied by the monetization route gate.
- Admin and portal routes use separate layouts and never mount the monetization loader.
- Public links that cross into bridge, admin, or portal routes use document navigation where needed so an already-running third-party ad runtime cannot survive an SPA transition into a protected route.
- Native Capacitor sessions never inject the web ad script.
- Use the network's own close/dismiss behavior. Do not use Popunder.

## Supported provider formats
For the current conversion-safety requirement, use a dismissible non-Popunder format only.

- Adsterra: prefer the exact publisher-generated Social Bar code for the approved DealsRky domain. Adsterra documents Social Bar placement immediately before the closing `</body>` tag.
- Monetag: prefer a Vignette Banner tag. Monetag documents Vignette placement in the document `<head>` and the format provides native Close/Continue controls.
- Do not use Monetag MultiTag for this integration because MultiTag includes Onclick/Popunder among its formats.

## Exact-tag adapter rule
The current runtime adapter is deliberately explicit: `single-script-src`.

Set `ADS_TAG_ADAPTER=single-script-src` only after inspecting the real DealsRky publisher-generated tag and confirming that the required integration is a single external script source with no required inline configuration, companion script, service worker, or additional required script attributes.

If the generated tag contains inline JavaScript, required attributes, multiple scripts, a service worker, or any other structure beyond that supported shape, do not extract only the `src` and do not enable ads. Keep ads OFF and implement a provider-specific adapter that reproduces the exact publisher tag structure safely.

This matters in particular for publisher code that carries network-specific attributes. The application must not guess or synthesize those attributes.

## Cloudflare variables
The committed configuration remains disabled:

- `ADS_ENABLED`: `true` only after the remaining activation checks are complete; otherwise disabled.
- `ADS_PROVIDER`: `adsterra` or `monetag`.
- `ADS_TAG_ADAPTER`: currently only `single-script-src` is accepted.
- `ADSTERRA_SCRIPT_URL`: exact HTTPS/protocol-relative script source from the approved DealsRky Adsterra tag.
- `MONETAG_SCRIPT_URL`: exact HTTPS/protocol-relative script source from the approved DealsRky Monetag tag.
- `ADS_LOAD_DELAY_MS`: default `10000`, clamped between `3000` and `60000`.

A provider and URL are not sufficient by themselves. Activation also requires the explicit supported tag adapter.

## Activation checklist
1. Choose exactly one provider and a non-Popunder dismissible format.
2. Copy the complete generated tag from the DealsRky publisher account.
3. Compare the full generated tag against the supported adapter contract above.
4. If it is not a supported single-external-script tag, leave ads disabled and implement the exact adapter first.
5. Configure the selected provider, adapter, exact script URL, and delay.
6. Set `ADS_ENABLED=true` only after browser verification.
7. Confirm one ad injection attempt maximum per tab session.
8. Confirm the provider-native close/dismiss control works.
9. Confirm `/t/...`, both agent bridge route shapes, admin, portal, and the native app remain ad-free.
10. Confirm `View on Amazon` and other affiliate CTAs navigate immediately with no interception or wrapper.

## Executable verification
Verified on 2026-08-13 on `task/dealsrky-monetization-ads-20260812`:

- `npm test`: 52 test files passed, 294 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- Monetization unit coverage: 21 tests passed.

The Vitest run emits existing non-failing worker/AI binding, listener-count, and teardown warnings; the command exits successfully with no failed tests.

## Production gate
No production ad activation should occur until the exact publisher-generated tag is supplied and its full structure is verified against the adapter. No fake Zone ID, guessed script, or copied code from another publisher account is acceptable.
