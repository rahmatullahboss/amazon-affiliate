# Publication-first pilot — release and retention policy

Status: local candidate only. This document does not authorize or execute a cloud resource change.

## Pilot limits
- 100 exact enrolled document URLs; at most 8 per scheduled batch.
- Five-minute publisher cadence; hourly existing blog publication unchanged; automatic AI draft generation remains off.
- Request path always checks current D1 eligibility and scope revision, then R2 identity. No stale serving, no request-time fill, no public bucket.
- 72-hour application snapshot validity; reconcile at six hours and refresh if remaining validity is at most six hours plus 15 minutes. Failed generation retries after five minutes. Delays, missing objects, or expired identities use ordinary SSR.
- A full 100-document initial fill takes 13 successful scheduled batches (nominally up to 65 minutes after enrollment, not a latency guarantee).

## R2 retention proposal (not applied)
- Dedicated private publication snapshot bucket, never the blog images bucket, backups, or a shared artifact bucket.
- Proposed lifecycle expiration: 7 days since object creation/update, scoped only to exact prefix `durable/public-render-v1/`. Keep other prefixes and existing lifecycle rules untouched.
- One object slot per deployment and exact canonical URL; repeated revisions replace that slot. New version slots are independent. R2 object expiry is not an access control: application revision, identity and validity gates remain mandatory. Active objects normally refresh before seven days; absent or expired objects fall back to SSR. Old version slots may survive until lifecycle expiry; rollback never depends on these objects.
- Cloudflare documents prefix-scoped lifecycle rules and eventual expiration (normally within 24 hours of expiration, not an exact deletion SLA): https://developers.cloudflare.com/r2/buckets/object-lifecycles/
- Release owner must approve retention policy and verify actual resource identity, private access, existing rules, exact prefix, storage metrics and eventual expiry in the authorized release process. No automatic deletion code, remote bucket provisioning, or lifecycle modification in this candidate.

## Cost and admission
- Local D1 idle sample: 100 count rows + 701 due-selection rows, no writes. At 288 callbacks/day: illustrative 230,688 rows/day for fully idle pilot vs 1,153,440 at minute cadence. Actual production metering must be measured.
- Real benefit depends on repeated eligible requests per generated revision; count generation, idle polling, D1/R2 reads and misses in the same window. Do not extrapolate the 100 synthetic URLs to the entire 4,700-product catalog.
- Migration 0034/0035 remains unapplied and is held under `pilot/publication/migrations/`, outside the ordinary D1 migrations directory. The root Wrangler configuration is identical to baseline master 07063034: no publication R2 binding, version metadata, flag or five-minute trigger. Missing optional bindings or a missing opt-in flag keep the feature dormant. Only explicit disposable QA installs the held schema and supplies synthetic publication bindings. Admit these files separately, under the final migration numbering agreed at release, with rollback and native baseline parity; do not rewrite any installed migration.
- Dormant code integration does not authorize pilot activation. The local QA configurations must never be used for a remote deployment. No production publication resource is required to build or run the dormant candidate.
- Existing production activation gate remains unresolved. No candidate activation, remote resource creation or production migration without independently permitted release verification. No bypass or proxy workaround.
