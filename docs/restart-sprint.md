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

## Local Supabase sign-in and session/store gate

Implemented real SDK password login/signup, confirmation/error handling, session restoration/user verification and membership-selected stores. Removed simulated auth, nonfunctional social/reset buttons and demo bypass/banner. All merchant routes plus timeline/AI drawer are gated; seven connected pages use the selected authorised store. Missing membership/table or session errors keep merchant data hidden.

Account/token/store transitions clear the query cache and remount protected state. Delayed results are discarded. Logout closes the UI immediately; failed logout cannot be undone by an automatic token refresh. Real database RLS remains essential and is not applied by this package. The disabled opportunity API stays disabled.

Validation: eight controller tests and five mocked browser groups added; total 84 passing tests including the previous 71. Full type checking and workspace build pass with local PORT/BASE_PATH and existing warnings. Mocked browser tests used installed Chrome, an isolated profile and fake Supabase endpoints; no real accounts or database writes. Login error layout visually reviewed. No deployment, merge or Replit sync.

Stop here for today. Next-session staging setup, exact prerequisites, remaining features and reproduction commands are in `local-auth-handover.md`. GitHub draft is the durable handover; live sign-in/gateway/real-token tests remain pending.

## Staging project verified and bootstrap prepared — 9 September

Paul created Night Scout Staging (`bioalckltvkhlczusdvl`, Ireland). Read-only dashboard/SQL inspection confirms a healthy project with zero public tables/views/functions and zero Auth users. Email auth and confirmation are enabled; redirect configuration is still the default. Existing project remains untouched.

Prepared one atomic bootstrap from the observed schema plus monthly-contribution and membership-read proposals. Two new local test groups pass, including role/membership reads and rollback after late failure. Script and read-only post-application verification are versioned under `db-migrations/staging/`; no remote DDL or users have been created by the agent. See `staging-setup-2026-09-09.md` for exact target, hash and approval boundary. Next: confirm applying these staging permissions, execute and verify, then arrange actual test users and preview redirect settings.

## Staging bootstrap applied — 9 September

After Paul's explicit approval, applied the exact tested atomic bootstrap only to Night Scout Staging (`bioalckltvkhlczusdvl`). SQL editor copy-back matched the committed SHA-256. Supabase reported success; read-only checks confirmed 23 tables with RLS, 23 policies, five invoker views, 24 functions, zero security-definer/anonymous-executable functions and zero users/memberships/stores. See `staging-setup-2026-09-09.md`.

Original Supabase project, Auth settings and Replit were untouched. No application deployment or merge. Next: staging preview configuration and user-assisted test accounts, then actual JWT/gateway store-isolation and sign-in checks. Prior local tests do not replace those checks.

## Financial event rules approved and preparation implemented

On 9 September Paul approved original paid/completed eligibility, explicit exclusions, store-local actual event dates and review of ambiguous adjustments. Recorded in agreed-financial-definitions.md. Added isolated event-evidence preparation and five passing regression groups. No application/database change; financial integration remains incomplete. See financial-integration-next-step.md for the staged connection and acceptance checks.

## Verified-sales connection prepared

Added an isolated development preview backed by a proposed member-checked evidence RPC and shared sales/refund calculation adapter. Exact staging package and three new integration groups pass; nine existing adapter tests also passed. Type checking/build pass. No remote database change yet: the permission change and synthetic refund fixtures await application. Existing briefing remains legacy. See financial-integration-next-step.md for scope, hash and expected results.


## Verified-sales staging package applied and preview checked

On 9 September, explicit approval was followed by successful application of the exact recorded financial evidence package to Night Scout Staging. Real Store B preview: August sales/AOV GBP 987; September refund GBP 87 and net sales GBP -87, with no original-order AOV. An uncovered July period remained unavailable. The new endpoint rejected other-store and anonymous requests; permitted evidence remained scoped to the assigned store. Temporary diagnostic page removed.

See financial-integration-next-step.md for the applied hash, verification scope and limitations. Main briefing calculations remain legacy; next connect its sales/AOV and narrative to verified evidence. No production deployment, Replit sync or merge.


## Main briefing connected to verified sales — 9 September

The local dashboard now reads the verified sales endpoint for the selected completed period and the immediately preceding period. It no longer uses legacy order counts to skip refund-only periods or substitute older periods. Cards and narrative share verified net/gross product sales, original AOV and value-based discount rate. Refund amounts and net shipping are shown separately; refund-rate and repeat-purchase ratios remain withheld pending definitions/evidence. Unsupported profit/cost claims remain unavailable.

