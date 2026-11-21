# Synthetic Daily Reporting Data stream

Status: agreed planning stream; documentation only. No company, schema, seed rows, job, provider writer, hosting service or deployment has been created by this plan.

## Purpose

Create one clearly labelled synthetic reporting company in Supabase that receives a fresh, realistic day of e-commerce finance events every day. The data should exercise the same authenticated, company-scoped reporting contracts and dashboard paths used by Night Scout, so changing daily data proves that the charts and calculations respond to new records.

This stream complements, but does not replace, provider acceptance:

- Shopify and Xero provider checks establish that each real integration can write/read its own isolated test transactions correctly.
- This synthetic-company stream supplies a repeatable, broad, realistic history for chart and reporting behaviour, including costs that Shopify alone cannot provide.
- Synthetic records must never be described as real provider transactions or used to claim provider integration acceptance.

The current roadmap tracks this as its own workstream: [Night Scout roadmap](roadmap-2026-10-31.md). Provider test-order handling remains described in the [Shopify test-data journey](shopify-test-data-journey-2026-10-29.md).

## Starting company profile

All figures below are explicit fixture assumptions to make the implementation concrete. They are not user-company facts, forecasts, tax advice or market benchmarks. Keep them configurable and versioned. Confirm the turnover interpretation, dates, and cost amounts before the first remote database write.

| Input | Initial fixture value | Treatment |
| --- | ---: | --- |
| Currency and timezone | GBP; Europe/London | Store event timestamps consistently; define reporting-day cut-off explicitly, including daylight-saving changes. |
| Annual net turnover | £500,000 | Provisional interpretation: net of product discounts/refunds, excluding VAT, with shipping revenue included. |
| Net product sales | £480,000 | Excludes VAT and shipping; consistent with the project's agreed financial definitions. |
| Net shipping revenue | £20,000 | Provisional 4% allocation of net turnover, tracked separately from product revenue and fulfilment costs. |
| Gross product sales before discounts/refunds | £528,000 | Excludes VAT and shipping; fixture basis for order and discount generation. |
| Discounts | £24,000 | Product discount events; reconcile to £504,000 discounted sales before later refunds. |
| Product refunds | £24,000 | Recognised on refund date; reconcile to £480,000 net product sales. |
| AOV | About £38 | £504,000 discounted product sales / 13,263 eligible original orders, before later refunds and excluding VAT/shipping. |
| Product COGS | £240,000 | Net of eligible returned-goods reversals; 50% gross product margin against £480,000 net product sales. |
| VAT | Transaction-level | Standard-rated baseline where applicable at 20%; include zero/reduced-rated cases and store the actual VAT amount/rate per line. |
| Employees | Five synthetic staff members | Synthetic staff IDs only, no names, contact details, payroll IDs or other personal data. Model role/pay-band and payroll assumptions as editable inputs. |
| Fulfilment | Third-party provider | Model per-order pick/pack, carrier/postage, storage, returns handling and surcharges as supplier costs; separate from customer shipping revenue. |

The proposed order count is an illustrative annual baseline. Allocate cents and order values deterministically so totals reconcile exactly. Do not force every daily or monthly AOV to equal £38; the annual cohort metric is the target.

### Illustrative retail seasonality

Use this initial monthly distribution for annual net trading activity, then generate varied daily order counts and normalize within each month so monthly and annual totals reconcile:

| Month | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Share | 6% | 6% | 6% | 6% | 7% | 7% | 7% | 7% | 8% | 9% | 13% | 18% |

This makes Q4 40% and December 18% of the annual profile. It is a transparent gift-led test shape, not a claim about a typical retailer. Add weekday/weekend variation and occasional quieter days without changing the monthly allocation.

## Financial event coverage

The event stream should exercise sales and the full operating cost base, not just produce synthetic order totals.

### Revenue, tax and working capital

- Product orders with line quantities, prices, discounts, VAT treatment and shipping charged to customers.
- Refunds and partial refunds on their own event dates; link them to original orders.
- Chargebacks and payment reversals where appropriate.
- Payment processor fees and clearing balances; distinguish order value from processor settlement and bank cash.
- Processor payouts and bank deposits with settlement delays, fees and stable matching references.
- VAT control movements and quarterly liability settlements. Separate output VAT, recoverable input VAT and net payable; never count VAT as revenue.
- Opening cash and clearly identified transfers where needed to make cash movements coherent.

