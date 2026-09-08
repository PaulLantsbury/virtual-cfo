# Metric-to-source reconciliation — work package 3

Paul confirmed on 8 September 2026 that the current dataset is test data, and that the previous development effort was still building and connecting the Supabase tables. A working query, a populated column and an accurate business metric are three different things. Do not treat any as proof of the others.

This inventory records the existing wiring and known gaps; it is not a completed numerical reconciliation. Schema and seven trading-function definitions were read from Supabase on 8 September. No tables or data were changed.

## Trading metrics used by the dynamic briefing

All seven functions currently filter by `orders.created_at::date`, not `order_date`. Store timezone and ingestion/event-date semantics must be agreed before real integrations.

| Screen metric | Existing function/source | Existing behaviour | Reconciliation still required |
| --- | --- | --- | --- |
| Gross sales | `gross_revenue` → `orders.gross_sales` | Sums non-cancelled orders | Tax/shipping basis, null statuses, complete imported periods |
| Net sales | `net_sales` → `orders` | Gross less discounts, refunds and tax; null components become zero | Refund VAT treatment, duplication, comparison to persisted `orders.net_sales` and source system totals |
| AOV | `average_order_value` → `orders` | Same net-sales numerator divided by count excluding fully refunded/cancelled orders | Agreed denominator and refunds; verify per-order fixture cases |
| Repeat purchase rate | `repeat_purchase_rate` → `orders` + `customers.first_order_at` | Distinct linked customers whose first order precedes period start / linked customers in period | Customer identity, first-order completeness, guest linkage and timezone |
| Discount rate | `discount_dependency` → `orders.discounts/gross_sales` | Value-based rate on non-cancelled orders | Consistent tax basis; not the share of orders with a code |
| Refund rate | `refund_rate` → `orders.refunds/gross_sales` | Refunds attributed to original order period | Reconcile refund-event tables, tax basis, partial refunds and historic backfills |
| Period availability | `order_count` → `orders` | Excludes cancelled AND fully refunded orders | This is a qualifying-order count, not ingestion coverage. A period of entirely refunded orders can be missed. Add an explicit period-coverage/all-trading-order contract before production use. |

The dashboard now computes its comparison from these same metrics over the immediately preceding period. It does not infer a trend from an absent period and does not call monthly-only comparison functions for weekly reporting. This makes copy internally consistent; it does not certify the underlying SQL's financial definitions.

## Tables already present and unfinished connections

| Area | Existing tables/fields | What must be completed |
| --- | --- | --- |
| Product cost / contribution | `order_line_items`, `product_variants.cost`, `cost_populated`, `store_cost_assumptions` | Cost completeness, historic cost-at-sale policy, quantity and refund treatment, and connection into contribution SQL. Do not treat missing costs as zero. |
| Refunds | `refunds`, `refund_line_items`, order-level refund fields | Reconcile event totals and line quantities to order-level figures and tax. |
| Overhead / profit | `overhead_categories`, `overhead_entries` | Actual versus budget handling, accounting periods, categories, and weekly allocation; reconcile to the contribution calculation. |
| Cash | `cash_balance_snapshots`, current cash view | Account/currency coverage, snapshot age and matched expense basis for runway. |
| Marketing | daily channel metrics, monthly channel snapshots, blended monthly metrics, CAC snapshots, opportunity scores | Complete source ingestion, attribution, period aggregation and consistent cost treatment; verify which UI fields actually use these results. |
| Opportunities | `opportunities`, `channel_opportunity_scores` | Generate estimates from the agreed calculation engine; keep cash release separate from recurring profit; deduplicate overlapping effects. Seed rows are examples. |
| Monitoring | `cfo_alerts` | Actual scheduled evaluation, recommendation/progress history and delivery. A table and example cards are not a running monitor. |
| Store identity | `stores`, `store_settings` | Authenticated membership, scoped reads and server entitlements; demo store is still hardcoded. |

Aggregate test-data coverage at inspection: 3,845 order lines; 14 refund lines; 11 variants, seven with a non-null cost; no order lines with a null variant ID; three cash snapshots; 144 overhead entries; eight marketing daily rows. These counts do not prove reconciled totals or continuous date coverage. A linked variant may still have a missing cost, and non-null cost is not proof of correctness.

## Next implementation sequence

1. Agree a small canonical test ledger including discounts, VAT, full/partial refunds, missing costs, zero sales and period-boundary events. Specify the expected totals independently of the existing SQL.
2. Map each desired UI field to an existing or proposed table field and calculation; label it connected, static, partially connected or missing. Expand the older `number-source-audit.md` rather than assuming every missing UI figure needs a new table.
3. Reconcile the six trading metrics and availability/coverage logic first. Compare source-row aggregates, RPC output and displayed values for the same store and dates.
4. Complete COGS, contribution, overhead and cash calculations with migration files and tests in a disposable database. Reconcile the historic cloud migration ledger before replaying changes.
5. Connect the remaining UI fields and dynamic narrative inputs to those verified results. Then validate recommendation estimates, monitoring and integrations.

Completion means the canonical test ledger, database calculations, displayed values and generated copy agree. It does not mean changing the sample data until the old screen figures happen to match.
