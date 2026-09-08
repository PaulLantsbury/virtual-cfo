# Trading reconciliation — 8 September 2026

> Subsequent decision: Paul approved [sales definitions v1](agreed-financial-definitions.md), including pre-refund AOV and refund-event timing. Proposed sales conventions below are superseded by that decision; the measured legacy behaviour and other outstanding decisions remain valid.

## Result and limits

Read-only checks of the demo store found **119 matching calculations across 3 months and 14 weeks**: six trading metrics plus the qualifying order count. The SQL independently aggregates source rows and compares them with the deployed RPCs. This verifies the current implementation's arithmetic, not the correctness of the financial definition or completeness of the seed data. Boundary weeks are included; their presence does not certify a complete import.

Run `db-migrations/checks/trading-reconciliation.sql` with read-only database access to reproduce it. `source-completeness.sql` in the same folder reproduces the aggregate source-gap counts. Its date handling deliberately matches the current database session timezone. Before production, replace this implicit convention with an agreed store timezone and event-date contract.

| Period | Gross sales | Current RPC net sales | AOV | Discount rate | Refund rate | Repeat rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| February 2026 | £2,761.00 | £1,916.80 | £50.44 | 4.17% | 7.24% | 0.00% |
| March 2026 | £153,556.00 | £116,244.59 | £66.09 | 2.07% | 2.64% | 65.22% |
| April 2026 | £167,853.00 | £122,921.40 | £61.93 | 3.93% | 3.62% | 71.43% |

The April briefing should display £122,921 net sales, +5.7% versus March; AOV £61.93, −6.3%; refund rate 3.6%, +1.0 percentage points. Regression tests pass these observed aggregate responses through the query adapter and briefing model. This is transport/formatting validation, not a live browser or authenticated API test.

## Evidence of incomplete or conflicting sources

- There are 3,841 demo orders dated 1 February–30 April, of which 3,834 are non-cancelled. Created and order dates agree on this dataset; no unknown financial statuses or cancellation-flag disagreements were found.
- February and March have no populated stored `net_sales` values. April has only two populated values totalling £204. Most currency fields are also missing. Consequently, summing stored net sales cannot reconcile to the calculated sales figure. Missing values must not be backfilled merely to match the screen.
- All 3,834 non-cancelled orders have tax equal to 20% of gross less discounts, within one penny. This is evidence of a tax-exclusive gross basis in this seed, while the deployed net-sales function subtracts tax. The existing dictionary itself calls gross pre-tax elsewhere. This conflict must be resolved before trusting net sales, AOV, contribution or profit. Do not silently choose between incompatible definitions.
- Order-level refunds total £10,341.65. Linked refund events total £819.80. Of 191 orders with refunds, 178 have no event record. The 13 with linked events agree in amount. On 139 non-cancelled orders, `refund_ex_vat + refund_tax` differs from `refunds` by more than one penny. Using the event table or tax components now would change totals without establishing which is correct.
- There are 3,838 non-cancelled order lines. 1,463 lines/units have no linked variant cost. The known-cost subtotal is £68,116.50 before refund treatment; it is **not total COGS**. The deployed contribution function does not deduct product cost at all.
- Current AOV includes fully refunded orders in the net-sales numerator but excludes them from the order count. Period availability also uses that count, so an all-refunded period can disappear. No such all-refunded period occurred in this observed sample; a synthetic case is required.
- Weekly repeat rates are often 100% in March/April. They reconcile to the linked customer records and first-order dates; this does not prove realistic customer identity coverage. The SQL does not explicitly exclude linked guest checkouts.
- `monthly_overhead_total` only includes entries wholly contained within the requested dates. Passing a week does not allocate monthly overhead. `cash_runway_months` combines the newest cash snapshot with the current calendar month's overhead, independent of the selected period.

## Wiring changes in this package

The dashboard and its prior-period comparison now request only their six trading sources. Failures in unrelated contribution/opportunity functions can no longer suppress a valid trading briefing. Failed trading fields remain unavailable, not zero. Other pages retain the full Phase 1 loader for compatibility and still need the repairs mapped below.

Historical summary cards now use the same formatting as the dynamic briefing, including two decimal places for AOV. The repeat-rate definition refers to linked customers, matching the actual SQL rather than implying a guest filter.

## Current screen-to-source map

This updates the older `number-source-audit.md`; a database connection is not a reconciled metric.

