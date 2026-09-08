# Isolated financial calculations v1

Run `pnpm test:financial` from the repository root. Uses Node's built-in test runner; no additional dependencies, credentials, database or network. Fifteen tests exercise the ten agreed worked cases plus five guard groups against the previously committed expected fixtures.

`calculations.mjs` is a pure prototype, not imported by the application. Its functions have no fixture dependencies; the test file adapts the synthetic cases to its inputs. This is an isolated Node environment, not a disposable PostgreSQL instance. Live RPCs, the current UI and Replit have not been changed.

## Input contract and responsibility

- Money uses safe integer minor units; overflow/non-integer/missing values are rejected. Ratios carry unrounded numbers and a reason when unavailable. No storage rounding policy is invented. Recurring overhead returns exact fractional portions and withholds a rounded amount when residual-penny allocation is unresolved.
- `normaliseSale` requires an explicit inclusive/exclusive basis and actual recorded VAT components. Its shipping input is net of shipping discounts already; raw per-line shipping discount allocation belongs to a future source adapter.
- `tradingPeriod` requires complete declared coverage, one store/currency, unique event IDs, linked original-order IDs and calendar dates already resolved by a source adapter. Eligibility is an explicit boolean, not inferred from Shopify status. This is scoping validation, not authentication or proof of complete ingestion.
- Refunds are selected by their own event dates and never rewrite original AOV. Fully refunded orders stay in the original period count. Refund-only periods have activity even when AOV cannot be calculated. Original historical order validation and cumulative over-refund checks still belong to the future ledger adapter; an orderId alone is not evidence that the refund is valid.
- Historic costs are supplied explicitly. Saleable recovery and supported cost reversal must be established by the adapter; ambiguous return timing or missing historic cost is null. A refund without recovery cannot reverse cost. The prototype does not invent landed costs or look up today's catalogue cost.
- The profit bridge receives period totals already classified once. It cannot independently prove that a fee was not duplicated across source tables. Source classification, including actual/estimated provenance, must be tested in the next adapter layer. Any missing required cost withholds dependent profit outputs.
- `cashPosition` accepts a declared complete same-date, same-currency account set and separates unrestricted, restricted and unsettled balances. It does not perform FX or invent missing snapshots. Actual cash balances may be signed; negative available cash produces an unresolved runway state.
- `cashMovement` accepts reconciled external totals and internal transfers whose two accounts are included. It does not consume raw bank feeds. Transfer matching, feed deduplication, period/currency validation and historical account completeness remain adapter responsibilities.
- `cashRunway` requires an explicitly chosen last complete month and three consecutive complete months. The reviewed-flow flag may only be set when no unresolved financing/exceptional-flow treatment remains. It cannot prove those declarations itself. Exactly zero burn, incomplete history and other deferred conditions are incomplete results, not invented runway values.
- `separateImpacts` classifies forecast opportunities only. Forecasts never change actual available cash, even if a caller attaches a realised flag; actual realisation must enter through reconciled cash transactions.

## Evidence and limitations

F01–F10 assert the fixed monetary outputs, period separation and approved presentation states. Guard tests additionally reject malformed money, ambiguous tax basis, invalid dates/currencies, duplicate events, unknown eligibility, invalid product recovery, incomplete cash history and inconsistent depreciation input.

The [approved definitions](../../docs/agreed-financial-definitions.md) remain authoritative. [Worked cases](../../docs/financial-acceptance-cases.md) list deferred policies; this prototype does not approve them. Test success means local arithmetic conforms to these cases, not that the full product is financially reconciled. No production deployment is appropriate until source adapters, database tests, access controls and UI conformance are verified.
