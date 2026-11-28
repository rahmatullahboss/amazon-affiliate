# DealsRky concurrent SSR handler initialization — 2026-11-28

Source: origin/master 4cb5c4af9980c82417606f7073cbc6cfb8ee6d58.

## Change
The immutable React Router build/handler initialization now shares one in-flight promise per Worker isolate. A concurrent burst of cold document requests initializes the same handler once (previous test showed two loadBuild calls), while all request/context/response processing remains independent. A failed initialization clears the pending promise so the next request can retry. No request bodies, user information or per-request context are cached.

## Evidence
- Existing concurrent unit test: loadBuild calls 2 -> 1; factory remains 1; responses retain separate paths/context.
- New concurrent rejection/retry unit test: first failed load is shared, later request retries and succeeds.
- Combined candidate test run: unit 205/205 PASS; API 136/136 PASS; Playwright desktop/mobile catalog 7 PASS/1 expected skip; TypeScript, production build and Wrangler dry-run PASS.
- One local warm product profile: baseline 21.42 sampled CPU ms/request; candidate 19.23 ms/request. First-document CPU 174.4 vs 202.6 ms. These were one-off runs under non-identical startup noise: no proven production CPU reduction, no deploy justified solely from this result.
- The change targets duplicate **concurrent cold initialization** work only, not general warm SSR request CPU.

No production changes, GitHub master unchanged during QA. Safe review scope excludes the held publication schema.