| Screen / field group | Path in current code | Status / next dependency |
| --- | --- | --- |
| Dashboard six trading cards and copy | `getTradingMetrics` → six RPCs → orders/customers → `buildBriefing` | Connected and numerically checked against current SQL; tax/refund/currency definitions unresolved |
| Dashboard selected period / prior comparison | `useLatestDataPeriod`, `useBriefingComparison` → `order_count` | Partial: excludes fully refunded orders; needs separate trading coverage contract and ingestion completeness |
| Dashboard profit, runway, recoverable amounts | Explicitly withheld | Missing verified calculation, not necessarily missing tables |
| Margin gross/AOV/discount/refund | Phase 1 RPCs in `margin-analysis.tsx` | Partial: static fallback values, including `||` substitutions for valid zeros |
| Margin contribution £ / per-order / bridge | `CM_VALUE`, `MONTHLY_ORDER_VOLUME`, `liveBridgeRows` | Incorrect basis: CM ratio uses net sales in SQL but UI multiplies gross; volume inferred from gross/net AOV. Several costs/drivers remain fixed. Repair together after tax and COGS contract |
| Margin trend/recovery/simulator | Phase 2 deltas plus fixed trend, drivers and scenario assumptions | Partial; seed estimates must not become reconciled recovery claims |
| Growth repeat/discount/CAC payback | Phase 1, Phase 2 and marketing RPCs | Partial with snapshot fallbacks. Discount narrative incorrectly describes a value ratio as share of orders using codes; composition and recovery remain fixed |
| Marketing channels/CAC/contribution/payback | `marketingChannelMetrics.ts` → channel/blended/CAC snapshot RPCs | Connected to sparse seed snapshots with static fallbacks. Attribution and actual spend coverage not reconciled; causal driver text is unsupported |
| Pricing discount card | `discount_dependency` plus Phase 2 comparison | Partial; full-price ratio, contribution, recovery and simulator bases remain snapshots |
| Profit Growth | `profit-engine.tsx` fixed bridge, drivers and scenarios | Static. Existing overhead tables and profit RPC can support future wiring after corrected contribution |
| Cash Control | `cash-control.tsx` fixed cash bridge/drivers/scenarios, shared period hook | Partial/prototype; dated account balances, expenses, inventory ageing and debtor/creditor data needed. A reporting-period label does not wire the cash cards |
| Opportunity Finder | API opportunity rows + seeded range/capital-release constants | Partial; ranking, deduplication, evidence dates and separate cash/profit impact types required |
| CFO Alerts | Fixed attention items, plan progress, insights and history | Static; event history, evaluation jobs and delivery need implementation |

## Canonical ledger for the next calculation implementation

Use these synthetic cases in a disposable database, never by altering the current seed to force agreement. Proposed ingestion contract: monetary components explicitly identify tax basis; retain raw source values; normalise merchandise gross and discounts excluding tax, and refund cash/tax separately. Net merchandise sales = gross excluding tax − discounts excluding tax − (refund cash − refund tax). Shipping revenue is separate. Unknown currency/tax basis is unavailable. These are proposed inputs, not assertions about the existing ambiguous `refunds` column.

| Synthetic case | Gross ex tax | Discount ex tax | Sale tax | Refund cash / tax | Expected net merchandise sales |
| --- | ---: | ---: | ---: | ---: | ---: |
| Paid | 100 | 0 | 20 | 0 / 0 | 100 |
| Discount + partial refund | 100 | 10 | 18 | 24 / 4 | 70 |
| Fully refunded | 100 | 0 | 20 | 120 / 20 | 0; period still has trading activity |
| Cancelled | 100 | 0 | 20 | 0 / 0 | Excluded |
| Valid zero-value order | 0 | 0 | 0 | 0 / 0 | 0; period still has trading activity |
| Missing product cost | 100 | 0 | 20 | 0 / 0 | Sales 100; contribution unavailable |

Also test tax-inclusive raw source normalisation (120 gross / 20 tax → 100 gross ex tax), missing refund tax, multi-currency rejection, cross-store customers, events at midnight/Sunday/month end, and refund events in a later period. Decide whether AOV uses all paid orders or retained orders; name that denominator explicitly. Decide whether refunds restate order-period sales or hit the refund period. Do not silently change these contracts in existing RPCs.

## Next implementation gates

1. Resolve and document source tax/refund basis and AOV/refund-date conventions using the synthetic ledger above.
2. Introduce versioned normalised trading calculations and an all-trading-order coverage result, with quality flags. Keep empty, zero, missing and partial imports distinct.
3. Add historic cost-at-sale and refund/restocking handling. Existing variant costs alone cannot reconstruct historic COGS. Only then assemble contribution → actual overhead → operating profit.
4. Add dated, currency-consistent cash/expense calculations and deliberate weekly overhead allocation. Inventory ageing and receivable/payable ledgers need dedicated source feeds/fields beyond current balances.
5. Reconcile migration history and test migrations in a disposable database; verify store access controls before deployment. Rewire the detailed pages to the verified contracts and remove their snapshot fallbacks.

Security advisors continue to report RLS without policies and publicly callable security-definer analytics. These remain a separate deployment gate, not a reason to loosen access for the wiring work. See [Supabase's security-definer remediation](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable). Logs were inspected at aggregate level; no customer records, credentials or raw logs are included here.
