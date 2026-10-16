# Shopify restricted candidate intake — 17 September 2026

Status: approved by Paul, applied to staging and live-verified on 17 September 2026. Three agents handled database permissions, private runtime/operator tooling and independent review. The exact proposed store/service policies and private restricted login are now applied; one unverified test candidate was recorded and replayed. No UI, financial formula, production, main or Replit change.

## Intended result

Receive PocketLaunchpad1's observed test order/refund as a private unverified candidate, then repeat the collection to prove replay without duplication. The actual source flag remains `test=true`, so no sale or refund enters financial reporting. The finance importer rejects all-excluded/no-event candidates; do not weaken that rule. A financial-review walkthrough is not the acceptance criterion for this package.

Target: staging `bioalckltvkhlczusdvl`, new store `56d92f8a-746e-4b4f-b408-81fc98c4aa17`, Shopify `95601983836`, domain `pocketlaunchpad1.myshopify.com`, GBP, Europe/London. First candidate reporting period: **17 September 2026 only**. Source collection remains bounded full history to retain later refunds against older orders.

## Prepared changes

- [Atomic setup proposal](../db-migrations/proposals/shopify-intake-2026-09-17.sql): one store row; dedicated service role; store-scoped candidate read/insert and narrow column updates; false-only coverage withdrawal; exact-store lock helper. No finance import, user membership or reviewer grants.
- [Private login builder](../experiments/staging/intake-provision-login.mjs): restricted NOINHERIT login, SCRAM verifier, bounded waits and two-connection limit for the lock check. Password and generated SQL/config must remain private. Normal runtime pool size is one.
- [Runtime](../experiments/shopify/intake-runtime.mjs): fixed staging host/login/store, verified TLS, safe role checks, transactional candidate writer, explicit target acknowledgement, sanitised receipts and no automatic uncertain-write retry.
- [Operator](../experiments/shopify/run-development-intake.mjs): owner-only regular private configuration, no symlinks, at most 31 reporting days. `--check` is default and checks database readiness only; `--record` requires the exact target. Existing private Shopify credential file is reused server-side.
- [Rollback-only lock verifier](../experiments/shopify/intake-lock-check.mjs): two restricted connections must contend, then release successfully; sanitised failure, bounded waits and cleanup.
- Recorder supports an optional store-lock adapter. Existing callers retain their original `FOR UPDATE` path.

Private configuration shape (values supplied locally, never committed): `projectRef`, `databaseUrl`, `scope` containing `storeId`, `shopId`, `from`, `to`, and `shopifyConfigPath`. Commands use the existing trusted staging CA through `NODE_EXTRA_CA_CERTS`.

```sh
node experiments/shopify/run-development-intake.mjs --config <private-intake.json> --check
node experiments/shopify/run-development-intake.mjs --config <private-intake.json> --record --confirm-target bioalckltvkhlczusdvl/56d92f8a-746e-4b4f-b408-81fc98c4aa17
```

## Verification and limits

Read-only live inventory: no duplicate proposed UUID/domain/Shop ID; no existing intake roles; RLS enabled on all five touched tables; no PUBLIC table ACLs in relevant schemas; policies name only existing authenticated/review/import roles. The existing invalidation function was inspected successfully using the restricted review role: invoker SQL, fixed `pg_catalog` search path, false-only update for the specified store. The initial attempt without switching to that role lacked schema access; the corrected read-only transaction completed.

**33 focused tests passed** (31 combined runtime/operator/recorder/readiness/setup checks plus two lock-verifier sequencing/failure checks). The lock-verifier tests use mocked connections; no live contention result is claimed. Local tests cover restricted-role record/replay, cross-store and financial-write denial, false-only invalidation, late rollback, atomic setup failure, duplicate setup refusal, disabled-RLS rejection, login restrictions, private files/configuration, operator acknowledgement, transaction cleanup and preservation of the old lock path. See [independent review](shopify-intake-acceptance-2026-09-17.md).

PGlite proves SQL/permission behavior in disposable fixtures, not independent remote connections. No standalone PostgreSQL was available and none was installed. A bounded two-connection, rollback-only staging lock check must pass after approved setup and before the first candidate; wider concurrent record/disconnect/lost-ack scenarios remain separate validation. This limitation is not hidden by the runtime's one-connection pool.

No fresh browser walkthrough is required: no UI or preview-facing code changed. The existing staging preview is unaffected; the new restricted database capability is deployed to staging only.

## Approved application scope (completed)

Approve together: apply the reviewed setup to this staging project only; generate/provision the private restricted login; check effective permissions and helper ownership/default grants; perform rollback-only lock verification; record the 17 September candidate; inspect that it is unverified and TEST_ORDER-excluded; repeat once and require replay with the same batch. Keep all other stores and finance evidence unchanged. If a gate fails, stop before candidate recording and report the exact state.

Both setup and login provisioning are transactional. A failed transaction rolls back its changes; duplicate setup refuses overwrite. They are separate transactions, so successful setup followed by failed login is an explicit partial state to inspect, not a reason to blindly rerun setup. Candidate recording is separately transactional. After an uncertain commit, inspect before retry; never delete retained history to hide uncertainty. Removing an already successful setup is a separate destructive decision, not an automatic rollback claim.

This approval does not certify financial completeness, grant human access, import financial events, merge main or release production. Repository AGENTS.md says staging cadence “does not authorise migrations, new grants”; preparation/publication is covered by standing authority, while these new database changes require this concrete approval.


## Live application result

Paul approved the concrete scope. Applied setup SHA-256 `d6eb8d061711558d14d9354153cce9b76efc5538bba81bbff7c540d6fd584e14` and the reviewed private login builder. Readiness passed with the dedicated intake login/service and verified TLS. Helper owner is postgres, fixed search path verified, browser roles cannot execute it. The two-connection live check observed lock contention and successful release, using only rolled-back transactions.

The 17 September operator run returned `recorded_requires_review`; unchanged repeat returned `replay` with the same batch. Direct read-only inspection found exactly one candidate/head, one Shopify test order and one refund, one TEST_ORDER exclusion, zero mapped financial events and coverage false. No finance/source transaction or membership rows were created for this store. All 43 other-store table/view count-and-content fingerprints matched the before snapshot.

The first verification script incorrectly required zero rows from reporting views as well as stored tables. Existing monthly views synthesize six period rows for a new store even without transactions. Corrected the assertion to distinguish base-table evidence from derived views; complete verification then passed. No data repair or repeat write was needed. The intermediate verifier failure was not an intake failure.

The temporary administrator password file was removed after verification. The dedicated intake credential remains in ignored owner-only local configuration. Neither credentials nor retained source payloads are committed. Production, Replit, main, financial completeness and user review rights remain unchanged.

Next: controlled changed-source/replay and recovery validation for the development feed, followed by an agreed route for eligible-data reporting tests. Keep Shopify test orders excluded; no fabricated non-test status or assumed costs. Wider multi-session record/disconnect/lost-ack tests remain unproven by the narrower live locking check. This is a working operator-driven staging intake, not a scheduled sync or merchant-facing connection panel.
