# Restart sprint — Reliable Night Scout baseline

Started 8 September 2026 with Paul's approval. Work is on branch `codex/restart-baseline` in an isolated checkout based on `2cf59f6`. No live application or database changes have been made.

## First work package: trustworthy reporting-period states

Implemented and locally verified; not merged or deployed:

- Recovered all three Replit-only original specifications; added a project guide and decision record.
- Separated loading, current, historical, empty and unavailable period states.
- Replaced the revenue-based three-month limit with an order-count search covering two years.
- Suppressed the dashboard's unsupported briefing when data is stale, absent or unavailable; retained a clearly dated historical trading summary.
- Used one source for the dashboard opportunity headline and KPI.
- Labelled historical and unverified periods on the other pages using the shared period hook.
- Corrected completed-week handling on Sundays and prevented superseded period requests from publishing results.
- Added deterministic reporting-period regression tests.
- Addressed inherited Opportunity Finder typing errors and enabled existing build tools on macOS as well as Replit's Linux environment.

## Sprint backlog and acceptance criteria

- [x] Recover original product specifications into the working branch and provide one documentation entry point.
- [x] Agree sales/VAT/shipping/AOV/discount/refund-timing definitions; see `agreed-financial-definitions.md`.
- [x] Agree contribution/COGS, overhead, profit/EBITDA, cash and weekly-allocation definitions.
- [ ] Resolve remaining order eligibility and financial edge cases; agree opportunity/scoring definitions before implementing those policies.
- [ ] Complete dashboard consistency for current data: remove fixed narratives, status claims, upside values and all-time/snapshot fallbacks; preserve zero as a valid value. Apply the same evidence rules throughout the other analysis pages.
- [ ] Make monthly and weekly calculations reconcile against a known dataset including refunds, tax, COGS, overhead and period boundaries. No misleading comparison when the prior period is absent.
- [ ] Implement real authentication, store membership and server-side entitlements. Prove user A cannot read user B's data, and anonymous requests cannot access customer records or privileged analytics. Preserve a deliberately isolated demo experience.
- [ ] Reconcile live definitions, migration ledger and repository history. Produce a reproducible baseline and test it in a disposable database before considering a live change.
- [ ] Review and merge the branch, reconcile Replit's unpushed document commit, and verify a preview before publishing.

## Validation

- `pnpm test:baseline`: 9 regression tests passing (April-from-September, zero-value trading, exhausted history, RPC/partial failures, invalid counts, cancellation, Sunday, leap/year boundaries).
- `pnpm run typecheck`: all workspace checks pass after the inherited Opportunity Finder typing fix.
- `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/virtual-cfo build`: passes. Existing bundle-size and tooltip sourcemap warnings remain.
- Local browser fixtures: verified the dated April historical summary, unavailable-data message and no-data message. Verified the historical screen excludes the old static diagnosis and 100% decline; monitoring alerts are withheld in these states. Visual layout reviewed.
- Tests and browser verification used local fixtures, not live Supabase. Native build dependency versions are unchanged; only Mac platform packages were enabled.

The application preview used a local test-data server, not real credentials. Development environment setup requires Node 24, pnpm, `PORT`, `BASE_PATH`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Use publishable/anon keys on the frontend; never put a service-role key there.

## Remaining limits

This first work package starts the agreed sprint; it does not complete authentication, financial SQL reconciliation, ingestion or the recommendation engine. Other analysis pages still contain prototype content. Dashboard financial estimates are withheld pending reconciliation; its trading narrative is now dynamic. Weekly analytics remain semantically incomplete even though calendar boundaries are corrected. The bounded search can report no data found for history older than two years. Store timezone support is not yet implemented. The connected Supabase account remains read-only.


## Work package 2 — dynamic trading briefing

Implemented in the same draft branch (not deployed):

- The current-period headline, metric cards and suggested areas to investigate now come from one pure calculation model. No fixed profit/advertising/cash diagnoses remain on the dashboard.
- Compare the immediately preceding completed period using the same trading functions. An absent or failed comparison produces no change claim or recommendation. Rate changes use percentage points; non-positive comparison bases use absolute currency differences.
- Preserve valid zeros. Missing/malformed scalar database results record errors rather than masquerading as zero.
- Offer an explicit historical test preview so the existing older seed data can exercise the dynamic briefing without being described as current trading.
- Label the hardcoded store explicitly as test data. Withhold contribution/profit, runway and recovery estimates until their cost, date and impact definitions are reconciled. Keep their detailed pages and models available for continued development.
- Automated monitoring is labelled inactive on the dashboard. Review prompts describe observed changes, not proven causes or promised savings.
- Financial consistency on other pages and the real shared recommendation engine remain unfinished.

