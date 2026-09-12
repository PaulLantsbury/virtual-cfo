# Profit Overview / Scenario Planner alignment

**Current page roles:** Paul subsequently approved removing the overview simulator. Profit Overview now contains the fixed baseline and profit bridge only; what-if controls live in Scenario Planner. See the follow-up at the end. The original simulator delivery below is historical.

Approved 12 September 2026. Paul approved bringing Profit Overview onto the same sample month and agreed financial definitions as Scenario Planner, with three agents for implementation, independent calculation review and browser/cross-page testing. The coordinator integrates, checks current local staging and publishes the code/docs to the existing development branch.

## Scope and acceptance

Profit Overview uses the existing pure `scenario-model.ts` unchanged, replacing its mixed annual/monthly snapshot arithmetic. Baseline sales £95,000, contribution after marketing £40,900, operating profit £21,900 and EBITDA £22,900 must match the zero-input planner. Display the coherent ex-VAT monthly P&L bridge, original-order AOV/refund separation and D&A add-back. Current simulator values and baseline must be clearly distinguished. Use only already-supported assumptions and controls; no invented demand, discount, cash or source calculations.

Remove conflicting legacy numbers and unsupported trend/ranking claims. Retain the page name, route and applicable free/Pro gates. A link to the full planner does not transfer unsaved edits; communicate that distinction. No new model policy, data connection, database write, migration, grant, Replit sync, main merge or production release.

Acceptance: independent worked ledger and review; browser baseline/cross-page agreement, supported slider changes, deltas/reset, gates, source-unavailable honesty, no external page data requests/writes and desktop/mobile usability; typecheck/build. Existing local staging uses already-authorised access. Real reporting/forecasting remains unavailable.

Status: implemented, independently reviewed, verified in the existing local staging preview and ready for Paul’s walkthrough.

## Delivered and verified

Profit Overview consumes the existing shared model unchanged. Its fixed baseline shows Sales £95,000, Contribution £40,900, Operating profit £21,900 and EBITDA £22,900. Its four supported controls (orders, AOV, marketing and other overheads) feed the same calculation as Scenario Planner. Current values and signed changes stay beside controls; the detailed 21-row bridge follows current values, with negative deductions, clear subtotals and D&A addback. Baseline headlines remain fixed when experimenting. Free/Pro simulator and detailed-table gates remain. Conflicting legacy amounts, five-control independent model, numerical opportunities and unsupported trends are removed. Unsaved changes are explicitly not transferred to the full planner.

- Independent [financial reconciliation review](profit-scenario-reconciliation-review.md) found no blockers. No new model formula or assumptions were added.
- 20 Profit Overview browser cases, 20 Scenario Planner cases and 11 pure-model groups pass together: 51 checks. Coverage includes baseline agreement, changing orders/AOV/costs, operating losses, reset, missing-source honesty, access gates, all three sticky metrics on desktop/mobile, signed bridge and actual cross-page navigation without unsaved-state carryover.
- Typecheck, build and whitespace checks pass. Existing tooltip sourcemap and bundle-size warnings remain. The worker's first typecheck invocation could not find Node; the configured runtime resolved it and the check passed. No browser test failures occurred in the integrated run.
- Desktop/mobile screenshots inspected. Existing local current-source staging at localhost:3000, authenticated store A, displays the four baseline figures above. Orders +30% produces sales £125,000, contribution £56,200, operating profit £37,200 and bridge EBITDA £38,200; fixed baseline remains unchanged. Reset restored the starting values. No database writes or new access.

Code, browser checks and these documents are saved through the authorised GitHub development branch/draft PR workflow. This does not update Replit, main or production. The preview is local staging, not hosted deployment. Actual reporting, real input integration, forecasting and remaining unsupported business response assumptions are unfinished. Other pages’ sample models have not been certified by this work.


### Page-role separation — approved follow-up

Paul identified duplication and approved removing the Profit Overview simulator. Profit Overview now explains the fixed sample month through its four headlines and signed profit bridge; Scenario Planner alone holds what-if controls. Added “Explore changes in Scenario Planner”. Shared model/amounts and existing detail gate remain unchanged; actual reporting stays unavailable. Updated browser coverage confirms no overview controls, baseline/bridge reconciliation, source/gate honesty and real navigation to planner on desktop/mobile (12 cases pass); build/whitespace checks pass. Earlier simulator delivery notes above are historical and superseded.
