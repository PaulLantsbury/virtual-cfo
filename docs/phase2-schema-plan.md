# Phase 2 Schema Plan — Finance Layer

## Overview

Phase 2 introduces the finance (P&L + cash) layer that sits alongside the existing
Shopify commerce layer. It powers the three remaining mock KPI tiles (`cr`, `np`,
`ae`), the Cash Control page, the Profit Engine page, and future actual vs budget
variance analysis.

**Scope of this document:** Architecture and table design only.
No migrations, no frontend changes, no alterations to Phase 1 tables.

---

## Current Phase 1 state (reference)

| Table | Role |
|---|---|
| `stores` | Root tenant table |
| `store_settings` | Per-store thresholds — already has `runway_warn_months` |
| `store_cost_assumptions` | Variable cost RATES per order (payment fees, fulfilment, packaging, return handling) |
| `customers`, `orders`, `order_line_items`, `refunds`, `refund_line_items` | Shopify commerce facts |
| `discounts`, `discount_codes` | Discount tracking |
| `opportunities` | CFO-identified improvement opportunities |
| `cfo_alerts` | Persisted alert events |

**Key design constraint for Phase 2:** `store_cost_assumptions` stores variable cost
*rates* applied per order. Phase 2 overhead tables store fixed cost *absolute amounts*
per period. These are distinct concepts and must remain in separate tables.

---

## 1. Tables required

Five new tables in dependency order:

| # | Table | Purpose |
|---|---|---|
| 1 | `overhead_categories` | Taxonomy of fixed/overhead cost categories per store |
| 2 | `overhead_entries` | Monthly actual and budget overhead amounts per category |
| 3 | `cash_balance_snapshots` | Point-in-time cash balance snapshots per store |
| 4 | `working_capital_snapshots` | Point-in-time working capital metrics (WC, inventory, AP/AR days) |
| 5 | `budget_lines` | Monthly metric targets for actual vs budget variance analysis |

---

## 2. Key fields for each table

### `overhead_categories`

The "chart of accounts" for fixed overheads. One row per category per store.
Supports manual entry and Xero/QuickBooks nominal code mapping.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | |
| `store_id` | `uuid NOT NULL → stores(id)` | Multi-tenant key |
| `name` | `text NOT NULL` | e.g. `'Payroll'`, `'Rent & Facilities'`, `'Software & Tools'` |
| `category_type` | `text NOT NULL DEFAULT 'other'` | `'payroll' \| 'facilities' \| 'technology' \| 'marketing_fixed' \| 'logistics_fixed' \| 'finance' \| 'other'` |
| `is_fixed` | `boolean NOT NULL DEFAULT true` | `true` = fixed overhead; `false` = semi-variable (e.g. packaging beyond minimum) |
| `external_account_code` | `text` | Optional. Xero nominal code, QuickBooks account ID, or CSV column header. No vendor-specific prefix. |
| `sort_order` | `int NOT NULL DEFAULT 0` | Controls display order in dashboards |
| `is_active` | `boolean NOT NULL DEFAULT true` | Soft-delete. Inactive categories are hidden but entries are retained. |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Unique constraint:** `(store_id, name)`

**Design note:** `external_account_code` is vendor-neutral by name. The source integration
(`'xero'`, `'quickbooks'`, etc.) is recorded on `overhead_entries.source`, not here.

---

### `overhead_entries`

Monthly overhead amounts, one row per category per period per entry type.
Supports both budget and actual tracking in a single table.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | |
| `store_id` | `uuid NOT NULL → stores(id)` | Multi-tenant key |
| `category_id` | `uuid NOT NULL → overhead_categories(id)` | |
| `period_start` | `date NOT NULL` | First day of the period (e.g. `2026-04-01`) |
| `period_end` | `date NOT NULL` | Last day of the period (e.g. `2026-04-30`) |
| `amount` | `numeric(14,2) NOT NULL` | Overhead amount in store currency |
| `entry_type` | `text NOT NULL DEFAULT 'actual'` | `'actual' \| 'budget' \| 'forecast'` |
| `source` | `text NOT NULL DEFAULT 'manual'` | `'manual' \| 'xero' \| 'quickbooks' \| 'csv_import'` |
| `external_ref` | `text` | Xero journal line ID, QuickBooks expense ID, or CSV import batch ref. Null for manual entries. |
| `notes` | `text` | Free-text annotation |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Unique constraint:** `(store_id, category_id, period_start, entry_type)`
— One budget and one actual row per category per month. If a month needs multiple
actual entries (e.g. payroll split across two runs), sum before inserting or use
`ON CONFLICT DO UPDATE SET amount = excluded.amount`.

