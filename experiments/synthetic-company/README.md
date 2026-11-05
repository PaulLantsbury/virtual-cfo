# Offline synthetic company generator

The generator itself is offline: it never connects to Supabase, Shopify, Xero or Render and contains no credentials or scheduler. Other modules in this directory prepare and rehearse explicitly bounded staging proposals. January's separately approved synthetic example is already loaded; that approval does not cover a full-history load. Never use Store D or an existing customer store.

## Run

Use Node 22+; no dependencies or installation needed. From the repository root:

```sh
node --test experiments/synthetic-company/generator.test.mjs
node experiments/synthetic-company/cli.mjs --as-of 2026-11-05
node experiments/synthetic-company/cli.mjs --as-of 2026-11-05 --full > /tmp/night-scout-fictional-ledger.json
```

Default explicit reference date is **5 November 2026**, not the machine clock. It generates 24 completed months (1 November 2024–31 October 2026) and completed November days through 4 November. `asOf` means the current **London business date** supplied by the operator; the generator does not infer it from the host timezone. Calendar keys stay ISO business dates through leap years and DST, without fabricating UTC transaction timestamps. No future financial events are materialized. Future due dates remain an outstanding schedule list.

`--months` selects a different initial history size. For a daily extension, **pin `--from YYYY-MM-01` to the original start** and advance `--as-of`; this preserves every past event byte for byte, including opening-cohort treatment. A rolling-window regeneration with a new opening date is a different fixture, not an append. `--company` accepts only explicit `fictional-...` identifiers. The immutable default profile is in `generator.mjs`; budgets can be revised only with a new profile version and separately regenerated scenario. There is no implicit configuration mutation. `generate({profile: "uk-gifts-v1", ...})` retains the original five-person £500,000 pressure scenario through the exported `HISTORICAL_PROFILE_V1`; the default is v2. The CLI uses the default v2. Event IDs contain the profile version, so v2 cannot overwrite v1 history. Never combine both versions as one company ledger: replay/compare them as separate scenarios.

`--full` prints the complete scoped journal and daily receipts. Default output is a small summary. Outputs are byte equivalent for identical arguments. CLI rejects unknown/incomplete options. The in-memory `replay` helper inserts zero on an exact rerun and rejects changed immutable IDs; it does not prove database concurrency or remote idempotency.

## Financial contract

The current default **uk-gifts-v2** implements the user's revised £750,000 turnover and four-person company. It removes the £24,000 administrator role; remaining gross salary is £119,000. Employer and pension budgets retain the earlier proportions, rounded separately to pennies: £17,000 × 119/143 = £14,146.85; £4,000 × 119/143 = £3,328.67. Employment totals **£136,475.52**, a £27,524.48 reduction. Sales, discounts, refunds, shipping and COGS scale by 1.5. Orders round to 19,895 at about £38 AOV, and actual per-order charges use that integer count. Processor fees scale to £13,500; marketing, storage, returns/surcharge budget and other fixed overheads remain unchanged. No assumption of unlimited capacity is implied; this is a local scenario. A full calendar year reconciles to:

| Item | Annual result |
| --- | ---: |
| Original paid orders | 19,895 |
| Gross product sales, excluding VAT/shipping | £792,000 |
| Product discounts | £36,000 |
| Discounted product sales before subsequent refunds | £756,000 |
| Later product refunds | £36,000 |
| Net product sales | £720,000 |
| Shipping revenue | £30,000 |
| Net turnover | £750,000 |
| Net COGS | £360,000 |
| Product gross profit | £360,000 (50%) |
| Variable costs, including fulfilment/packaging and processor fees | £100,280 |
| Marketing | £30,000 |
| Overheads, including four-person employment and depreciation | £157,475.52 |
| Operating profit | £102,244.48 |
| EBITDA | £104,644.48 |

AOV is £756,000 / 19,895, approximately £38 **excluding VAT/shipping, before later refunds**. It is not a VAT-inclusive checkout value. Payroll totals £119,000 gross salary, £14,146.85 fictional employer contribution allowance and £3,328.67 employer pension. Employee withholding is a fictional 20% budget split, not a statutory tax calculation. Salaries accrue at monthly close; next-business-day net pay and nineteen-day liability remittances distinguish profit from cash. No personal data are used.

Orders vary by month, weekday and gifting pulses around Valentine's Day, UK Mothering Sunday, Easter and Christmas. Monthly weights conserve annual totals: Q4 is 40%, December 18%. Year-specific holidays move. Largest-remainder penny allocations avoid floating-point monetary drift; the standard-rated-only taxable baseline records rounded tax per event. Insurance and processor fees are exempt assumptions; payroll has no VAT. Taxable premises assume an opted-to-tax charge. VAT returns use a fictional accrual scheme with settlement 37 days after calendar-quarter close. This is a scenario, not tax advice or a filing calendar.

