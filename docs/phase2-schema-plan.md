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

No dedicated indexes beyond the PK and UNIQUE constraint. The PK and unique on
`(store_id, name)` cover all expected access patterns at Phase 2 data volumes.

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
| `amount` | `numeric(14,2) NOT NULL` | Overhead amount in `currency_code` |
| `currency_code` | `text NOT NULL DEFAULT 'GBP'` | ISO 4217 currency for `amount`. Should match `stores.currency_code`. |
| `entry_type` | `text NOT NULL DEFAULT 'actual'` | `'actual' \| 'budget' \| 'forecast'` |
| `is_recurring` | `boolean NOT NULL DEFAULT true` | `true` = predictable, repeating monthly cost. `false` = exceptional or one-off (e.g. legal settlement, one-time equipment purchase). |
| `source` | `text NOT NULL DEFAULT 'manual'` | `'manual' \| 'xero' \| 'quickbooks' \| 'csv_import'` |
| `external_ref` | `text` | Xero journal line ID, QuickBooks expense ID, or CSV import batch ref. Null for manual entries. |
| `notes` | `text` | Free-text annotation |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Unique constraint:** `(store_id, category_id, period_start, entry_type, is_recurring)`
— Allows both a recurring and an exceptional one-off entry to coexist in the same
category, period, and entry type without overwriting each other. For example,
Finance & Legal can carry a £6,000 recurring retainer row (`is_recurring = true`)
and a £20,000 litigation settlement row (`is_recurring = false`) in the same month
as two separate actual entries. To update an existing row, use
`ON CONFLICT DO UPDATE SET amount = excluded.amount`.

**Recommended indexes:**

```sql
CREATE INDEX idx_overhead_entries_store_period_type
  ON overhead_entries (store_id, period_start, entry_type);

CREATE INDEX idx_overhead_entries_store_category_period
  ON overhead_entries (store_id, category_id, period_start);
```

The first index serves `monthly_overhead_total()` (which always filters by
`store_id`, `period_start`, and `entry_type`). The second serves category-level
breakdown queries on the Cash Control and Profit Engine pages.

**Design notes:**

- `entry_type` enables the same table to answer both "what did we actually spend?"
  and "what did we budget?" without a join between two separate tables. The UNIQUE
  constraint enforces one canonical row per category/period/type.
- `currency_code` is stored per-entry rather than derived from `stores.currency_code`
  to support future multi-currency stores (e.g. a UK store that pays a US SaaS
  subscription in USD) without a schema migration. Phase 2 seeds all entries as
  `'GBP'`.
- `is_recurring` allows the CFO alert engine to separate predictable fixed-cost
  baseline from exceptional one-off spend. When computing `cash_runway_months()`,
  the RPC can optionally filter to `is_recurring = true` to exclude atypical months
  from the denominator. Future alerting can also flag months where exceptional costs
  cause unusual variance relative to the `is_recurring` baseline.

---

### `cash_balance_snapshots`

Point-in-time cash balance per store. One row per date per account. Multiple accounts
(e.g. current account + Stripe reserve) are supported.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | |
| `store_id` | `uuid NOT NULL → stores(id)` | Multi-tenant key |
| `snapshot_date` | `date NOT NULL` | End-of-day date the balance was captured |
| `cash_balance` | `numeric(14,2) NOT NULL` | Balance in `currency_code` |
| `account_key` | `text NOT NULL DEFAULT 'main'` | Machine-stable identifier for the account. Used in the UNIQUE constraint and all query/RPC logic. Treat as a slug — it should not change after creation. Examples: `'main'`, `'stripe_reserve'`, `'savings'`. |
| `account_display_name` | `text NOT NULL DEFAULT 'Main Account'` | Human-readable label shown in the UI. Can be renamed freely without breaking logic. Examples: `'Main Business Account'`, `'Stripe Reserve'`, `'Tax Savings Pot'`. |
| `currency_code` | `text NOT NULL DEFAULT 'GBP'` | ISO 4217 currency for `cash_balance`. Enables future EUR/USD account balances without a migration. |
| `source` | `text NOT NULL DEFAULT 'manual'` | `'manual' \| 'xero' \| 'quickbooks' \| 'open_banking' \| 'csv_import'` |
| `external_ref` | `text` | Source system account or transaction ID |
| `notes` | `text` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Unique constraint:** `(store_id, snapshot_date, account_key)`

