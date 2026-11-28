# DealsRky — Product Details SSR/Payload review, 28 November 2026

## Baseline and scope
- Based on exact `origin/master` `4cb5c4af9980c82417606f7073cbc6cfb8ee6d58`.
- No production deployment, Cloudflare security change, remote database write, or publication-pilot activation.
- Product route still uses React Router SSR and per-request D1 reads. Unique product URL distribution and low cache reuse mean broad prerendering should not be assumed beneficial.

## Production observations (read-only)
- From 2026-11-28T09:30:00Z to 09:58:00Z, observed new-version product executions: 35, mean 49.6 ms CPU, P50 41 ms, P95 100 ms (sampled, not a traffic census).
- The active product catalog: 4,773. A DE product with null category has no DE candidates in the latest 12 related-product rows in a read-only D1 sample (the 12 were US).
- Do not block or throttle verified search crawlers solely to improve CPU dashboards. User-agent labels are not proof of bot verification.

## Code candidate
- `app/utils/product-detail.ts`: filter related candidates to marketplaces represented by the current product's available marketplace choices, with exact matching.
- `app/routes/product-detail.tsx`: preserve original query ORDER/LIMIT and product selection, then discard candidates never renderable in any selected marketplace **before** resolving affiliate tracking links and returning the loader payload.
- New unit and disposable D1 integration tests show market isolation, exactly preserved visible related card order, approved affiliate tracking tags and canonical route.

## Verification
- Targeted: 9/9 pass.
- Unit: 205/205 pass, 42 test files.
- API: 135/135 pass, 36 test files.
- Desktop/mobile browser catalog E2E: 7 PASS, 1 expected desktop skip.
- Typecheck: PASS; production build: PASS.

## Matched local profiling — important release caveat
Fixture: synthetic QA CA product Q000000028 and 12 US related candidates, same local D1 source and same generated profile runner, PetalBot user agent, 60 warm document requests per run.
- Baseline HTML output: 27,776 bytes; candidate: 25,434 bytes; reduction: 2,342 bytes (~8.43%).
- Baseline sampled active CPU/request: 16.1048 ms and 16.1847 ms.
- Candidate sampled active CPU/request: 18.4160 ms and 18.4442 ms.
- This test does **not** demonstrate CPU improvement. There may be profiling variability or additional work; until explained, **do not merge as a CPU optimization or deploy**.

## Follow-up investigation
1. Produce a reproducible CPU flamegraph for real product-page templates (not only synthetic QA), separating cold and warm isolate initialization, React Router route matching, JSX/HTML streaming, D1 API serialization, and GC.
2. Compare route-level SSR build splitting/server bundle options against Cloudflare Vite deployment constraints in an isolated proof of concept; do not modify production integration without full hydration and asset compatibility.
3. Evaluate crawl distribution with Cloudflare verified bot evidence before proposing rate controls. Preserve Google/Bing indexing and affiliate tracking.
4. If this change is retained, position it as HTML/loader payload reduction, not measured Worker CPU reduction.

Decision: Review candidate only; production stays on master 4cb5c4a.
