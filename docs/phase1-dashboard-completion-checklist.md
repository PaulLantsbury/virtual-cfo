# Phase 1 Dashboard Completion Checklist

_Last updated: April 2026 · Cloud project: `futkktdebdygsdrcknpr` (eu-north-1)_

---

## 1. KPI Tiles — Supabase-backed (8 of 11)

These tiles read from the cloud Supabase database via SECURITY DEFINER RPC functions.
The primary source is always the Phase 1 RPC result; each tile has a documented fallback.

| Tile id | Title | Primary RPC | Fallback |
|---------|-------|-------------|----------|
| `ns` | Net Sales | `net_sales()` | `commerceMetrics.netSales` (all-time) |
| `mr` | Monthly Revenue | `gross_revenue()` | `commerceMetrics.totalRevenue` (all-time) |
| `aov` | Average Order Value | `average_order_value()` | `commerceMetrics.averageOrderValue` |
| `rr` | Refund Rate | `refund_rate()` | `commerceMetrics.refundRate` |
| `dd` | Discount Dependency | `discount_dependency()` | `commerceMetrics.discountRate` |
| `rpr` | Repeat Purchase Rate | `repeat_purchase_rate()` | `commerceMetrics.repeatPurchaseRate` |
| `cm` | Contribution Margin | `contribution_margin_pct()` | `commerceMetrics.contributionMarginPercent` |
| `rc` | Recoverable Contribution | `recoverable_contribution_range()` | `RECOVERABLE_LOW / RECOVERABLE_HIGH` constants |

**Period convention (date-range tiles):** current calendar month, computed at module load.
`PHASE1_DATE_FROM = YYYY-MM-01`, `PHASE1_DATE_TO = last day of month`.
Store ID is hardcoded to `10000000-0000-0000-0000-000000000001` until auth is wired.

**`rc` tile note:** `recoverable_contribution_range()` takes only `p_store_id` — no date range.
Opportunities are store-level signals, not period-bound.

**"change" strings:** All eight wired tiles currently show hardcoded change text
(e.g. `↑ 12.4% vs last month`). Period-over-period deltas are not yet computed from the DB.
This is intentional — prior-period comparison functions are Phase 2 scope.

---

## 2. KPI Tiles — Mock / Partial (3 of 11)

These tiles have no Supabase backing and display static constants from snapshot files.

| Tile id | Title | Current source | Why it is still mock |
|---------|-------|---------------|----------------------|
| `cr` | Cash Runway | `CASH_RUNWAY = 3.4` from `cash-snapshot.ts` | Requires cash balance + monthly fixed costs. Both come from Xero. No Supabase function exists yet. |
| `ae` | Acquisition Efficiency | Hardcoded string `"Meta CAC +14%"` in `KPI_CARDS` | Requires Meta Ads API spend data and new-customer count per period. No ingestion pipeline exists yet. |
| `np` | Net Profit | Hardcoded string `"£56,300"` in `KPI_CARDS` | Requires Xero P&L (contribution minus fixed operating costs). No Supabase function exists yet. |

---

## 3. SQL Functions Now Powering the Dashboard

All eleven functions live in the `public` schema, are `STABLE`, `SECURITY DEFINER`, and
have `SET search_path = public, pg_temp`.

### Called directly by `getPhase1Metrics()` in `phase1Metrics.ts`