**Recommended index:**

```sql
CREATE INDEX idx_cash_balance_snapshots_store_date
  ON cash_balance_snapshots (store_id, snapshot_date DESC);
```

This index supports the `v_current_cash_balance` view and `cash_runway_months()`,
both of which fetch the latest snapshot date per store using `MAX(snapshot_date)`
or `DISTINCT ON (store_id) ORDER BY snapshot_date DESC`.

**Design notes:**

- **`account_key` vs `account_display_name`:** `account_key` is the stable
  machine-readable identifier used in UNIQUE constraints, RPC filters, and
  application logic. `account_display_name` is the presentation label. Separating
  them means a merchant can rename "Main Account" to "Lloyds Current Account" in
  the UI without breaking any data or query logic.
- `cash_runway_months()` aggregates `SUM(cash_balance)` across all `account_key`
  values for a store at the latest `snapshot_date`. All accounts are summed
  regardless of key — there is no account exclusion at Phase 2.
- **`currency_code`** is stored per row to support future scenarios where a store
  holds cash in multiple currencies (e.g. GBP operating account + USD reserve for
  supplier payments). Phase 2 seeds all accounts as `'GBP'`. Multi-currency
  aggregation in `cash_runway_months()` is deferred to Phase 3.

---

### `working_capital_snapshots`

Point-in-time working capital metrics. One row per store per date. Enables the
Cash Conversion Cycle display on the Cash Control page.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | |
| `store_id` | `uuid NOT NULL → stores(id)` | Multi-tenant key |
| `snapshot_date` | `date NOT NULL` | |
| `inventory_value` | `numeric(14,2)` | Inventory at cost in `currency_code`. Null if not available. |
| `accounts_receivable` | `numeric(14,2)` | Outstanding AR in `currency_code`. Typically zero for D2C Shopify. |
| `accounts_payable` | `numeric(14,2)` | Outstanding AP in `currency_code`. From Xero AP ageing when available. |
| `currency_code` | `text NOT NULL DEFAULT 'GBP'` | ISO 4217 currency for all monetary columns (`inventory_value`, `accounts_receivable`, `accounts_payable`). |
| `inventory_days` | `numeric(8,2)` | Calculated or imported. `inventory_value / (annual_cogs / 365)` |
| `supplier_days` | `numeric(8,2)` | Average days to pay suppliers |
| `receivable_days` | `numeric(8,2)` | Average days to collect AR (typically ~0 for D2C) |
| `source` | `text NOT NULL DEFAULT 'manual'` | `'manual' \| 'xero' \| 'shopify' \| 'csv_import'` |
| `notes` | `text` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Unique constraint:** `(store_id, snapshot_date)`

**Recommended index:**

```sql
CREATE INDEX idx_working_capital_snapshots_store_date
  ON working_capital_snapshots (store_id, snapshot_date DESC);
```

Supports `v_working_capital_current` (which uses `DISTINCT ON (store_id) ORDER BY
snapshot_date DESC`) and any range query over WC history on the Cash Control page.

**Design notes:**

- The Cash Conversion Cycle (CCC) is not stored directly — it is computed as
  `inventory_days - supplier_days + receivable_days` inside `v_working_capital_current`.
  Storing it would create a derived-data consistency risk.
- `currency_code` is stored per snapshot rather than derived from `stores.currency_code`
  to support future scenarios where inventory is valued in a different currency
  (e.g. stock purchased in USD, store currency GBP). Phase 2 seeds as `'GBP'`.

---

### `budget_lines`

Metric targets per period. One row per metric per scope per period. Enables the
actual vs budget variance view on the Cash Control and Profit Engine pages.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | |
| `store_id` | `uuid NOT NULL → stores(id)` | Multi-tenant key |
| `period_start` | `date NOT NULL` | First day of the period |
| `period_end` | `date NOT NULL` | Last day of the period |
| `metric_key` | `text NOT NULL` | Canonical metric name. See allowed values and CHECK constraint below. |
| `budgeted_value` | `numeric(14,2) NOT NULL` | Budget target in metric units (£ for monetary metrics; ratio [0,1] for percentage metrics) |
| `currency_code` | `text NOT NULL DEFAULT 'GBP'` | ISO 4217 currency for monetary `budgeted_value` fields. Ratio metrics (e.g. `contribution_margin_pct`) are currency-agnostic; the column is still required for schema consistency. |
| `period_granularity` | `text NOT NULL DEFAULT 'month'` | Granularity of the budget period. Phase 2 uses `'month'` only. `'week'`, `'quarter'`, `'year'` unlock without schema changes. |
| `metric_scope` | `text NOT NULL DEFAULT 'store'` | Dimension at which the budget applies. Phase 2 uses `'store'` only. Sub-store scopes will require a future `scope_ref text` column to identify which specific channel/campaign/SKU. |
| `notes` | `text` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Unique constraint:** `(store_id, period_start, metric_key, metric_scope)`

