# Scenario Planner — calculation review

Reviewed 12 September 2026 for Paul's request to move business impact above the sliders and check the existing calculations while leaving them unchanged.

> **Current status:** The original review below is historical. Paul subsequently approved replacing the inconsistent sample model; see “Subsequent” below. The corrected implementation and current verification are recorded in [Scenario Planner correction](scenario-planner-correction.md).

## Conclusion and scope

The current calculations reproduce their programmed sample arithmetic. They are **not a validated financial forecasting model** and do not conform to all [agreed financial definitions](agreed-financial-definitions.md). The UI change must not imply otherwise. No formula, coefficient, preset, source constant or financial rule was changed by this review.

Reviewed `artifacts/virtual-cfo/src/pages/scenario-lab.tsx` (`computeOutputs`, current slider ranges and presets), plus `pricing-metrics.ts`, `business-snapshot.ts` and `cash-snapshot.ts` under `src/lib/data/`. These inputs are static examples, not the selected store's current financial position. Property names such as `ebitda` are legacy implementation names, not financial certification.

## Independently worked arithmetic

All amounts below are GBP. “Profit” means the existing unvalidated sample result, internally named `ebitda`. All unmentioned sliders are zero. Comparisons use the unchanged zero-slider starting position, not the currently selected preset.

| Case | Sales | Contribution | Sample profit | Sample cash | Profit change |
| --- | ---: | ---: | ---: | ---: | ---: |
| Zero-slider starting position | 420,000 | 198,000 | 78,000 | 186,000 | 0 |
| Revenue +10% | 462,000 | 213,840 | 93,840 | 198,672 | +15,840 |
| Order volume +10% | 420,000 | 202,950 | 82,950 | 189,960 | +4,950 |
| AOV +10% | 420,000 | 202,950 | 82,950 | 189,960 | +4,950 |
| Discount rate −1 percentage point | 420,000 | 203,000 | 83,000 | 190,000 | +5,000 |
| Shipping cost per order −£1 | 420,000 | 203,000 | 83,000 | 190,000 | +5,000 |
| Marketing spend −10% | 420,000 | 198,000 | 79,350 | 187,080 | +1,350 |
| Balanced Growth preset | 441,000 | 231,595 | 112,270 | 245,416 | +34,270 |
| Margin Recovery preset | 420,000 | 235,500 | 116,175 | 216,540 | +38,175 |
| Cash Protection preset | 420,000 | 198,000 | 79,350 | 235,080 | +1,350 |
| Discount opportunity preset | 420,000 | 220,790 | 100,790 | 204,232 | +22,790 |
| Meta reallocation opportunity preset | 420,000 | 214,000 | 95,080 | 199,664 | +17,080 |
| Full-price opportunity preset | 428,400 | 217,653 | 97,653 | 201,722 | +19,653 |

Worked checks independent of UI formatting:

- Revenue +10%: sales = £420,000 × 1.10 = £462,000. Contribution uplift = 10% × £198,000 × 0.8 = £15,840. Sample profit = £78,000 + £15,840 = £93,840. Cash uplift = £15,840 × 0.8 = £12,672. Sales change is +10%; sample profit change is +20.307692…%, or +20.3% at one decimal.
- AOV +10%: contribution uplift = 10% × £198,000 × 0.25 = £4,950; sales stays at £420,000 because the sales equation does not reference AOV. This verifies current implementation, not a valid commercial relationship.
- Marketing spend −10%: cost delta = −10% × £27,000 × 0.5 = −£1,350; sample profit increases by £1,350, but contribution does not change. That distinction conflicts with the agreed contribution-after-marketing definition.
- Balanced Growth contribution uplift = £7,920 + £1,485 + £990 + £10,000 + £10,000 + £3,200 = £33,595. Marketing cost delta is −£675, so profit uplift = £34,270. Cash uplift = 8 × £2,500 + 4 × £3,000 + 80% × £34,270 = £59,416. Runway rounds to 4.1 months. Sales change = +5%; sample profit change = +43.935897…%, or +43.9%.
- Full-price opportunity contribution uplift = £3,168 + £1,485 + £15,000 = £19,653. Cash uplift is rounded from £15,722.40 to £15,722.