**Design note:** `entry_type` enables the same table to answer both
"what did we actually spend?" and "what did we budget?" without a join between
two separate tables. The UNIQUE constraint enforces one canonical row per
category/period/type.

---

### `cash_balance_snapshots`

Point-in-time cash balance per store. One row per date per account. Multiple accounts
(e.g. current account + Stripe reserve) are supported via `account_name`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | |
| `store_id` | `uuid NOT NULL → stores(id)` | Multi-tenant key |
| `snapshot_date` | `date NOT NULL` | End-of-day date the balance was captured |
| `cash_balance` | `numeric(14,2) NOT NULL` | Balance in store currency |
| `account_name` | `text NOT NULL DEFAULT 'main'` | e.g. `'main'`, `'stripe_reserve'`, `'savings'`. Allows multi-account aggregation. |
| `source` | `text NOT NULL DEFAULT 'manual'` | `'manual' \| 'xero' \| 'quickbooks' \| 'open_banking' \| 'csv_import'` |
| `external_ref` | `text` | Source system account or transaction ID |
| `notes` | `text` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Unique constraint:** `(store_id, snapshot_date, account_name)`

**Design note:** `cash_runway_months()` will aggregate all accounts for a store
(`SUM(cash_balance) WHERE store_id = ... AND snapshot_date = (latest date)`) to
get total available cash. The `account_name` field does not need normalisation at
Phase 2 — it is a display label, not a foreign key.

---

### `working_capital_snapshots`

Point-in-time working capital metrics. One row per store per date. Enables the
Cash Conversion Cycle display on the Cash Control page.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | |
| `store_id` | `uuid NOT NULL → stores(id)` | Multi-tenant key |
| `snapshot_date` | `date NOT NULL` | |
| `inventory_value` | `numeric(14,2)` | Inventory at cost. Null if not available. |
| `accounts_receivable` | `numeric(14,2)` | Outstanding AR. Typically zero for D2C Shopify. |
| `accounts_payable` | `numeric(14,2)` | Outstanding AP. From Xero AP ageing when available. |
| `inventory_days` | `numeric(8,2)` | Calculated or imported. `inventory_value / (annual_cogs / 365)` |
| `supplier_days` | `numeric(8,2)` | Average days to pay suppliers |
| `receivable_days` | `numeric(8,2)` | Average days to collect AR (typically ~0 for D2C) |
| `source` | `text NOT NULL DEFAULT 'manual'` | `'manual' \| 'xero' \| 'shopify' \| 'csv_import'` |
| `notes` | `text` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Unique constraint:** `(store_id, snapshot_date)`

**Design note:** The Cash Conversion Cycle (CCC) is not stored directly — it is
computed as `inventory_days - supplier_days + receivable_days` inside a view or
in the RPC. Storing it would create a derived-data consistency risk.

---

### `budget_lines`

Monthly metric targets. One row per metric per period. Enables the actual vs budget
variance view on the Cash Control and Profit Engine pages.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | |
| `store_id` | `uuid NOT NULL → stores(id)` | Multi-tenant key |
| `period_start` | `date NOT NULL` | First day of the period |
| `period_end` | `date NOT NULL` | Last day of the period |
| `metric_key` | `text NOT NULL` | Canonical metric name. See allowed values below. |
| `budgeted_value` | `numeric(14,2) NOT NULL` | Budget target in metric units (£ or ratio) |
| `notes` | `text` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Unique constraint:** `(store_id, period_start, metric_key)`

**Allowed `metric_key` values (Phase 2 scope):**

| Key | Unit | Description |
|---|---|---|
| `'monthly_revenue'` | £ | Gross revenue target |
| `'net_sales'` | £ | Net sales target (post discounts and refunds) |
| `'contribution_margin_pct'` | ratio [0,1] | e.g. `0.40` = 40% target |
| `'monthly_fixed_costs'` | £ | Total overhead spend target |
| `'operating_profit'` | £ | Net profit target |
| `'cash_balance'` | £ | Minimum cash balance target |