The scope is included in the UNIQUE constraint to allow separate budget rows for
the same metric at different scopes — e.g. a `'monthly_revenue'` budget at
`'store'` scope AND at `'channel'` scope for the same period. Phase 2 seeds
`'store'` scope only.

**Recommended index:**

```sql
CREATE INDEX idx_budget_lines_store_period_metric
  ON budget_lines (store_id, period_start, metric_key);
```

Supports `budget_variance_summary()` which always filters by `store_id` and
`period_start` and joins on `metric_key`.

**CHECK constraints:**

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
),
CONSTRAINT chk_budget_lines_period_granularity CHECK (
  period_granularity IN ('week', 'month', 'quarter', 'year')
),
CONSTRAINT chk_budget_lines_metric_scope CHECK (
  metric_scope IN ('store', 'channel', 'campaign', 'sku')
)
```

`metric_key` CHECK is expanded in a new migration whenever Phase 3 adds new
canonical metrics to the `METRIC.*` enum. `period_granularity` and `metric_scope`
CHECK constraints are fixed at Phase 2 — the allowed set is narrow and stable.

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

**Design notes:**

- **`period_granularity`:** Stored explicitly rather than inferred from
  `period_start/period_end` because inferred granularity is ambiguous at boundaries
  (e.g. a 7-day range could be a week or partial month). Having the field explicit
  also allows weekly and quarterly budget reporting to be enabled in the frontend
  without any schema change.
- **`metric_scope`:** Allows the same metric to carry multiple budget rows at
  different granularities — one store-level target and, in future, per-channel or
  per-SKU targets. Phase 2 inserts only `'store'` scope. When `'channel'`,
  `'campaign'`, or `'sku'` scopes are introduced in Phase 3, a `scope_ref text`
  column will be added to carry the specific identifier (e.g. a channel slug or
  SKU code).
- **`currency_code`:** Stored per budget line rather than derived from the store for
  the same reason as `overhead_entries` and `cash_balance_snapshots` — future
  multi-currency budgets (e.g. USD ad spend budget alongside GBP P&L budget) should
  not require a migration.

---

## 2a. Phase 2 column refinements — rationale

The following columns were added after the initial schema design to future-proof the
tables before any migrations are generated.

| Column | Tables | Reason |
|---|---|---|
| `currency_code` | `overhead_entries`, `cash_balance_snapshots`, `working_capital_snapshots`, `budget_lines` | Storing the currency at row level costs one column per table but avoids a migration when multi-currency support is needed. Phase 1 `stores.currency_code` is a store-level default; Phase 2 row-level `currency_code` allows individual entries (e.g. a USD SaaS subscription, EUR stock payable) to carry the correct currency without touching the store setting. All Phase 2 seed rows default to `'GBP'`. |
| `is_recurring` | `overhead_entries` | Distinguishes predictable monthly overheads from exceptional one-off costs. The `cash_runway_months()` RPC can optionally filter to `is_recurring = true` to avoid a single anomalous month (e.g. a large legal fee) inflating the fixed-cost denominator and producing an artificially short runway reading. Future CFO alerting can also generate "exceptional cost spike" alerts for `is_recurring = false` entries that exceed a threshold. |
| `period_granularity` | `budget_lines` | Phase 2 uses monthly budgets only, but weekly cadence budgets (useful for marketing spend) and quarterly targets (useful for P&L board reporting) are a natural next step. Storing the granularity explicitly prevents the alternative — inferring it from `period_start/period_end` date arithmetic — which is ambiguous and fragile at period boundaries. |
| `metric_scope` | `budget_lines` | Enables the same metric to carry a store-level budget AND, in future, sub-store budgets by channel, campaign, or SKU — all in the same table and within the same query. Without this field, adding channel-level budgeting later would require either a new table or a nullable `scope` column added via `ALTER TABLE`, both more disruptive than including it upfront. |
| `account_key` + `account_display_name` | `cash_balance_snapshots` | Separates stable machine logic from mutable UI labels. `account_key` is used in UNIQUE constraints, RPC filters, and any multi-account aggregation logic — it should never change. `account_display_name` is used only for presentation and can be renamed without touching any query logic. The original `account_name` served both roles simultaneously, which made it fragile: renaming "Main Account" to "Lloyds Business Current" would silently create a new row rather than updating the display label. |

---

## 3. Foreign keys and unique constraints (summary)

| Table | FK relationships | Unique constraints |
|---|---|---|
| `overhead_categories` | `store_id → stores(id) CASCADE` | `(store_id, name)` |
| `overhead_entries` | `store_id → stores(id) CASCADE`; `category_id → overhead_categories(id) RESTRICT` | `(store_id, category_id, period_start, entry_type, is_recurring)` |
| `cash_balance_snapshots` | `store_id → stores(id) CASCADE` | `(store_id, snapshot_date, account_key)` |
| `working_capital_snapshots` | `store_id → stores(id) CASCADE` | `(store_id, snapshot_date)` |
| `budget_lines` | `store_id → stores(id) CASCADE` | `(store_id, period_start, metric_key, metric_scope)` |

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

Returns the latest `cash_balance_snapshots` rows per store (aggregated across all
accounts at the most recent `snapshot_date`), used by `cash_runway_months()`.

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
  oe.is_recurring,
  SUM(oe.amount)    AS total_amount,
  COUNT(*)          AS entry_count
FROM public.overhead_entries oe
JOIN public.overhead_categories oc
  ON oc.id = oe.category_id
 AND oc.is_active = true
GROUP BY
  oe.store_id,
  oc.category_type,
  oc.name,
  oe.period_start,
  oe.period_end,
  oe.entry_type,
  oe.is_recurring;
```