Paul clarified that Supabase table construction and UI wiring were incomplete when development paused. The next work package is the [metric-to-source reconciliation](metric-source-reconciliation.md). It distinguishes existing tables from missing calculations, incomplete test data and unconnected fields. No Supabase changes were made in this work package.

Validation: 20 regression tests pass; full workspace type checking and frontend build pass. Browser fixtures verified rising sales, falling sales, missing and failed prior-period data, and opening/closing the explicitly labelled historical test preview: the headline and cards changed together, and absent comparisons produced no trend or suggested review. Existing build warnings about bundle size and tooltip sourcemaps remain.

## Work package 3 — measured source reconciliation

- Compared source aggregates with all six trading RPCs and qualifying order count over 3 months and 14 weeks: 119 checks, no arithmetic mismatches against the current SQL. Reproducible read-only SQL is in `db-migrations/checks/`.
- Recorded missing stored sales/currency, incomplete refund events/tax components, missing product costs and a probable conflict between seed tax basis and the current net-sales formula. Current SQL agreement is not financial correctness.
- Updated the screen-to-source map and proposed a small synthetic ledger with explicit tax/refund/cost conventions in `trading-reconciliation-2026-09-08.md`.
- Dashboard and comparison now load only six trading sources; unrelated contribution/opportunity failures cannot suppress trading. Failed fields stay unavailable. Historical/current formatting is shared, including AOV precision.
- Detailed pages still contain the mapped snapshot fallbacks and inconsistent bases. These are not marked complete. No live schema/data, ingestion, migration replay or deployment changes.

Validation: 23 regression tests and full workspace type checking pass. Production build passes with the existing bundle-size and sourcemap warnings. New tests pass observed aggregate March/April responses through the trading adapter and briefing model; no new live browser/authenticated API verification is claimed.

Sales/VAT/AOV/refund timing are now approved in `agreed-financial-definitions.md`; contribution/profit/cash definitions are also approved below. Remaining eligibility, edge cases and scoring decisions still need resolution. Next implementation stage, after remaining relevant decisions: implement and test versioned normalised trading and coverage in a disposable database, then add historic COGS and rewire contribution/overhead/cash and detailed pages. Keep existing raw test records intact.

## Sales definitions approval — documentation only

Paul approved sales definitions v1 on 8 September, explicitly including pre-refund AOV and refund-event timing. Recorded the exact scope and worked example in `agreed-financial-definitions.md`, linked it from the guide and updated the decision/backlog status. No further code or database changes were made.

GitHub is the durable record; Replit should use the same versioned documents. This documentation is on the existing draft branch, not yet merged into main or verified as synced to Replit. Preserve Replit's uncommitted work when syncing.

Validation: documentation links and diff reviewed; no application tests rerun for this documentation-only change.

## Contribution, profit and cash approval — documentation only

Paul approved all proposed contribution, profit and cash definitions on 8 September 2026. Updated `agreed-financial-definitions.md`, the guide and baseline decision record. Main contribution is after marketing; runway uses actual average monthly cash burn over the last three complete months. Historic costs, saleable-return COGS reversal, margin denominator, separate EBITDA, daily overhead allocation and separate cash-release opportunities are recorded explicitly.

Status: agreed, not implemented or deployed. No code/database changes. GitHub draft branch remains the durable record; main/Replit synchronisation is still pending. Remaining edge cases are distinguished from the approved core definitions. Validation: documentation diff and links checked; no application tests rerun.

## Financial acceptance cases v1 — before implementation

Created ten synthetic worked cases in `financial-acceptance-cases.md` and matching machine-readable integer-pence fixtures in `tests/fixtures/financial-acceptance-v1.json`. Includes tax normalisation, zero-rated sales, a complete February profit bridge, March partial/full refunds of February orders, historic cost and saleable return handling, missing costs, cross-month weekly overhead allocation, cash transfer exclusion, actual-burn runway, positive cash generation and separate one-off cash-release impacts.