The baseline contribution-per-order figure is £12.40, runway 3.4 months, working capital £74,000 and CAC payback 1.6. Those are fixed sample constants, not independently evidenced starting measures.

## Financial/model findings requiring future agreed work

1. **Sales and the growth sliders are disconnected.** Only Revenue Change alters displayed sales. Order Volume Change and Average Order Value Change independently alter contribution and profit. Setting all three for the same commercial change risks counting overlapping effects. The new prominent sales/profit panel should disclose this existing limitation; do not change an equation implicitly while moving the display.

2. **Periods and profit definitions do not reconcile.** Sales uses £420,000 gross pricing-period revenue. The £198,000 contribution also appears in an annual model based on £520,000 gross revenue. The £78,000 profit constant subtracts £120,000 explicitly labelled monthly fixed costs from that annual contribution. There is no common period, tax/shipping treatment, historical COGS reconciliation or complete overhead/D&A bridge proving these measures. Operating profit and EBITDA are separately defined in the approved contract; the legacy result establishes neither.

3. **Marketing and fulfilment cost changes are applied below contribution.** The approved main contribution measure deducts period advertising and variable fulfilment costs. Here marketing/fulfilment sliders affect the profit adjustment only. Marketing additionally uses an unexplained 50% multiplier: a £2,700 nominal reduction on its £27,000 sample base produces only £1,350 uplift. Changing these is future financial model work, not an arithmetic correction authorised in this layout change.

4. **Coefficients are not derived from the displayed business inputs.** A discount-rate decrease of one point yields £5,000, whereas 1% of displayed £420,000 gross sales is £4,200. A £1 shipping-cost decrease yields £5,000 total uplift and £0.85 per-order uplift, neither reconciled to the mock 16,000 orders. £198,000 / 16,000 = £12.375, rounding to £12.38, rather than the separate £12.40 CPO constant. The declared 18% discount example also differs from £64,000 / £420,000 ≈ 15.24%. These are inconsistent sample assumptions, not evidence that a replacement coefficient should be guessed.

5. **Refund effects do not implement event-period accounting.** Returns Rate Change simply applies £1,800 per point. There are no original-order/refund links, actual event dates, recorded VAT, saleable-inventory cost reversals or agreed rate denominator in this model. Discount/returns sliders change contribution without altering its gross sales figure. Calling the latter net product sales would be misleading.

6. **Cash and runway are illustrative.** Profit uplift is converted to cash at an arbitrary 80%; inventory days release £2,500/day and supplier days £3,000/day without supporting balances or dates. Runway = 3.4 + cash change / £80,000, rounded and floored at zero; it is not dated available cash divided by the last three complete months' actual burn. Even the old source comment's cash/fixed-cost interpretation does not reconcile: £186,000 / £120,000 = 1.55, not 3.4. Working capital clamps at zero while cash can continue increasing, so large release scenarios need balance constraints before use as forecasts.

7. **CPO/CAC models do not reconcile to totals.** CPO uses a separate set of coefficients and does not divide scenario contribution by scenario orders; CAC payback is a ratio of fixed example factors, not independently modelled customer acquisition/cohort cash recovery. Fixed Cost Change also potentially overlaps Staff Cost and Software / Overhead changes. No overlap policy has been approved.

8. **Three controls intentionally have no effect in the retained implementation.** Payment Fee Rate Change, Meta Spend Change and Google Spend Change are not read by `computeOutputs`. Presets containing Meta changes show movement because their other levers are active. Existing UI disclosure must remain.

## Boundary and execution evidence

A temporary Node harness extracted and executed the current `computeOutputs` function and presets directly from the source; its constants were explicitly supplied from the reviewed static modules. It printed the 13 cases above and checked all **262,144 min/max corner combinations** of the 18 current slider ranges. No network, application server or database was used.