Each sale has a stable synthetic order/customer/channel reference and balanced journal. Refund events occur fourteen calendar days after the original sale and retain order links. Partial refunds never exceed the original product/cost amount; saleable returns reverse half the refunded product value as COGS. The opening fourteen-day cohort is generated for link evidence but is outside the reporting ledger. AOV original-order counts remain on sale dates.

Opening balances: bank £60,000, inventory £35,000, equipment £24,000, matched by £119,000 equity; no invented opening payable or VAT liability. Equipment supports the specified depreciation. Monthly stock receipts match net expected stock consumption, with 30-day supplier invoices. Outbound COGS and returned-stock reversals remain separate from purchases. Stock never becomes negative in the checked default history.

Fulfilment/packaging costs use actual daily order counts; storage, returns/surcharges and other overhead budgets accrue daily by calendar allocation. Weekly consolidated supplier invoices move accrued liabilities to payables; payment occurs thirty days later. Daily marketing is channel-tagged but is **not** certified matched cohort attribution. Processor settlement is explicitly **gross payouts after two weekdays, with processor fees separately charged to bank daily**. It does not simulate net-of-fee payouts. Business days exclude weekends only; bank holidays/provider settlement calendars remain an adapter-level extension.

### Profit interpretation and historical baseline

The revised operating margin is **13.63%** (£102,244.48 / £750,000); EBITDA margin is **13.95%**. Fulfilment/packaging costs total £86,780: pick/pack £24,868.75, carrier £49,737.50, packaging £4,973.75, storage £4,800 and returns/surcharges £2,400. Adding processor fees £13,500 gives £100,280 variable costs. Contribution after marketing is £259,720. Other fixed overheads excluding employment total £21,000, including £2,400 depreciation. These are fixture results before interest and corporation tax, not guaranteed profit or an assessment of staffing capacity.

**Historical v1 remains unchanged:** 13,263 annual orders, £500,000 turnover, £240,000 gross profit, five-person employment £164,000, variable costs £69,252, overheads £185,000, operating loss £24,252 and EBITDA loss £21,852. The revision creates new versioned fixture events; it does not alter old source records or retroactively label earlier tests profitable.

## Evidence and limitations

Every journal event carries fictional company, profile, currency, timezone and provenance; provider is null. Debits are positive and credits negative. Daily snapshots include balances, metric totals, event counts and SHA-256 receipts. The fixture fingerprint includes all data, explicit horizon and limitations. These are local integrity checks, **not canonical coverage approvals or verified merchant snapshots**.

Tests independently assert annual target amounts, balancing, every daily balance roll-forward, refund capacity/event dates, cash clearing versus unsettled receipts, VAT quarter reconciliation, payroll liability timing, Christmas seasonality, leap/DST date coverage, deterministic replay/extension, rejected scope/date input and byte-equivalent CLI output. No application test suite is modified.

January's supported sales/profit page slice has separate hosted acceptance. Full-history acceptance still requires a reviewed versioned source/evidence contract, hosted permissions and authenticated readback, chart/table/commentary/Explore the Numbers consistency, failure and isolation checks, and separate scheduler approval. Customer cohorts, channel matching, stock ageing, individual supplier products and bank reconciliation are not fully modeled. A synthetic ledger cannot establish Shopify/Xero OAuth, collection, pagination, webhook or test-provider acceptance.

## Two-year history and daily continuation

The `history-*` modules are a **local disposable-database proposal**, not an installed feed. They prepare a separate private history edition, preserve the existing January v1 source/evidence tables, and reuse existing monetary calculations through a new SQL-backed v2 reader. They do not extend the installed v1 SQL reader or bypass its store-wide invalidation rules.

Pin the November 2024 opening date when extending the default reference history. Only completed London business days may be appended; replay must insert nothing, changed immutable IDs must fail, and each complete month must retain its exact evidence basis. January sales/profit reconcile across editions; closing cash can differ because the opening basis differs. Never combine their opening journals or silently switch a page between editions.

See [rollout and recovery](../../docs/history-rollout-and-recovery-2026-11-05.md) and [independent review](../../docs/synthetic-history-independent-review-2026-11-05.md). A real hosted load, access policy, page connection and daily scheduler each remain distinct acceptance gates. Local overlapping calls do not prove distributed concurrency safety.
