# Blog Scheduling And Tracking Management Design

## Scope

This change adds:

1. Scheduled publishing for blog posts in the admin blog manager.
2. Easier detection of missing marketplace tracking coverage.
3. Safer admin force-delete behavior for tracking tags, with automatic remapping to the marketplace default tag.

This design intentionally stays inside the existing admin/blog/tracking architecture and reuses the current hourly worker cron.

## Goals

- Let admins mark a post to publish automatically at a future time.
- Keep blog scheduling clear in the UI with a distinct `scheduled` state.
- Make missing marketplace tracking easy to spot from the dashboard and the tracking page.
- Let admins force-delete a tag without breaking mapped products when a marketplace default tag exists.

## Non-Goals

- No minute-level scheduling guarantees beyond the existing hourly automation cadence.
- No per-agent scheduled publishing workflow.
- No bulk scheduling UI in this phase.
- No destructive delete when no safe replacement tag exists.

## Blog Scheduling

### Data model

`blog_posts` will gain:

- `status`: expands from `draft | published` to `draft | scheduled | published`
- `scheduled_for`: nullable UTC datetime

Rules:

- `draft`: not live, no schedule required
- `scheduled`: not live yet, `scheduled_for` required and must be in the future
- `published`: live, `published_at` set

### Admin UI

`/admin/blogs` will add:

- `Scheduled` in the status dropdown
- a date-time input for `scheduled_for`
- list badge for scheduled posts
- pagination remains as already implemented

Form behavior:

- if status becomes `scheduled`, the date-time input becomes required
- if status changes away from `scheduled`, `scheduled_for` is cleared unless the admin explicitly republishes it
- `View live site` only appears for `published` posts

### Publish job

The existing hourly worker cron will also run a scheduled-publish step:

- query `blog_posts`
- select rows where:
  - `status = 'scheduled'`
  - `scheduled_for <= now()`
  - `is_deleted = 0`
- update those rows to:
  - `status = 'published'`
  - `published_at = scheduled_for` if present, otherwise current UTC
  - `updated_at = now()`

This job must be idempotent. Re-running must not republish or mutate already published rows incorrectly.

## Missing Tracking Finder

### Detection rule

A marketplace is considered covered if there is at least one tracking tag where:

- `is_active = 1`
- and (`is_site_primary = 1` or `is_default = 1`)

Supported marketplaces remain:

- `US`
- `CA`
- `UK`
- `DE`
- `IT`
- `FR`
- `ES`

### Dashboard

The admin dashboard will show:

- missing marketplace count
- list of missing marketplace codes
- quick link to `/admin/tracking`

### Tracking page

`/admin/tracking` will show a dedicated `Missing Tracking` block above the main list:

- missing marketplace chips
- explanation that direct Amazon CTA can stay hidden without active default/site-primary coverage
- quick jump to the create-tag form

This is a finder, not a new workflow. The actual fix still happens in the existing tracking form.

## Force Delete For Tags

### Goal

When admin force-deletes a tag, linked product mappings should move to the active default tag for the same marketplace instead of breaking.

### Behavior

If a tag is force-deleted:

1. Find all mappings linked to that tag.
2. Find the replacement tag:
   - same marketplace
   - `is_active = 1`
   - default/site-primary
   - not the tag being deleted
3. If replacement exists:
   - remap affected rows to the replacement tag
   - delete or deactivate the original tag according to existing tag-delete semantics
4. If no replacement exists:
   - block delete
   - return a clear error telling admin to create or mark a default tag first

### UX

Admin must go through an explicit confirm flow:

- action label: `Force Delete`
- warning text includes the marketplace and the number of linked mappings
- confirm text makes clear that links will be moved to the marketplace default tag

If the operation succeeds, the UI should return a summary like:

- `Moved 12 linked mappings to default US tag and deleted old tag.`

## Error Handling

- scheduled posts with invalid or past schedule must fail validation
- scheduled publish job skips rows with bad or missing state instead of crashing the run
- force delete without a valid replacement returns a friendly actionable message
- tracking finder shows empty-state success text when all supported marketplaces are covered

## Testing

### Blog scheduling

- can create scheduled post with future datetime
- cannot create scheduled post without datetime
- cannot create scheduled post with past datetime
- due scheduled posts publish on scheduler run
- future scheduled posts remain scheduled

### Tracking finder

- missing marketplaces appear when no active default/site-primary tag exists
- covered marketplaces disappear from the warning list

### Force delete

- linked mappings remap to active default tag in same marketplace
- delete is blocked when no replacement default exists
- unrelated marketplace mappings remain unchanged

## Rollout Notes

- migration required for `scheduled_for` and extended `status`
- admin UI and scheduler change should be deployed together
- no existing published posts should be modified during migration
