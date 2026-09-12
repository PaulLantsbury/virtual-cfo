# Profit Overview / Scenario Planner reconciliation review

12 September 2026. Independent financial review of the approved package aligning Profit Overview to the corrected shared synthetic month. This review concerns sample arithmetic and presentation, not actual store reporting, data completeness or production readiness.

## Authoritative basis

[Agreed financial definitions](agreed-financial-definitions.md) govern sales, refund events, contribution after marketing, operating profit and the EBITDA bridge. The shared implementation is `artifacts/virtual-cfo/src/lib/scenario-model.ts`; Profit Overview must consume its zero-input baseline rather than retain its former independent equations or mixed-period snapshots. [The earlier calculation review](scenario-calculation-review.md) records the superseded model and approval for its replacement.

A direct execution of the shared model reproduced the following same-month amounts independently checked against the declared inputs:

| Step | GBP | Check |
| --- | ---: | --- |
| Gross product sales | 125,000 | 1,000 original orders × £125 pre-discount basket |
| Product discounts | (25,000) | 20% of gross product sales |
| Product sales before later refunds | 100,000 | 1,000 × £100 original AOV |
| Product refunds in the month | (5,000) | Explicit fixed event-period input |
| Net product sales | 95,000 | Gross less discounts and product refunds |
| Net goods costs | (38,000) | £40,000 historic original costs less £2,000 saleable-return reversal |
| Gross profit | 57,000 | Net product sales less net goods costs |
| Net shipping revenue | 2,900 | £3,000 charged less £100 shipping refunds |
| Variable operating costs | (9,000) | £4,000 outbound shipping + £3,000 fulfilment + £2,000 processing |
| Contribution before marketing | 50,900 | Gross profit plus shipping less variable costs |
| Marketing | (10,000) | Period expense, counted once |
| Contribution after marketing | 40,900 | Main contribution measure |
| Staff, software and other overheads | (18,000) | £12,000 + £2,000 + £4,000 |
| Depreciation/amortisation | (1,000) | Separate cost component included in total £19,000 overheads |
| Operating profit | 21,900 | Contribution less all operating overheads |
| EBITDA | 22,900 | Operating profit plus £1,000 D&A |

All product and shipping sales are tax-exclusive: no blanket VAT deduction. Refunds do not reduce original order count or rewrite AOV. No actual store orders, costs, refund facts or source coverage are inferred from these fictional inputs.

Where contribution or operating margin is shown, the approved denominator is **net product sales plus net shipping revenue**, £97,900 here. Contribution margin is 41.7773238% (41.8% at one decimal); operating margin is 22.3697651% (22.4%). Using gross £125,000, product-only £95,000 or the retired £520,000 would violate the agreed denominator. This denominator review is not approval of a new margin metric or undefined zero/negative-denominator policy.

## Verification status

The 11 existing pure-model test groups pass on re-execution, including independently worked single/joint changes, marketing deducted once, separate overhead categories, an adverse operating loss of −£7,380, 512 input-range corners and rejected invalid inputs. These verify the shared arithmetic, not browser rendering or store data.

## Completed source integration review

Reviewed the completed `artifacts/virtual-cfo/src/pages/profit-engine.tsx` independently. No financial blocker was found:

- One `computeScenario(scenario)` call supplies every financial amount. The page contains no separate profit engine, annual/monthly snapshot imports or legacy fixed-coefficient financial formulas. Percentage-change formatting compares each metric with its own baseline; it is not presented as a profit margin. No profit-margin ratio is currently displayed, so the denominator rule above remains a future acceptance requirement.
- The fixed overview uses `model.baseline` and the simulator's three live amounts use `model.result`. Sales, contribution and operating profit compare with their own starting amounts. EBITDA remains separately labelled in the baseline and detailed bridge.
- The 21-row bridge follows gross sales → discounts → original sales → event refunds → net product sales → net goods costs → gross profit → net shipping → three variable costs → contribution before marketing → marketing → contribution → separate staff/software/other overheads/D&A → operating profit → D&A addback → EBITDA. Cost components are deducted once. Subtotal rows are identified as running results rather than additional movements.
- Displayed deductions explicitly use negative signs. Operating profit and EBITDA retain the source amount's sign rather than being clamped or formatted with an absolute value alone. The shared model's tested negative scenarios therefore remain negative in presentation.
- Four controls pass directly to the shared model: order volume, AOV, marketing expense and other overheads. Their min/max values come from the shared ranges. Other overheads are explicitly separate from staff, software and D&A. No unsupported revenue/discount/refund response slider remains.
- The old £520,000/£198,000/£78,000 example, independent five-control simulator, invented numerical opportunities, staff ratios/trends and unsupported driver claims have been removed. Shared assumptions explicitly expose the single synthetic month and fixed refund/cost inputs.
- Actual profit reporting remains prominently unavailable, missing real costs are not described as zero, and Pro is described as a sample preview. No profit data retrieval has been introduced. Detailed bridge and simulator access gates remain.
- Cross-page wording expressly says unsaved scenarios are not synchronised or transferred. Profit Overview starts its own zero-input state. The shared baseline is not a claim that edited scenarios persist between pages.

The coordinator records combined browser/build and staging verification separately. This source review does not claim those checks or visual acceptance have completed. No calculation, source constant, database, runtime or deployment change is made by this review document.
