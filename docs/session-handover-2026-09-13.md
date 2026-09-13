# Night Scout — 13 September resume and inventory

## Completed scope

Paul resumed from the 12 September handover and authorised parallel reviews. Three agents reviewed repository data paths, financial input schema evidence and shared reporting contract/acceptance. Coordinator consolidated the findings. This was read-only application/database investigation with versioned documentation outputs. No application, schema, database, grant, account, production or Replit changes. No fresh live Supabase query was made; database conclusions are explicitly based on saved catalog, staging application records and code. Working tree was clean at resume.

## Findings

- [Page source map](reporting-page-source-map-2026-09-13.md): CFO Briefing uses evidence-based store-local sales; five pages still use legacy broad aggregate reads and browser-local/order-only lookback that can skip refund-only periods. Profit Overview and Scenario Planner share synthetic fixtures only. Remaining pages retain separate sample figures/models.
- [Financial input map](financial-input-map-2026-09-13.md): existing source structure contains costs/overheads/spend/cash fields, but current product cost does not prove historic sale cost; refunds do not prove saleable stock recovery; sales coverage does not prove cost completeness. Legacy contribution omits COGS and cash runway uses the wrong basis. Proposed prototype fields are not installed cloud tables.
- [Read-contract review](shared-reporting-contract-review-2026-09-13.md): reuse the existing evidence adapter; common scope, definitions, readiness, provenance and comparison handling. Missing values stay unavailable, valid zeros and negative refund periods survive, no sample results feed actual reporting.

## Proposed first implementation package — awaiting Paul

Create a shared sales snapshot/read path and consistent store-local period selection for CFO Briefing, Verified Sales and Margin Analysis’s existing source panel. Replace Margin’s legacy gross-sales/AOV path with clearly labelled net product sales and original-order pre-refund AOV from the same evidence used by the briefing; preserve separately named gross product sales if shown. Use one selected reporting period across these pages; never silently walk back to an order-containing period. Surface incomplete/unavailable status consistently, including refund-only periods, and do not unlock margin/profit without cost evidence.

Reuse existing sales definitions, evidence gates, membership checks and calculation code. No new schema/data/grants are needed for this initial code package. Focused tests must prove matching values for identical scopes, missing-vs-zero, negative refund periods, valid date/timezone/currency handling and stale-response isolation. Local staging may still show incomplete periods; do not restore completeness to force a demonstration. Shared period UX and first consumer migration require Paul’s approval before implementation.

After this foundation: inventory-to-design for historic costs, return recovery and expenses; prepare any schema/population as a separate reviewable proposal; remove remaining page-specific actual calculation paths and hardcoded report values; then Shopify development ingestion through the same evidence pipeline. No new cost allocation or forecasting assumptions without Paul. Cash/opportunities/monitoring remain later workstreams. Shopify setup has not started.

## Verification and status

Coordinator reviewed all three reports and checked documentation whitespace. No application tests were rerun because no executable code changed. Reports distinguish historical original Supabase snapshot, recorded applied staging schemas, disposable prototypes and live state not inspected today. Routine GitHub development-branch publication is authorised. No implementation package is active yet; next user decision is the bounded sales-snapshot scope above.