These keys align directly with the existing `METRIC.*` enum in `src/lib/metrics.ts`.
When new Phase 3 metrics are added to that enum, new `metric_key` values are introduced
by documenting them in this table comment — not by changing the table schema.

---

## 3. Foreign keys and unique constraints (summary)

| Table | FK relationships | Unique constraints |
|---|---|---|
| `overhead_categories` | `store_id → stores(id) CASCADE` | `(store_id, name)` |
| `overhead_entries` | `store_id → stores(id) CASCADE`; `category_id → overhead_categories(id) RESTRICT` | `(store_id, category_id, period_start, entry_type)` |
| `cash_balance_snapshots` | `store_id → stores(id) CASCADE` | `(store_id, snapshot_date, account_name)` |
| `working_capital_snapshots` | `store_id → stores(id) CASCADE` | `(store_id, snapshot_date)` |
| `budget_lines` | `store_id → stores(id) CASCADE` | `(store_id, period_start, metric_key)` |

**`overhead_categories → overhead_entries` FK uses `RESTRICT` (not CASCADE)**
because accidentally deleting a category that has entries would silently remove
historical cost data. The application must enforce "deactivate, don't delete" for
categories that have entries.

**All `stores` FKs use `ON DELETE CASCADE`** — consistent with all Phase 1 tenant tables.

---

## 4. Which dashboard tiles and pages each table enables

| Table | Tile / Page enabled |
|---|---|
| `overhead_entries` | `np` tile (Net Profit), `cr` tile (cash runway denominator), Cash Control (fixed cost breakdown), Profit Engine (P&L waterfall), Actual vs Budget variance page |
| `overhead_categories` | Cash Control (cost category breakdown), Profit Engine (category labels), Actual vs Budget variance page |
| `cash_balance_snapshots` | `cr` tile (Cash Runway = cash / monthly overhead), Cash Control (cash position card) |
| `working_capital_snapshots` | Cash Control (Cash Conversion Cycle, inventory days, supplier days), Scenario Lab (WC modelling) |
| `budget_lines` | Actual vs Budget variance page, Cash Control (budget vs actual cash), Profit Engine (variance waterfall) |

**Tiles that move from mock to Supabase-backed after Phase 2:**

| Tile ID | From | To |
|---|---|---|
| `cr` (Cash Runway) | `CASH_RUNWAY = 3.4` static constant | `cash_runway_months(store_id)` RPC |
| `np` (Net Profit) | `"£56,300"` hardcoded literal | `operating_profit_monthly(store_id, date_from, date_to)` RPC |

`ae` (Acquisition Efficiency) remains mock in Phase 2. It requires Meta Ads API
integration and is Phase 3 scope.

**Bonus — Phase 1 tile improvements enabled by Phase 2:**

All 8 Phase 1 tiles currently show static `change` strings (e.g. "↑ 12.4% vs last month").
These can become computed prior-period deltas in Phase 2 by calling the existing Phase 1
RPCs with the prior month's date range — **no new tables are needed**. This is a
frontend-only change using existing Phase 1 SQL functions.

---

## 5. SQL views required

### `v_current_cash_balance`

Returns the latest `cash_balance_snapshots` row per store (aggregated across all
accounts), used by `cash_runway_months()`.

```sql
CREATE OR REPLACE VIEW public.v_current_cash_balance AS
SELECT
  store_id,
  snapshot_date,
  SUM(cash_balance) AS total_cash_balance
FROM public.cash_balance_snapshots
WHERE snapshot_date = (
  SELECT MAX(s2.snapshot_date)
  FROM public.cash_balance_snapshots s2
  WHERE s2.store_id = cash_balance_snapshots.store_id
)
GROUP BY store_id, snapshot_date;
```

Alternatively (and more efficiently) as a `DISTINCT ON` correlated query in the
RPC function directly. Either approach is valid; the view is more reusable.

---

### `v_monthly_overhead_summary`

Returns overhead totals grouped by store, category type, month, and entry type.
Used by the Cash Control breakdown chart and the Profit Engine waterfall.

