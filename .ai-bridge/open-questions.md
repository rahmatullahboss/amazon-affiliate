# Open Questions — DealsRky Monetization

## Remaining activation dependency
The code is verified and safely disabled. Live activation still requires the complete publisher-generated ad tag/code from the selected DealsRky publisher account.

## Exact input needed
Provide one of the following from the publisher dashboard, copied in full rather than only a zone ID:

- Adsterra: the exact generated Social Bar tag/code for the approved DealsRky domain; or
- Monetag: the exact generated standalone Vignette Banner tag/code for DealsRky.

Do not use Monetag MultiTag for this requirement because it includes Onclick/Popunder.

## Adapter decision after tag review
- If the complete tag is genuinely a single external `<script src="...">` and has no required inline config, companion script, service worker, or required extra attributes, it can use `ADS_TAG_ADAPTER=single-script-src` plus the exact source URL.
- If the complete tag has any additional required structure, keep `ADS_ENABLED=false` and implement a provider-specific exact adapter first.
- Do not invent a zone ID, guess attributes, copy another publisher's tag, or blindly extract only the script URL from a multi-part tag.

## Browser checks still dependent on the real tag
After the exact tag is available, verify in a non-production or controlled activation flow:
1. Network-native close/dismiss behavior.
2. No Popunder/new-tab ad behavior.
3. One injection attempt maximum in a browser tab session.
4. No ad runtime on tracking shortcuts, both bridge route shapes, admin, portal, or native Capacitor.
5. Immediate unwrapped Amazon CTA navigation.

No code verification blocker remains before obtaining the real tag.