Manually specified expected results were independently checked for arithmetic consistency. JSON parses and case IDs are unique; documentation links and diff checked. These are acceptance targets, not automated tests against the application or live SQL. No application tests rerun because runtime code was unchanged. The existing 23-test suite remains the earlier wiring baseline.

Unresolved edge cases are listed without inventing expected policy. Next implementation work can use these fixtures to test versioned calculations in a disposable database, then API/UI outputs. No Supabase data/schema or application changes, merges, deployments or Replit synchronisation were performed. Fixtures and docs are saved in the GitHub draft branch.

## Isolated financial prototype — implementation against agreed cases

Added `experiments/financial-v1/calculations.mjs`, a pure local module with no app, database, network or fixture dependencies. Normalises explicit tax bases, aggregates sales/refunds by resolved event date, preserves original AOV, handles historic/saleable-return COGS and missing costs, assembles the approved profit bridge, allocates recurring overhead and calculates scoped cash movement/runway. Forecast cash-release impacts remain separate from actual balances.

`pnpm test:financial`: 15 tests pass (F01–F10 plus five guard groups). The existing `pnpm test:baseline` suite also passes all 23 tests. Tests consume the previously committed expected fixtures; expected amounts were not changed to fit implementation. Covers store/currency/date checks, duplicate events, unknown eligibility, missing costs, invalid money, unverified cash history, non-positive denominators and fractional allocation. Inputs must already have complete coverage and resolved eligibility/event/currency policies; this module does not infer them from live data.

This is a Node test environment, not a disposable PostgreSQL/Supabase instance. No migration, live data write, app wiring, merge, deployment or Replit sync. Future adapters still need verified source mappings, deduplication/correction rules, cost evidence, authorisation and policies for outstanding cases. Next: build a versioned source adapter and disposable database tests against the same fixtures before changing the app.

## Disposable database source adapter — trading, refunds and costs

Added a versioned experimental source schema and read-only adapter in `experiments/financial-v1/`. Relational order/refund/cost rows feed the agreed calculation module using exact decimal-to-pence conversion. Original-order links include store identity; unique event/cost keys prevent double insertion. Adapter reads a repeatable-read snapshot, checks coverage/currency/date/tax/eligibility evidence, validates cumulative refunds and returned quantities, and preserves historic cost evidence. Estimated costs retain provenance; missing costs withhold profit.

`pnpm test:financial-db`: 14 tests pass in disposable in-memory PostgreSQL (PGlite 0.5.8, exact pinned dev dependency). F03/F04 bridge and later refunds agree with the unchanged expected fixtures after database insertion and adapter reads. Additional tests cover tax normalisation, missing costs, cross-store links, duplicate imports/costs, incomplete coverage, over-refunds/returns and decimal precision. This is a new experimental input contract, not a claim that current Supabase tables satisfy it.

See `source-adapter-status.md` for limits: current cloud rows lack key evidence; live mappings, cash/marketing feeds, automatic idempotent ingestion/corrections, production authentication/RLS and migration-history reconciliation remain pending. No live DB access/write, app wiring, migration application, deployment or Replit sync in this package.

Validation for this package: all 52 tests pass (14 database adapter + 15 isolated financial + 23 dashboard baseline). Workspace type checks and frontend production build pass. Existing tooltip sourcemap and bundle-size warnings remain. Dependency lock changes reviewed: PGlite added as an exact dev dependency and existing Drizzle optional-peer resolution updated; other package versions unchanged.

## Supabase-shaped sales/refund mapping proposal

Inspected current orders/refunds/line/store schema and constraints read-only. Added `db-migrations/proposed/finance_v1_sales_evidence.sql` outside automatic migrations: private evidence schema, same-store foreign keys, mapping views with stale-source detection and deny-by-default RLS. No backfill or raw financial changes. Added a read-only sales mapper that joins the inspected raw shape to explicit evidence; COGS remains unavailable until line-level history/recovery is mapped.

Nine disposable PostgreSQL tests execute the exact proposed SQL and verify F03/F04 monetary sales/refunds and AOV, preservation of raw records, missing/stale evidence, split reconciliation, cross-store links, RLS and atomic rerun failure. The live Supabase migration-list tool failed on missing `name`; direct read-only queries show a version-only ledger with 25 entries through 20260502000018, inconsistent with repository history. No ledger repair attempted.