- No non-finite output occurred at any permitted-range corner. Sample CPO ranged £4.80–£20.75, safely above the payback divisor's zero point. Because its underlying linear expression has its extrema at these corners, this also rules out a zero CPO divisor inside the current slider bounds.
- Profit ranged −£88,580 to £295,095, and cash −£82,264 to £469,676. Negative values must retain their signs in presentation; the existing sample equations allow losses and negative cash.
- The three inactive controls produced exactly the baseline outputs when changed alone. This documents their lack of implementation; it is not acceptance of inactive product controls for launch.
- There is a latent out-of-range failure: setting discount change to +40 points (outside the current UI maximum +8) clamps CPO to zero and produces infinite CAC payback. Current sliders do not reach it. A future external-input/real-data adapter needs explicit finite-input and zero-denominator handling; these were not introduced in this change.
- This was a bounded calculation audit, not exhaustive UI-state, source-data, cash forecasting or financial conformance testing. The coordinator records browser/build checks for the separate layout implementation.

## Recommended sequence — not new policy approval

Keep current figures explicitly sample and preserve the formulas for this approved layout change. Before promoting Scenario Planner to actual planning, agree one coherent period and baseline, link growth drivers without overlap, reconcile contribution/profit/cost definitions, implement the currently inactive levers, and replace unsupported cash/CAC assumptions with agreed models and evidenced inputs. Record any policy choices with Paul before changing them. Use the examples above as evidence of current behaviour, not as acceptance cases for the future financial model.

## Subsequent approval and replacement model — 12 September 2026

After receiving these findings, Paul explicitly approved correcting the erroneous formulas using one coherent sample month, sales derived from orders × AOV without a separate sales slider, and unavailable outputs where marketing growth/cash assumptions are unsupported. The earlier sections above describe the **retired model at the time of the audit**; their numbers are not acceptance expectations for the replacement.

The new pure model is `artifacts/virtual-cfo/src/lib/scenario-model.ts`. It uses integer pence internally and exposes GBP amounts to the page. Its starting month is an explicitly synthetic example:

| Component | GBP |
| --- | ---: |
| Gross product sales | 125,000 |
| Product discounts, 20% of gross | (25,000) |
| Product sales before later refunds: 1,000 original orders × £100 AOV | 100,000 |
| Product refunds occurring this month | (5,000) |
| Net product sales | 95,000 |
| Original historical goods costs: 1,000 × £40 | (40,000) |
| Cost reversal for goods explicitly returned to saleable inventory this month | 2,000 |
| Gross profit | 57,000 |
| Net shipping revenue: £3,000 charged less £100 event refunds | 2,900 |
| Outbound shipping, fulfilment and processing: £4 + £3 + £2 per original order | (9,000) |
| Contribution before marketing | 50,900 |
| Period marketing | (10,000) |
| Contribution after marketing | 40,900 |
| Staff, software and other overheads | (18,000) |
| Depreciation/amortisation | (1,000) |
| Operating profit | 21,900 |
| Add back depreciation/amortisation | 1,000 |
| EBITDA | 22,900 |

Sales and shipping amounts exclude VAT; VAT is not subtracted again. AOV remains before later refunds and original order counts remain intact. Explicit same-month refund/recoverable-cost amounts are held fixed as event-period inputs, rather than estimated from this month's new orders. Shipping charges are fixed sample totals. Per-order costs are declared sample estimates; shipping and processing controls adjust pounds per order, not unsupported percentage rates. Marketing changes expense once and does not infer sales growth. Separate staff/software/other-overhead controls prevent duplicate overhead adjustments. AOV scales the pre-discount price at the fixed sample 20% discount assumption; no separate discount or returns-rate control remains in the replacement model. AOV and order changes are independently selected assumptions, without predicted demand effects.

Eleven pure-model test groups pass in `artifacts/virtual-cfo/tests/scenario-model.test.mjs`: worked baseline, order-only, AOV-only, joint growth, marketing classification, variable costs, separate overhead/D&A bridge, rounding, a worked adverse operating loss of −£7,380, 512 current-range corners, and invalid inputs. For example, orders +10% yields £105,000 net sales and £27,000 operating profit; AOV +10% yields £105,000 and £31,900; both together yield £116,000 and £38,000. The model rejects missing, unsupported, non-finite and out-of-bound inputs. Original orders round to whole orders; money rounds to integer pence before aggregation. Contribution per order is a separately rounded output, never an input to total contribution.

This establishes coherent sample arithmetic under declared inputs. It is not live-store data validation, a demand forecast, cash forecast or production financial certification. Cash, runway, CAC payback and inferred channel growth remain unimplemented rather than receiving invented replacement coefficients. The coordinator records integration/browser verification separately.