```sql
CREATE OR REPLACE VIEW public.v_monthly_overhead_summary AS
SELECT
  oe.store_id,
  oc.category_type,
  oc.name           AS category_name,
  oe.period_start,
  oe.period_end,
  oe.entry_type,
  SUM(oe.amount)    AS total_amount,
  COUNT(*)          AS entry_count
FROM public.overhead_entries oe
JOIN public.overhead_categories oc ON oc.id = oe.category_id
GROUP BY
  oe.store_id,
  oc.category_type,
  oc.name,
  oe.period_start,
  oe.period_end,
  oe.entry_type;
```

---

### `v_working_capital_current`

Returns the most recent working capital snapshot per store with the computed
Cash Conversion Cycle.

```sql
CREATE OR REPLACE VIEW public.v_working_capital_current AS
SELECT DISTINCT ON (store_id)
  store_id,
  snapshot_date,
  inventory_value,
  accounts_receivable,
  accounts_payable,
  inventory_days,
  supplier_days,
  receivable_days,
  COALESCE(inventory_days, 0)
    - COALESCE(supplier_days, 0)
    + COALESCE(receivable_days, 0)   AS cash_conversion_cycle,
  source
FROM public.working_capital_snapshots
ORDER BY store_id, snapshot_date DESC;
```

---

## 6. RPC functions required

All Phase 2 functions follow the same conventions as Phase 1:
`STABLE SECURITY DEFINER SET search_path = public, pg_temp`.

### `monthly_overhead_total(p_store_id, p_date_from, p_date_to, p_entry_type)`

Returns total overhead spend for the given store, period, and entry type.

```
Parameters:
  p_store_id   uuid
  p_date_from  date
  p_date_to    date
  p_entry_type text DEFAULT 'actual'

Returns: numeric   (£ total, 0 if no rows)

Formula:
  SUM(amount) FROM overhead_entries
  WHERE store_id = p_store_id
    AND period_start >= p_date_from
    AND period_end   <= p_date_to
    AND entry_type   = p_entry_type
    AND category_id IN (
      SELECT id FROM overhead_categories
      WHERE store_id = p_store_id AND is_active = true
    )
```

Powers: `np` tile denominator, Cash Control breakdown, Profit Engine waterfall.

---

### `cash_runway_months(p_store_id)`

Returns how many months of fixed costs the current cash balance covers.

```
Parameters:
  p_store_id uuid

Returns: numeric   (months, NULL if no cash snapshot exists)

Formula:
  total_cash    = SUM(cash_balance) FROM cash_balance_snapshots
                  WHERE store_id = p_store_id
                    AND snapshot_date = MAX(snapshot_date for this store)

  monthly_fixed = monthly_overhead_total(p_store_id,
                    date_trunc('month', CURRENT_DATE)::date,
                    (date_trunc('month', CURRENT_DATE)
                     + interval '1 month - 1 day')::date,
                    'actual')

  runway = total_cash / NULLIF(monthly_fixed, 0)

Returns NULL if no cash snapshot exists.
Returns NULL if monthly_fixed = 0 (division guard).
```

Powers: `cr` tile.

---

### `operating_profit_monthly(p_store_id, p_date_from, p_date_to)`

Returns net operating profit (contribution minus fixed overheads) for the period.

```
Parameters:
  p_store_id   uuid
  p_date_from  date
  p_date_to    date

Returns: numeric   (£ operating profit, or NULL if contribution is NULL)

Formula:
  cm_pct         = contribution_margin_pct(p_store_id, p_date_from, p_date_to)
  ns             = net_sales(p_store_id, p_date_from, p_date_to)
  fixed_costs    = monthly_overhead_total(p_store_id, p_date_from, p_date_to, 'actual')

  contribution_£ = ns * cm_pct
  operating_profit = contribution_£ - fixed_costs

Returns NULL when cm_pct is NULL (no cost assumptions configured).
Returns 0 - fixed_costs (negative number) when net_sales = 0.
```

Powers: `np` tile.

---

### `budget_variance_summary(p_store_id, p_date_from, p_date_to)` *(Phase 2b)*

Returns a comparison of budgeted vs actual values for each metric in the period.

