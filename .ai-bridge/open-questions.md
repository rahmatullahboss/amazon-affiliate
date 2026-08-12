# Open Questions — DealsRky Monetization

## Activation dependency
The code integration supports both networks, but live activation still requires the exact publisher-generated native ad tag/script for DealsRky.

Needed before enabling production ads:
- Choose the first active provider: Adsterra or Monetag.
- Copy the exact dismissible Social Bar/Interstitial/Vignette tag from that publisher account.
- If the generated tag is a normal external `<script src="...">`, configure that HTTPS/protocol-relative source URL.
- If the publisher tag contains required inline JavaScript rather than only an external script source, adapt the integration to that exact tag instead of guessing its structure.

No publisher ID or tag should be invented.
