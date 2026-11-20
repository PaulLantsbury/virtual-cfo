# Current dashboard test package — 9 October 2026

**Prepared and tested locally; not applied to staging.** This is an opt-in alternative to the September 18 historical package, using the same reserved synthetic historical store. It fills the complete September 2026 period and elapsed October 1–8 sales. It is not an additive upgrade: if the reserved target already exists, application refuses rather than modifying its immutable evidence. Existing Store D and the original historical fixture remain unchanged.

## Expected results

| Exact synthetic period | Net product sales | Net shipping | Original orders | Pre-refund AOV | Operating profit | EBITDA |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| September 1–30, 2026 | £960 | £36 | 12 | £80 | £466 | £472 |
| October 1–8, 2026 | £240 | £9 | 3 | £80 | Unavailable | Unavailable |

September actual synthetic COGS is £360, gross profit £600, variable costs £48, advertising £92, overheads including D&A £30, D&A £6; contribution after marketing is £496. These are invented, explicitly labelled source records, not estimates substituted into real-store results. October has no profit version under the approved complete-calendar-month rule. No October 9–31 source activity or completeness is invented. The full October month remains unsupported; choose the exact elapsed scope.

The package retains August 2025–August 2026 monthly sales/profit regression data, two historical refund events and an independently dated recovery. It contains **141 orders, 2 refunds, 16 exact sales scopes and 14 sealed complete profit months** across 15 relations (980 rows). Source/evidence timestamps in the current mode are frozen at October 8 as reproducibility markers, not claims of collection.

## Generate exact review files

Use an independently verified existing approved reviewer UUID; never use a disposable test identity against staging. The Monday remains an explicit illustrative daily-plan input, not generator activation.

```sh
node experiments/financial-v1/prepare-dashboard-test-package.mjs EXISTING_APPROVED_REVIEWER_UUID EXPLICIT_MONDAY EMPTY_OUTPUT_DIRECTORY current-2026-10-09
```

Outputs: `historical-manifest.json`, `schema-readiness.sql`, `historical-preflight.sql`, `historical-rehearsal.sql`, `historical-apply.sql`, `historical-postflight.sql`, `historical-rollback.sql`, `schema-diagnostics.sql`, `operator-apply.sql`, and `daily-disabled-plan.json`. No database/network connection or source writer exists in the preparation CLI. The default without the final option remains the original historical package.

Current manifest SHA-256: `ac76def32951fbc2eacdf897ece29d1c53b240f7481f75a150261590ba4ac193`. Disposable schema SHA-256: `c75f98ba556cd0ba42c8170e72ab666ba4c58998a034b3b20a457707b53cd175`. SQL hash depends on the explicit reviewer and is generated alongside the exact transaction; no disposable review hash authorises live execution.

## Read-only compatibility preflight

Independently confirm the TLS connection is staging `bioalckltvkhlczusdvl`, not production, before using any SQL file. `schema-readiness.sql` uses `BEGIN READ ONLY` and ends `ROLLBACK`. Its single JSON result returns:

- expected table/column/constraint/trigger counts and visible column/constraint/trigger counts;
- exact schema-contract agreement and reserved synthetic target vacancy;
- explicit flags that separate reviewer, auth-identity and connection-identity verification are still required. The schema-readiness file itself is reviewer-independent and can be run before binding the remaining application files to a verified reviewer.

The query compares all expected layouts, constraints and trigger implementations internally but emits no DDL, tokens, credentials, customer rows, financial values, membership identities or connection strings. Count agreement alone is insufficient: `schema_contract_matches` must be true. Visibility limits may yield false or a permission error; that is a stop, not authorisation for grants. The intake-aware query retains exact enforced column nullability and all deployed trigger/function checks while representing ordinary PostgreSQL18 NOT NULL catalog rows by cross-version column attributes. Unexpected metadata remains a stop; do not strip triggers or ignore constraints to obtain a passing result.

The coordinator subsequently ran the intake-aware query read-only against verified PostgreSQL17 staging: **schema_contract_matches=true**, columns154, constraints95, triggers10 and reserved target vacant. That establishes inspected schema compatibility for this package; actual reviewer verification and separate application approval remain pending.

## Application boundary and verification

The current owner instruction authorises the proposed staging work. Application still requires a verified staging connection, compatible schema and the concrete package bound to an independently verified existing reviewer; no new access grant is implied. A compatible schema-readiness result alone is diagnostic. The guarded full preflight additionally checks explicit project/reviewer session attestations and actual auth user existence. It does not prove a host identity. Rehearsal performs temporary writes and belongs inside the same approved staging application package.