Full mapping, proposed deployment sequence and limits: `supabase-sales-mapping-proposal.md`. Pending: approval/evidence workflow, missing source facts, original eligibility/timezone policies, faithful migration baseline and production role tests. No live schema/data edits, app wiring, merge, deployment or Replit sync.

Validation for this proposal: all 61 tests pass (9 cloud-shaped mapping + 14 source adapter + 15 financial + 23 dashboard). No new dependency/runtime-app changes; type/build were not rerun because this package adds isolated test code, proposed SQL and documentation only. Links and diff checked.

## Migration history recovery and observed baseline

Recovered 27 historical SQL files from Git history, covering every one of the 25 recorded cloud versions. Preserved hashes/provenance in an archive outside the runner. Compared later repository function bodies with the live definitions: several later changes are present despite missing ledger entries; recoverable contribution lacks the repository monthly-contribution filter, and opportunity breakdown differs from its recovered source. Data patches remain unverified.

Captured public schema/ACL metadata read-only and rebuilt 22 tables, 5 views and 24 functions in disposable PostgreSQL. Round-trip structural and non-owner object-grant checks pass, including generated columns. The exact additive sales-evidence proposal applies to that baseline without changing existing function definitions. Archive hashes also pass. No live ledger/schema/data changes or historical migration replay.

Validation: 63 tests pass across the two migration-baseline groups and previous 61 dashboard/financial/adapter tests. No application/runtime dependency changes; type/build not rerun for this isolated test/documentation package. See `migration-history-reconciliation.md` for evidence, limitations and next steps. Full Supabase/API-role reproduction, targeted opportunity correction and reviewed ledger repair remain pending. GitHub draft updated; main/Replit not synchronised.

## Targeted recoverable-contribution correction

Prepared `db-migrations/proposed/20260908000001_recoverable_contribution_monthly_only.sql`, outside the automatic runner. It restricts the existing range function to monthly-contribution impacts without replaying seed changes. Existing signature, store/status scope, security mode, owner/grants and legacy empty/NULL aggregation semantics remain intact. No opportunity scoring or data classification is introduced.

Three new regression groups reproduce the mixed-impact defect and verify corrected totals, cross-store/archived exclusions, empty inputs, row/object/grant preservation and repeat application against the restored observed public schema. All 66 tests pass. No runtime app/dependency edits; type/build not rerun. See `recoverable-contribution-correction.md`.

Saved to the GitHub draft, not deployed, merged or synced to Replit. Supabase was not accessed or modified in this package. Next: production authentication/store-isolation design and API-role tests, then a reviewed migration registration/deployment. Existing security-definer access remains an explicit limitation.

## Authentication/store-access verification and local protection

Confirmed simulated login/signup and no membership model in the captured schema. Reproduced an anonymous cross-store read via the legacy security-definer range RPC in disposable PostgreSQL. Replaced misleading older auth-plan claims with the actual enforcement requirements.

Prepared an undeployed membership/RLS proposal for all 22 public tables, five views and 24 RPCs. Authenticated users read member stores only; anonymous RPC execution and client writes/self-enrolment are denied. Four tests cover the baseline leak, all-RPC/view isolation, missing identity, revocation, denied writes, and protection against replaying the earlier financial fix to undo hardening. Auth identity is stubbed locally; no JWT/gateway conformance is claimed.

Removed service-role proxying from the local unauthenticated opportunity endpoint; it returns 503 until real authenticated access exists. A loopback HTTP test verifies anonymous and forged identity/store requests cannot trigger upstream access. Initial sandbox socket denial was resolved through an approved local test run.

Validation: 71 tests pass (70 database/financial/dashboard tests plus the HTTP test). Workspace type checking passes. The first build stopped because PORT/BASE_PATH were absent; rerunning the workspace build with local PORT=5173 and BASE_PATH=/ passes, with existing frontend sourcemap/bundle warnings. No live Supabase reads/writes, deployment, merge or Replit sync. Next: confirm Supabase Auth, implement actual sessions and membership-selected stores, and run two-user staging gateway tests before enabling the route or deploying proposals.
