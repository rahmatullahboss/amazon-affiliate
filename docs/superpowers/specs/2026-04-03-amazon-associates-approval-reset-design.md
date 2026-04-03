# Amazon Associates Approval Reset Design

## Goal

Restructure DealsRky so the public site reads as a transparent editorial recommendation site instead of a thin deals or coupon directory, while fixing the most visible Amazon Associates review blockers before pending applications are decided.

The system should:

- make Amazon-bound links easier for reviewers and users to verify
- keep affiliate disclosures visible at the point of action
- reduce signals that look like a generic scraped deals catalog
- strengthen original editorial value across the site
- preserve the current multi-market architecture without making it the primary public story

## Scope

This phase covers:

- public-facing compliance fixes on product, bridge, and policy pages
- reviewer and crawler access fixes for Amazon application review
- homepage, deals page, and product page positioning changes
- stronger disclosure and destination clarity near Amazon CTAs
- a written content model for approval-oriented editorial publishing
- a rollout order that prioritizes pending application survival

This phase does not cover:

- migrating to Amazon PA-API
- rebuilding the product ingestion pipeline
- automatic 24-hour product refresh logic
- redesigning the admin or portal applications
- changing the underlying multi-market tracking model

## Current State

DealsRky already has several good baseline signals:

- a dedicated disclosure page
- site-wide header and footer disclosure language
- public About, Contact, and Privacy pages
- Amazon-bound redirects using `302`
- no public fixed price display on the main product detail page

However, the public site still presents several review risks:

- Amazon review crawlers may be blocked from key redirect checks
- product CTA buttons do not clearly say the user is going to Amazon
- affiliate disclosure is not close enough to the main CTA on product-style pages
- homepage and listing copy still leans too far toward a deals-site identity
- the public catalog looks broad, fast-moving, and lightly editorialized
- the blog and product content volume is too thin for a strong editorial trust signal

## Recommended Strategy

Use an approval-first editorial reset with two layers:

1. Immediate visible compliance fixes
2. Editorial positioning and content strengthening

This is the fastest path that materially improves approval odds without waiting for a backend data-source migration.

The public message should become:

- DealsRky helps users research products
- DealsRky links users to Amazon for final pricing and checkout
- DealsRky discloses the affiliate relationship clearly
- DealsRky publishes original buying guidance, not just listings

## Design Principles

- prefer reviewer-visible fixes over backend purity in this phase
- make Amazon destination intent explicit before the click
- keep disclosures near the CTA, not only in global chrome
- avoid claims that imply live deals, coupon freshness, or verified best-price coverage
- reduce catalog sprawl signals and increase editorial-value signals
- keep language simple, specific, and non-promotional

## Compliance Fixes

### Reviewer Access

Amazon review traffic must be able to inspect the public site and confirm that outbound links resolve correctly.

Required changes:

- remove public blocking of `Amazonbot` from `robots.txt`
- relax redirect-path bot blocking so Amazon review traffic is not rejected when validating outbound flows
- keep abuse protection, but do not block legitimate review or compliance crawlers by default

Success condition:

- a reviewer or crawler can inspect public pages and verify that Amazon-bound links resolve successfully

### CTA Clarity

The current CTA language is too generic.

Required changes:

- replace `View Deal` with `View on Amazon` or `Check on Amazon`
- replace any secondary generic CTA copy with text that names Amazon directly
- add a short pre-CTA or post-CTA note that confirms the user is leaving DealsRky for Amazon

Success condition:

- a reviewer can understand the destination without needing to click or infer intent

### Inline Disclosure

Global disclosure is useful but not enough by itself.

Required changes:

- add a short disclosure directly beside or below the primary Amazon CTA on product detail pages
- add the same disclosure near the CTA on bridge pages
- keep the wording short and consistent

Recommended wording:

`Affiliate link. As an Amazon Associate, DealsRky earns from qualifying purchases.`

Success condition:

- the affiliate relationship is visible in close proximity to the outbound link

### Outbound Link Attributes

All Amazon-bound public links should use the same safe outbound-link treatment.

Required changes:

- use `rel="nofollow sponsored"` for public Amazon-bound links
- preserve redirect noindex behavior for internal redirect endpoints

