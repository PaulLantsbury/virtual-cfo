# Profit evidence acceptance design — 13 September 2026

**Subsequent decision:** Paul approved the three bounded recommendations on 13 September: actual restock-date recovery, actual-only costs and complete months with independent subtotals. See `agreed-financial-definitions.md`. Earlier proposal wording below is historical; other allocation/correction/FX decisions remain unresolved.

Status: preparation only. These are proposed acceptance checks for the next cost/expense connection, not executable tests, implemented behaviour or permission to apply a schema. They reuse Paul’s agreed financial definitions and existing worked cases; unresolved policy is identified rather than invented. No application, calculation, fixture, database or access changes accompany this document.

Coordinator proposal for Paul: begin with **actual costs only, complete calendar months and component-level readiness**; recognise stock recovery on its **actual evidenced restock date**. These are proposed scope/policy decisions, not approvals recorded by this document. If approved, the corresponding checks below become implementation acceptance; weekly allocation and estimate-enabled reporting remain outside the first package.

## Existing evidence to retain

The shared sales package now provides one selected store-local period and verified-sales read path for CFO Briefing, Verified Sales and Margin Analysis. This establishes a reusable sales boundary, not cost completeness. `calculateMappedSales` explicitly returns COGS null and profit incomplete. Sales/refund coverage cannot be reused as expense or stock-recovery coverage.

`experiments/financial-v1/calculations.test.mjs` already exercises the F01–F10 worked cases, including the February profit bridge, March refunds, historic cost, missing COGS, calendar allocation and cash separation. `source-adapter.test.mjs` adds proposed-schema mapping, duplicate cost IDs, cumulative refund/recovery checks, known-zero coverage, estimates and currency rejection. These are valuable isolated tests; they do not show that existing Supabase fields meet the proposed adapter contract.

`scenario-model.ts` and its tests establish a coherent synthetic month. Keep them unchanged in this preparation package. Its sample amounts, order-cost assumptions and fixed refunds are not evidence-backed defaults for the actual reporting path. Browser tests showing £95,000 sample sales do not substitute for source reconciliation.

Two concrete gaps constrain reuse:

- `profitBridge` currently returns every profit subtotal null if any required cost field is null, including D&A. It therefore cannot independently report an otherwise supported gross profit or contribution when only overhead/D&A is missing.
- The prototype source adapter constructs stock recovery from selected refund events and rejects recovery outside the refund period. It does not support a later return-only month independently of refund date. A production stock-recovery contract cannot be inferred from this implementation.

## Proposed versioned snapshot and readiness

Extend the shared reporting contract through a separately versioned cost/profit snapshot; do not change the sample model or silently reinterpret the existing sales response. Each component needs store, currency, period/event-date basis, amount or null, evidence/provenance, completeness state and a reason when unavailable. Record estimates and allocations explicitly. The source revision/evidence must be compatible with the sales snapshot used in the same bridge.

Readiness belongs to a component and its dependencies. The following is a proposed dependency acceptance model for approval, not a claim the current all-or-nothing function implements it:

| Component/result | Inputs needed for a supported amount | Missing-input behaviour |
| --- | --- | --- |
| Net product sales and shipping | Existing verified sales/refund snapshot | Existing evidence gates; never replaced by costs or samples. |
| Net COGS | Historic sold-item costs and separately evidenced saleable recovery with coverage for the selected scope | Missing historic cost/recovery leaves net COGS unknown, not zero or current catalogue cost. |
| Gross profit | Net product sales and complete net COGS | Withhold gross profit if either dependency is incomplete. Overhead absence alone should not invalidate these inputs in the proposed new contract. |
| Variable costs | Covered processing, fulfilment, packaging, outbound shipping and return-handling costs; classification and exclusions | Known individual amounts may remain visible, but the total cannot be labelled complete if a required component lacks evidence. |
| Contribution before marketing | Gross profit, net shipping and complete variable costs | Withhold dependent total, preserve independently supported inputs. |
| Contribution after marketing | Contribution before marketing plus complete period advertising | Missing advertising blocks main Contribution, even if recorded spend rows happen to sum to zero. |
| Operating profit | Contribution and complete overheads including D&A | Missing overhead coverage blocks operating profit. Agency, salaries and software must not be included twice. |
| EBITDA | Operating profit and separately identified D&A already included in overheads | No D&A default or unproved add-back. If total overheads are evidenced but the D&A split is unknown, show only results the explicitly agreed snapshot can support. |

Known zero requires positive completeness evidence for that component and scope. No rows is not that evidence. A complete zero advertising amount can be used; an empty advertising import with unknown coverage cannot. One reviewed row does not establish that every expected row was collected. The exact approval/evidence mechanism remains part of the implementation proposal.

## Proposed reconciliation and failure checks

