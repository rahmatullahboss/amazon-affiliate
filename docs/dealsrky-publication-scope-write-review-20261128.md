# DealsRky publication scope trigger hardening — 2026-11-28

**STATUS: HELD PILOT ONLY.** Migrations 0034/0035 remain outside standard migrations and have never been installed in production. No R2 bucket, scheduler or publication flag is activated.

## Changes
- Seed ASIN/category/fallback scope revisions only when an exact product URL is deliberately enrolled (at most 100 URL pilot cap). Catalog insert/update/delete and agent-product mapping changes bump only existing scoped keys.
- Separate review/gallery-only updates from related-card visible-field updates. Product editorial/gallery updates invalidate the product's own ASIN snapshot without invalidating unrelated related-product pages in the same category.
- Re-enrolling a previously removed URL forces a fresh ASIN revision. Prevents durable R2 snapshots from an earlier enrollment becoming valid again.
- Preserve existing fail-closed visibility, adult/hidden detection, marketplace handling, related content, global tracking/agent/social settings invalidation, unchanged scheduler and request-time no-write semantics.

## Disposable native D1 evidence (4,700 synthetic products, 100 enrolled)
| Measurement | Unmodified pilot | Candidate |
| --- | ---: | ---: |
| 4,700 product title updates: rows written | 18,800 | 9,500 |
| 4,700 product title updates: rows read | 28,200 | 28,400 |
| 4,700 product title updates: local wall time | 70 ms | 82 ms (sometimes 166 ms in a later run) |
| 4,700 editorial-only updates: rows written | Estimated 18,800 with prior trigger logic | 4,800 |
| 4,700 editorial-only updates: candidate rows read | — | 14,300 |
| 4,700 editorial-only updates: candidate local wall time | — | 29–36 ms |
| 100 idle enrolled URLs: D1 rows read/check | 801 | 801 |

The new migrations **reduce write amplification**, especially for editorial-only updates, but they **do not establish a total D1 CPU/latency improvement for general catalog updates**. In some local runs, wall time regressed. Avoid activating this pilot until the prospective CPU benefit, all-in D1/R2 cost and trigger overhead are positive.

## QA
- Native D1/R2 publication test: 8/8 PASS, including own vs related invalidation and removal/re-enrollment stale-snapshot protection.
- Native publication migration cost: 1/1 PASS; triggers expected 19 (16 scope triggers, two enrollment seed triggers and one enrollment cap; verified by the native test).
- Combined branch unit 205/205 PASS, API 136/136 PASS, browser 7 PASS/1 expected skip, typecheck and production build/dry-run PASS.
- Held 0034/0035 migration files are only run by disposable test setup; no production migrations applied.

## Release blockers
No source deployment or schema install should accompany this PR. Current observed product URL prospective coverage is low (earlier 42-minute cohort covered 2 of 49 later requests); the separate admission analysis remains HOLD. Confirm real enrollment/time-window reuse, private R2 lifecycle, related revision correctness, data-change audit, production migration admission and rollback before any activation.
