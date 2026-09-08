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
