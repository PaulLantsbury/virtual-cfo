# Calculation acceptance — 17 September 2026

Status: five new executable acceptance groups, backed by an independently hand-worked synthetic ledger. No live data, source classifications, financial definitions or application formulas changed. The new fixture is not a seed or a claim about Shopify completeness. It exercises the actual `fetchVerifiedSales` / mapped-sales boundary used by website reporting, followed by the current evidence-based profit calculator; the RPC transport is synthetic.

## Independent ledger and expected answers

All inputs and assertions use integer GBP pence after tax normalisation. The following invented records are deliberately different from the existing Store D fixture. Explicit evidence declares three eligible original orders. An additional £999 test order is explicitly ineligible and contributes nothing; this suite does not establish eligibility from raw Shopify status.

| February original order | Gross product before discount, excluding VAT | Product discount, excluding VAT | Product sales before refund | Shipping after shipping discount, excluding VAT | Historical landed cost |
| --- | ---: | ---: | ---: | ---: | ---: |
| A, recorded tax-exclusive | £120 | £12 | £108 | £6 | £40 |
| B, recorded tax-inclusive | £80 | £8 | £72 | £3 | £30 for two units |
| C, recorded zero VAT | £60 | £0 | £60 | £0 | £20 |

B's actual source amounts are gross £96 including £16 VAT, discount £9.60 including £1.60 VAT, and shipping £3.60 including £0.60 VAT. Recorded tax components, not an assumed rate, produce the exclusive values. A records £24 gross VAT and £2.40 discount VAT; no second deduction from its exclusive product values is allowed.

On 20 February, A refunds £24 product cash (£20 product plus £4 VAT) and £1.20 shipping cash (£1 plus £0.20 VAT). There is no stock recovery in February. Expected February results:

- Gross product sales £260; discounts £20; original sales after discount £240 across three orders.
- AOV **£80** (£240 / 3), despite the same-month refund. Discount rate **7.6923076923%** (£20 / £260).
- Net product sales **£220**; net shipping **£8**; refund cash **£25.20**, comprising £21 exclusive refunds and £4.20 recorded VAT.
- Historical COGS **£90**; gross profit **£130**.
- Actual variable expenses £12 → contribution before marketing **£126** (£130 + £8 − £12).
- Actual advertising £23 → Contribution **£103**.
- Actual overheads £30, already including £6 D&A → operating profit **£73**, EBITDA **£79**.
- Margin denominator £228 (net product sales plus net shipping); Contribution margin **45.1754385965%**, operating margin **32.0175438596%**.

On 5 March B refunds £36 cash, comprising £30 product and £6 VAT, with no shipping refund. There are no March original orders. Expected March net sales are **−£30**, AOV is unavailable and the refund-only month remains activity. Actual return handling £4 and overheads £30 including £6 D&A give Contribution **−£34**, operating profit **−£64**, EBITDA **−£58**. No COGS is recovered in March.

On 5 April one B unit re-enters saleable inventory with evidenced historical cost £15. April COGS is **−£15**, and gross profit, Contribution, operating profit and EBITDA are each **£15**, with explicit complete empty expense coverage. No sales or refunds occur in April. February remains unchanged. Non-positive revenue-denominator margins are unavailable under the existing unresolved policy; no new policy is introduced here.

Assertions use fixed expected amounts, not a second implementation of the production formulas. Missing overhead coverage preserves supported Contribution but withholds operating profit/EBITDA. Missing product cost preserves sales but withholds gross profit. Missing sales coverage, stale order evidence and a one-penny refund mismatch reject the sales report.

## Executable checks

New files:

- `experiments/financial-v1/cfo-acceptance-fixture.mjs`: reusable invented source and cost evidence.
- `experiments/financial-v1/cfo-acceptance.test.mjs`: five independent acceptance groups.

Run with the repository Node runtime:

```sh
node --test experiments/financial-v1/cfo-acceptance.test.mjs experiments/shopify/synthetic-reporting.test.mjs experiments/financial-v1/profit-staging-integration.test.mjs
```

Verification result: **12/12 tests passed** (five new acceptance groups, six existing profit database integration groups and one existing synthetic intake/reporting group). No formula failures were found in these supported cases.

The existing synthetic-reporting test reuses the collector/details mapper, restricted candidate import, separate exact-period reviews and member sales RPC in disposable PostgreSQL. Existing profit staging integration tests reuse the actual database evidence reader and sales reader, including changes invalidating sealed evidence. They complement this fixture rather than pretending this pure adapter test alone certifies the database.

## Website coverage and remaining work

Existing `artifacts/virtual-cfo/tests/store-d-cross-page-browser.mjs` connects disposable Store D SQL, real sales RPC and profit service to website presenters; `shared-sales-reporting-browser.mjs` and `shared-profit-reporting-browser.mjs` separately exercise shared UI states. Those existing browser suites were inspected for coverage but **not rerun as part of this subpackage**. The new three-order ledger has not yet been rendered in the website. There is no new claim that every page, slider, sample model or metric is reconciled.

Next acceptance slice: feed this same independent ledger through the disposable full evidence pipeline and browser presenters, compare selected period/store across CFO Briefing, Profit Overview and Margin Analysis, then extend only supported metric displays on other pages. Specifically retain loss, missing-cost and stale-source screen cases. Keep sample Scenario Planner and marketing/pricing models clearly separate until connected to the agreed common source.

This package does not prove live Shopify order completeness, real historical landed costs, FX, customer-repeat metrics, cash forecasting, marketing attribution or CFO recommendation scoring. Those require their own evidence or decisions. No real test order is relabelled as eligible, no schema is applied and no live data is written.