### Inventory and cost of sales

- Supplier purchase orders/invoices, freight, duty and other landed cost components as distinct source events.
- Inventory receipts and stock movements.
- Recognize COGS when a product is sold. Inventory purchases are not immediately COGS.
- Reverse COGS on returned goods only when the fixture marks the goods as returned to saleable stock.
- Reconcile cost of sales to the target gross margin without hiding inventory timing differences.

### Five-person payroll

Represent five stable synthetic employee IDs with configurable roles or pay bands. Produce regular monthly payroll cycles with:

- Gross wages/salaries.
- Employer payroll taxes/contributions and pension costs as separate expense categories and liabilities.
- Employee deductions and net pay as balance-sheet/liability flows, not extra expenses.
- Payroll accrual and later cash payment dates so P&L and cash views differ appropriately.
- Optional bonuses or seasonal overtime only when enabled in the scenario configuration.

Payroll is not VATable. Avoid embedding statutory rates as permanent truths; any rate tables must be explicitly dated, configurable and reviewed before being used for a real jurisdiction.

### Outsourced fulfilment and other operating expenses

Generate provider invoices and settlement/payment activity for:

- Per-order pick and pack, carrier/postage, storage, returns handling and volume/remote-area surcharges.
- Advertising by channel, with invoice/accrual and payment timing where useful.
- Card/payment processing fees.
- Rent or storage, software subscriptions, insurance, utilities and professional services.
- Packaging and other consumables.
- Supplier accounts payable, invoice due dates, partial settlement where useful, and bank reconciliation.
- Optional financing interest or equipment depreciation only as explicit scenario settings, with accounting treatment kept separate from cash.

Keep each expense category and event coverage visible. Do not select values that imply an agreed operating profit, EBITDA, cash runway or industry benchmark. Add annual budgets/amounts only as editable parameters once the user confirms them.

## VAT and revenue reconciliation

The initial £500,000 target is net of VAT. In a standard-rated-only illustration, 20% VAT would apply to qualifying net taxable lines, but the fixture must calculate VAT from line-level tax treatment, discounts, refunds and shipping treatment rather than applying 20% to every amount.

For orientation only, if all £480,000 net product sales and £20,000 shipping revenue were standard-rated, net output VAT before input VAT would be £100,000 after the assumed £24,000 product refunds. Real fixture orders should include explicitly tagged tax categories and reconcile to their computed VAT. Customer receipts, net revenue, VAT, processor fees, payout totals and bank cash are separate values and must not be conflated.

## Data architecture and isolation

Before implementation, inspect the existing Supabase schema, RLS policies, company/store membership model, canonical reporting queries and chart data paths. Use a new dedicated synthetic reporting company; do not repurpose Store D or any existing store. Store D's reported incomplete same-day order values remain a separate verification issue. Do not write anything until this read-only review demonstrates that the fixture can be isolated from merchant companies.

Requirements:

1. Every fixture row carries the correct synthetic company scope and explicit synthetic provenance/scenario version.
2. The generator writes through the approved isolated test path and uses the same scoped reporting contracts and calculations as the product pages.
3. Provider-specific test flags remain provider semantics. In particular, Shopify source orders with test=true remain excluded from merchant financial events; do not change their flag or make those records eligible to populate charts.
4. Synthetic Shopify-like and Xero-like evidence, if included for source comparison, must have a common fixture event reference and a clear provider-simulation marker. Do not double-count mirrored evidence as separate revenue.
5. No live merchant/company data is copied into the fixture. Use no personal data.
6. Access follows existing authenticated membership and RLS rules. Never broaden grants to make a chart work.
7. Reconcile sales, refunds, tax, COGS, fulfilment, payroll, other expenses, receivables/payables, settlements and cash movements from source events through the same reporting path used by the actual charts.

## Daily generation and replay safety

