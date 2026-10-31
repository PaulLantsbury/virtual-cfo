# Nightly Shopify collection — 17 September 2026

## Cloud hosting direction confirmed

Paul chose cloud-hosted nightly execution; no Mac needs to stay awake. The earlier computer-choice question is withdrawn. [Cloud staging plan](cloud-nightly-staging-plan-2026-09-17.md) records read-only Replit inspection, current tariff, separate worker recommendation and exact remaining work. Existing Replit is public Autoscale and is not updated by development-branch GitHub saves. No Replit settings/secrets/deployment or live database changes were made. Cloud adapter, reporting-coverage policy and concrete activation approval remain; no schedule is running.

## Agreed product behaviour

Paul agreed one automatic refresh per day, overnight at **02:00 in each store's local timezone**, with a **15-minute startup allowance: 02:00 inclusive to 02:15 exclusive**. A worker starting within that window can collect once; a process restart or repeated invocation cannot collect again for the same local date. Failed collection must not invent replacement figures: retain prior recorded data, flag the unsuccessful refresh, and do not present it as freshly verified. Existing evidence invalidation still applies when source data changes; retaining historical records does not authorise showing invalidated figures as current.

## Prepared implementation; not activated

`nightly-plan.mjs` calculates the store-local scheduled minute independently of the computer's timezone. It handles calendar/DST changes, chooses the first occurrence of a repeated 02:00, and the first valid later local minute if 02:00 is missing. The runner and proposed database permissions are deliberately restricted to the existing **Europe/London development store**; broader timezone deployment is not implemented by this proposal.

`nightly-runner.mjs` commits a unique store/local-date reservation before entering the existing durable sync journal and restricted intake. Database constraints prevent two processes or restarted workers collecting twice on the same local date. Unresolved reservations block future dates. A lost start acknowledgement never initiates collection. Failed/uncertain writes are not blindly retried; reservations are not automatically released. Existing manual intake and nightly intake share the durable journal's unresolved-store guard. Manual operator collection remains an explicit separate action, not part of the once-daily automatic schedule.

`nightly-development.mjs` is a bounded executable launcher. It defaults to read-only checking; `--tick` requires the exact staging project/store confirmation. It reads the existing owner-only configuration, uses the existing restricted login and credential provider, and returns safe metadata only. It does not install a scheduler, publish an endpoint, collect contact details, run customer-ID collection, approve a candidate or certify/import finance.

A new SQL proposal adds only `ingest_v1.nightly_claims` with fixed-store RLS, column-level insert/state-update grants and immutable terminal history. Browser roles cannot read/write the private table. The existing status RPC already reports the durable intake attempt; Settings must not claim scheduling is enabled before actual deployment.

## Decisions needed before activation

1. **Execution host:** cloud execution is agreed; the separate cloud worker still needs preparation, review and explicit deployment activation. No billable service or scheduler has been installed.
2. **Reporting period:** the launcher deliberately preserves the explicitly configured intake period (at most 31 calendar days). The source collector reads available order history but produces a candidate only for this configured period. It does **not** silently advance dates, decide month-boundary behaviour, certify history coverage or implement a complete rolling financial feed. Agree the daily/monthly evidence scope before scheduled activation.
3. **Startup window implemented:** the approved runner accepts a start from 02:00 inclusive until 02:15 exclusive. At or after 02:15 it skips collection rather than catching up during the day. The unique local-date claim still prevents duplicate starts throughout the window. Existing network-read retries remain bounded inside a single attempt; uncertain writes require inspection. Generic missing/repeated-hour planner behaviour is tested but wider non-London timezone activation remains outside this staging proposal.
4. **Apply proposal and wire the host:** SQL/grants require approval before staging application. The caller should invoke the prepared tick within the approved startup window; no service is running merely because this code exists.

After those decisions and approval, run the read-only check, one controlled due-time integration exercise, concurrency/restart verification and an overnight observation before describing the feature as enabled.

## Verification

**9/9 focused planner, runner and launcher tests passed.** Independent review fixes for receipt validation, terminal timestamps and safe cleanup errors were included before the final pass.

Synthetic disposable PostgreSQL-compatible tests cover local-time DST planning, duplicate/concurrent/restarted ticks, next-day progression, unresolved-outcome blocking, lost commit acknowledgements, denied browser/cross-store/history mutation, no work outside the startup window, strict receipt validation and unchanged pre-existing financial rows on failure. The launcher is exercised against that disposable database with a synthetic intake callback; this does not prove a real overnight Shopify run or unattended-host availability.

Commands (explicitly prepared, not executed against staging):

```sh
node experiments/shopify/nightly-development.mjs --config .local/intake-staging.json --check
node experiments/shopify/nightly-development.mjs --config .local/intake-staging.json --tick --confirm-target bioalckltvkhlczusdvl/56d92f8a-746e-4b4f-b408-81fc98c4aa17
```

Use the existing trusted staging CA configuration for the live database. No credentials belong in this document or command history.
