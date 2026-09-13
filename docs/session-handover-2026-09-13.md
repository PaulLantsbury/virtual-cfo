# Night Scout — 13 September handover

## Initial inventory (completed before implementation)

Paul resumed from the 12 September handover and authorised parallel reviews. Three agents reviewed repository data paths, financial input schema evidence and shared reporting contract/acceptance. Coordinator consolidated the findings. This was read-only application/database investigation with versioned documentation outputs. No application, schema, database, grant, account, production or Replit changes. No fresh live Supabase query was made; database conclusions are explicitly based on saved catalog, staging application records and code. Working tree was clean at resume.

## Findings

- [Page source map](reporting-page-source-map-2026-09-13.md): CFO Briefing uses evidence-based store-local sales; five pages still use legacy broad aggregate reads and browser-local/order-only lookback that can skip refund-only periods. Profit Overview and Scenario Planner share synthetic fixtures only. Remaining pages retain separate sample figures/models.
- [Financial input map](financial-input-map-2026-09-13.md): existing source structure contains costs/overheads/spend/cash fields, but current product cost does not prove historic sale cost; refunds do not prove saleable stock recovery; sales coverage does not prove cost completeness. Legacy contribution omits COGS and cash runway uses the wrong basis. Proposed prototype fields are not installed cloud tables.
- [Read-contract review](shared-reporting-contract-review-2026-09-13.md): reuse the existing evidence adapter; common scope, definitions, readiness, provenance and comparison handling. Missing values stay unavailable, valid zeros and negative refund periods survive, no sample results feed actual reporting.

## First implementation package — subsequently approved and implemented

Create a shared sales snapshot/read path and consistent store-local period selection for CFO Briefing, Verified Sales and Margin Analysis’s existing source panel. Replace Margin’s legacy gross-sales/AOV path with clearly labelled net product sales and original-order pre-refund AOV from the same evidence used by the briefing; preserve separately named gross product sales if shown. Use one selected reporting period across these pages; never silently walk back to an order-containing period. Surface incomplete/unavailable status consistently, including refund-only periods, and do not unlock margin/profit without cost evidence.

Reuse existing sales definitions, evidence gates, membership checks and calculation code. No new schema/data/grants are needed for this initial code package. Focused tests must prove matching values for identical scopes, missing-vs-zero, negative refund periods, valid date/timezone/currency handling and stale-response isolation. Local staging may still show incomplete periods; do not restore completeness to force a demonstration. Paul subsequently approved this bounded package; implementation and verification are recorded below.

After this foundation: inventory-to-design for historic costs, return recovery and expenses; prepare any schema/population as a separate reviewable proposal; remove remaining page-specific actual calculation paths and hardcoded report values; then Shopify development ingestion through the same evidence pipeline. No new cost allocation or forecasting assumptions without Paul. Cash/opportunities/monitoring remain later workstreams. Shopify setup has not started.

## Verification and status

Coordinator reviewed all three reports and checked documentation whitespace. No application tests were rerun because no executable code changed. Reports distinguish historical original Supabase snapshot, recorded applied staging schemas, disposable prototypes and live state not inspected today. Routine GitHub development-branch publication is authorised. This inventory-only checkpoint is superseded by the implementation record below.

## Shared sales package

Implemented by three agents with coordinator integration: a common evidence-aware sales hook, per-store shared month/week/custom selection, strict date validation and store timezone/currency; all three consumers use the same financial calculation adapter. Verified Sales no longer fixes August, and Margin no longer uses the broad legacy aggregate loader or order-only lookback. Margin samples remain separate; actual margin/profit stays unavailable pending historic costs. No database, grant, ingestion, Replit or production changes.

See [shared-sales package](shared-sales-package-2026-09-13.md) for verification, staging evidence and test environment limitations. The normal local staging preview is at localhost:3000 and uses the existing staging Supabase project. It is not a hosted production release. Routine code/docs publication is to the existing GitHub development branch/draft PR.

## Next work

1. Design the historical cost and expense evidence needed to compute actual contribution and operating profit, based on the input inventory and agreed definitions. Identify remaining policy decisions for Paul before implementation; sales completeness cannot certify costs.
2. Move remaining actual page reads onto the shared scope/evidence foundation, then replace sample/hardcoded business outputs when their real inputs are supported. This sales package does not mean every page is reconciled.
3. Set up the Shopify development store and connector through the same evidence pipeline. No real Shopify account/feed is connected yet.

