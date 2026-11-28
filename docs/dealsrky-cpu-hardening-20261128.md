# DealsRky CPU hardening — 2026-11-28

## Scope and source
- GitHub base: `origin/master` `5c1599d3804bd408418bfda5bbece19e10ddf41c`.
- Isolated branch: `perf/dealsrky-cpu-hardening-20261128`.
- No production deploy, remote database write, bot block, or publication-pilot activation in this change.

## Evidence that led to this patch
- Production 2026-11-28 06:00–08:00 UTC observed telemetry sample: 259 executions, 7,772 ms sampled CPU. Product detail: 108 executions, 5,238 ms CPU (67.4%); home 12, 504 ms (6.5%). This is not a full traffic census.
- D1 Insights: homepage mapping query average 7,512 rows read and 72.36 ms execution; tracked alias lookup average 2,418 rows read and 7.97 ms across the displayed insights window.
- Read-only production D1 no-match query comparison: previous join plan 3,947 rows read and 229.06 ms; ASIN-first indexed join 4 rows read and 0.83 ms. These are one-off timings, not representative medians. Valid-match case used 4 rows in both plans.
- 108 sampled product-page URL variants were distinct, so generic cache rollout does not currently have a supported hit-rate case.
- Local SSR profiles fluctuated across runs (candidate warm product 19.60 ms/request vs repeated baseline 18.25 ms/request); no sustained overall SSR CPU improvement is claimed from this patch.

## Implemented
1. `server/services/dynamic-links.ts`: start linked product resolution from `idx_products_asin`, then join agent mappings via `idx_ap_product_active`. All original market, visibility and tracking predicates remain.
2. `server/services/homepage-feed.ts`: read mappings in ranking order using `idx_agent_products_homepage_rank`.
3. `migrations/0036_homepage_rank_expression.sql`: scoped expression index on exact existing ordering `COALESCE(homepage_rank,999999), created_at DESC`. The held publication-pilot 0034/0035 remain outside normal migrations.
4. `app/root.tsx`: load `@capacitor/app` only in native effect; clean up listener on asynchronous unmount. Web/public SSR does not need native plugin module.
5. `test/api/cpu-query-plans.test.ts`: real disposable D1 parity, indexed plan and no-temp-sort checks.

## Verification
- Targeted new query-plan tests: 2/2 PASS.
- Existing targeted regression: 30/30 PASS.
- Full unit suite: 204/204 PASS (42 files).
- Full API suite: 134/134 PASS (35 files).
- TypeScript: PASS.
- Production build: PASS.
- Disposable browser catalog acceptance: 7 PASS, 1 expected desktop skip. Affiliate aliases, marketplace, desktop/mobile catalog and homepage social links preserved.
- Existing `BLOG_AUTO_GENERATION=off` is unchanged.

## Release contract
- Apply the new `0036_homepage_rank_expression.sql` migration in a controlled production migration step **before** deploying the source containing the `INDEXED BY` clause; without the index, this query would fail closed.
- Compare query plans and outputs on disposable D1 first; verify migration ledger. Do not apply held pilot migration 0034/0035 as part of this change.
- Deploy only on explicit instruction; retain verified immutable client assets and current rollback, and compare route-level production P50/P95, rows-read, errors, bot/browser cohorts and affiliate correctness.
- Do not assume the new index will reduce the platform CPU median by a specific percentage; its direct benefit is query efficiency. Do not block verified SEO crawlers just to reduce CPU.