| Function | Signature | Returns | Tile / Purpose |
|----------|-----------|---------|----------------|
| `gross_revenue` | `(uuid, date, date)` | `numeric` | `mr` tile — SUM(gross_sales) excl. cancelled |
| `discount_cost` | `(uuid, date, date)` | `numeric` | Internal — numerator for `cm` (not a tile directly) |
| `return_amount` | `(uuid, date, date)` | `numeric` | Internal — feeds `cm` return_handling deduction |
| `net_sales` | `(uuid, date, date)` | `numeric` | `ns` tile — SUM(gross_sales − discounts − refunds − tax) excl. cancelled |
| `order_count` | `(uuid, date, date)` | `bigint` | Internal — AOV denominator; also used inside `contribution_margin_pct` |
| `average_order_value` | `(uuid, date, date)` | `numeric` | `aov` tile — net_sales / qualifying_order_count |
| `repeat_purchase_rate` | `(uuid, date, date)` | `numeric` | `rpr` tile — returning_customers / all_period_customers, ratio [0,1] |
| `discount_dependency` | `(uuid, date, date)` | `numeric` | `dd` tile — SUM(discounts) / SUM(gross_sales), ratio [0,1] |
| `refund_rate` | `(uuid, date, date)` | `numeric` | `rr` tile — SUM(refunds) / SUM(gross_sales), ratio [0,1] |
| `contribution_margin_pct` | `(uuid, date, date)` | `numeric \| null` | `cm` tile — (net_sales − variable costs) / net_sales, ratio [0,1]; NULL = no cost row |
| `recoverable_contribution_range` | `(uuid)` | `TABLE(recoverable_low numeric, recoverable_high numeric)` | `rc` tile — SUM(impact_low/high) from non-archived opportunities |

### View

| Object | Purpose |
|--------|---------|
| `v_current_cost_assumptions` | Most-recent `effective_from ≤ today` cost assumption row per store. Read exclusively by `contribution_margin_pct()`. |

### Formula discrepancies vs the legacy frontend (documented, intentional)

| Function | SQL (canonical) | Legacy `commerceMetrics.ts` |
|----------|----------------|----------------------------|
| `average_order_value` | `net_sales / order_count` (excl. cancelled + refunded) | `total_sales / count(*)` (all orders) |
| `discount_dependency` | value-based: `SUM(discounts) / SUM(gross_sales)` | not computed; was static snapshot |
| `repeat_purchase_rate` | date-window aware: `first_order_at < period_start` | un-windowed all-time ratio |

---

## 4. Cloud Tables and Views Now Required

All tables are multi-tenant: every row carries `store_id NOT NULL → stores(id)`.

### Core tables (migration `20260429000000`)

| Table | Role |
|-------|------|
| `stores` | Root — one row per merchant. Unique on `shopify_domain` and `shopify_store_id`. |
| `store_settings` | Per-store targets (`cm_target_pct`, `runway_warn_months`, `repeat_rate_target_pct`). Unique on `store_id`. |
| `store_cost_assumptions` | Variable cost rates per store per `effective_from` date. Unique on `(store_id, effective_from)`. |
| `customers` | One row per registered Shopify customer. Unique on `(store_id, shopify_customer_id)`. |
| `products` | Shopify product catalogue. Unique on `(store_id, shopify_product_id)`. |
| `product_variants` | Shopify variant catalogue with cost and price. Unique on `(store_id, shopify_variant_id)`. |
| `orders` | Shopify order events — primary data source for all date-range RPCs. Unique on `(store_id, shopify_order_id)`. |
| `order_line_items` | Per-line price, quantity, discount, total. Unique on `(store_id, shopify_line_item_id)`. |
| `refunds` | Refund events linked to orders. Unique on `(store_id, shopify_refund_id)`. |
| `refund_line_items` | Line-level refund detail (quantity, subtotal). PK only — no additional unique constraint. |
| `discounts` | Shopify price rules. Unique on `(store_id, shopify_price_rule_id)`. |
| `discount_codes` | Shopify discount codes linked to price rules. Unique on `(store_id, code)`. |
| `opportunities` | Store-level opportunity rows powering the `rc` tile. Filtered by `status <> 'archived'`. |
| `cfo_alerts` | Alert inbox entries shown in the CFO Alerts page. |

### View (migration `20260429000003`)

| View | Depends on |
|------|-----------|
| `v_current_cost_assumptions` | `store_cost_assumptions` |

---

## 5. Schema Drift and Legacy Columns to Ignore

