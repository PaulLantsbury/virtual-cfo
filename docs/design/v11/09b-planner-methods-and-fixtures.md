# 9B Growth methods and scenario fixtures

| Method | Order calculation | Important boundary |
| --- | --- | --- |
| Order assumptions | User directly enters total orders. | Marketing spend affects cost only; it does not create extra orders. |
| Spend & CPA | Eligible spend / new-customer CPA gives acquired customers; one first order each + Other orders. | Other orders are returning orders and non-paid first orders, excluding paid first orders already counted. |
| Traffic & conversion | Whole-site sessions × eligible orders per session. | Includes all site orders; do not add Other orders. Spend affects cost only, not traffic. |

Traffic helper: Best for testing site conversion or traffic changes. Sessions, order numerator, store and dates must match. Do not substitute a differently defined analytics conversion rate without mapping. Conversion changes use percentage points. CPA cannot be zero or negative and is an assumption at the proposed spend level, not guaranteed constant return.

| Fixture | Baseline | Scenario |
| --- | --- | --- |
| Orders | 1,000 | 1,100 |
| AOV | £100 | £105 |
| Performance marketing | £10,000 | £12,000 |
| CPA and Other orders | £20 and 500 | £20 and 500 |
| Whole-site sessions and conversion | 50,000 and 2.0% | 50,000 and 2.2% |
| Net product sales | £95,000 | £110,500 |
| CM3 | £40,900 | £49,500 |
| EBITDA | £22,900 | £31,500 |

Fixed in this illustrative month: product refunds £5,000; net shipping income £2,900; product cost £40/order less £2,000 evidenced returned-stock recovery; shipping £4, fulfilment £3 and payment £2 per order; staff £10,000 and other overheads £8,000. AOV excludes shipping, VAT and later refunds. Net product sales = orders × AOV − refunds.

All three methods reproduce 1,100 scenario orders: direct input; £12,000 / £20 = 600 acquired first orders + 500 Other; or 50,000 × 2.2%. EBITDA bridge: £22,900 + £5,100 volume + £5,500 AOV − £2,000 marketing = £31,500. Apply volume first, then AOV at scenario volume; count interactions once.

Optional adverse case: CPA £24 at £12,000 spend produces 500 paid first orders + 500 Other = 1,000 orders. With AOV £105 and all other assumptions unchanged: net sales £100,000, CM3 £43,900, EBITDA £25,900. This is a sensitivity, not a forecast. The scenario month is separate from the historical quarterly fixture.

## Acceptance

SP06 P0. At matched baseline every method reproduces baseline. Test all switch pairs, invalid/negative/zero inputs, missing costs, method exclusion, shared-input persistence and full-precision arithmetic. SP07 P1. A keyboard or mobile user can change a mode and explain which calculation is active. Evidence reproduces the result; no uplift is presented as cash available or an instruction to spend.

[Back to the design index](README.md)

## Related mockups

These are illustrative designs with fictional data, not live screenshots.

### Plan Order assumptions

![Plan Order assumptions](mockups/15-plan-order-assumptions.png)

### Plan Spend and CPA

![Plan Spend and CPA](mockups/16-plan-spend-and-cpa.png)

### Plan Traffic and conversion

![Plan Traffic and conversion](mockups/17-plan-traffic-and-conversion.png)

### Plan Scenario planner expanded

![Plan Scenario planner expanded](mockups/18-plan-scenario-planner-expanded.png)