The bounded staging integration uses GBP and Europe/London; general store currency/timezone configuration and scalable evidence retrieval remain outstanding. Weekly dates require exact verified coverage; monthly coverage is not silently treated as weekly coverage.

Validation: 26 analytics tests pass, including three new verified-briefing cases for original AOV, refund-only periods and inactivity. Workspace type checking and frontend build pass (existing sourcemap/chunk warnings). Signed-in browser check showed August GBP 987 sales and AOV with unavailable previous-period comparison; changing to the uncovered week hid figures and narrative and showed unavailable. Refund-only copy is regression-tested; September remains available in the separate preview because it is not yet a completed month.

Saved locally; Paul subsequently explicitly approved publishing this code-and-document package to the public GitHub draft. No database changes, Replit sync, merge or production deployment in this step. Next: generalise store reporting settings and evidence coverage/ingestion before expanding beyond synthetic staging data.


## Store reporting settings connected — 9 September

The local verified briefing and comparison preview now read the selected store's existing currency and timezone settings. Completed reporting periods follow the store calendar, including month boundaries and DST. Missing/invalid settings block financial reads; cache keys include store, currency, timezone and dates. Currency must match the verified evidence, and incompatible previous-store/currency comparisons are withheld.

The arithmetic currently supports currencies with two decimal minor units; unsupported precision (for example JPY or KWD) is explicitly unavailable. No currency conversion was added. No store settings or database records were changed.

Validation: all 30 analytics tests pass, covering timezone-boundary differences, DST, malformed settings, unsupported precision, dollar formatting and incompatible comparisons. Workspace type checking and frontend build pass with existing sourcemap/chunk warnings. Signed-in staging briefing still displays August GBP 987 sales and AOV after loading the store settings.

This does not re-date historic evidence or certify a later timezone change. Evidence must be regenerated/reverified when its source assumptions change. Remaining work: persist the timezone/source-settings provenance with evidence, build controlled ingestion and support reliable period coverage beyond hand-created fixtures. Frontend work is local/draft only; no Replit sync, merge or production release.

Publication checkpoint: Paul explicitly approved this store-settings code-and-documentation package and its upload to the public GitHub draft.

## Import dry-run review prepared — 9 September

Added a source-neutral import-readiness checker and eight passing tests. It checks scope/settings, completed-period capture, page chains, duplicate/missing records, mapped evidence and shared financial reconciliation; it reports candidate results without certifying coverage or writing records. Identical/changed batch fingerprints support a future reconciliation process but are not persistent idempotency. See import-readiness.md for the input contract, limitations and next source-mapping/writer steps.

No actual Shopify store/export has been supplied for this checkpoint. No database, Replit or production changes. The user has been asked which real source is available. This is preparation for ingestion, not a completed real-data connection. Tests cover this isolated addition; unchanged application type/build checks were not repeated.

Publication: Paul explicitly approved uploading the import-review code and documentation to the public GitHub draft. Earlier packages remain published.

## Shopify extraction foundation with test data — 9 September

Paul confirmed no Shopify account is available and approved building against test data. Added a server-only fixed-query reader and bounded order/refund-summary collector, checked against official API documentation and tested with synthetic HTTP responses. Ten Shopify test groups and eight import-review groups pass. See shopify-connection.md for implemented checks, source references and limitations.

The collector retains review-required refunds/edits and does not certify coverage or populate financial evidence. Complete line/tax mapping, installation/authentication, durable collection/writes and a real-store conformance check remain outstanding. No live Shopify/Supabase calls, Replit sync, merge or production release. Application/build code is unchanged.

Publication checkpoint: Paul explicitly approved uploading the Shopify connection foundation code, tests and documentation to the public GitHub draft. Earlier packages remain published.


## Shopify detail mapping with synthetic end-to-end checks

Added fixed product/shipping/refund detail retrieval and conservative source mapping for unedited, tax-exclusive, single-SALE orders. Actual components reconcile to original payment and refund transactions; store-local payment dates preserve original AOV and event-period refunds. Unsupported/ambiguous cases are blocked. See shopify-connection.md for the exact supported subset and remaining work.

19 Shopify tests and 15 shared financial tests pass. The synthetic HTTP-to-calculation case returns GBP 90 original AOV and a later GBP -20 net-product refund period. Shipping stays separate. No database/evidence write, live account call, application change, Replit sync or production release. Next: extend supported mappings and prepare durable source/provenance/coverage controls before a staging writer.

