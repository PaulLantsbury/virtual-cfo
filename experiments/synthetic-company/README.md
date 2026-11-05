# Offline synthetic company generator

Local preparation only. This module never connects to Supabase, Shopify, Xero or Render; it has no credentials, target store identifiers, provider SDKs, SQL writer or scheduler. Nothing here certifies reporting completeness or changes the application. A new dedicated company and reviewed canonical adapter remain staging gates. Never use Store D or an existing customer store.

## Run

Use Node 22+; no dependencies or installation needed. From the repository root:

```sh
node --test experiments/synthetic-company/generator.test.mjs
node experiments/synthetic-company/cli.mjs --as-of 2026-11-05
node experiments/synthetic-company/cli.mjs --as-of 2026-11-05 --full > /tmp/night-scout-fictional-ledger.json
```

Default explicit reference date is **5 November 2026**, not the machine clock. It generates 24 completed months (1 November 2024–31 October 2026) and completed November days through 4 November. `asOf` means the current **London business date** supplied by the operator; the generator does not infer it from the host timezone. Calendar keys stay ISO business dates through leap years and DST, without fabricating UTC transaction timestamps. No future financial events are materialized. Future due dates remain an outstanding schedule list.

`--months` selects a different initial history size. For a daily extension, **pin `--from YYYY-MM-01` to the original start** and advance `--as-of`; this preserves every past event byte for byte, including opening-cohort treatment. A rolling-window regeneration with a new opening date is a different fixture, not an append. `--company` accepts only explicit `fictional-...` identifiers. The immutable default profile is in `generator.mjs`; budgets can be revised there only with a new profile version and separately regenerated scenario. There is no implicit configuration mutation.

`--full` prints the complete scoped journal and daily receipts. Default output is a small summary. Outputs are byte equivalent for identical arguments. CLI rejects unknown/incomplete options. The in-memory `replay` helper inserts zero on an exact rerun and rejects changed immutable IDs; it does not prove database concurrency or remote idempotency.

## Financial contract

The profile follows the synthetic-company guidance's 5 November defaults. A full calendar year reconciles to:

| Item | Annual result |
| --- | ---: |
| Original paid orders | 13,263 |
| Gross product sales, excluding VAT/shipping | £528,000 |
| Product discounts | £24,000 |
| Discounted product sales before subsequent refunds | £504,000 |
| Later product refunds | £24,000 |
| Net product sales | £480,000 |
| Shipping revenue | £20,000 |
| Net turnover | £500,000 |
| Net COGS | £240,000 |
| Product gross profit | £240,000 (50%) |
| Variable costs, including fulfilment/packaging and processor fees | £69,252 |
| Marketing | £30,000 |
| Overheads, including five-person employment and depreciation | £185,000 |
| Operating profit | −£24,252 |
| EBITDA | −£21,852 |

AOV is £504,000 / 13,263, approximately £38 **excluding VAT/shipping, before later refunds**. It is not a VAT-inclusive checkout value. Payroll totals £143,000 gross salary, £17,000 fictional employer contribution allowance and £4,000 employer pension. Employee withholding is a fictional 20% budget split, not a statutory tax calculation. Salaries accrue at monthly close; next-business-day net pay and nineteen-day liability remittances distinguish profit from cash. No personal data are used.

Orders vary by month, weekday and gifting pulses around Valentine's Day, UK Mothering Sunday, Easter and Christmas. Monthly weights conserve annual totals: Q4 is 40%, December 18%. Year-specific holidays move. Largest-remainder penny allocations avoid floating-point monetary drift; the standard-rated-only taxable baseline records rounded tax per event. Insurance and processor fees are exempt assumptions; payroll has no VAT. Taxable premises assume an opted-to-tax charge. VAT returns use a fictional accrual scheme with settlement 37 days after calendar-quarter close. This is a scenario, not tax advice or a filing calendar.

Each sale has a stable synthetic order/customer/channel reference and balanced journal. Refund events occur fourteen calendar days after the original sale and retain order links. Partial refunds never exceed the original product/cost amount; saleable returns reverse half the refunded product value as COGS. The opening fourteen-day cohort is generated for link evidence but is outside the reporting ledger. AOV original-order counts remain on sale dates.

Opening balances: bank £60,000, inventory £35,000, equipment £24,000, matched by £119,000 equity; no invented opening payable or VAT liability. Equipment supports the specified depreciation. Monthly stock receipts match net expected stock consumption, with 30-day supplier invoices. Outbound COGS and returned-stock reversals remain separate from purchases. Stock never becomes negative in the checked default history.

Fulfilment/packaging costs use actual daily order counts; storage, returns/surcharges and other overhead budgets accrue daily by calendar allocation. Weekly consolidated supplier invoices move accrued liabilities to payables; payment occurs thirty days later. Daily marketing is channel-tagged but is **not** certified matched cohort attribution. Processor settlement is explicitly **gross payouts after two weekdays, with processor fees separately charged to bank daily**. It does not simulate net-of-fee payouts. Business days exclude weekends only; bank holidays/provider settlement calendars remain an adapter-level extension.

## Evidence and limitations

Every journal event carries fictional company, profile, currency, timezone and provenance; provider is null. Debits are positive and credits negative. Daily snapshots include balances, metric totals, event counts and SHA-256 receipts. The fixture fingerprint includes all data, explicit horizon and limitations. These are local integrity checks, **not canonical coverage approvals or verified merchant snapshots**.

Tests independently assert annual target amounts, balancing, every daily balance roll-forward, refund capacity/event dates, cash clearing versus unsettled receipts, VAT quarter reconciliation, payroll liability timing, Christmas seasonality, leap/DST date coverage, deterministic replay/extension, rejected scope/date input and byte-equivalent CLI output. No application test suite is modified.

Remaining before live chart acceptance: read-only schema fit, reviewed scoped event/cost adapter and any required access proposal; canonical coverage/seals and snapshot metadata; supported live page wiring; chart/table/commentary/Explore the Numbers consistency; non-member/cross-company database tests; incomplete/stale/failure cases; scheduler approval and operational receipts. Customer cohorts, channel matching, stock units/ageing, individual supplier products and bank reconciliation are not fully modeled. A synthetic ledger cannot establish Shopify/Xero OAuth, collection, pagination, webhook or test-provider acceptance. No live write path is prepared by this package.