These mismatches were discovered during cloud seed reconciliation (migration `20260429000004`)
and are now fully documented. The cloud schema is authoritative; the local `seed.sql`
was the source of the drift.

### `order_line_items`
| Column in local `seed.sql` | Cloud reality | Action |
|----------------------------|---------------|--------|
| `title` | **Does not exist** | Drop from all INSERTs |
| `compare_at_price` | **Does not exist** | Drop from all INSERTs |
| `total_discount` | Renamed to `discount` | Map `total_discount → discount` |
| _(absent)_ | `total` (`price * qty − discount`) | Compute and include |
| `shopify_line_item_id` | `text` (not `integer`) | Cast integers to `text` on insert |

### `refunds`
| Column in local `seed.sql` | Cloud reality | Action |
|----------------------------|---------------|--------|
| `refund_subtotal` | Renamed to `amount` | Map `refund_subtotal → amount` |
| `created_at` (used as event date) | Both `refund_date` and `created_at` exist | Use `refund_date` for the event timestamp; `created_at` defaults to `now()` |

### `opportunities`
| Column in local `seed.sql` | Cloud reality | Action |
|----------------------------|---------------|--------|
| `uplift_low` | Renamed to `impact_low` | Map accordingly |
| `uplift_high` | Renamed to `impact_high` | Map accordingly |
| `priority_rank` | Renamed to `priority` | Map accordingly |
| `action_label` | **Does not exist** | Drop |
| `why_label` | **Does not exist** | Drop |

### `cfo_alerts`
| Column in local `seed.sql` | Cloud reality | Action |
|----------------------------|---------------|--------|
| `alert_key` | Renamed to `alert_type` | Map accordingly |
| `is_triggered` | **Does not exist** | Drop; `is_read` (default `false`) is the closest equivalent |
| `title` | Exists, **NOT NULL** | Must always be supplied on insert |

---

## 6. Before Shopify Ingestion

The dashboard currently reads from a static 108-order seed dataset.
The following must be completed before real Shopify order data flows in.

### Auth and multi-tenancy
- [ ] Replace hardcoded `PHASE1_STORE_ID` in `dashboard.tsx` with a per-session store UUID
      resolved from the authenticated user's account.
- [ ] Add a `user_stores` or `store_memberships` table to map auth users → stores.
- [ ] Confirm RLS policies or accept that SECURITY DEFINER functions handle all tenant isolation.

### Shopify OAuth and webhook setup
- [ ] Shopify OAuth install flow — captures `shop`, `access_token`, creates/updates `stores` row.
- [ ] Webhook registration for: `orders/create`, `orders/updated`, `refunds/create`,
      `customers/create`, `products/update`.

### Data ingestion mappings (cloud schema is authoritative)
- [ ] `orders` — map Shopify `order.id` → `shopify_order_id` (text), compute
      `gross_sales`, `discounts`, `refunds`, `tax`, `total_sales` from Shopify line totals.
- [ ] `order_line_items` — map to `shopify_line_item_id` (text), `price`, `quantity`,
      `discount`, `total`. No `title` or `compare_at_price` columns.
- [ ] `customers` — map `shopify_customer_id` (text), `email`, `is_guest` (null customer_id = guest),
      maintain `first_order_at` and `total_orders` in real time.
- [ ] `refunds` — map `shopify_refund_id` (text), `refund_date` (event timestamp), `amount`
      (not `refund_subtotal`). `created_at` defaults to `now()` automatically.
- [ ] `products` + `product_variants` — sync on `products/update` webhook; include `cost`
      from the Cost of Goods API if contribution margin accuracy is required.

### Cost assumptions
- [ ] Provide real `store_cost_assumptions` row per merchant at onboarding
      (payment rate, fulfilment, packaging, return handling).
- [ ] Confirm current dev seed: `effective_from = 2026-01-01`, `payment_fee_rate = 0.029`,
      `fulfilment_cost_per_order = 3.50`, `packaging_cost_per_order = 1.25`,
      `return_handling_rate = 0.15`.

