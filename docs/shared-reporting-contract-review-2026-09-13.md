# Shared reporting read contract — review, 13 September 2026

Status: proposed architecture and acceptance criteria for Paul’s decision. Repository inspection only; this document does not implement a data adapter, certify source completeness or change any application, schema, database, account, financial rule or release. Night Scout is the commerce CFO product, separate from Sam.

## Direction and current evidence

Paul’s latest priority is one authoritative Supabase dataset, common definitions and calculations, consistent store/period/currency scope, and no hardcoded business results in actual reporting. Shopify should later feed that same path. This supersedes treating separate sample pages as the reporting destination. The 12 September end-of-day checkpoint remains authoritative for completed work; Profit Overview has no simulator, while Scenario Planner alone holds modelling controls.

“One dataset” need not mean one physical table. It means one authorised, reconciled set of source events and cost records with common identity, scope, evidence and calculation rules. Read models and cached summaries may be derived from it; neither a page-specific fixture nor a second independently maintained aggregate becomes an alternative financial truth.

| Inspected implementation | What it provides | What it does not establish |
| --- | --- | --- |
| `src/lib/analytics/useVerifiedBriefing.ts` | Store currency/timezone lookup; current/prior periods from the timeline; matching `verified-sales` query keys; calls the shared sales adapter. | A complete reporting contract for every page, a cost read or profit availability. |
| `src/pages/verified-sales.tsx` | Uses the same sales adapter and key shape; shows source sales/refunds/shipping/AOV with explicit unavailable states. | Shared period ownership: this page has its own date inputs/default rather than the briefing timeline. |
| `experiments/financial-v1/rpc-sales-adapter.mjs` | User-session `verified_sales_source` RPC; validates response version, store and exact period, then maps/calculates evidence. | Typed public error reasons or full timezone/revision provenance in the returned `VerifiedSales` declaration. |
| `experiments/financial-v1/cloud-sales-adapter.mjs` | Checks coverage, currency, verified mappings, original-order links and cumulative refund limits; delegates arithmetic to `calculations.mjs`. | Historic cost/recovery mapping. It explicitly returns `cogs: null` and `profitDataState: 'incomplete'`, even when sales are available. |
| `experiments/financial-v1/calculations.mjs` | Pure agreed sales, cost/profit and cash arithmetic using integer minor-unit inputs; missing costs remain incomplete. | Live input collection, classification, permissions or completeness. `profitBridge` currently suppresses all profit outputs if any required cost component is null. |
| `experiments/financial-v1/source-adapter.mjs` | Isolated proposed `source_orders/source_refunds/source_costs` read mapping, including cost evidence. | Evidence that those proposed tables are the deployed authoritative source. Do not create a parallel dataset just to adopt this prototype. |
| `src/lib/scenario-model.ts` | One coherent synthetic month, shared by Profit Overview and Scenario Planner; explicit supported assumptions. | An actual-data adapter. Its fixed 1,000 orders, £100 AOV and cost inputs must not become defaults for missing store data. |

Paths beginning `src/` above are under `artifacts/virtual-cfo/`. Deployment and live database inventory belong to the companion review; this document makes no new live-state assertions.

The companion inventory confirms the checked-in `finance_v1.coverage_evidence` contract has a sales/refunds flag, not cost completeness. Existing catalogue costs and cost-assumption rates do not by themselves supply historic sale-time costs or complete expense totals; refund quantities do not prove saleable stock recovery. This supports retaining the current profit block, rather than treating an existing column as a verified input. See the companion financial-input inventory for its schema/deployment evidence and limits.

## Proposed contract

One reusable read function/hook should return a scoped reporting snapshot, rather than pages assembling independent RPC totals. The first version can wrap the existing sales RPC and calculation path; extending it to costs requires the inventory/mapping and explicit implementation agreement.

| Contract area | Required meaning |
| --- | --- |
| Scope | Requested and resolved store ID, inclusive store-local date range, verified timezone and currency. Validate actual calendar dates and compare response scope before rendering. No browser timezone or GBP fallback for actual values. |
| Identity/version | Contract version and financial-definition version; evidence reference and source/read revision when available. Do not invent a revision from the fetch time. A fetch timestamp only means when the client read it. |
| Metric value | Explicit unit: integer minor units for money, integer original-order count, separately typed ratios. Keep AOV as an explicit numerator/denominator or defined ratio; it can represent fractions of a penny until display rounding. No premature cross-page rounding. |
| Availability | Loading, available, incomplete, unavailable/error and unsupported must be distinguishable. Available zero is a real value; unknown is null with a reason. A refund-only period can have negative sales and zero original orders without being empty. |
| Evidence | Sales/refund collection completeness, mapping validity and cost readiness are separate concepts. One verified sales period does not prove historic COGS, stock recovery, advertising or overhead completeness. Presence of rows or a reviewer action alone does not prove collection coverage. |
| Dependencies | Explain which missing input blocks each result. Initially preserve the current conservative profit block; changing to partially available profit submetrics is a separately reviewable implementation, not an automatic relaxation. |
| Provenance | Distinguish sourced actual amounts from explicit estimates/allocations, and both from synthetic fixture data. An estimated cost cannot silently acquire the same status as an evidenced actual amount. |
| Comparison | Previous period has its own scope/readiness. Current valid figures remain visible if the previous period is unavailable; no invented percentage change. Different currencies/stores or incompatible definitions cannot be compared. |
| Scenario handoff | A future actual baseline references this same reporting snapshot. User changes are an explicitly separate scenario; zero changes reconcile to that baseline. Unsupported/missing baseline components block dependent modelling rather than importing sample amounts. |