Note: `is_recurring` is included in the GROUP BY so callers can distinguish the
recurring-cost total from exceptional-cost total without a second query.

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
  currency_code,
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
  p_store_id    uuid
  p_date_from   date
  p_date_to     date
  p_entry_type  text DEFAULT 'actual'

Returns: numeric   (£ total, 0 if no rows)

Formula:
  SUM(amount) FROM overhead_entries
  WHERE store_id    = p_store_id
    AND period_start >= p_date_from
    AND period_end   <= p_date_to
    AND entry_type   = p_entry_type
    AND category_id IN (
      SELECT id FROM overhead_categories
      WHERE store_id = p_store_id AND is_active = true
    )

Note: No filter on is_recurring at Phase 2 — the full actual total is used.
Future enhancement: add a p_recurring_only boolean parameter to allow
cash_runway_months() to exclude exceptional costs from the denominator.
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
                  WHERE store_id    = p_store_id
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
  metric_scope      text,
  period_granularity text,
  budgeted_value    numeric,
  actual_value      numeric,
  variance_abs      numeric,   -- actual - budgeted
  variance_pct      numeric    -- (actual - budgeted) / ABS(budgeted) * 100
)
```

This function reads from `budget_lines` for budgeted values and calls the
relevant Phase 1 and Phase 2 RPCs for actual values. `metric_scope` and
`period_granularity` are passed through from `budget_lines` to allow the caller
to filter the result set. It is the most complex function in Phase 2 and should
be implemented last.

**Date range join logic:** The same full-containment predicate used in
`monthly_overhead_total()` applies when selecting budget rows:

```sql
WHERE period_start >= p_date_from
  AND period_end   <= p_date_to
