# DealsRky publication-on-change admission evidence — 2026-11-28

## Decision
**HOLD — do not enable the dormant 100-URL publication pilot in production.**
This conclusion is evidence-based for the observed traffic interval, not a prediction of all future traffic. No remote publication database migration, private R2 binding, cron schedule, HTML flag or bot rule was changed.

Source baseline: exact GitHub master `4cb5c4af9980c82417606f7073cbc6cfb8ee6d58`. Live Worker version at collection: `ff485906-3a68-47d4-9cf3-2fef33f8e82d`.

## Read-only observed Product Details traffic

Cloudflare Worker Observability events, **2026-11-28T09:30:00Z–10:54:00Z**, version-filtered, with QA marker requests excluded. Aggregation is sampled, not a complete traffic census. No URL, ASIN, IP, agent string, token or header contents were emitted.

| Measure | Observed |
| --- | ---: |
| Eligible-looking product document executions | 90 |
| Distinct exact product URL variants | 85 |
| Repeated executions after first matching URL request | 5 |
| Sampled total product CPU | 4,122 ms |
| Sampled mean product CPU per execution | 45.8 ms |
| Earlier 42-minute half: requests / distinct URLs | 41 / 38 |
| Later 42-minute half: requests / distinct URLs | 49 / 49 |
| Earlier-half URLs seen again in later half | 2 |
| Later-half requests potentially covered by earlier-half enrollment | 2 / 49 = 4.08% |
| Sampled CPU of covered later-half requests | 161 ms |

**Important:** Repeated URL share (5/90) is relevant to *reactive request-time caching*, **not** an upper bound for *pre-generated* documents, which can bypass SSR even on their first visit. The prospective, temporally separated enrollment/coverage check (38 earlier URLs, 2 later requests covered) is a more meaningful retrospective test of a strategy that enrolls previously observed URLs.

**Illustrative CPU-only admission test:** Rendering the 38 earlier URLs in advance at the observed sample mean 45.8 ms per request would cost about **1,740.4 ms**. The two corresponding later requests used 161 ms observed CPU. Nominal CPU-only difference is **-1,579.4 ms** before any publisher scheduler cost, D1 revisions, R2 GET/PUT or storage lifecycle. This is *not* a measured pre-generation cost, and applies only to this sampled interval. It is a caution against activating the pilot without stronger recurrence, not a cost guarantee.

A theoretical perfect oracle able to pre-render **all** 85 future-visible URLs could avoid many first-visit SSR executions, but the production system cannot know these future URLs from the prior 42-minute data. Fitting enrollment to the entire observed interval would leak future information into the forecast.

## Existing pilot correctness and cost verification (native disposable D1/R2)

- `test/api/public-render-publication.test.ts` plus `test/api/publication-default-off.test.ts`: 7/7 PASS. Checks 100-document pre-generation (13 batches of <=8), correct R2 identity, current D1 revision eligibility, related/title/affiliate/visibility invalidation, retriable failure, expiry, version isolation, missing/hidden paths, and no request-time fill.
- `test/api/public-render-migration-cost.test.ts`: 1/1 PASS with 4,700 synthetic products and 100 enrolled URLs.
- Idle publisher: 100 count rows + 701 due-selection rows = **801 D1 rows read per check**; no writes. At exactly 288 five-minute callbacks/day, a continuously idle pilot would read about **230,688 D1 rows/day** before serving a visitor.
- Bulk update 4,700 products with prototype triggers: **28,200 rows read, 18,800 rows written, 74 ms local wall time**. Without the prototype triggers: **4,700 rows read, 4,700 rows written, 14 ms wall time**.
- A no-op 4,700-row product update with triggers cost 14,100 rows read and 4,700 writes in the disposable fixture. Source run times are local, one-off measurements and not production CPU metrics.
- This prototype writes revision markers for broad catalog mutations, not only for enrolled documents. That amplification is unacceptable without a measured positive cost case.
- Pilot remains capped at 100 exact URLs, expires snapshots after 72 hours at application layer, reviews a max of eight paths per scheduled run, and falls back to ordinary SSR if a snapshot is missing, stale or invalid.

## Admission tool and release gate

`scripts/qa-publication-reuse-envelope.mjs` queries a bounded Cloudflare observability window with a request-budget cap, prints **only aggregate metrics**, selects prior-half exact URLs as an *observed-history candidate list*, and scores held-out request coverage. It is strictly read-only.

`scripts/publication-admission-policy.mjs` evaluates a CPU-only necessary condition, returning `HOLD_CPU_ONLY_NEGATIVE`, `INSUFFICIENT_SAMPLE`, or `FURTHER_D1_R2_COST_AND_FRESHNESS_QA_REQUIRED`. Even a favorable CPU-only case **never auto-approves activation**.

`scripts/qa-publication-admission-policy.test.mjs` provides 3/3 Node tests of negative, positive-but-not-ready, and invalid/insufficient inputs.

Conditions before any future activation:
1. A temporally held-out traffic cohort demonstrates expected pre-render coverage (not just historical top URL popularity).
2. Measured actual snapshot generation CPU plus R2/D1/scheduler cost is **lower** than prospectively saved SSR CPU with margin and real traffic.
3. Validated per-URL invalidation covers own product, related recommendations, tracking/agent and shared social settings. Hidden/adult/disabled content must never be served stale.
4. Bulk ingestion overhead is bounded and Cloudflare D1 write/read quotas are respected.
5. Private, dedicated R2 bucket identity, lifecycle retention, held schema `0034/0035`, cron routing, rollout and rollback are independently reviewed.
6. Full desktop/mobile hydration, affiliate, marketplace, SEO and visibility parity passes before any traffic.

## Action taken
- Added read-only telemetry aggregation tool, pure advisory admission policy, and three independent Node tests.
- No production release or database mutation. Previously merged master `4cb5c4a` remains authoritative.
- Existing draft PR #25 (payload pruning) is separate and must not be merged as a CPU improvement without evidence.
