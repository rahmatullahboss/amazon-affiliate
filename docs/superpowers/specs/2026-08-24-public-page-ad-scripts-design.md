# Public Page Ad Scripts Design

## Goal

Add the publisher-supplied popunder, native banner, and bottom-of-body ad scripts to DealsRky public browsing pages while keeping administrative, portal, redirect, and native-app experiences ad-free.

## Scope and boundaries

Ads are enabled only inside `app/routes/public-layout.tsx`, which owns the public route group. This covers the home, policy, blog, deals, category, product-detail, and public storefront pages currently registered under that layout.

The following paths remain untouched and must not load these ad scripts:

- Admin routes
- Portal routes
- Tracking and bridge/redirect routes
- Native Capacitor app runtime
- Amazon affiliate CTA and redirect behavior

No database, environment variable, deployment, DNS, or affiliate-tag changes are part of this work.

## Architecture

Create one focused `PublicAds` component module. It owns the exact publisher URLs and container identifier so the snippets cannot drift across pages. The public layout renders the banner immediately after the public header and renders the closing-body script after the public footer.

The popunder script is appended to `document.head` once after client hydration. This preserves the publisher's head placement without placing a global script in `app/root.tsx`. The body ad markup is rendered only after the runtime confirms that the page is not running inside Capacitor; this prevents a native webview from executing third-party ad scripts during server-rendered HTML hydration.

The component does not intercept links, wrap Amazon CTAs, delay navigation, or add provider configuration beyond the exact supplied URLs and `data-cfasync` attribute.

## Exact publisher inputs

- Popunder: `https://pl30967642.profitableratecpmnetwork.com/8b/f2/cb/8bf2cb651ba536569055a0e78deb5e0c.js`
- Native banner loader: `https://pl30967643.profitableratecpmnetwork.com/c4b4a3c619735916a8b2c83cf2ae6a65/invoke.js`
- Native banner container: `container-c4b4a3c619735916a8b2c83cf2ae6a65`
- Bottom-of-body loader: `https://pl30967644.profitableratecpmnetwork.com/27/9f/b2/279fb283fc6df4ba2e60428705c80920.js`

## Runtime behavior

- Each page document gets at most one popunder script element.
- The native banner loader and container are mounted once in the public layout.
- The bottom loader is mounted once immediately before the public layout closes.
- Third-party script failures are isolated to the ad component; the public page remains renderable because no page content depends on an ad load callback.
- During client-side navigation, the public layout remains the single ad boundary and does not duplicate scripts.

## Verification

Add focused unit coverage for the exact ad constants and native-runtime eligibility. Run the full existing unit suite, typecheck, and production build. Review the final diff to confirm that only the public ad module, public layout, focused test, and required project status/spec records changed; existing dirty extension files must remain untouched.