- Generate deterministic fixtures from company, scenario/profile version, Europe/London business date and event ordinal.
- Assign stable event IDs and source references. Re-running the same date must be idempotent, with no duplicate orders, costs or ledger effects.
- Record generation status, input/profile version, event counts, totals and reconciliation outcome in an auditable run record.
- Corrections should be represented by explicit correction/reversal events and a new profile/run revision, not silent mutation of already-reported history.
- Keep event timestamps, settlement/payment dates and accounting periods distinct.
- Provide a manual, bounded staging catch-up for missed days only after idempotency is demonstrated. Do not silently backfill production or create provider transactions as a catch-up.
- Ensure daily charts update from newly dated events while historical totals remain stable and reproducible.

## Implementation sequence

1. **Read-only fit check:** inspect company and tenant schema, RLS, financial event model, canonical dashboard queries and relevant chart pages. Map each required event category to a supported write and read path.
2. **Finalize fixture contract:** settle the turnover definition, date/history horizon, product categories and VAT treatment, cost assumptions, accounting/cash conventions and how provider-comparison markers work.
3. **Design review:** prepare schema or function changes only if existing structures cannot support the isolated fixture. Review migration, access and rollback implications before any application.
4. **Local generator:** build a deterministic, idempotent generator and unit/reconciliation fixtures. Validate a complete profile year and replaying each day.
5. **Staging company:** create or designate the isolated synthetic company only after the scope and access review; seed enough history for the longest actual chart (initial proposal: 24 months, subject to chart inspection).
6. **Canonical-path acceptance:** verify figures in the actual dashboard pages, not only direct table queries or a mock API. Check daily refresh, seasonal chart shape, margins, VAT and cost coverage.
7. **Schedule:** choose an existing approved scheduler/host if available. If new infrastructure, spend, broad access or production changes are needed, prepare the concrete proposal and stop for authorization before making those changes.
8. **Operate separately:** monitor run receipts, idempotency, reconciliation and freshness; document reset and recovery procedure. Keep provider acceptance work independently tracked.

## Acceptance criteria

The stream is ready for daily staging use when:

- A dedicated, clearly labelled synthetic company is isolated from every real merchant scope.
- The full history and each daily batch are generated reproducibly and replay safely.
- Annual net turnover, product revenue, shipping, discounts, refunds, order count/AOV, COGS and margin reconcile to configured targets.
- VAT reconciles by line and period with output/input balances and settlement events represented separately.
- Five synthetic employees create realistic accrual and cash payroll flows without personal data.
- Third-party fulfilment invoices, variable per-order charges, storage, shipping/carrier and returns handling are visible as costs separate from customer shipping revenue.
- Other costs, payment fees, inventory purchases, stock/COGS, payables, processor clearing/payouts and bank movements appear on the correct financial basis.
- Actual Night Scout pages update from the daily events using canonical scoped contracts; no fixture data appears in merchant views.
- Provider test-order exclusion and Shopify/Xero acceptance evidence are unchanged and remain independently verifiable.
- Each run exposes a clear freshness receipt and passes financial reconciliation.

## Decisions to confirm before the first write

These inputs can stay configurable for the plan and local generator, but must be resolved before persistent staging records are created:

- Whether £500,000 should mean net revenue after refunds including shipping (the current provisional interpretation) or a different turnover definition.
- The target history window and start date.
- VAT mix, registration assumption, VAT accounting scheme and VAT return settlement timing.
- The amount and payment timing for each of the five roles, employer costs and pension contributions.
- Fulfilment rate card and annual cost target.
- Other annual overhead and marketing budgets, processor fee assumptions, opening cash, supplier terms and settlement schedules.
- Existing synthetic company suitability, write path, generator runtime and run time.

No further user detail is required to finish this plan. Use sensible, visible defaults for the initial local fixture, and ask only if a choice affects a persistent database write, access, cost or materially changes the reporting interpretation.


## 5 November 2026 — concrete local fixture defaults and readiness assessment

These versioned planning defaults resolve routine local-generator choices. They authorize no remote writes, access changes or scheduler activation. Retain the revenue/AOV definitions above: £500,000 net turnover includes £20,000 shipping; £38 AOV excludes VAT/shipping and precedes later refunds. Do not relabel this as a £38 VAT-inclusive checkout basket.

