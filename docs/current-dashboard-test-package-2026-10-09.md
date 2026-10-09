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

Outputs: `historical-manifest.json`, `schema-readiness.sql`, `historical-preflight.sql`, `historical-rehearsal.sql`, `historical-apply.sql`, `historical-postflight.sql`, `historical-rollback.sql`, and `daily-disabled-plan.json`. No database/network connection or source writer exists in the preparation CLI. The default without the final option remains the original historical package.

Current manifest SHA-256: `ac76def32951fbc2eacdf897ece29d1c53b240f7481f75a150261590ba4ac193`. Disposable schema SHA-256: `c75f98ba556cd0ba42c8170e72ab666ba4c58998a034b3b20a457707b53cd175`. SQL hash depends on the explicit reviewer and is generated alongside the exact transaction; no disposable review hash authorises live execution.

## Read-only compatibility preflight

Independently confirm the TLS connection is staging `bioalckltvkhlczusdvl`, not production, before using any SQL file. `schema-readiness.sql` uses `BEGIN READ ONLY` and ends `ROLLBACK`. Its single JSON result returns:

- expected table/column/constraint/trigger counts and visible column/constraint/trigger counts;
- exact schema-contract agreement and reserved synthetic target vacancy;
- explicit flags that separate reviewer, auth-identity and connection-identity verification are still required. The schema-readiness file itself is reviewer-independent and can be run before binding the remaining application files to a verified reviewer.

The query compares all expected layouts, constraints and trigger implementations internally but emits no DDL, tokens, credentials, customer rows, financial values, membership identities or connection strings. Count agreement alone is insufficient: `schema_contract_matches` must be true. Visibility limits may yield false or a permission error; that is a stop, not authorisation for grants. The current query deliberately retains the original full exact contract. If deployed metadata differs, reconcile the disposable fixture to inspected, approved deployed DDL and regenerate/retest; do not strip triggers or ignore constraints to obtain a passing result.

The read-only query is ready for a verified staging operator because this session could not retrieve deployed schema through the protected SQL editor. No current remote compatibility result is claimed. The older recorded schema mismatch is not automatically a current diagnosis.

## Application boundary and verification

The current owner instruction authorises the proposed staging work. Application still requires a verified staging connection, compatible schema and the concrete package bound to an independently verified existing reviewer; no new access grant is implied. A compatible schema-readiness result alone is diagnostic. The guarded full preflight additionally checks explicit project/reviewer session attestations and actual auth user existence. It does not prove a host identity. Rehearsal performs temporary writes and belongs inside the same approved staging application package.

After reviewing and approving the exact package: run the guarded transaction once, then independent exact postflight/authenticated reader checks, verify prior-store fingerprints, and select the dedicated synthetic store with September or October 1–8 in the real hosted UI. A lost connection around COMMIT requires read-only postflight, never automatic replay. Rollback SQL is only for an open transaction; no committed evidence deletion is provided.

This fixture covers shared Sales/Profit/Margin/Briefing financial inputs. It provides no Xero account/report evidence, marketing attribution, customer lifetime metrics or cash eligibility. The disabled daily programme remains semantic preparation only; no recurring source writer has been activated. Detailed dashboard redesign follows working verified current pages.

## Local verification

The current package test exercises the real member sales reader and immutable profit reader in disposable PostgreSQL, including schema-compatible/incompatible readiness, rollback rehearsal without residue, exact September arithmetic, October profit withholding, rejection of full October coverage, replay refusal and preservation of existing Store D. **25 checks passed** across the current integration test, three original historical-package tests and 21 fixed historical-oracle/regression checks. The current integration test was rerun after the final reviewer-independent schema-readiness change; it passed. CLI generation of all eight files also passed.