Publication checkpoint: Paul explicitly approved uploading the product/tax/refund mapping code, tests and documentation to the public GitHub draft. The earlier connection package remains published.

## Durable import candidate recording — local proposal

Added a private candidate-batch schema proposal and transactional recording helper. Source identity/settings are checked against the locked store row; identical and historical replays are distinguished; changed or newly blocked content becomes a new candidate for the exact range while retaining prior history. Coverage cannot be certified through these tables. See import-candidate-intake.md for implementation and limits.

All 25 Shopify tests pass, including six new database groups for replay, source/settings checks, rollback, denied public access and persistence across close/reopen. No live schema/data change, application update, Replit sync or production deployment. Next: source-version ordering and cross-period invalidation before any verified-evidence writer.

Publication checkpoint: Paul explicitly approved uploading the candidate-intake schema proposal, helper, tests and documentation to the public GitHub draft.


## Standing GitHub draft publication approval

Paul requested removal of repeated routine upload approvals. Recorded scoped standing approval in AGENTS.md and in the local Codex auto_review.policy setting for this repository/draft. Existing local configuration was preserved. This covers subsequent development packages and their implementation documentation; credentials/customer data, database application, merging and production releases are outside scope. Managed review rules still take precedence, and immediate reload of the setting in an already-running task has not been verified.


## Source versions and cross-period recheck controls

Extended the local candidate-intake proposal with per-order/refund source versions and sticky period recheck flags. Older unseen versions are refused; same-version conflicts and missing records require review. Accepted changes conservatively flag all known candidate periods for the store. The private candidate-state reader returns no figures, including when data awaits review. No replay clears a flag.

29 Shopify tests pass. Existing rollback/restart/role protections remain covered; new cases cover independent refund versions, unseen older input and multiple affected periods. See import-candidate-intake.md for the important boundary: this is candidate-state protection, not yet wired to existing finance coverage or the briefing. No live database, Replit or production changes. Next is a reviewed recheck/publication flow that carries these controls into authoritative evidence.

## Verified-coverage invalidation bridge prepared locally

Added an additive SQL proposal linking raw/source changes and candidate review flags to finance_v1 coverage. Same-transaction invalidation makes the existing verified-sales adapter reject previously verified figures; other stores remain available. It never publishes candidates or restores coverage. See verified-invalidation.md for trigger scope, tests and the remaining reviewed-publication/client-refresh work.

35 Shopify tests pass, including six new integration groups against the exact committed staging bootstrap and financial fixture package in disposable PostgreSQL. No live staging changes, application updates, Replit sync or production release. Next: bind independently reviewed evidence and completeness to exact source versions before a publication transaction can re-enable figures.

## Read-only candidate review packet

Added individual event reconciliation and a snapshot-bound review packet, documented in candidate-review.md. Matching aggregate totals cannot conceal changed source identities, dates or financial event components. The packet checks current source versions/settings and existing evidence, remains uncertified, and performs no writes. 41 Shopify tests pass, including an actual disposable PostgreSQL snapshot check.

The restoration step is not complete: original sale VAT component reconciliation, independent coverage review, reviewer audit storage and an atomic guarded publication operation remain required. This checkpoint prepares the review without prematurely restoring figures. No remote database changes, Replit sync or production deployment.

## Original-sale VAT reconciliation

Source sale events now retain actual product VAT after discounts, shipping VAT and the original reconciled customer payment. Candidate review compares all three against finance evidence, blocking incorrect tax allocations even when net sales and total payment agree. Missing original tax/payment evidence also blocks. Existing AOV/refund timing rules are unchanged.

43 Shopify tests pass, with original tax/payment assertions in the synthetic HTTP mapping tests and mismatch/review regression cases. Updated candidate-review.md with exact restoration gates and remaining boundaries: tax-inclusive imports and separate pre-discount VAT allocations are not inferred; completeness review and the atomic audited restoration writer are still pending. No live database, Replit or production changes.

## Recorded approval and period restoration — local proposal

Implemented an internal authenticated-reviewer hook, explicit per-store reviewer authorisation, exact snapshot recheck, retained append-only audit snapshot and atomic restoration of the reviewed coverage range. Evidence edits now also invalidate coverage. Existing source/raw invalidation and client read restrictions remain in place. See reviewed-restoration.md.