```

This ensures only budget rows whose entire period falls within the query window
are matched. Partial-period rows (e.g. a quarterly budget line queried with a
monthly date range) are excluded, which is the correct behaviour for a
like-for-like actual vs budget comparison.

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

### `overhead_entries` — 72 rows (actuals) + 72 rows (budgets)

Seed 12 months of data (January–December 2026) for each of 6 categories,
in both `entry_type = 'actual'` and `entry_type = 'budget'`
(6 categories × 12 months × 2 entry types = 144 rows total).

Seeding the full calendar year prevents `cash_runway_months()` from returning `NULL`
when `CURRENT_DATE` moves beyond a shorter seed window. The function computes
`monthly_fixed` by calling `monthly_overhead_total()` for `date_trunc('month', CURRENT_DATE)`.
Any month with no overhead rows returns 0, which triggers the division guard and
surfaces `NULL` on the `cr` tile. A full-year seed eliminates this risk for the
entire 2026 reporting period.

All seed rows: `currency_code = 'GBP'`, `is_recurring = true`, `source = 'manual'`.

Budget rows are uniform at £120,000 total per month across all 12 months. Actual
rows vary for the first four months to generate meaningful variance; the remainder
are seeded on-budget:

| Month | Total actual | Total budget | Variance |
|---|---|---|---|
| Jan 2026 | £118,600 | £120,000 | −£1,400 (under) |
| Feb 2026 | £117,400 | £120,000 | −£2,600 (under) |
| Mar 2026 | £122,800 | £120,000 | +£2,800 (over) |
| Apr 2026 | £119,200 | £120,000 | −£800 (near-budget) |
| May–Dec 2026 | £120,000 | £120,000 | £0 (on-budget) |

Variance is introduced at the category level for Jan–Apr (e.g. payroll slightly over
in March, marketing fixed slightly under in February). May–December are seeded
on-budget to keep the migration concise while preserving a realistic 4-month
variance history.

---

### `cash_balance_snapshots` — 3 rows (month-end snapshots)

| `snapshot_date` | `cash_balance` | `account_key` | `account_display_name` | `currency_code` |
|---|---|---|---|---|
| 2026-02-28 | £172,000 | `main` | `Main Business Account` | `GBP` |
| 2026-03-31 | £178,000 | `main` | `Main Business Account` | `GBP` |
| 2026-04-30 | £186,000 | `main` | `Main Business Account` | `GBP` |

The April 30 balance of `£186,000` matches the `CASH_BALANCE` constant in
`cash-snapshot.ts`. The rising trajectory (Feb → Mar → Apr) creates a realistic
progression for the Cash Control page.

---

### `working_capital_snapshots` — 1 row (current month)

| Column | Value | Notes |
|---|---|---|
| `snapshot_date` | 2026-04-30 | |
| `inventory_value` | £486,000 | Derived from `inventory_days × implied daily COGS` |
| `accounts_receivable` | £0 | D2C — no AR (paid at checkout) |
| `accounts_payable` | £127,000 | Approx. 42 supplier days |
| `currency_code` | `GBP` | |
| `inventory_days` | 82 | Matches `INVENTORY_DAYS` constant |
| `supplier_days` | 42 | Matches `SUPPLIER_DAYS` constant |
| `receivable_days` | 7 | Aligned with `CASH_CONVERSION_CYCLE = 47` code constant |
| `source` | `manual` | |

Cash Conversion Cycle = 82 − 42 + 7 = **47 days**, matching the existing
`CASH_CONVERSION_CYCLE = 47` constant in `cash-snapshot.ts`. Setting
`receivable_days = 7` rather than 0 ensures the Supabase-backed value is
consistent with the mock constant from the moment the tile is wired, preventing
an unexplained 7-day drop on the Cash Control page.

---

### `budget_lines` — 6 rows (April 2026 targets)

All seed rows: `period_granularity = 'month'`, `metric_scope = 'store'`,
`currency_code = 'GBP'`.

| `metric_key` | `budgeted_value` | Notes |
|---|---|---|
| `'monthly_revenue'` | 130,000.00 | Target gross revenue |
| `'net_sales'` | 108,000.00 | After discounts and refunds |
| `'contribution_margin_pct'` | 0.40 | 40% target (ratio, not %) |
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
| Multi-currency cash runway | `cash_runway_months()` sums all accounts without FX conversion; GBP-only at Phase 2 |

---

## 10. Recommended implementation order

### Phase 2a — Fixed costs and cash (unlocks `cr` and `np` tiles)

1. **Migration: `overhead_categories`** — no FK beyond `stores`
2. **Migration: `overhead_entries`** — FK to `overhead_categories`; create both indexes (`store_id, period_start, entry_type`) and (`store_id, category_id, period_start`)
3. **Migration: `cash_balance_snapshots`** — no FK beyond `stores`; create index on (`store_id, snapshot_date DESC`)
4. **Seed migration** — insert Bloom & Co. rows into all three tables with `currency_code = 'GBP'` and `is_recurring = true` on all `overhead_entries` rows
5. **Views: `v_monthly_overhead_summary`, `v_current_cash_balance`**
6. **RPCs: `monthly_overhead_total()`, `cash_runway_months()`, `operating_profit_monthly()`**
7. **Frontend: wire `cr` and `np` tiles** — remove `CASH_RUNWAY` and `"£56,300"` constants

### Phase 2b — Working capital and budget variance

8. **Migration: `working_capital_snapshots`** — no FK beyond `stores`; create index on (`store_id, snapshot_date DESC`)
9. **Migration: `budget_lines`** — no FK beyond `stores`; create index on (`store_id, period_start, metric_key`); seed `period_granularity = 'month'`, `metric_scope = 'store'`, `currency_code = 'GBP'`
10. **Seed migration** — insert Bloom & Co. rows
11. **View: `v_working_capital_current`**
12. **RPC: `budget_variance_summary()`**
13. **Frontend: Cash Control CCC panel, Actual vs Budget page**

### Phase 2c — Prior-period deltas for Phase 1 tiles (no schema changes)

14. **Frontend only** — call Phase 1 RPCs with prior-month date range to generate `change` strings dynamically; remove all static `change` string constants from `dashboard.tsx`

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
home for per-store configuration.

**Phase 2 columns to add to `store_settings`:**
- `overhead_variance_warn_pct numeric(6,2)` — alert when actual overheads exceed budget by X%
- `min_cash_floor numeric(14,2)` — absolute minimum cash balance before alert fires
- `operating_profit_target_pct numeric(6,2)` — target operating profit as % of net sales

---

### Risk 3 — `budget_lines.metric_key` divergence from `METRIC.*` enum

**Issue:** `metric_key` is a text column. If new canonical metric names are added
to `src/lib/metrics.ts` without updating the `CHECK` constraint, the constraint
silently rejects the new value.

**Mitigation:** The `CHECK` constraint is the canonical gate. When a Phase 3 metric
is added, a new migration must extend the constraint. Document this requirement in
the migration comment.

---

### Risk 4 — `budget_lines.metric_scope = 'channel' | 'campaign' | 'sku'` requires `scope_ref`

**Issue:** The CHECK constraint allows `'channel'`, `'campaign'`, and `'sku'` scope
values but there is no `scope_ref` column to identify *which* channel/campaign/SKU.
Without `scope_ref`, two rows with `metric_key = 'monthly_revenue'` and
`metric_scope = 'channel'` for the same period would violate the UNIQUE constraint.

**Mitigation:** Phase 2 seeds `'store'` scope only. The `CHECK` constraint allows
future values from day one, but the UNIQUE constraint `(store_id, period_start,
metric_key, metric_scope)` means only one `'channel'` row per metric per period is
permitted until `scope_ref` is added in Phase 3. Document this explicitly in the
migration comment.

---

### Risk 5 — `overhead_entries` period range vs RPC date parameters

**Issue:** Phase 1 RPCs use `p_date_from` / `p_date_to` as `date` parameters.
`overhead_entries` uses `period_start` / `period_end`. A mismatch between a
calendar month's `period_end` (`2026-04-30`) and the RPC's `p_date_to` could
cause an entry to be missed.

**Mitigation:** The Phase 2 RPC `monthly_overhead_total()` must use
`period_start >= p_date_from AND period_end <= p_date_to` (period fully contained
within the query range). Seed data must use exact calendar month bounds.

---

### Risk 6 — No collision on new table or column names

A full audit of Phase 1 table and column names confirms no collisions:

| Phase 2 name | Conflict? |
|---|---|
| `overhead_categories` | None |
| `overhead_entries` | None (`order_line_items` is different) |
| `cash_balance_snapshots` | None |
| `working_capital_snapshots` | None |
| `budget_lines` | None |
| `currency_code` (new column) | Phase 1 `stores.currency_code` exists — same concept, no collision |
| `is_recurring` | Not used in Phase 1 — safe to introduce |
| `account_key` | Not used in Phase 1 — safe to introduce |
| `account_display_name` | Not used in Phase 1 — safe to introduce |
| `period_granularity` | Not used in Phase 1 — safe to introduce |
| `metric_scope` | Not used in Phase 1 — safe to introduce |
| `period_start` / `period_end` | Not used in Phase 1 — safe to introduce |
| `entry_type` | Not used in Phase 1 — safe to introduce |

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
                                           amount         per category per month
                                           currency_code  ISO 4217 (default GBP)
                                           entry_type     'actual' | 'budget'
                                           is_recurring   true | false

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