Success condition:

- public outbound links consistently express affiliate/sponsored intent

### Terms Page

The public trust surface should include a basic Terms page.

Required changes:

- add a public `/terms` route
- link it from the footer policy section

The page only needs basic terms for:

- site usage
- informational content
- retailer responsibility
- no purchase contract on DealsRky
- contact path

## Public Positioning Reset

### Homepage

The homepage should stop sounding like a real-time deals engine.

Required changes:

- reduce phrases such as `best prices today`, `latest deals`, `live updates`, and similar urgency-led language
- foreground editorial phrases such as `buying guides`, `curated picks`, `research-backed recommendations`, and `shopping advice`
- present marketplaces as supported destinations, not the main value proposition
- introduce a short explanation of how DealsRky helps users evaluate products before buying on Amazon

Success condition:

- the homepage reads like an editorial recommendation brand, not a coupon or discount portal

### Deals Page

The deals index should become a catalog of picks rather than a promotional “all deals” board.

Required changes:

- rename the top-level page framing from `Shop All Deals` to a more editorial label
- remove or soften any copy that implies live bargain verification
- add an editorial intro that explains items are curated recommendations
- maintain category browsing, but frame it as research and discovery

Success condition:

- the listing page no longer over-promises live deal freshness

### Product Detail Pages

Product pages need stronger editorial structure and clearer commercial boundaries.

Required changes:

- keep product title, image, and marketplace
- preserve the editorial summary block
- add a small “why this might fit” or “what to check before buying” section when content is available
- place disclosure and destination clarity directly around the CTA
- keep reminding the user that pricing, shipping, and reviews are confirmed on Amazon

Success condition:

- each product page looks like a compact editorial recommendation page, not just a bridge to a retailer

## Content Strategy

Approval confidence depends heavily on visible original content.

Minimum publishing target for this phase:

- 10 to 15 original blog posts
- 20 to 30 manually reviewed public product pages

Each important product page should include some original editorial substance based on:

- who the product is for
- what stands out
- what tradeoff or buyer check matters
- what the user should verify on Amazon before purchase

Avoid:

- generic templated filler that reads the same across products
- fake urgency
- unsupported best-product claims
- coupon language unless the site truly maintains coupon quality and freshness

## Marketplace Strategy

The backend may support many marketplaces, but the public site should not lead with multi-market scale as the core pitch.

Rules for this phase:

- keep multi-market routing support intact
- do not position broad marketplace coverage as the main homepage promise
- verify each public marketplace path uses a valid site-primary tracking tag
- manually test the highest-traffic or currently applied marketplaces first

This lets the system stay flexible without turning the approval review into a broad compliance audit across every market at once.

## Rollout Order

Implementation should happen in this order:

1. reviewer access fixes
2. CTA text and inline disclosure fixes
3. outbound link attribute cleanup
4. Terms page
5. homepage and deals-page positioning rewrite
6. product-page editorial framing improvements
7. blog and public content expansion
8. deeper backend hardening later

## Verification Plan

Before claiming this phase is complete, verify:

- public pages remain accessible
- Amazon review traffic is not blocked
- product page CTA text explicitly names Amazon
- CTA-adjacent disclosure is visible on product and bridge pages
- outbound public Amazon links use `rel="nofollow sponsored"`
- the footer includes the new Terms page link
- homepage and deals page no longer overstate live deal coverage
- at least the first batch of editorial content is present and indexable
- major marketplace flows resolve to tagged Amazon URLs

## Risks And Mitigations

### Risk: compliance-only fixes without stronger content still fail review

Mitigation:

- treat content expansion as part of the same approval-reset effort, not as a later optional enhancement

### Risk: anti-bot logic still blocks reviewer validation

Mitigation:

- explicitly test reviewer-like access after changing crawler rules

### Risk: existing copy continues to imply a deals or coupon business model

Mitigation:

- audit homepage, deals page, product CTA text, and featured-section labels together rather than patching one page in isolation

## Out Of Scope Follow-Up

After the approval-reset phase, plan a second phase for deeper program hardening:

- official PA-API migration
- product freshness rules and stale-content handling
- stronger product content governance
- possible narrowing of niche or marketplace emphasis based on approval outcomes

