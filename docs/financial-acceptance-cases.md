# Financial acceptance cases v1

Derived from [Paul's approved definitions](agreed-financial-definitions.md), 8 September 2026. These are synthetic worked examples and expected results for the future implementation, not assertions that the existing application passes. No production data, SQL or UI has been changed. Machine-readable values are in `tests/fixtures/financial-acceptance-v1.json`; all money there is integer GBP pence.

The isolated prototype now exercises F01–F10 using `pnpm test:financial`, alongside five guard-test groups. This validates local calculation code only; production database/API/UI conformance remains pending.

Use the IDs below when building automated database and UI tests. Test the future calculation service/database first, then the displayed values and narrative. The existing 23 analytics tests exercise legacy wiring; they do not certify this new contract. Preserve raw source events and original order links in the future fixture importer.

## F01 — sales and tax normalisation

One eligible paid order: product gross £120 including £20 recorded VAT; product discount £12 including £2 VAT; shipping £6 including £1 VAT. No refund. Normalised gross product sales £100, product discount £10, net product sales £90, net shipping revenue £5, product VAT £18 and shipping VAT £1. AOV £90. Total customer charge £114. Discount rate 10%.

The same purchase imported with tax-exclusive product gross £100 and discount £10 must produce exactly the same normalised results. Do not deduct the £18 product VAT again. Shipping and its VAT do not enter AOV.

## F02 — zero-rated sale

One eligible paid order: gross £100, recorded VAT £0, no discount or shipping. Net product sales and AOV are £100; VAT £0. Do not infer £16.67 VAT from the amount or apply a blanket 20% rate.

## F03 — February sales, cost and profit bridge

Both orders are explicitly eligible original paid orders; this does not define eligibility for other statuses. All costs below are known actual costs. Currency and period membership are explicit fixture inputs.

| February input | Order A | Order B |
| --- | ---: | ---: |
| Gross product sales ex VAT | £100 | £50 |
| Product discount ex VAT | £10 | £0 |
| Product VAT | £18 | £0 |
| Net shipping ex VAT | £5 | £0 |
| Shipping VAT | £1 | £0 |
| Historic cost of products sold | £40 | £20 |

Period variable costs: payment processing £3, fulfilment £4, packaging £2 and outbound shipping £6. Advertising £10. Operating overheads £25, already including £5 depreciation/amortisation. The £25 includes agency £5, salaries £10 and software £5 as well as the £5 non-cash charge; none is deducted in advertising or variable costs. No freight allocation is estimated here: historic product costs already contain the agreed allocated components.

| Expected February result | Value |
| --- | ---: |
| Gross product sales / discounts | £150 / £10 |
| Net product sales / original order count / AOV | £140 / 2 / £70 |
| Net shipping / combined revenue denominator | £5 / £145 |
| COGS / gross profit | £60 / £80 |
| Variable operating costs | £15 |
| Contribution before marketing | £70 |
| Contribution after marketing (main Contribution) | £60 |
| Operating profit / EBITDA | £35 / £40 |
| Contribution margin / operating profit margin | 41.38% / 24.14% |

Ratios are 60/145 and 35/145; percentages above are display rounding only. Calculate at full precision. Total original customer charges are £164 (£140 products + £5 shipping + £19 VAT), not net revenue.

## F04 — March refunds of February orders

In March, A receives a partial product refund £24 including £4 VAT, plus a full shipping refund £6 including £1 VAT. The refunded product is not recovered; no A COGS reversal occurs. B receives a full product refund £50 with £0 VAT and returns the product to saleable stock in March; reverse B's original £20 cost. The refund and return-to-stock events both occur in March in this case, avoiding an unresolved cross-period restocking policy. There are no new March orders.

March return handling is £4; advertising is £0; overheads are £25 including £5 depreciation/amortisation. There are no other costs or events.

| Expected March result | Value |
| --- | ---: |
| Product refunds ex VAT / refunded product VAT | £70 / £4 |
| Shipping refund ex VAT / refunded shipping VAT | £5 / £1 |
| Total cash refunded | £80 |
| Net product sales / net shipping revenue | −£70 / −£5 |
| Net COGS (cost reversal) / gross profit | −£20 / −£50 |
| Contribution before / after marketing | −£59 / −£59 |
| Operating profit / EBITDA | −£84 / −£79 |

February remains net product sales £140, original order count 2 and AOV £70. The later full refund must not remove B from February's original denominator. March has refund activity even though it has no new orders. Do not assert numeric March AOV or a margin percentage: zero-order and negative-revenue presentation policies remain open. This fixture asserts the monetary results and that refund activity is not discarded.

## F05 — historic cost must not become today's cost

Two units sold at a recorded historic cost of £20 each; current variant cost later becomes £30. Expected sale COGS remains £40, not £60. Returning one unit to saleable inventory reverses £20, leaving net COGS £20. A refund without recovery reverses £0. Exact cost-allocation methodology is outside this fixture; historic costs are explicit inputs.

## F06 — missing cost is not zero cost

One eligible sale has known net product sales £90 and no discount/refund/shipping. Historic product cost is missing. Sales and AOV remain £90. COGS, gross profit, contribution, operating profit and EBITDA must be marked incomplete/unavailable; they cannot be reported as though COGS were £0. Known cost inputs may be shown separately, but not labelled complete profit.

## F07 — recurring overhead allocation across a month boundary

Known recurring January overhead £3,100 and February 2026 overhead £2,800, with no finer daily information. Both are £100 per calendar day. The week 26 January–1 February contains six January days and one February day: allocated overhead £700. January's complete allocations total £3,100; February's total £2,800. Label the result allocated. Non-recurring expenses and fractional-penny residual allocation are separate cases still requiring a convention.

## F08 — available cash, movement and actual-burn runway

At 30 April: unrestricted bank balance £8,000 and settled payment-account balance £2,000. Restricted funds £500 are separate; unsettled processor funds £300 are separate. Available cash £10,000. All fixture accounts are known, complete and GBP; this does not decide FX conversion or incomplete account handling.

February, March and April each have external inflows £4,000 and external outflows £6,000: net movement −£2,000 per month, average monthly burn £2,000, runway 5 months. April also contains a £1,000 transfer from the included bank to the included payment account; neither leg changes consolidated movement. Opening unrestricted April cash £12,000 less £2,000 movement equals closing £10,000. No financing or exceptional flows occur in these fixture months.

## F09 — cash generation

Use the same £10,000 available cash and three complete months, each with external inflows £6,000 and outflows £5,000. Monthly net generation £1,000. Expected runway state: **Not currently burning cash**; do not display a negative or infinite number of months. Exactly zero burn and fewer than three complete months are not decided by this case.

## F10 — cash release is separate from recurring improvement

A scenario has one-off inventory cash release £5,000 and recurring monthly contribution improvement £200. Expected presentation: two separate amounts with their time bases. Do not show £5,200 monthly contribution or £62,400 annual contribution. Do not add inventory release to available cash before it happens. This case validates impact classification, not the unapproved ranking or confidence methodology.

## Deferred cases — decisions required, not passing tests

- Original-order eligibility for pending/unpaid/cancelled orders, edits and exclusions; repeat-customer identity.
- Store timezone, source timestamps and event boundaries; late imports and duplicate/corrected events.
- Non-product goodwill refunds and the event-period refund-rate denominator.
- Return-to-stock in a different period from refund; missing historic cost on a returned item; exact landed-cost allocation.
- Zero original orders, zero/negative revenue margin denominators and display conventions.
- Cash with missing accounts/currencies, mixed currencies, zero burn, incomplete three-month history or financing/exceptional flows.
- Partial data and estimate-confidence presentation; fractional-penny overhead allocation.

The cases use known inputs to avoid deciding these questions. Implementing only these examples does not complete financial reconciliation or approve the deferred policies.
