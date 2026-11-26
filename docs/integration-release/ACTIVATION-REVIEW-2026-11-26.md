# Independent provider publication and activation review — 26 November 2026

Read-only release review. No schema/data/grant mutation, provider call, OAuth, secret/private-setting inspection, log-content query, deployment, schedule or spending action. Reviewed recovery source receipt, staging package, logging acceptance proposal and repository instructions. New candidate ancestry/tests are separate agent-owned evidence and must be pinned before publication.

## Fresh installed-state evidence

Using the already authorised read-only staging audit connection, a catalog-only aggregate query at **2026-11-26 10:55:59.598522 UTC** returned:

| Catalog scope | Count |
| --- | ---: |
| `meta_ads_v1` / `google_ads_v1` namespaces | 0 |
| Exact twelve proposed Meta/Google API/report/collector group/login role names | 0 |
| `worker_read_daily_spend` functions in those namespaces | 0 |

The query touched only pg_namespace, pg_roles and pg_proc metadata. No provider/customer/auth rows, role passwords, function bodies, secrets or connection values were read. No effective installed grants can be certified for absent roles. This verifies absence now, not future installation success or app configuration.

The revised Meta report function returns additional columns. An old function is not currently installed in the inspected namespaces, so the existing-return-type migration is a **conditional drift gate**, not a present installed-function blocker. Repeat the same catalog preflight immediately before an approved install. If an old signature appears, stop the first-install sequence and prepare an explicitly reviewed versioned function or transactional replacement with ACL restoration; [PostgreSQL CREATE OR REPLACE](https://www.postgresql.org/docs/current/sql-createfunction.html) cannot change a function return type. Do not blindly apply the proposal.

## Hosting and logging evidence

Current [Render logging documentation](https://render.com/docs/logging.md) lists requested URLs in HTTP request logs; it does not guarantee OAuth-query omission. The [log-stream documentation](https://render.com/docs/log-streams.md) describes forwarding to configured destinations. Neither establishes this workspace's enabled sinks or outbound instrumentation. Local actual-logger canaries prove only application output handling.

An initial metadata-only listing returned “no workspace selected.” PM then supplied the previously user-confirmed workspace/service identities. Request-scoped metadata reads succeeded without changing global workspace selection. Fresh service/deploy facts observed by 26 November 10:57:04 UTC: `night-scout-xero-staging`, branch `codex/restart-baseline`, auto-deploy off, not suspended, latest deploy `204226d0c796561d5bb812cde1bd9cec8da6a8d5` live (finished 21 November 17:11:07.867796 UTC). No private environment values, log contents, external log destinations or injected-agent settings were read. These service metadata responses do not expose enough telemetry configuration to close the logging gate. Private workspace/service/deploy IDs are omitted here.

Engineering-owned closure remains a bounded exact proposal: inspect safe capture configuration facts; use fictional callback query/header/body/error canaries only against a controlled harmless endpoint; verify each enabled ingress/runtime/outbound/export sink excludes or redacts relevant fields; remove temporary instrumentation and verify ordinary default-off operation. No real credential/code/token or provider request is a canary. Do not redeploy expired diagnostics. Secret/private-setting access or a new hosted canary needs the separate exact authority in the staging package.

## Source-publication package

The new isolated candidate must descend from real public cloud commit `6cc5c542929dadedaa3a7633a6937160d4b16880`, not synthetic archive ancestry. Pin exact commit/tree, changed path inventory and SHA-256 manifest; compare full reviewed provider delta to recovered tested source `870c59fbadfc62c017ce3b988648a02bb80415de` plus documentation tip `fea71fcccdebe7e094d23f28fb57b51cb37ab673`. Preserve accepted UI, data-lane paths and cloud validation corrections. Pages owns its adapter; the API wire cannot be silently widened or inferred.

Before source publication: final integrated tests/build, independent preservation/privacy review, exact destination branch/PR and PM release sequencing. PM reports an earlier design-lane publication rejection outside its named branch; this review does not grant new-branch push authority. No push or remote-branch creation was attempted here. Record exact intended repository, destination branch, tested commit/tree, changed paths, review/validation evidence and draft-PR target for the concrete publication decision; never switch destinations to bypass a rejection. A local commit is not publication. Publishing source does not merge, deploy, install SQL, enable OAuth or enable a collector. If managed review rejects the exact publication, record the actual reason and do not change destinations as a bypass.

## Separately scoped hosted packages

1. **Website/source release:** Exact combined provider/pages source, default-off controls, fresh hosted baseline, build and acceptance receipts, rollback revision. No SQL or provider action implied.
2. **Storage/access installation:** Exact six SQL proposal hashes, first-install absence preflight, separate API/report/collector role pairs and full effective-ACL/ownership checks. Secure provisioning values remain private. No broad browser grants or existing-store changes. Verify installed functions and deny wrong role/member before runtime enablement.
3. **Logging/setup:** Exact host/callback/app and safe capture-layer verification, with credentials provisioned only via approved secure process. Google OAuth scope itself is not read-only; fixed read operations and the advertiser role enforce that restriction. No runtime enabled merely because source is deployed.
4. **Bounded provider acceptance:** Name one private target and exact completed account-local interval; Meta history/timezone/full daily totals must be independently reconciled. Google OAuth/discovery can be tested separately; positive-spend acceptance remains a future existing-advertiser gate. Do not create ads/spend or repeat the settled owner question. Xero acceptance remains separate.

All runtime and one-off collector/acceptance flags remain unset/false; no new schedule or recurring cleanup. A failed one-off is not authority for automatic retry/catch-up.

## Rollback and cleanup requirements

Stop acceptance/collector controls first. With approved API access still available, cancel pending selections/disconnect and verify encrypted credential deletion while retaining observations; separately revoke the external grant when authorised. Disable API/report runtimes, restart/stop the exact host, revoke dedicated login capability through separately reviewed SQL, preserve stored observations and audits. Source rollback alone does not revoke credentials. No destructive schema drop or retention deletion. Pending encrypted credentials with no active scheduler need an explicit bounded cleanup action, not an implicit cron.

## Disposition

Suitable for completing exact source-publication preparation. Fresh metadata removes uncertainty over existing provider schema/role/signature presence at the recorded instant. Hosted telemetry, actual installation/access, combined pages mounting and real-provider acceptance remain genuine separate gates. No routine owner question is introduced by this review.

## Exact read-only catalog query

Run only against the confirmed staging audit connection; no project/operator identifiers are embedded. The aggregate output is intentionally limited to absence counts and the observation instant.

```sql
SELECT clock_timestamp() AS observed_at,
  (SELECT count(*) FROM pg_catalog.pg_namespace
   WHERE nspname IN ('meta_ads_v1','google_ads_v1')) AS provider_schema_count,
  (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN (
    'night_scout_meta_ads_api_group','night_scout_meta_ads_api_login',
    'night_scout_meta_ads_report_group','night_scout_meta_ads_report_login',
    'night_scout_meta_ads_collector_group','night_scout_meta_ads_collector_login',
    'night_scout_google_ads_api_group','night_scout_google_ads_api_login',
    'night_scout_google_ads_report_group','night_scout_google_ads_report_login',
    'night_scout_google_ads_collector_group','night_scout_google_ads_collector_login'
  )) AS dedicated_role_count,
  (SELECT count(*) FROM pg_catalog.pg_proc p
   JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname IN ('meta_ads_v1','google_ads_v1')
     AND p.proname='worker_read_daily_spend') AS provider_report_signature_count;
```

## Candidate source review checkpoint

Independently confirmed integration commit `3187ce39fda8e3ec66710c58c2a70952efcf0d34` has real public parent `6cc5c542929dadedaa3a7633a6937160d4b16880`. Subsequent in-progress hardening was reviewed: descriptor-based plain-object checks reject accessors/extra symbol or non-enumerable fields, dense-array checks reject sparse/accessor/extra day entries, strict timestamp validation prevents Date.parse rollover, and connection-state comparison avoids coercion. No source concern found in those changes. This is a review checkpoint; coordinator must record the final immutable commit and validation receipt rather than claim the mutable tree itself is certified.