After reviewing and approving the exact package: run the guarded transaction once, then independent exact postflight/authenticated reader checks, verify prior-store fingerprints, and select the dedicated synthetic store with September or October 1–8 in the real hosted UI. A lost connection around COMMIT requires read-only postflight, never automatic replay. Rollback SQL is only for an open transaction; no committed evidence deletion is provided.

This fixture covers shared Sales/Profit/Margin/Briefing financial inputs. It provides no Xero account/report evidence, marketing attribution, customer lifetime metrics or cash eligibility. The disabled daily programme remains semantic preparation only; no recurring source writer has been activated. Detailed dashboard redesign follows working verified current pages.

## Local verification

The current package test exercises the real member sales reader and immutable profit reader in disposable PostgreSQL, including schema-compatible/incompatible readiness, rollback rehearsal without residue, exact September arithmetic, October profit withholding, rejection of full October coverage, replay refusal and preservation of existing Store D. **25 checks passed** across the current integration test, three original historical-package tests and 21 fixed historical-oracle/regression checks. The current integration test was rerun after the final reviewer-independent schema-readiness change; it passed. CLI generation of all ten files also passed.

## PostgreSQL catalog compatibility diagnosis

The disposable runtime reports PostgreSQL **18.3**. PostgreSQL [18 pg_constraint documentation](https://www.postgresql.org/docs/18/catalog-pg-constraint.html) records table NOT NULL constraints as `contype='n'`; [17 documentation](https://www.postgresql.org/docs/17/catalog-pg-constraint.html) records that type for domains only. Consequently raw constraint-count differences across major versions may include catalog representation differences. This is a diagnostic possibility, not proof that the recorded staging mismatch is harmless.

The preparation CLI additionally emits `schema-diagnostics.sql` (ten files total). It runs read-only and returns server/catalog major versions, visible constraint counts grouped by type, full-contract agreement, and mismatching table/column/constraint/trigger **identifiers and status only**. It does not emit definitions, function bodies, source rows or reviewer IDs. A changed definition is represented as the expected record missing plus an unexpected/changed record with the same identifier. The result explicitly says `application_authorized=false`; version agreement alone never authorises application.

Reconciliation sequence:

1. Run schema-readiness and schema-diagnostics on the independently verified staging connection. Save their value-free results; use version/type counts to identify catalog differences separately from actual layout/function drift.
2. Obtain an approved schema-only export for mismatching objects. Use the implemented intake-aware cross-version enforcement contract for ordinary PostgreSQL17/18 NOT NULL differences. Preserve every enforced NOT NULL attribute, exceptional NOT NULL constraint, relation constraint, generated column and immutable trigger. Any further difference requires inspected DDL reconciliation and fresh tests.
3. The generator uses PGlite18.3 with exact canonical enforced nullability plus all ten deployed safeguards; its read-only staging comparison now passes on PostgreSQL17. Any unsupported catalog exception remains a stop. No deployment migration or runtime grant is automatically proposed.
4. Only after the actual existing reviewer is independently verified, regenerate the reviewer-bound current package privately. Confirm the UUID is an existing approved synthetic reviewer with membership; it must not be a disposable test UUID or an inferred browser user. SQL generation creates no user or grants.
5. Review exact newly generated hash/counts and full guarded preflight with the separate staging-data approval. The application still refuses an occupied target and requires all original checks. Do not edit the transaction's expected schema literal after hashing.

Focused current-package integration tests cover both no-difference diagnostic output and an added-column mismatch with safe identifiers. Existing arithmetic/isolation/replay cases continue in that same focused test. The coordinator has since verified PostgreSQL17 and full intake-aware contract agreement live; reviewer verification remains a separate private step.

### Reusable server-side read-only diagnostic

`node deployments/render-staging/check-dashboard-schema.mjs` uses only the existing dedicated staging review configuration and TLS validation. It reads the fixed repository SQL file `deployments/render-staging/dashboard-schema-diagnostics.sql`; there is no user-selected SQL or apply path. It emits only allowlisted readiness fields, PostgreSQL major versions, type counts and component mismatch counts. Raw database errors, object identifiers/DDL and configuration values are suppressed. Missing catalog visibility yields a safe unavailable/mismatch state and does not create grants. Two focused checks verify target refusal, connection settings, error suppression, cleanup and output allowlisting; the expanded current-package SQL diagnostic test also passes.

For detailed private schema reconciliation the fixed SQL diagnostic itself returns only differing object identifiers/status. A separately authorised schema-only inspection can retrieve their definitions; the CLI does not publish those definitions. Credentials and source data are never part of this workflow.

## Latest intake-aware staging contract — supersedes the earlier PG17 gate

A reviewed **opt-in `deployed-intake` preparation mode** now reproduces the exact existing `20260910_review_setup.sql` in the disposable database before creating the synthetic ledger. This adds all five existing source/evidence/settings invalidation triggers to the original five immutable profit guards. None is disabled or removed. Exported application SQL still contains data inserts only; no review schema, role or grant is exported.

The opt-in schema contract compares every layout/generated-column property, all ten trigger definitions **and complete function bodies**, all ordinary constraints and explicit per-column `attnotnull`, `attislocal`, and `attinhcount` attributes. It represents ordinary validated/local/noninherited/nondeferrable PostgreSQL18 table NOT NULL catalog rows by their enforced column attributes, making those semantics comparable with PostgreSQL17. Unvalidated, nonlocal, inherited, NO INHERIT or deferrable NOT NULL exceptions remain catalog constraints and force mismatch against the ordinary fixture. Dropping a column's NOT NULL attribute is explicitly tested to refuse compatibility. This supersedes the earlier recommendation that this generator cannot prepare a PG17-compatible contract; the original unnormalized mode remains unchanged.

```sh
node experiments/financial-v1/prepare-dashboard-test-package.mjs EXISTING_APPROVED_REVIEWER_UUID EXPLICIT_MONDAY EMPTY_OUTPUT_DIRECTORY current-2026-10-09 deployed-intake
```

The canonical intake schema SHA-256 is `e5fe786fd72437c8c4ace1446db0082895629f9733c2e34fb0dda438657a6cc1`. Remote catalog differences must still pass **every** canonical contract check; metadata counts alone cannot establish readiness. The fixed repository diagnostic is now generated from this intake-aware contract. Earlier default-mode counts of 221 catalog constraints/five triggers describe the original disposable preparation, not this new expected semantic contract.

The intake-aware focused integration test passes: exact September profit and elapsed October sales, rollback without residue, replay refusal, full-October refusal, added-column drift, dropped-NOT-NULL drift and preserved Store D. Two CLI output/target/error tests also pass. No live application or new membership is authorised by these checks.

Binding the application still requires an independently verified existing synthetic reviewer. Prefer the existing Store D owner only after verifying that identity and its permitted synthetic-review role privately; do not infer a user from store labels, add auth users, create grants or commit that identity. The new target's one reviewer membership remains part of the separate explicit staging-data approval. Readiness/diagnostic artifacts contain no reviewer ID and can be executed before this binding.

## One-file operator application artifact

The CLI now emits `operator-apply.sql`, the exact guarded transaction with transaction-local staging-project and reviewer attestations included. It is usable after the independently verified actual reviewer is bound into the package; no preceding session SET command is needed. Those settings are operator attestations, never host verification or automatic approval. The separate `operatorSqlSha256` hashes this complete file including COMMIT. The original raw apply/preflight/rehearsal files are preserved.

The operator file adds no roles, grants or auth users. It inserts the one reviewed synthetic-store membership and the existing prepared data only. Its header requires independent staging TLS/reviewer verification and explicit reviewed data-application authority. As before, an occupied target, schema drift, missing actual auth identity or existing membership failure aborts the transaction. No uncertain outcome is retried. Focused tests exercise the self-contained operator rollback rehearsal, application, postflight and occupied-target refusal without preceding session attestations.

The optional `verifyStoreD:true` operator preparation mode additionally requires Store D to have exactly one existing membership belonging to the bound reviewer. It saves transaction-local counts and SHA-256 fingerprints of Store D across all 15 relevant relations plus marketing daily records, then checks the same fingerprints immediately before COMMIT. Its settings use `SET LOCAL`, which emits no reviewer result row. Focused disposable checks refuse a second existing Store D reviewer, refuse an injected Store D source mutation and roll back the entire new target, then verify successful self-contained rollback rehearsal/application and replay refusal. The private bound application and rehearsal files differ only in final COMMIT versus ROLLBACK; their complete hashes are supplied privately to the coordinator, and the actual reviewer identity is absent from repository documentation/tests.