Use 24 completed months ending at the last completed London month, plus current-month completed days. Apply the seasonal weights above to a £500,000 annual baseline, with Mother's Day, Valentine's Day, Easter and Christmas gifting pulses; move holiday dates by year. Never generate future actuals. Freeze a separate dated reference mode for screenshot comparisons.

### Editable annual company cost base

| Component | Annual fixture assumption |
| --- | ---: |
| Five gross salaries: owner/manager £36k; buying/operations £30k; marketing £28k; customer service £25k; administrator £24k | £143,000 |
| Employer contribution allowance, separately accrued (scenario parameter, not a statutory calculation) | £17,000 |
| Employer pension allowance | £4,000 |
| Total employment expense | £164,000 |
| 3PL pick/pack: 13,263 orders × £1.25 | £16,578.75 |
| Carrier cost: 13,263 orders × £2.50 | £33,157.50 |
| 3PL storage | £4,800 |
| Returns handling and surcharges | £2,400 |
| Packaging: 13,263 orders × £0.25 | £3,315.75 |
| Marketing, channel-scoped | £30,000 |
| Processor fee budget, allocated to settlements | £9,000 |
| Office/administrative premises | £6,000 |
| Software | £4,800 |
| Insurance | £1,800 |
| Utilities/communications | £2,400 |
| Professional services | £3,600 |
| Equipment depreciation | £2,400 |

These assumptions deliberately expose a financially pressured five-person retailer: revenue £500,000 less £240,000 product COGS and £284,252 other costs gives operating loss £24,252; EBITDA loss £21,852. Do not manufacture a healthy operating margin to make the demo look attractive. Shipping revenue is already in turnover; carrier and packaging are charged once. Payroll is overhead; inventory purchases affect stock/payables/cash before sale-triggered COGS. The £17k employer allowance is an editable fictional budget, not UK payroll advice.

Generate monthly payroll accruals and net-pay/liability settlements, weekly 3PL invoices, daily processor clearing/fees with two-business-day payouts, monthly software/office costs, channel advertising accruals and monthly payment, supplier invoices on 30-day terms, inventory receipts before seasonal peaks, later-dated partial refunds and quarterly VAT settlement events. Use artificial IDs only. Start with £60,000 opening bank cash, £35,000 stock and matching explicit opening equity/payables; validate every opening balance and roll-forward. Standard-rated-only baseline is simplest; mixed VAT/zero-rate cases belong in separate named edge scenarios. Keep tax settlement timing configurable.

### Is direct Supabase synthetic data enough?

Yes for the supported reporting and chart path **if** the generator populates the canonical scoped event/cost structures, coverage evidence and sealed snapshots expected by those readers. Rows alone are insufficient. The current code contract in `src/lib/v11/reporting-adapter.ts` requires matching business/currency/period, allowed access, freshness, verified snapshot ID/as-of, sales coverage and ready profit components. Existing hooks do not yet expose every required snapshot field. The fictional v11 workspace is therefore not converted into a dynamic merchant dashboard by merely adding table rows.

Daily sales/profit events can exercise date changes, AOV, margin, seasonality, per-order denominators and contextual Explore the Numbers links once wired through the shared contract. Cash requires balances, settlements, stock and payable/receivable roll-forwards; customer economics requires stable synthetic customer/cohort IDs and acquisition attribution; channel views require matched spend and channel activity. Plan persistence, monitoring delivery and invitations need their own services. Provider OAuth, API pagination, webhooks, test-order exclusion and scheduled provider transaction linkage remain separate Shopify/Xero tests.

Acceptance must follow one event from source row through reader/snapshot to chart, commentary and Explore the Numbers evidence, retaining the same company, dates, unit, denominator and snapshot. Check the ten-second owner verdict with changing figures, and reject any static Q3 preview substitution. Also test unavailable, incomplete, stale and refund-only days, same-day amounts, DST, monthly close, idempotent replay and non-member isolation. No staging seed or schedule is claimed by this update.