Preserve automatic progress through agreed packages, use bounded parallel agents where helpful, update local staging after each meaningful package, and retain explicit decisions for financial policy and production/database changes.

## Subsequent profit-evidence preparation

Paul asked to proceed after shared-sales completion. Three agents prepared cost, expense and acceptance designs; coordinator consolidated [the proposed implementation package and three decisions](profit-evidence-package-2026-09-13.md). Documentation only, reviewed against existing rules and prototype source; no financial policy adopted, no application/database changes or staging refresh required. Shared-sales remains the verified application checkpoint.

At this stop the user decision is: (1) recognise saleable recovery on evidenced actual restock date independently of refund timing; (2) use actual, evidenced historical costs/expenses only in the first actual-profit slice, without inventing freight allocation; (3) begin with complete months and independently available subtotals. Unresolved precision, exceptional/correction accounting, allocation, FX and ratio-denominator cases remain unsupported. On approval, prepare versioned adapter/schema/tests and a concrete staging migration/setup proposal; do not apply it without separate database approval.

## Subsequent approval and implementation preparation

Paul agreed all three decisions; they are now recorded in the financial definitions. Three agents implemented the versioned monthly profit contract, private schema proposal and disposable database reader, with independent regression tests. See [implementation record](profit-evidence-implementation-2026-09-13.md). This supersedes the prior pending-decision checkpoint.

The tested code supports historical per-line costs, independent saleable recovery dates, actual expense source references, component readiness and stale/missing-source checks. No application route or live database reads have been changed. Proposed SQL has not been applied.

Next authorised engineering work: complete the transactional existing-sales integration, explicit version/source-proof preparation, exact synthetic setup/reconciliation and staging preflight/recovery package. These preparation steps need no repeat approval. Obtain separate approval only once the actual staging database operation is concrete and validated. No new financial rule is needed for the supported first scope; unsupported allocation/FX/correction cases stay unavailable.

## Transactional sales and exact staging package complete

Three agents completed the real mapped-sales callback, isolated Store D fixture and independent database integration tests; coordinator added the controlled staging-only entry point and focused live read-only checks. Combined regressions pass 63/63. See [exact setup, reconciliation and recovery](profit-staging-setup-2026-09-13.md). The callback now uses membership-checked sales evidence within the same transaction, with revisions tied to raw sources and evidence. February sales/costs/expenses, March refund and April stock recovery reconcile independently.

Next decision: approve the five private profit tables/guard, synthetic Store D records and one existing Paul account membership in staging. Nothing in that proposal has been applied. A privileged staging connection must be verified privately before execution; current application credentials are restricted. After approved execution, reconcile the three months, then prepare member-scoped profit API/version selection and page integration. The local shared-sales preview remains the application checkpoint. Production, Replit and existing stores are unchanged.

## Staging setup approved; connection outstanding

Paul explicitly approved the five private profit tables/guard, Store D three-month synthetic fixture and existing-account membership. Do not request that approval again. No database changes have yet been executed. Local credential metadata confirms only the existing restricted review and import connections are saved; no privileged operator connection is configured in the environment. Obtain a suitable staging operator connection privately before running the approved controlled entry point. Do not reset database passwords, create broader roles or weaken privileges as an inferred workaround. Preserve the exact approved schema/fixture hashes and recheck preflight before application.

## Approved staging execution completed

The preceding connection block is resolved. Exact approved schema and Store D fixture were applied once to staging and all three months now reconcile. The first postcheck exposed a UK daylight-saving DATE conversion bug; a reader-only SQL date-text fix and regression resolved it without changing sealed evidence. 64/64 tests pass. Five private tables have RLS, no client grants; approved membership exists. Existing A/B/C preflight settings/counts/coverage remain unchanged. Temporary password file removed. See the setup execution record for limits. Next is member-scoped actual-profit API/version selection and page integration; no production release or public profit route exists yet.

## Navigation logo update