```
Parameters:
  p_store_id   uuid
  p_date_from  date
  p_date_to    date

Returns: TABLE(
  metric_key        text,
  budgeted_value    numeric,
  actual_value      numeric,
  variance_abs      numeric,   -- actual - budgeted
  variance_pct      numeric    -- (actual - budgeted) / ABS(budgeted) * 100
)
```

This function reads from `budget_lines` for budgeted values and calls the
relevant Phase 1 and Phase 2 RPCs for actual values. It is the most complex
function in Phase 2 and should be implemented last.

---

## 7. Dummy seed data required

All seed data is for the Bloom & Co. dev store
(UUID `10000000-0000-0000-0000-000000000001`).

### `overhead_categories` — 6 rows

These must total `£120,000/month` to match the `MONTHLY_FIXED_COSTS` constant
in `cash-snapshot.ts`.

| Category name | `category_type` | Monthly amount |
|---|---|---|
| Payroll & Contractors | `payroll` | £80,000 |
| Rent & Facilities | `facilities` | £12,500 |
| Software & Tools | `technology` | £7,500 |
| Marketing Fixed | `marketing_fixed` | £10,000 |
| Finance & Legal | `finance` | £6,000 |
| Other Overheads | `other` | £4,000 |
| **Total** | | **£120,000** |

---

### `overhead_entries` — 18 rows (actuals) + 18 rows (budgets)

Seed 3 months of data (February, March, April 2026) for each of 6 categories,
in both `entry_type = 'actual'` and `entry_type = 'budget'`.

The actual amounts can vary slightly from budget to generate meaningful variance:

| Month | Total actual | Total budget | Variance |
|---|---|---|---|
| Feb 2026 | £117,400 | £120,000 | −£2,600 (under) |
| Mar 2026 | £122,800 | £120,000 | +£2,800 (over) |
| Apr 2026 | £119,200 | £120,000 | −£800 (near-budget) |

Variance is introduced at the category level (e.g. payroll slightly over in March,
marketing fixed slightly under in February). This makes the Actual vs Budget page
visually interesting from day one.

---

### `cash_balance_snapshots` — 3 rows (month-end snapshots)

| `snapshot_date` | `cash_balance` | `account_name` |
|---|---|---|
| 2026-02-28 | £172,000 | `main` |
| 2026-03-31 | £178,000 | `main` |
| 2026-04-30 | £186,000 | `main` |

The April 30 balance of `£186,000` matches the `CASH_BALANCE` constant in
`cash-snapshot.ts`. The declining pattern (Feb → Mar → Apr recovering) creates a
realistic trajectory for the Cash Control page.

---

### `working_capital_snapshots` — 1 row (current month)

| Column | Value | Source |
|---|---|---|
| `snapshot_date` | 2026-04-30 | |
| `inventory_value` | £486,000 | derived from inventory_days × implied daily COGS |
| `accounts_receivable` | £0 | D2C — no AR (paid at checkout) |
| `accounts_payable` | £127,000 | approx. 42 supplier days |
| `inventory_days` | 82 | matches `INVENTORY_DAYS` constant |
| `supplier_days` | 42 | matches `SUPPLIER_DAYS` constant |
| `receivable_days` | 0 | D2C default |
| `source` | `'manual'` | |

Cash Conversion Cycle = 82 − 42 + 0 = **40 days** (slightly lower than the
`CASH_CONVERSION_CYCLE = 47` constant, which may include a receivables buffer).

---

### `budget_lines` — 6 rows (April 2026 targets)

| `metric_key` | `budgeted_value` | Notes |
|---|---|---|
| `'monthly_revenue'` | 130,000.00 | Target gross revenue |
| `'net_sales'` | 108,000.00 | After discounts and refunds |
| `'contribution_margin_pct'` | 0.40 | 40% target |
| `'monthly_fixed_costs'` | 120,000.00 | Overhead budget |
| `'operating_profit'` | 12,000.00 | 108k × 0.40 − 120k (approx.) |
| `'cash_balance'` | 175,000.00 | Minimum cash floor |

---

## 8. Which metrics become Supabase-backed immediately after Phase 2

Once the five tables and seed data exist, the following can be live-wired with no
further infrastructure:

| Tile / Metric | RPC | What drives it |
|---|---|---|
| `cr` — Cash Runway | `cash_runway_months(store_id)` | `cash_balance_snapshots` + `overhead_entries` |
| `np` — Net Profit | `operating_profit_monthly(store_id, date_from, date_to)` | `contribution_margin_pct()` + `overhead_entries` |
| Cash Control — Fixed cost total | `monthly_overhead_total(store_id, date_from, date_to, 'actual')` | `overhead_entries` |
| Cash Control — Budget vs actual | `monthly_overhead_total(..., 'budget')` vs `'actual'` | `overhead_entries` (both entry types) |
| Cash Control — Cash Conversion Cycle | `v_working_capital_current` view | `working_capital_snapshots` |
| Profit Engine — P&L waterfall | Composite: `gross_revenue()`, `net_sales()`, `monthly_overhead_total()`, `operating_profit_monthly()` | Phase 1 + Phase 2 RPCs |
| Prior-period `change` strings on all 8 Phase 1 tiles | **No new tables needed** — existing Phase 1 RPCs called with prior-month date range | `orders` table (Phase 1) |

---

## 9. Which metrics still require real Xero (or equivalent) integration

These cannot be reliably computed from seeded dummy data alone and require a live
accounting integration before they are production-ready:

| Metric / Feature | Why it requires integration |
|---|---|
| Real-time cash balance auto-sync | `cash_balance_snapshots` seeded manually; Xero Cash account feed needed for daily/weekly auto-update |
| Actual overhead entries auto-populated | `overhead_entries` seeded manually; Xero nominal ledger export needed for automated import |
| Accounts Payable (working capital) | `working_capital_snapshots.accounts_payable` seeded manually; Xero AP ageing report needed for accuracy |
| Budget import from accounting system | `budget_lines` seeded manually; Xero Budgets API or CSV upload needed for merchant-specific targets |
| EBITDA vs accounting profit reconciliation | Requires depreciation, amortisation, and interest data from Xero P&L — not modelled in Phase 2 |
| Acquisition Efficiency / Meta CAC (`ae` tile) | Requires Meta Ads API spend ingestion and customer acquisition source attribution — Phase 3 |
| Shopify inventory value (automated) | `inventory_value` in `working_capital_snapshots` seeded manually; Shopify Inventory API + COGS from `product_variants.cost` needed for automation |

---

## 10. Recommended implementation order

### Phase 2a — Fixed costs and cash (unlocks `cr` and `np` tiles)

1. **Migration: `overhead_categories`** — no FK beyond `stores`, safe to add first
2. **Migration: `overhead_entries`** — FK to `overhead_categories`; add index on `(store_id, period_start, entry_type)`
3. **Migration: `cash_balance_snapshots`** — no FK beyond `stores`; add index on `(store_id, snapshot_date)`
4. **Seed migration** — insert Bloom & Co. rows into all three tables
5. **Views: `v_monthly_overhead_summary`, `v_current_cash_balance`**
6. **RPCs: `monthly_overhead_total()`, `cash_runway_months()`, `operating_profit_monthly()`**
7. **Frontend: wire `cr` and `np` tiles** — remove `CASH_RUNWAY` and `"£56,300"` constants

### Phase 2b — Working capital and budget variance

8. **Migration: `working_capital_snapshots`** — no FK beyond `stores`
9. **Migration: `budget_lines`** — no FK beyond `stores`
10. **Seed migration** — insert Bloom & Co. rows
11. **View: `v_working_capital_current`**
12. **RPC: `budget_variance_summary()`**
13. **Frontend: Cash Control CCC panel, Actual vs Budget page**

### Phase 2c — Prior-period deltas for Phase 1 tiles (no schema changes)

14. **Frontend only** — call Phase 1 RPCs with prior-month date range to generate `change` strings dynamically; remove all 11 static `change` string constants from `dashboard.tsx`

---

## 11. Naming risks and conflicts with Phase 1

### Risk 1 — `store_cost_assumptions` vs `overhead_*` confusion

**Issue:** Both tables deal with "costs". A developer unfamiliar with the schema might
add a fixed cost to `store_cost_assumptions` or a variable rate to `overhead_entries`.

**Mitigation:**
- Add table comments in the migration that explicitly state the difference:
  `store_cost_assumptions` = *variable* cost rates per order (ratios and per-order amounts)
  `overhead_categories` / `overhead_entries` = *fixed* overheads in absolute £ per period