48 Shopify tests pass, including five disposable PostgreSQL restoration groups. Live authentication/provisioning, least-privilege service grants, multi-session concurrency testing and review UI integration remain required before staging application. The conservative global table locks block writes during restoration and need throughput review. No Supabase changes, Replit sync or production release.

## Reviewer token verification — local composition

Added a server-side Supabase getUser adapter that verifies each supplied bearer token, rejects anonymous/failed/malformed identities, suppresses upstream error details and ignores body-supplied reviewer IDs or authentication callbacks. The existing database membership and explicit reviewer grant remain mandatory. The successful synthetic database restoration test now runs through this adapter.

52 Shopify tests pass; Auth responses are synthetic, not live verification. No local PostgreSQL server/Docker was found, so independent-session contention tests remain unrun; their exact required cases are recorded in restoration-concurrency-checklist.md. Live client provisioning, least-privilege permissions and HTTP/UI integration remain pending. No live database, Replit or production changes.

## Independent PostgreSQL contention tests completed

Prepared and ran a standalone PostgreSQL 18.4 test harness using an isolated temporary cluster with TCP disabled. Seven cases pass: committed/rolled-back competing writes, raw/evidence changes after review locks, duplicate approvals, reviewer permission removal and lock timeout. Tests observe lock waits from a third connection and verify final audit, coverage and the existing member sales reader. Another store remains readable. The 52 existing Shopify tests also pass after sharing fixture setup between the suites.

The runner shuts down and removes its synthetic cluster; standalone binaries stay outside the repository. No application dependency/lockfile change, live Supabase mutation, Replit sync or production release. Forced deadlock/load testing and matching the deployed service configuration remain limitations. Next: least-privilege service configuration and authenticated request/UI integration; token verification remains tested with synthetic Auth responses.


## End-of-day handover — 9 September

Paul stopped development for today. Read session-handover-2026-09-09.md before resuming: it records the current tested checkpoint, applied-versus-proposed boundary, remaining roadmap and next service-permissions/authenticated-review work. No further development or deployment was performed for this handover.

## 10 September — restricted review service and authorised preparation

Resumed from the 9 September handover. Added a local-only non-login internal review role with explicit read/append/column-update grants and RLS policies. A fixed argument-free definer helper acquires dependency locks without granting source mutation rights. Authenticated preparation now checks explicit reviewer authorisation before inspecting a candidate. See review-service-permissions.md for the trust boundary and deliberate definer exception.

56 tests pass, plus all seven independent PostgreSQL contention cases rerun with restricted-role restoration. No live role/login provisioning, migration, Replit sync, merge or production release. Next: server client/pool environment matching, bounded authentication requests and safe HTTP integration before a reviewer UI and staging enablement.

## 10 September — review HTTP boundary

Added a default-disabled API review router and trusted composition with the existing authenticated review helpers. Strict input/size/type checks precede service access, responses are non-cacheable, and fixed error messages avoid exposing SQL/upstream details. Four loopback HTTP groups pass, including actual prepare/restore through restricted-role synthetic database fixtures; API type checking and build pass. The initial sandbox listener failure was resolved by running with loopback permission.

See review-http-integration.md. Next: verified same-environment Auth client/database pool with bounded requests, deployment request controls and reviewer UI. The mounted endpoint stays 503 until explicitly composed with verified dependencies. No Supabase, Replit or production changes.

## 10 September — review server runtime composition

Added explicit same-project Auth/direct-database validation, restricted username and verified TLS options, bounded Auth fetch/response size, dedicated pool transaction handling and startup permission checks. Uncertain commits are not retried and their connections are discarded. See review-server-runtime.md for supported configurations and remaining deployment checks.

61 Shopify tests pass; standalone PostgreSQL passes the seven concurrency scenarios plus a new real restricted-login/pg-Pool prepare-and-restore case with synthetic Auth. The app route remains disabled. Next: explicit server runtime enablement/readiness, reviewer UI and a concrete staging configuration plan. No live database/Auth changes, Replit sync or production release.

## 10 September — API startup and reviewer screen

Connected explicit default-off runtime startup to the API router and added the protected /financial-review screen. Independent evidence/confirmation is required after a passing review; dates/account changes clear approvals and stale/uncertain responses never auto-retry restoration. Direct API dependencies use existing pinned workspace versions and are recorded in the lockfile.

Two startup, four HTTP and four isolated browser groups pass; full type checking and API/frontend builds pass with documented build warnings. Browser/Auth responses remain synthetic. See review-screen-startup.md. Next: concrete staging migration/login/enablement plan, same-origin UI/API setup and real staging end-to-end verification after approval. Nothing was applied to Supabase or released to production.

