# Country And Category Template Engine Design

## Goal

Add a structured editorial content engine that varies bridge-page content by marketplace and product category without requiring a fresh Amazon API call for existing saved products.

The system should:

- generate more natural variation than a simple text spinner
- keep country-specific wording and category-specific emphasis
- support multiple reusable template variants per category group
- use existing saved product data by default
- let admin regenerate content for already-saved products
- avoid exposing the variation controls to agents

## Scope

This phase covers:

- replacing the current generic `review_content` generator
- introducing country-aware and category-aware template selection
- deterministic variant selection for stable output
- admin-triggered regeneration for existing products without re-fetching from the product API
- tests for template output and regeneration behavior

This phase does not cover:

- AI rewriting
- automatic batch regeneration for the whole catalog
- per-agent custom editorial content
- user-facing template editing UI

## Current State

Today content generation is centralized in `server/services/product-ingestion.ts`.

When a product is imported or updated:

- the system stores `title`, `category`, `description`, `features`, `product_images`, and `aplus_images`
- `buildEditorialReviewContent()` generates a very simple `review_content`
- bridge pages render product description and features directly, plus the generated review block

This produces consistent but repetitive content. It does not reflect marketplace differences or category-specific buying angles.

## Recommended Architecture

Use a structured template engine with four layers:

1. Category grouping
2. Country/marketplace tone rules
3. Template variant bank
4. Deterministic variant picker

The content engine will not rely on AI or live API refresh during regeneration. It will use the product fields already saved in D1.

## Data Inputs

The generator will use only existing product fields:

- `title`
- `marketplace`
- `category`
- `description`
- `features`

Optional future inputs can be added later, but this phase should work well even when only some of these fields are populated.

## Category Strategy

Categories coming from Amazon are noisy and inconsistent, so the generator should not depend on exact category names.

Introduce category normalization with a small set of editorial groups such as:

- `home`
- `kitchen`
- `cleaning`
- `beauty`
- `fashion`
- `electronics`
- `outdoor`
- `fitness`
- `baby`
- `pet`
- `generic`

Rules:

- normalize category text to lowercase
- match known keywords into one editorial group
- fallback to `generic` when no confident match exists

This keeps the template system stable even when imported category labels vary.

## Country Strategy

Templates should vary by supported marketplace:

- `US`
- `CA`
- `UK`
- `DE`
- `IT`
- `FR`
- `ES`

Each marketplace gets a small tone/profile definition, not a full separate content system.

Country rules can influence:

- phrasing style
- buying-note wording
- intro vocabulary
- compliance-safe closing language

Example intent:

- `US`: practical and benefit-driven
- `DE`: utility and build-quality framing
- `IT`: lifestyle and everyday-use framing
- `UK`: balanced value and convenience framing
- `FR`, `ES`, `CA`: localized variation but still English output unless current site behavior changes later

This keeps the system simple while still creating meaningful variation.

## Template Bank

Templates should be code-based configuration, not database-managed in this phase.

Each editorial group gets multiple structured variants. A variant is a set of sentence blocks, not a full freeform paragraph.

Recommended block structure:

- `intro`
- `fitFor`
- `featureLead`
- `closingNote`

The generator then assembles a review block from:

- one intro block
- one fit/use-case block
- up to 3 or 4 standout features
- one closing block

Benefits:

- more natural variation
- easier testing
- easier extension later
- less risk of low-quality spun copy

## Variant Selection

Use deterministic selection by default.

The same product should not randomly change text on every request. Instead, choose the variant from a stable seed based on fields such as:

- `asin`
- `marketplace`
- normalized category group

That gives stable output for a product unless regeneration is explicitly requested.

For admin regeneration:

- advance to the next variant for the same product
- persist the regenerated `review_content`
- do not change content on every page load

This makes the system look varied across the catalog while keeping page output stable.

## Content Assembly Rules

Generation order:

1. normalize marketplace
2. normalize category into editorial group
3. sanitize description and feature text
4. choose deterministic template variant
5. assemble review content
6. store result in `review_content`

Fallback rules:

- if description exists, use it as supporting context but not as the whole editorial block
- if features exist, use the strongest 3 to 4 clean features
- if no description exists, use title + category-aware intro
- if no features exist, use description-led copy
- if both are weak, produce a short generic fallback instead of blank content

The generator should avoid:

- fake claims
- price promises
- review-score summaries not present in saved data
- warranty or shipping claims

Closing language should remain safe, for example reminding the visitor to confirm current pricing, delivery, and reviews on Amazon.

## Regeneration Flow

Existing products should be regenerable without new API calls.

Admin-side behavior:

- add a `Regenerate Content` action on the admin products page
- the action calls a new protected API endpoint
- endpoint loads the saved product record
- endpoint rebuilds `review_content` from stored fields only
- endpoint updates `review_content` and `updated_at`
- endpoint returns the new content payload

Default behavior:

- no external product API request
- no feature/image refresh

Future extension can add an optional “refresh from Amazon first” flow, but it is out of scope for this phase.

## New Products Flow

For newly imported products:

- keep the current import flow
- after product fields are resolved, run the new template engine instead of the old review generator

This preserves the current ingestion model while improving the generated editorial layer.

## UI Changes

Admin products page:

- add a `Regenerate Content` button per product row/card
- show loading state while regenerating
- show success/error feedback
- keep the rest of the product-management flow unchanged

No agent-panel changes are required in this phase.

## Server Changes

Introduce a new content-template module, likely under `server/services/` or `server/content/`, with focused units:

- category normalization
- marketplace tone rules
- variant library
- deterministic variant selection
- final review content assembly

`server/services/product-ingestion.ts` should call this new module rather than holding all generation logic inline.

Add a protected endpoint under admin products routes for regeneration, following existing auth and response patterns.

## Testing

Required tests:

- country-aware output differs for the same base product data
- category-aware output differs across category groups
- unknown category falls back to `generic`
- regeneration updates `review_content` without calling the Amazon API
- product import still creates `review_content`
- deterministic generation stays stable for the same product seed
- admin regeneration changes the stored review content to another valid variant

## Rollout Plan

Recommended rollout:

1. ship the engine behind the existing content field
2. apply it automatically for new imports
3. allow admin to regenerate existing products one by one
4. evaluate content quality
5. add bulk regeneration later if needed

This keeps the change low-risk and avoids unnecessary API quota usage.

## Risks And Mitigations

### Risk: Variation still feels too similar

Mitigation:

- use structured variants per category group
- vary intros, fit/use-case blocks, and closing notes independently

### Risk: Category mapping is messy

Mitigation:

- normalize into broad editorial groups
- keep a `generic` fallback

### Risk: Regeneration creates unstable pages

Mitigation:

- deterministic default variant
- regeneration only when admin explicitly requests it

### Risk: Weak source data produces weak content

Mitigation:

- fallback logic for sparse descriptions and features
- keep output concise instead of forcing long low-quality copy

## Success Criteria

The feature is successful when:

- country-specific and category-specific content variation exists across bridge pages
- content generation does not require fresh API calls for existing products
- admin can regenerate saved product content manually
- output remains stable until regeneration is triggered
- bridge pages look less repetitive while staying accurate and compliance-safe
