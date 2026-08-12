# Codex Status — DealsRky Monetization

## Status
Implementation is source-complete on `task/dealsrky-monetization-ads-20260812`, pending live publisher tag configuration and executable local verification.

## Source changes
- Added typed Adsterra/Monetag configuration parsing.
- Added native script loader with delayed, visible-tab-only, once-per-session injection.
- Mounted monetization only in the public layout.
- Excluded Amazon tracking and bridge conversion routes.
- Excluded admin, portal, and native Capacitor app sessions.
- Added disabled Cloudflare variables and operator documentation.
- Added unit tests for provider selection, URL validation/normalization, delay limits, and route eligibility.

## Verification performed
- GitHub compare confirms the feature branch is ahead of `master` and not behind at the review point.
- Reviewed public route definitions against the monetization allow/deny behavior.
- Reviewed network documentation: Monetag Vignette tags are placed in the head; Adsterra Social Bar scripts are normally placed near the end of body. Loader preserves provider-specific target placement after its safety delay.
- Current production HTML did not expose an existing Adsterra/Monetag tag in searchable page content.

## Verification blocked
Both the Amazon CodexPro connector and the Mac `local_dev` connector returned HTTP 502, so `npm test`, `npm run typecheck`, and `npm run build` could not be executed in this turn.

## Next review focus
1. Restore the project connector and run targeted unit tests, typecheck, and build.
2. Configure the exact DealsRky publisher-generated tag/script URL for one provider.
3. Browser-verify close behavior, once-per-session behavior, and zero ad loading on bridge routes.
4. Deploy only with explicit user instruction.