## 10 September — concrete staging review package prepared

Built one guarded atomic SQL artifact from the four tested intake/review proposals, plus read-only pre/post checks. Its SHA-256 and exact scope are in staging-review-package-2026-09-10.md. Three package groups pass, including rollback and baseline refusal; the exact script also passes on isolated PostgreSQL 18.4 with the seven contention cases and restricted-login runtime case. Current verified fixture figures are preserved.

Status: ready for approval, NOT applied. It adds schema/triggers/restricted non-login permissions only, with no login, reviewer assignments or imports. No live preflight inspection, Supabase mutation, Replit sync or production release has occurred. Next action after approval: verify the selected staging project and current baseline, apply the exact package and record the catalog/coverage checks; keep the API disabled pending login/UI provisioning.

### 10 September — approved staging review package applied

Paul approved the exact database package. Applied to bioalckltvkhlczusdvl after matching preflight and byte-for-byte editor verification. Five RLS-protected tables and restricted non-login role verified; no public/member internal execution or source/self-grant/audit mutation permissions. Zero candidate/reviewer/audit rows. Four existing coverage flags remain true and synthetic order amounts remain GBP 123/987. See staging-review-package-2026-09-10.md for full execution record. API still disabled; no login/reviewer provisioning, production deployment, merge or Replit update. Next work is the dedicated staging runtime/reviewer setup and real-auth synthetic end-to-end check.

### 10 September — local review connection prepared

Added opt-in loopback-only Vite proxy for the review API, with route boundaries, port checks and bounded forwarding. Two connection tests and frontend type checking pass. No live server enablement, credential, reviewer assignment or candidate import yet. Next is direct staging connectivity and dedicated runtime/reviewer provisioning, then real-auth synthetic review checks. See review-screen-startup.md.

### 10 September — restricted staging access verified

Confirmed the selected existing sign-in is a member of test store A; provisioned that store's reviewer assignment and a dedicated restricted login in a guarded transaction. Four local provisioning tests pass. Real direct PostgreSQL authentication and SET LOCAL ROLE succeeded using the official Supabase root CA with certificate verification enabled; no source-write/self-grant privileges. Private credential/config remain Git-ignored with 0600 access. See staging-review-access.md. No candidate import/API enablement/real-auth screen test yet. Next: review-only local server composition (avoid unrelated generic DATABASE_URL), matching public Auth configuration, and deliberate synthetic end-to-end scenario.

### 10 September — connected local review preview

Isolated loopback review server implemented; two tests pass. Real restricted runtime readiness passed and the separate port-3001 frontend routes reviews to port 4001. Missing-token request correctly returned 401. Port 3000 unchanged. User asked to sign in interactively to port 3001; authenticated review and candidate-data scenario remain pending. Private launcher/config outside Git; details in staging-review-access.md.

### Connected preview consolidated onto port 3000

Stopped the two identified local preview processes and restarted the private launcher with frontend origin/port 3000 and review API 4001. This preserves the existing browser sign-in and avoids the extra port-3001 login. The authenticated financial-review screen loaded test store A; preparing August 2026 returned the safe evidence-needs-attention response. The empty candidate schema means a successful review is not yet possible. The message currently conflates missing candidate data with stale evidence and should be clarified before the next test. No restoration, candidate import or finance-row change was performed. Next: explicit synthetic candidate scenario, then full review/restoration validation.

### Synthetic review scenario prepared; application pending

Prepared deterministic staging-only test package to normalise test store A's placeholder source identities and add a matching August candidate. Amounts/evidence stay unchanged; both A coverage periods are intentionally revoked by existing triggers, B untouched. Two exact-artifact/rollback tests pass. Fixed the misleading missing-candidate message; five HTTP groups and frontend type checking pass. See staging-review-scenario.md for hash/scope and execution plan. Not applied; API restart pending for message change.

### Approved scenario applied; signed-in reconciliation passed

Applied exact approved test artifact to staging after project/hash/editor verification. One batch/head and two versions; no audits. Amounts A123/23 and B987/87 unchanged. A coverage revoked, B coverage preserved. Existing real signed-in account prepared August through localhost:3000/financial-review and received Transaction checks passed. Final completeness confirmation/restoration NOT submitted. Next: independently check the documented synthetic completeness evidence, then exercise review/audit/restoration; September remains unverified.
