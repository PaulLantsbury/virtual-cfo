# First controlled Xero refresh on Render

## Status

The code and database contract for one bounded staging refresh are prepared and tested. They are not active. The database migration must be applied and verified first, and creating the separate Render cron service requires explicit cost approval.

## Safety properties

- The worker discovers exactly one active persisted connection and one complete current mapping; neither identifier nor mapping JSON is copied into Render configuration.
- A database lease spans OAuth refresh-token rotation, all five report reads and the terminal accounting-evidence write.
- The evidence write and lease release are atomic. Concurrent and replayed runs are rejected before Xero is contacted.
- The worker login receives only narrowly scoped security-definer RPC execution. The older unfenced evidence writer is revoked from it.
- Raw Xero reports remain in memory and logs/receipts contain no credentials, account identifiers or financial values.
- Reporting dates are explicit, valid, at most 31 days apart and GBP-only for this staging exercise.

## Activation gates

1. In **Night Scout Staging** only, run `db-migrations/staging/20260925_xero_single_refresh_job.sql` as the migration owner.
2. Before contacting Xero, review the migration and confirm its focused database-contract tests pass. The supplied `verify-xero-first-refresh-2026-09-25.sql` is the post-run verifier, so it is run only after the controlled refresh.
3. Obtain explicit approval for the separate Render cron charge (Render currently applies a minimum monthly cron charge).
4. Create the isolated cron service using:
   - build: `pnpm --filter @workspace/db --prod install --frozen-lockfile --ignore-scripts`
   - start: `node deployments/nightly-staging/run-xero-refresh.mjs`
   - branch: `codex/restart-baseline`
   - region: Frankfurt
5. Set fixed non-secret values: runtime `staging`, target project ref, currency `GBP`, and an agreed bounded report-from/report-to period.
6. Set only the worker secrets: restricted `night_scout_import_login` database URL, staging CA certificate, Xero client ID/secret, and envelope master key/version.
7. Keep `NIGHT_SCOUT_XERO_STAGING_REFRESH_ENABLED=false` until every preceding check passes. Then enable it and trigger exactly one manual run.
8. Immediately disable or suspend the cron after that run. Do not leave the fixed reporting period scheduled.
9. Run `db-migrations/staging/verify-xero-first-refresh-2026-09-25.sql`; all eight status checks must be true. Refresh Night Scout Settings and confirm accounting evidence is available.

## Rollback / failure handling

If the run fails, disable the worker and inspect only the safe failure class. Do not repeat consent or blindly retry: the refresh token may already have rotated. The exact-version lease and persisted credential audit determine whether a controlled retry is safe.

Recurring refresh is a later package. It needs rolling London reporting dates and a deliberate scheduling/cost decision rather than reusing this fixed-period first-run configuration.