- The field types make it structurally obvious: `store_cost_assumptions` stores
  `numeric(8,5)` rates; `overhead_entries` stores `numeric(14,2)` absolute amounts.

---

### Risk 2 — `store_settings` scope creep

**Issue:** `store_settings` already has `cm_target_pct`, `runway_warn_months`, and
`repeat_rate_target_pct`. Phase 2 may want additional alert thresholds
(e.g. `overhead_budget_variance_warn_pct`).

**Recommendation:** Add Phase 2 threshold columns to `store_settings` via `ALTER TABLE`
rather than creating a new settings table. `store_settings` is already the designated
home for per-store configuration. Keep it as a single wide table rather than
fragmenting settings across multiple tables.

**Phase 2 columns to add to `store_settings`:**
- `overhead_variance_warn_pct numeric(6,2)` — alert when actual overheads exceed budget by X%
- `min_cash_floor numeric(14,2)` — absolute minimum cash balance before alert fires
- `operating_profit_target_pct numeric(6,2)` — target operating profit as % of net sales

---

### Risk 3 — `budget_lines.metric_key` divergence from `METRIC.*` enum

**Issue:** `metric_key` is a free-text column. If new canonical metric names are added
to `src/lib/metrics.ts` without updating the allowed-values documentation in the
migration comment, the column becomes undocumented.

**Mitigation:** Add a `CHECK` constraint to the migration listing the Phase 2 allowed
values, and expand the `CHECK` constraint in a new migration when Phase 3 metrics
are added. This enforces the allowed set at the DB level.

```sql
CONSTRAINT chk_budget_lines_metric_key CHECK (
  metric_key IN (
    'monthly_revenue',
    'net_sales',
    'contribution_margin_pct',
    'monthly_fixed_costs',
    'operating_profit',
    'cash_balance'
  )
)
```

---

### Risk 4 — `overhead_entries` period range vs RPC date parameters

**Issue:** Phase 1 RPCs use `p_date_from` / `p_date_to` as `date` parameters.
`overhead_entries` uses `period_start` / `period_end`. A mismatch between a
calendar month's `period_end` (`2026-04-30`) and the RPC's `p_date_to` could
cause an entry to be missed.

**Mitigation:** The Phase 2 RPC `monthly_overhead_total()` must use
`period_start >= p_date_from AND period_end <= p_date_to` (period fully contained
within the query range), not a partial-overlap join. Document this in the migration
comment. Seed data must use exact calendar month bounds to avoid edge cases.

---

### Risk 5 — No conflict on table or column names

A full audit of Phase 1 table and column names confirms no collisions:

| Phase 2 name | Conflict? |
|---|---|
| `overhead_categories` | None |
| `overhead_entries` | None (`order_line_items` is different) |
| `cash_balance_snapshots` | None |
| `working_capital_snapshots` | None |
| `budget_lines` | None |
| Column `amount` on `overhead_entries` | Phase 1 `refunds.amount` exists — different table, no collision |
| Column `period_start` / `period_end` | Not used in Phase 1 — safe to introduce |
| Column `entry_type` | Not used in Phase 1 — safe to introduce |
| Column `source` | Not used in Phase 1 — safe to introduce |

---

## Appendix — Phase 1 vs Phase 2 cost architecture

```
VARIABLE COSTS (per order — Phase 1)          FIXED COSTS (per period — Phase 2)
─────────────────────────────────────         ──────────────────────────────────────
store_cost_assumptions                         overhead_categories
  payment_fee_rate      0.029                    Payroll & Contractors
  fulfilment_per_order  £3.50                    Rent & Facilities
  packaging_per_order   £1.25                    Software & Tools
  return_handling_rate  0.15                     Marketing Fixed
                                                 Finance & Legal
Used by:                                         Other Overheads
  contribution_margin_pct()            
  → powers cm tile (Phase 1, live)       overhead_entries
                                           amount   per category per month
                                           entry_type  'actual' | 'budget'

                                         Used by:
                                           monthly_overhead_total()
                                           → powers np tile (Phase 2)
                                           cash_runway_months()
                                           → powers cr tile (Phase 2)
```

---

*Last updated: 2026-04-30. This document is a design plan — no migrations should be
created from it until Phase 2 implementation begins. Update this file when
implementation decisions diverge from this design.*