| ID | Setup/action | Required observable result |
| --- | --- | --- |
| PE01 | Feed existing F03 February source events and evidenced costs through the eventual shared read. | Gross product sales £150, discounts £10, net product sales £140, shipping £5, original orders 2, AOV £70. COGS £60, gross profit £80, variable costs £15, contribution before marketing £70, Contribution £60, operating profit £35, EBITDA £40. No sample amount enters the result. |
| PE02 | Present PE01 in every migrated reporting page and its detail bridge. | Equal unrounded values, same store/dates/currency/evidence scope and consistent labels. Contribution margin 60/145 and operating margin 35/145; rounding only for display. No product-sales-only denominator. |
| PE03 | Replay F04 later partial/full refunds with explicitly evidenced same-month saleable recovery. | February remains £140 sales, 2 orders and £70 AOV. March product sales −£70, shipping −£5, COGS −£20, gross profit −£50, Contribution −£59, operating profit −£84 and EBITDA −£79. Negative amounts remain valid, and March is not discarded for having zero new orders. |
| PE04 | Change today’s product catalogue cost after a sale, using F05’s historic evidence. | Two sold units remain £40 COGS, not £60. One evidenced saleable return reverses £20. A refund without recovery reverses no cost. |
| PE05 | Remove the historic cost evidence for one otherwise valid sale. | Verified sales/AOV remain available; COGS and all dependent profit totals are incomplete. Known expense rows may be inspected without implying complete profit. This carries F06 through the actual adapter and UI. |
| PE06 | Remove only advertising coverage; separately remove only overhead/D&A evidence. | Proposed component dependencies behave independently. Complete sales/COGS/variable amounts remain known. Main Contribution is blocked by missing advertising; operating profit/EBITDA are blocked by missing required overhead evidence. This is a new regression gap, not a test the current all-or-nothing prototype already passes. |
| PE07 | Compare an explicitly complete zero-cost category with absent coverage and no rows. | First case is numeric zero; second is null/incomplete with a reason. The two cases must remain distinguishable through storage, adapter, snapshot and page. |
| PE08 | Replay the same source expense/import; then attempt to reclassify the same identified expense into another category. | The same economic entry is not charged twice. Preserve traceable correction/reclassification semantics. Cross-source identity conflicts are flagged unless an agreed identity rule resolves them; do not invent fuzzy duplicate matching. |
| PE09 | Provide F03’s overhead total £25 including D&A £5. | Deduct £25 once; add back £5 only for EBITDA. Agency £5, salaries £10 and software £5 are not also charged as advertising or variable costs. Reject an inconsistent D&A split rather than forcing the bridge to balance. |
| PE10 | Supply a currency, store, period, tax-basis or source-revision mismatch in one required cost component. | No mixed-scope profit headline. Existing valid sales can remain visible, but incompatible costs cannot be merged. Delayed prior-store/period responses cannot replace current scope. No implied FX conversion or repeat VAT deduction. |
| PE11 | Use F07’s known recurring monthly overheads for 26 January–1 February. | £700 allocated, with allocation provenance, and monthly totals reconcile. Fractional-penny residuals or non-recurring expense timing are unresolved cases: block/report the ambiguity until policy is agreed. |
| PE12 | Supply an estimate or budget/forecast row alongside actual records. | Provenance remains distinct; no forecast/budget silently included as actual expenditure, and no estimate silently described as actual. Whether an estimated total may be displayed, and with what readiness label, is a decision before enabling that path. |
| PE13 | Refund occurs in March but the saleable stock recovery occurs in April, with no April refund. | The new adapter must recognise that this is not covered by the old refund-selected prototype. Until recovery timing policy/contract is approved, flag dependent COGS as unresolved rather than place reversal in March or ignore April. Under the proposed actual-restock-date rule, add explicit refund-only and recovery-only period tests after Paul approves it. No numeric timing outcome is invented here. |
| PE14 | Valid current period with unavailable comparison period; then revise or invalidate underlying evidence. | Current readiness and comparison readiness remain separate. No invented trend; invalidated evidence removes dependent readiness on the next scoped read. Define revision/invalidation semantics before claiming a cached result is current. |
| PE15 | Attempt an unauthorised store read or a source write through the reporting client. | Existing authorisation boundary denies access; read-only reporting does not grant review, import or write permissions. Scope checks do not substitute for server/database authorisation. |

For PE06, an unknown D&A split and an unknown total overhead amount are different facts. The new schema/contract must make the distinction explicit; do not derive a split or decide partial-result policy merely to satisfy a test. Until a revised dependency implementation is approved, retain the present conservative profit-unavailable behaviour.

## Reuse, gaps and implementation boundary

Reuse F01–F07 for monetary expectations and the source-adapter duplicate/currency tests. Extend the newly shared browser fixture for selected-scope reconciliation when a cost read contract exists; do not create a separate page-specific financial calculator. New tests should prove the evidence-to-snapshot mapping, component completeness, correction identity, dependency propagation and stale-scope behaviour rather than restating arithmetic already tested.

For the proposed complete-month, actual-only first slice, PE11 is a retained future regression reference, not required new allocation functionality; PE12 checks exclusion of estimates/budgets/forecasts from actual totals.

The minimal next proposal is a versioned read contract with explicit cost-component readiness, one agreed historic-cost/recovery source mapping, one agreed expense classification/coverage mapping and a bounded consumer bridge. Test the mapping and storage read in isolation before applying any schema or displaying actual profit. If only one component is ready, report that preparation honestly; do not activate a complete profit headline to demonstrate progress.

Paul’s decisions still required include return-to-stock timing across periods, detailed landed-cost allocation, acceptable estimate/partial-result presentation and unresolved zero/negative margin denominator conventions. Record these before asserting their outcomes. Known eligibility, original AOV, event-period refunds, sales/shipping/VAT separation, main Contribution and operating-profit/EBITDA definitions are already agreed and should not be reopened.

A completed test package would verify implementation against its inputs; it would not certify merchant collection completeness, approve staging figures or authorise migrations, grants, imports, new accounts, spending, Replit synchronisation or production release. Those remain separate boundaries.