Implementation should retain user-session store authorisation and existing database access boundaries. Client `storeId` validation is not permission. Reuse a common cache key including store, dates, timezone, currency and contract version; clear/gate old data on a scope change, reject delayed mismatched responses, and invalidate after authorised source/evidence changes. Current and previous periods need not be fetched as one transaction, but each period’s financial components must describe one consistent snapshot. A new snapshot token or broader RPC is a proposal if the existing response cannot guarantee the required revision semantics.

## Reconciliation acceptance

1. With exactly the same authorised store, local dates, currency, definition and evidence snapshot, every reporting presentation of gross product sales, discounts, product refunds, net product sales, shipping, original orders and AOV agrees before formatting. Navigation cannot quietly switch from a selected range to an unrelated default month.
2. Net product sales equal gross product sales less discounts less product refunds in the refund event period. Shipping and recorded VAT stay separate. AOV uses original eligible sales after discounts before subsequent refunds; the original order remains counted after a later refund.
3. Use the existing approved February/March worked case: February original net sale/AOV £90 and one order; March refund −£20 net product sales and no new order. March AOV is unavailable, not zero. This is an isolated test, not evidence that current staging coverage should be enabled.
4. Verified complete no-activity coverage can produce zero amounts. No rows without valid coverage cannot. Missing settings, rejected mappings, mixed currency, invalid dates and access failures never produce substitute figures or a green readiness state.
5. When the cost path is eventually complete, gross profit = product net sales − COGS; contribution = gross profit + net shipping − variable costs − marketing; operating profit = contribution − overheads including D&A; EBITDA adds D&A back once. Costs need coverage, period, classification and provenance; refund cash alone does not authorise a stock-cost reversal.
6. Profit/Contribution margins use net product sales plus net shipping as the denominator under the agreed definitions. Zero/negative denominator behaviour stays explicitly unavailable until its policy is agreed. Do not import the sample model’s display conventions as financial policy.
7. Store/period changes during in-flight reads cannot flash or retain another scope’s results as current. Current/prior failures are exercised independently. All pages display consistent money/ratio rounding, while underlying arithmetic retains its precision.
8. The future actual Scenario Planner starts at the same reporting baseline, and reset returns there. Until the supporting cost model is evidenced, a sales-only snapshot cannot activate actual contribution/profit scenarios. No £95,000/£40,900/£21,900 sample fallback is acceptable in actual reporting.
9. Cross-page checks use isolated known fixtures through the common read contract and separately authorised integration evidence when available. Passing fixtures validates code; it does not certify a merchant source or restore review/coverage flags.

## Smallest useful first implementation package — proposal

Agree a **shared sales snapshot and reconciliation slice**, using the existing `verified_sales_source` path, rather than attempting every financial page or inventing missing costs:

- Extract shared scope/date validation, one sales read hook and common availability/provenance presentation from the already-connected Briefing/Verified Sales paths.
- Make those two pages consume the same contract and reporting period. The companion page inventory identifies Margin Analysis’s existing sales/AOV panel as a stronger first replacement consumer than adding a new actual-sales header to the otherwise sample Profit Overview. Include Margin only within the selected package, keeping its sample analysis clearly separate and unsupported profit fields unavailable. An actual section alongside Profit Overview’s sample figures requires an explicit product decision.
- Keep sales arithmetic and database evidence gates unchanged. Add focused cross-page, invalid/missing/zero, refund-only and stale-scope tests. Do not broaden reference-ledger synthetic scenarios.
- Document the first consumer migration, unresolved inputs and eventual replacement of sample content. Verify existing local staging without creating imports, grants or evidence approvals; publish approved code/docs through the existing development branch.

This is a limited foundation, not completion of Paul’s single-source requirement. Remaining reporting consumers, actual historic costs and operating expense inputs, a sourced scenario baseline and Shopify ingestion follow as explicit packages. No sample results may masquerade as progress on that actual path.

## Decisions versus routine implementation

Paul should choose the first consumer set and how users move from the current sample views to actual unavailable/partial reporting; the common period-selection behaviour; and the next supported cost-input source after the inventory. Still-open financial choices include detailed cost allocation, cross-period stock-recovery timing, zero/negative margin denominators, refund-rate/cohort meaning and later cash-policy edges. Do not reopen already approved AOV, refund-event timing, original-order eligibility or operating-profit/EBITDA definitions.

Once a package is approved, hook naming, types, shared formatting, cache ownership, reason-code mapping, tests and documentation are routine engineering choices. Existing authorisation covers routine development-branch publication and local staging checks, not migrations, grants, account setup, spending, Replit synchronisation or production release. This review alone authorises none of those actions.
