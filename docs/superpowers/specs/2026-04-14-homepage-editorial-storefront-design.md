# Homepage Editorial Storefront Design

## Goal

Redesign the public homepage so it feels like an editorial storefront instead of a text-heavy catalog dashboard. The page should become more image-led, remove repetitive deal labels, and present homepage products as curated picks rather than stacked list widgets.

## Scope

This redesign is limited to the public homepage at [app/routes/home.tsx](/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate/app/routes/home.tsx). It does not change homepage data loading, product feed logic, blog ranking, or marketplace detection. It only changes layout, hierarchy, copy density, and the presentation of existing homepage content.

## Problems To Fix

1. The current hero is too text-heavy and uses multiple small boxes, which makes the page feel busy instead of premium.
2. The homepage repeats similar concepts with multiple headings like "Trending Deals", "Latest Deals", and "Top 10 Deals Today".
3. The current "Top 10 Deals" area is rendered as a simple text list without images, which feels weak compared to the rest of the page.
4. The right sidebar stacks several boxed modules that compete for attention and make the page feel like an admin or feed page instead of a consumer-facing storefront.

## Chosen Direction

Use an editorial magazine-style storefront:

- A single strong hero with a large visual block, sharper headline, shorter support copy, and minimal supporting chips.
- A photo-first curated products section as the main body.
- Removal of repeated labels such as "Trending Deals", "Latest Deals", and "Top 10 Deals".
- Replacement of text-only product lists with media cards that show product images.
- A more intentional visual hierarchy, with fewer sections and less box noise.

## Layout Plan

### Hero

Replace the current intro and duplicate promo banner treatment with one primary hero section:

- Left side:
  - small editorial eyebrow
  - one strong headline
  - one short paragraph
  - two CTAs: primary to `/deals`, secondary to `/blog`
- Right side:
  - one large image-led feature panel
  - one small overlay stat or trust note
- Remove the grid of three small hero bullets.
- Remove the quick-access links block beneath the hero.

### Main Product Discovery

Keep the primary product grid, but reframe it as curated homepage picks:

- Remove section titles that reference "latest", "trending", or "top 10".
- Reduce explanatory copy and avoid repeated headings above multiple product blocks.
- Keep product cards image-led and buyer-friendly.
- Preserve current feed behavior and links.

### Sidebar / Secondary Discovery

Simplify the current sidebar:

- Remove the standalone "Trending Deals" list block.
- Replace the current "Top 10 Deals Today" text list with image-backed compact cards or photo media rows.
- Keep useful support modules only if they still help the page:
  - email subscription can remain if visually simplified
  - share box can remain if visually simplified
  - marketplace scope box should be reduced or merged if it still feels repetitive

### Blog / Editorial Area

Keep the featured article block and supporting articles, because they fit the editorial storefront direction. This section should visually align with the new homepage tone rather than feel detached from the hero.

## Content Rules

- Remove the following homepage labels:
  - "Trending Deals"
  - "Latest Deals"
  - "Top 10 Deals"
  - "Top 10 Deals Today"
- Avoid creating new sections that repeat the same idea with different wording.
- Prefer one strong section title over multiple stacked promotional headings.
- Keep CTA copy concrete and shopper-facing.

## Visual Direction

- Photo-first and editorial, not dashboard-like.
- Fewer boxes, fewer badges, less repeated chrome.
- Stronger image presence in hero and secondary deal modules.
- Cleaner spacing and larger visual rhythm between major sections.
- Preserve the existing DealsRky visual language and color palette rather than introducing a disconnected design system.

## Technical Constraints

- Reuse existing homepage loader data and derived homepage sections.
- Avoid changing backend code unless the redesign absolutely needs new fields.
- Prefer refactoring presentation within [app/routes/home.tsx](/Users/rahmatullahzisan/Desktop/Dev/Amazon affiliate/app/routes/home.tsx), and extract small homepage-only display helpers only if the file becomes harder to manage.
- Maintain responsive behavior for mobile and desktop.

## Testing Expectations

- Validate that removed labels no longer appear in homepage render.
- Validate that the top deals area shows image-backed items instead of plain text-only list rows.
- Validate that homepage still links correctly to deals, blog, and product detail destinations.
- Verify mobile layout for hero and compact product rows.

## Success Criteria

- Homepage feels visually lighter and more premium.
- Hero looks intentional and no longer reads like stacked marketing copy in boxes.
- Duplicate section naming is gone.
- Top deals presentation includes product imagery.
- The page remains fully functional with existing feed data and links.