Paul supplied the new white/orange dog-and-wordmark PNG. The shared signed-in sidebar and mobile header now select a dedicated navigation asset; the public landing page and authentication artwork retain their existing logo. The supplied PNG is stored unchanged, with CSS framing to omit its transparent margins. Frontend typecheck passes and the mobile staging header was visually checked. No financial behaviour or deployment changed.

## Profit Overview member-scoped reporting package

Three agents completed the scoped profit service/HTTP route, actual-evidence UI and independent access/reconciliation tests. The shared reporting period now includes Profit Overview. Its hardcoded sample model is removed; sales, gross profit, contribution, operating profit and EBITDA plus the signed bridge use evidence states. Scenario Planner remains separately labelled sample data. UI preserves independent verified sales when cost reads fail, and protects against stale store/period responses.

Verification: 21/21 combined HTTP/access/proxy/runtime/review tests; final full browser run 9/9 on isolated fake-config preview, covering reconciled figures, refunds, missing costs, invalid periods, mismatched/stale results, plan locking and mobile layout. Frontend/backend typechecks pass. The normal localhost:3000 staging preview was restarted with the optional profit service using existing restricted credentials. Live UI safely reports unavailable because the nine required SELECT permissions have not been granted; no actual-profit success on live app is claimed. Browser temporarily held a connection-error page during restart; fresh in-app tab5 now opens normal staging.

Next decision: approve `db-migrations/proposals/20260913_profit_reporting_read_access.sql`, nine SELECT-only table permissions and nine member-scoped read policies for the existing server role. Exact contents and live catalog preflight in `docs/profit-reporting-service-2026-09-13.md`. No logins, passwords, membership changes, writes, public/browser grants or production changes. After approved application, verify Store D February/March/April in signed-in UI and compare sales across reporting pages. Existing password temporary file remains deleted; the short permission SQL can be applied through the authenticated staging SQL console after approval.

## Profit reporting access applied and live verified

Paul approved the exact read-only access proposal; applied to staging through its authenticated SQL console. Live restricted-role checks: nine SELECT-enabled RLS tables, nine membership policies, no writes on these tables. Live signed-in Profit Overview Store D Feb/March/April matches all headline figures (OP35/−75/40). February sales140 and AOV70 agree across Profit Overview, CFO Briefing, Margin Analysis and Verified Sales. No production/Replit/source/membership changes. This supersedes the preceding pending-access checkpoint.

Next: extend the shared profit report into other appropriate actual-reporting pages and update their old profit-unavailable descriptions, while preserving independent readiness. Verified Sales currently still says profit awaits historical costs; Margin/Briefing remain sales-only. Scenario Planner remains a separate sample. Do not imply the whole site is reconciled. Current local staging preview uses restricted runtime session41755; user-visible walkthrough tab6 was opened after stale old tab1 failed to refresh. Repository publication remains the existing development branch.

## Shared profit page rollout completed

Paul accepted the Profit Overview walkthrough, then approved connecting CFO Briefing and Margin Analysis. Both now use the same scoped profit hook and shared summary, including supported margins. Stale blanket profit-unavailable descriptions were replaced in both pages and Verified Sales. Forecast/cash/recovery advice and sample simulator boundaries remain explicit. No new database permissions or financial formulas.

Frontend typecheck passes; 16/16 new shared-profit browser tests and 4/4 Margin Analysis regressions pass. Live Store D February matches across the new summaries (GP80, contribution60, OP35, EBITDA40, margins41.4%/24.1%); March Margin Analysis matches negative totals and withholds unsupported ratios. See `docs/shared-profit-pages-2026-09-13.md`. Code is updated in existing local staging; GitHub development publication authorised. Next: remaining actual-source migrations and clearer separation/removal of legacy sample models, then Shopify development ingestion per priorities. Do not claim every page is free of samples or every financial input connected.

### Navigation logo colour refresh

Replaced the navigation asset with Paul’s supplied Night Scout Logo (3).png, unchanged. Kept existing desktop/mobile logo dimensions and positioning styles; public home and authentication logos remain unchanged. Verified the blue Scout artwork in the local staging navigation. No calculation or database changes.

Navigation logo follow-up: adjusted the image’s vertical object position from 55% to 48% for the replacement artwork, keeping the existing desktop/mobile dimensions while making room for the dog’s ears.