### Timezone handling
- [ ] UK merchants: set `SET timezone = 'Europe/London'` at connection time, or use
      `created_at AT TIME ZONE stores.timezone::date` inside RPC functions.
      Current functions use `created_at::date` which truncates in UTC (Supabase default).

### Opportunities and alerts
- [ ] Define how `opportunities` rows are created — manually by the opportunity engine,
      by a scheduled function, or at Shopify sync time.
- [ ] Define the `cfo_alerts` generation logic (scheduled job vs. real-time trigger).

---

## 7. Before Xero Integration

The `cr` (Cash Runway) and `np` (Net Profit) tiles cannot be wired without Xero data.

### New tables / columns needed
- [ ] `xero_bank_accounts` or `cash_positions` — current balance per store, synced daily.
- [ ] `xero_fixed_costs` or `monthly_fixed_costs` — total monthly fixed operating costs per store
      (rent, salaries, SaaS). This is the denominator for cash runway.
- [ ] `xero_pl_lines` or equivalent — P&L entries for operating profit calculation.

### New SQL functions needed
- [ ] `cash_runway_months(p_store_id uuid)` — `cash_balance / monthly_fixed_costs`.
      Returns `numeric`. Wire to `cr` tile.
- [ ] `operating_profit(p_store_id uuid, p_date_from date, p_date_to date)` —
      `contribution_margin − total_fixed_costs`. Wire to `np` tile.

### Wiring changes in `phase1Metrics.ts`
- [ ] Add `cashRunwayMonths: number` and `operatingProfit: number` to `Phase1MetricsResult`.
- [ ] Call both new functions inside `getPhase1Metrics()` (or a separate `getXeroMetrics()` helper).

### Dashboard wiring in `dashboard.tsx`
- [ ] Add `cr` wiring block: replace `CASH_RUNWAY` constant with `phase1Metrics.data.cashRunwayMonths`.
- [ ] Add `np` wiring block: replace `"£56,300"` hardcoded value with computed operating profit.

---

## 8. Before Meta / Google Ads Integration

The `ae` (Acquisition Efficiency) tile cannot be wired without ad platform data.

### What the tile requires
The current display is the hardcoded string `"Meta CAC +14%"`.
The canonical metric is `METRIC.META_CAC_TREND` — the change in Meta CAC vs. the prior period.

`Meta CAC = Meta ad spend in period / new customers acquired via Meta in period`

"New customer" = customer whose `first_order_at` falls within the period and whose
acquisition source is attributed to Meta (requires UTM or Shopify attribution data).

### New tables needed
- [ ] `ad_spend` — daily spend per channel (`meta`, `google`, `tiktok`, etc.),
      linked to `store_id`. Synced from Meta Marketing API / Google Ads API.
- [ ] `customer_acquisition_source` (or extend `customers`) — channel attribution per customer.
      Populated from Shopify `landing_site_ref` / UTM parameters at order time.

### New SQL function needed
- [ ] `meta_cac_trend(p_store_id uuid, p_date_from date, p_date_to date)` —
      compares CAC in the period vs. the immediately prior equal-length period.
      Returns a ratio (e.g. `1.14` = CAC up 14%). Consider returning a signed
      percentage change instead if the tile display evolves.

### Google Ads
- [ ] If Google Ads is added alongside Meta, create a `google_cac_trend()` function
      and a blended `blended_cac_trend()` combining both channels.
- [ ] Add a new tile id (`gcac` or extend `ae` to show blended CAC) and register
      it in `TILE_METRIC_MAP`.

### Dashboard wiring in `dashboard.tsx`
- [ ] Add `ae` wiring block: replace hardcoded `"Meta CAC +14%"` with computed
      `phase1Metrics.data.metaCacTrend` formatted as `±X%`.
- [ ] The status (`danger` / `warning` / `positive`) should be derived from whether
      CAC is rising or falling relative to the threshold.
