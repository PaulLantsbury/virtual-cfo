# Build and test cleanup — 21 November 2026

Status: source-only cleanup of overnight branch `9f034cc6519df597423db4c01f3afb2877cfac68`; hosted website, database, provider and daily-feed configuration remain unchanged. Three independent agents and a coordinator reviewed declarations, broad synthetic tests and overnight compatibility. No live Xero request or retry was made.

## What actually blocked checks

The 17 TS7016 errors were missing declarations for JavaScript modules imported by the TypeScript API. They were internal build-contract gaps, not Xero refusing an API call. Precise `.d.mts` contracts now cover the 17 modules, with shared types and raw provider JSON kept `unknown` until validation. A strict compile-only regression checks the important boundaries without wildcard module declarations, implicit-any escapes or disabled checks.

Accurate declarations exposed a pre-existing type mismatch: the worker credential port described `date`, while the orchestrator actually supplies `from` and `to`. The two annotations now match the actual range. Independently compared emitted JavaScript is byte-identical; no provider runtime behaviour changed.

The full Xero suite initially reported 320 tests:312 passed and8 failed, all in the historical Demo isolation fixture. It was using the real wall clock after its intentionally bounded 6 November setup expiry. The test fixture now controls its historical clock in a newly created disposable database. Source production SQL/expiry, logins and approval windows are untouched. Positive in-window cases and explicit before-opening/exact-expiry rejection remain required. Private failure logs include SQL diagnostics and are not published.

## Other defects fixed during independent review

- Optional customer aggregates must obey first-customer, unique returning-customer, identified-order and overlap/union constraints. Impossible frequency inputs are rejected. Two inconsistent toy fixtures were corrected; canonical generated source and legacy published summaries remain valid.
- Refresh eligibility requires typed monthly evidence, exact UUID/revision formats and no duplicate months. Later months cannot become eligible across a missing predecessor. This remains an offline proposal, not an executor or hosted publication.
- The shared cloud programme file ended in literal `undefined`. Replaced it with durable batch order, exact baseline history, authority limits, acceptance gates and honest reporting instructions.
- Added separate complete-domain `test:synthetic-company` and `test:xero` entrypoints, serial file execution and five-minute per-file timeout. Existing full workspace build/typecheck gates remain mandatory and unchanged; domain separation does not waive them.

## Validation

- Full root workspace `pnpm run build`: PASS, including referenced-library build, all four workspace typechecks (API, frontend, mockup sandbox, scripts), API bundle and both frontend builds.
- Complete Xero domain: **321/321 passed**, zero failures/skips/cancellations, serial file execution with five-minute per-file timeout; approximately 56 seconds. The historical fixture is 10/10, including exact time-boundary checks.
- Complete existing synthetic-company suite: **146/146 passed**, zero failures/skips/cancellations, 30 files; 4 minutes 42 seconds. The cloud's reported broad failure was not reproduced. Subsequent new guard changes were checked in their affected focused suites rather than rerunning unchanged heavy database cases.
- Final customer/economics/Plan focused checks: **18/18 passed**. Final refresh proposal checks: **5/5 passed**. These overlap existing suites; do not sum them into an inflated grand total.
- Strict Xero declaration regression runs with `skipLibCheck=false`; exact worker range, unknown raw reports, discriminated unavailable/failed results and read scopes are checked. No production `.mjs` Xero or SQL proposal bytes changed.
- Independent reviews of declaration contracts, historical clock containment, customer cardinalities, refresh continuity and legacy summary compatibility passed; whitespace check passed.

The local checkout reused installed packages from an identical frozen lockfile, including the mockup workspace. Local package-manager dependency-state warnings reflect isolated linked packages, not a modified lockfile. The full existing root build was executed with configured `PORT`/`BASE_PATH`; no TypeScript error was suppressed. On a fresh cloud checkout, install normally with `pnpm install --frozen-lockfile` before running the documented commands.

Existing non-fatal tooltip sourcemap, mixed-chunk and bundle-size warnings remain. They are separate performance/polish work. The historical broad cloud synthetic failure could not be reproduced; without its original stderr we cannot claim that concurrency or memory was the proven cause.

## Rollout and next work

A clean local build/test suite is not real-provider acceptance. Before Xero customer rollout, separately verify real OAuth/renewal/reconnect, tenant/membership isolation, owner-confirmed mapping, period/currency reconciliation and accurate stale/error states. Do not revive expired staging trials or replay historical provider operations based on these unit tests.

The overnight 90-day continuation remains prepared, not published; the prior 48 summaries are immutable. New customer aggregates need separately reviewed summary/version work before they appear on historical live pages. Plan's baseline helper is still not wired to Plan; Scout remains a proposal. Genuine scheduled financial receipt acceptance remains a read-only operational milestone.

Next: review and integrate the cleaned overnight source, complete Plan wiring and remaining source comparisons, verify scheduled receipts, then prepare the exact data/website activation package. Do not restart completed Profit/Cash/Marketing/Plan designs.
