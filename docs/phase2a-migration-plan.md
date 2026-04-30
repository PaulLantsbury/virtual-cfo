# Phase 2a Migration Plan — Fixed Costs, Cash & Core RPCs

## Scope

Phase 2a creates the three tables needed to power the `cr` (Cash Runway) and
`np` (Net Profit) tiles, seeds 12 months of Bloom & Co. data, and adds the views
and RPC functions that wire those tiles.

**In scope:**
- `overhead_categories` table
- `overhead_entries` table
- `cash_balance_snapshots` table
- `v_monthly_overhead_summary` view
- `v_current_cash_balance` view
- `monthly_overhead_total()` RPC
- `cash_runway_months()` RPC
- `operating_profit_monthly()` RPC
- Bloom & Co. seed data for all three tables

**Explicitly out of scope for this phase:**
- `working_capital_snapshots` (Phase 2b)
- `budget_lines` (Phase 2b)
- `budget_variance_summary()` RPC (Phase 2b)
- `v_working_capital_current` view (Phase 2b)
- Any marketing or acquisition tables
- Frontend wiring of `cr` and `np` tiles (documented below but not implemented)

---

## Source of truth

`docs/phase2-schema-plan.md` — all design decisions, rationale, and naming risks
are captured there. This document translates that plan into an exact migration
specification ready for SQL authoring.

---

## Migration files

Six files in creation order. All files go in `supabase/migrations/`.
Timestamps use `20260430` (April 30 2026) to follow on from the last Phase 1
migration (`20260429000005_recoverable_contribution_range.sql`).

| File | Contents |
|---|---|
| `20260430000000_overhead_categories.sql` | Table, constraint, index, comments |
| `20260430000001_overhead_entries.sql` | Table, constraints, indexes, comments |
| `20260430000002_cash_balance_snapshots.sql` | Table, constraint, index, comments |
| `20260430000003_phase2a_seed.sql` | Bloom & Co. seed rows for all three tables |
| `20260430000004_phase2a_views.sql` | `v_monthly_overhead_summary`, `v_current_cash_balance` |
| `20260430000005_phase2a_rpcs.sql` | `monthly_overhead_total`, `cash_runway_months`, `operating_profit_monthly` |

The table migrations must precede the seed migration. The seed migration must
precede the views and RPCs (views reference categories via join; RPCs call
`monthly_overhead_total` which is defined in the same RPCs file).

---

## File 1 — `overhead_categories`

### Purpose

Taxonomy of fixed/overhead cost categories per store. One row per category per
store. The "chart of accounts" for fixed overheads — vendor-neutral, supports
manual entry, Xero, QuickBooks, and CSV import via `external_account_code`.

### Full column specification

| Column | SQL type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` | |
| `store_id` | `uuid` | `NOT NULL` | — | FK → `stores(id) ON DELETE CASCADE` |
| `name` | `text` | `NOT NULL` | — | e.g. `'Payroll & Contractors'` |
| `category_type` | `text` | `NOT NULL`, CHECK | `'other'` | Allowed values below |
| `is_fixed` | `boolean` | `NOT NULL` | `true` | `true` = fixed; `false` = semi-variable |
| `external_account_code` | `text` | nullable | — | Xero nominal code, QB account ID, CSV header |
| `sort_order` | `int` | `NOT NULL` | `0` | Controls display ordering |
| `is_active` | `boolean` | `NOT NULL` | `true` | Soft-delete; inactive hidden but entries retained |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` | |

### Primary key

`id uuid PRIMARY KEY DEFAULT gen_random_uuid()`

### Foreign keys

`store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE`

### Unique constraints

`CONSTRAINT uq_overhead_categories_store_name UNIQUE (store_id, name)`

### CHECK constraints

```sql
CONSTRAINT chk_overhead_categories_type CHECK (
  category_type IN (
    'payroll',
    'facilities',
    'technology',
    'marketing_fixed',
    'logistics_fixed',
    'finance',
    'other'
  )
)
```

### Indexes

No additional indexes beyond the PK and UNIQUE constraint. The PK on `id` and
UNIQUE on `(store_id, name)` cover all expected Phase 2 access patterns.

### Table and column comments

Comments must be included in the migration. The table comment should reference the
`store_cost_assumptions` distinction (variable rates vs fixed amounts). The
`external_account_code` comment must note it is vendor-neutral.

---

## File 2 — `overhead_entries`

### Purpose

Monthly overhead amounts per category, period, and entry type. A single table
handles both budget and actual tracking via `entry_type`. The UNIQUE constraint
includes `is_recurring` so both a recurring and an exceptional one-off entry can
coexist for the same category and period without conflict.

### Full column specification

| Column | SQL type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` | |
| `store_id` | `uuid` | `NOT NULL` | — | FK → `stores(id) ON DELETE CASCADE` |
| `category_id` | `uuid` | `NOT NULL` | — | FK → `overhead_categories(id) ON DELETE RESTRICT` |
| `period_start` | `date` | `NOT NULL` | — | First day of period e.g. `2026-04-01` |
| `period_end` | `date` | `NOT NULL` | — | Last day of period e.g. `2026-04-30` |
| `amount` | `numeric(14,2)` | `NOT NULL` | — | Overhead amount in `currency_code` |
| `currency_code` | `text` | `NOT NULL` | `'GBP'` | ISO 4217; row-level for multi-currency |
| `entry_type` | `text` | `NOT NULL`, CHECK | `'actual'` | `'actual' \| 'budget' \| 'forecast'` |
| `is_recurring` | `boolean` | `NOT NULL` | `true` | `true` = repeating; `false` = one-off/exceptional |
| `source` | `text` | `NOT NULL`, CHECK | `'manual'` | `'manual' \| 'xero' \| 'quickbooks' \| 'csv_import'` |
| `external_ref` | `text` | nullable | — | Source system line ID or import batch ref |
| `notes` | `text` | nullable | — | Free-text annotation |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` | |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` | |

### Primary key

`id uuid PRIMARY KEY DEFAULT gen_random_uuid()`

### Foreign keys

```sql
store_id    uuid NOT NULL REFERENCES stores(id)               ON DELETE CASCADE,
category_id uuid NOT NULL REFERENCES overhead_categories(id)  ON DELETE RESTRICT
```

`RESTRICT` on `overhead_categories` prevents silent data loss: deleting a
category that has historical entries must fail. The application enforces
"deactivate, don't delete" for categories with entries.

### Unique constraints

```sql
CONSTRAINT uq_overhead_entries_store_cat_period_type_recurring
  UNIQUE (store_id, category_id, period_start, entry_type, is_recurring)
```

`is_recurring` is included in the key so that a recurring entry and an exceptional
one-off for the same category, period, and entry type can coexist as separate rows.
To update an existing row, use `ON CONFLICT (...) DO UPDATE SET amount = excluded.amount`.

### CHECK constraints

```sql
CONSTRAINT chk_overhead_entries_entry_type CHECK (
  entry_type IN ('actual', 'budget', 'forecast')
),
CONSTRAINT chk_overhead_entries_source CHECK (
  source IN ('manual', 'xero', 'quickbooks', 'csv_import')
)
```

### Indexes

```sql
CREATE INDEX idx_overhead_entries_store_period_type
  ON overhead_entries (store_id, period_start, entry_type);

CREATE INDEX idx_overhead_entries_store_category_period
  ON overhead_entries (store_id, category_id, period_start);
```

`(store_id, period_start, entry_type)` is the primary access index for
`monthly_overhead_total()`, which always filters on those three columns.
`(store_id, category_id, period_start)` serves category-level breakdown queries
on the Cash Control and Profit Engine pages.

---

## File 3 — `cash_balance_snapshots`

### Purpose

Point-in-time cash balance per store account. Multiple accounts per store are
supported via `account_key`. `cash_runway_months()` aggregates all accounts at
the latest `snapshot_date`.

### Full column specification

| Column | SQL type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` | |
| `store_id` | `uuid` | `NOT NULL` | — | FK → `stores(id) ON DELETE CASCADE` |
| `snapshot_date` | `date` | `NOT NULL` | — | End-of-day date balance was captured |
| `cash_balance` | `numeric(14,2)` | `NOT NULL` | — | Balance in `currency_code` |
| `account_key` | `text` | `NOT NULL` | `'main'` | Machine-stable slug used in UNIQUE and logic |
| `account_display_name` | `text` | `NOT NULL` | `'Main Account'` | Mutable UI label only |
| `currency_code` | `text` | `NOT NULL` | `'GBP'` | ISO 4217; row-level for multi-currency |
| `source` | `text` | `NOT NULL`, CHECK | `'manual'` | `'manual' \| 'xero' \| 'quickbooks' \| 'open_banking' \| 'csv_import'` |
| `external_ref` | `text` | nullable | — | Source system account or transaction ID |
| `notes` | `text` | nullable | — | |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` | |

### Primary key

`id uuid PRIMARY KEY DEFAULT gen_random_uuid()`

### Foreign keys

`store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE`

### Unique constraints

```sql
CONSTRAINT uq_cash_balance_snapshots_store_date_account
  UNIQUE (store_id, snapshot_date, account_key)
```

`account_key` (not `account_display_name`) is in the UNIQUE constraint. This
means a merchant can rename "Main Account" to "Lloyds Business Current" without
creating a new row or breaking the constraint.

### CHECK constraints

```sql
CONSTRAINT chk_cash_balance_snapshots_source CHECK (
  source IN ('manual', 'xero', 'quickbooks', 'open_banking', 'csv_import')
)
```

### Indexes

```sql
CREATE INDEX idx_cash_balance_snapshots_store_date
  ON cash_balance_snapshots (store_id, snapshot_date DESC);
```

Descending on `snapshot_date` optimises the `MAX(snapshot_date)` correlated
subquery in `v_current_cash_balance` and the `DISTINCT ON` pattern if the view
is rewritten in future.

---

## File 4 — `phase2a_seed`

### Dev store

UUID: `10000000-0000-0000-0000-000000000001` (Bloom & Co.)

All INSERTs must use `ON CONFLICT DO NOTHING` to be idempotent. The UUIDs for
`overhead_categories` rows must be hard-coded stable values so that the
`overhead_entries` seed can reference them by ID in the same migration.

### `overhead_categories` — 6 rows

| `id` (stable UUID) | `name` | `category_type` | `is_fixed` | `sort_order` |
|---|---|---|---|---|
| `20000000-0000-0000-0000-000000000001` | `Payroll & Contractors` | `payroll` | `true` | `1` |
| `20000000-0000-0000-0000-000000000002` | `Rent & Facilities` | `facilities` | `true` | `2` |
| `20000000-0000-0000-0000-000000000003` | `Software & Tools` | `technology` | `true` | `3` |
| `20000000-0000-0000-0000-000000000004` | `Marketing Fixed` | `marketing_fixed` | `true` | `4` |
| `20000000-0000-0000-0000-000000000005` | `Finance & Legal` | `finance` | `true` | `5` |
| `20000000-0000-0000-0000-000000000006` | `Other Overheads` | `other` | `true` | `6` |

All rows: `store_id = '10000000-0000-0000-0000-000000000001'`, `is_active = true`,
`external_account_code = NULL`.

**UUID format rationale:** Using the `20000000-...` prefix keeps dev seed UUIDs
visually distinct from store UUIDs (`10000000-...`) and random production UUIDs.
Hard-coding these values is required so `overhead_entries` rows can reference them
as `category_id` within the same seed migration, without a subquery per row.

### `overhead_entries` — 144 rows

**All rows share:** `store_id = '10000000-0000-0000-0000-000000000001'`,
`currency_code = 'GBP'`, `is_recurring = true`, `source = 'manual'`,
`external_ref = NULL`.

#### Budget rows (72 rows — all 6 categories × 12 months, uniform)

Budget amounts are identical every month. `entry_type = 'budget'`.

| `category_id` | Monthly budget amount |
|---|---|
| `20000000-...-0001` (Payroll) | £80,000.00 |
| `20000000-...-0002` (Rent) | £12,500.00 |
| `20000000-...-0003` (Software) | £7,500.00 |
| `20000000-...-0004` (Marketing Fixed) | £10,000.00 |
| `20000000-...-0005` (Finance & Legal) | £6,000.00 |
| `20000000-...-0006` (Other Overheads) | £4,000.00 |
| **Total per month** | **£120,000.00** |

Periods: `period_start = YYYY-MM-01`, `period_end = last day of month` for each
of January–December 2026.

#### Actual rows (72 rows — `entry_type = 'actual'`)

Jan–Apr 2026 carry variance; May–Dec 2026 are on-budget (same as budget amounts).

**January 2026 actuals — total £118,600.00 (−£1,400 vs budget)**

| Category | Amount | vs budget |
|---|---|---|
| Payroll & Contractors | £79,500.00 | −£500 |
| Rent & Facilities | £12,500.00 | £0 |
| Software & Tools | £7,000.00 | −£500 |
| Marketing Fixed | £9,800.00 | −£200 |
| Finance & Legal | £6,000.00 | £0 |
| Other Overheads | £3,800.00 | −£200 |

**February 2026 actuals — total £117,400.00 (−£2,600 vs budget)**

| Category | Amount | vs budget |
|---|---|---|
| Payroll & Contractors | £79,000.00 | −£1,000 |
| Rent & Facilities | £12,500.00 | £0 |
| Software & Tools | £7,200.00 | +£200 |
| Marketing Fixed | £8,500.00 | −£1,500 |
| Finance & Legal | £6,000.00 | £0 |
| Other Overheads | £4,200.00 | +£200 |

**March 2026 actuals — total £122,800.00 (+£2,800 vs budget)**

| Category | Amount | vs budget |
|---|---|---|
| Payroll & Contractors | £82,000.00 | +£2,000 |
| Rent & Facilities | £12,500.00 | £0 |
| Software & Tools | £7,500.00 | £0 |
| Marketing Fixed | £11,200.00 | +£1,200 |
| Finance & Legal | £5,800.00 | −£200 |
| Other Overheads | £3,800.00 | −£200 |

**April 2026 actuals — total £119,200.00 (−£800 vs budget)**

| Category | Amount | vs budget |
|---|---|---|
| Payroll & Contractors | £80,000.00 | £0 |
| Rent & Facilities | £12,500.00 | £0 |
| Software & Tools | £7,100.00 | −£400 |
| Marketing Fixed | £9,800.00 | −£200 |
| Finance & Legal | £6,000.00 | £0 |
| Other Overheads | £3,800.00 | −£200 |

**May–December 2026 actuals:** Each category's actual equals its budget amount.
The migration can use the budget amounts directly (copy-paste of the budget block
with `entry_type = 'actual'`). All totals = £120,000.00.

#### Period boundary convention

All period boundaries use exact calendar month bounds:
```
period_start = YYYY-MM-01
period_end   = last calendar day of the month
```

Exact last-day values:
`2026-01-31`, `2026-02-28`, `2026-03-31`, `2026-04-30`, `2026-05-31`,
`2026-06-30`, `2026-07-31`, `2026-08-31`, `2026-09-30`, `2026-10-31`,
`2026-11-30`, `2026-12-31`

These must be hard-coded in the seed, not computed dynamically, to avoid any
timezone or date-arithmetic edge case in the migration runner.

### `cash_balance_snapshots` — 3 rows

| `snapshot_date` | `cash_balance` | `account_key` | `account_display_name` | `currency_code` |
|---|---|---|---|---|
| `2026-02-28` | `172000.00` | `main` | `Main Business Account` | `GBP` |
| `2026-03-31` | `178000.00` | `main` | `Main Business Account` | `GBP` |
| `2026-04-30` | `186000.00` | `main` | `Main Business Account` | `GBP` |

All rows: `store_id = '10000000-0000-0000-0000-000000000001'`, `source = 'manual'`,
`external_ref = NULL`.

The April 30 balance of `£186,000` matches the `CASH_BALANCE` constant in
`cash-snapshot.ts`.

---

## File 5 — Views

### `v_current_cash_balance`

Returns the total cash balance per store at the most recent `snapshot_date`,
summed across all accounts. Used by `cash_runway_months()`.

```sql
CREATE OR REPLACE VIEW public.v_current_cash_balance AS
SELECT
  store_id,
  snapshot_date,
  SUM(cash_balance) AS total_cash_balance
FROM public.cash_balance_snapshots
WHERE snapshot_date = (
  SELECT MAX(s2.snapshot_date)
  FROM   public.cash_balance_snapshots s2
  WHERE  s2.store_id = cash_balance_snapshots.store_id
)
GROUP BY store_id, snapshot_date;
```

**Note on the correlated subquery:** This form is safe at Phase 2 data volumes
(one store, 3 snapshots). If the snapshot table grows to thousands of rows per
store in production, the view should be rewritten using `DISTINCT ON (store_id)
ORDER BY store_id, snapshot_date DESC` with the `idx_cash_balance_snapshots_store_date`
index. The interface (`store_id`, `snapshot_date`, `total_cash_balance`) is
identical either way — the rewrite does not affect callers.

---

### `v_monthly_overhead_summary`

Returns overhead totals grouped by store, category, period, entry type, and
recurring flag. Used by the Cash Control breakdown chart and the Profit Engine
waterfall. Filters out inactive categories via the JOIN condition.

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
FROM  public.overhead_entries    oe
JOIN  public.overhead_categories oc
  ON  oc.id        = oe.category_id
 AND  oc.is_active = true
GROUP BY
  oe.store_id,
  oc.category_type,
  oc.name,
  oe.period_start,
  oe.period_end,
  oe.entry_type,
  oe.is_recurring;
```

**`is_recurring` in GROUP BY:** Callers can distinguish the recurring-cost total
from exceptional one-offs within the same category and period without a second
query. This is consistent with how `monthly_overhead_total()` will expose a future
`p_recurring_only` filter parameter.

**Inactive category filter:** `AND oc.is_active = true` in the JOIN ensures the
view matches `monthly_overhead_total()` exactly. Both return only entries for
active categories; a soft-deleted category is excluded from totals in both.

---

## File 6 — RPC functions

All three functions use: `LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp`.

`STABLE` is appropriate because all three functions do not modify the database and
return the same result for the same inputs within a transaction.

`SECURITY DEFINER` allows the anon/service-role key to call these functions
without needing direct table access — consistent with all Phase 1 RPCs.

---

### `monthly_overhead_total`

```
Signature:
  monthly_overhead_total(
    p_store_id   uuid,
    p_date_from  date,
    p_date_to    date,
    p_entry_type text DEFAULT 'actual'
  )
  RETURNS numeric

Formula:
  COALESCE(SUM(oe.amount), 0)
  FROM  overhead_entries    oe
  JOIN  overhead_categories oc ON oc.id = oe.category_id
                               AND oc.is_active = true
  WHERE oe.store_id     = p_store_id
    AND oe.period_start >= p_date_from
    AND oe.period_end   <= p_date_to
    AND oe.entry_type   = p_entry_type

Returns: numeric (0 if no qualifying rows — never NULL)
```

**Period containment:** `period_start >= p_date_from AND period_end <= p_date_to`
(full containment, not partial overlap). This matches the `budget_variance_summary()`
logic and ensures only entries whose entire period falls within the query window
are included. Callers must pass exact calendar month bounds.

**No `is_recurring` filter at Phase 2:** The function sums all entries regardless
of `is_recurring`. A future `p_recurring_only boolean DEFAULT false` parameter
will be added when CFO alerting needs a clean recurring-costs baseline.

**`COALESCE(..., 0)`:** Returns 0, not NULL, when no rows match. This prevents
`cash_runway_months()` from propagating unexpected NULLs through arithmetic.

---

### `cash_runway_months`

```
Signature:
  cash_runway_months(
    p_store_id uuid
  )
  RETURNS numeric

Formula:
  Step 1 — total_cash:
    SELECT SUM(cash_balance)
    FROM   cash_balance_snapshots
    WHERE  store_id      = p_store_id
      AND  snapshot_date = (
             SELECT MAX(snapshot_date)
             FROM   cash_balance_snapshots
             WHERE  store_id = p_store_id
           )

  Step 2 — monthly_fixed:
    monthly_overhead_total(
      p_store_id,
      date_trunc('month', CURRENT_DATE)::date,
      (date_trunc('month', CURRENT_DATE) + interval '1 month')::date - 1,
      'actual'
    )

  Step 3 — runway:
    total_cash / NULLIF(monthly_fixed, 0)

Returns:
  numeric  — runway in months
  NULL     — if no cash snapshot exists for the store
  NULL     — if monthly_fixed = 0 (NULLIF division guard)
```

**Date arithmetic note:** `(date_trunc('month', CURRENT_DATE) + interval '1 month')::date - 1`
is the standard PostgreSQL idiom for the last day of the current month. The
alternative `+ interval '1 month - 1 day'` is not valid PostgreSQL syntax and
must not be used.

**Current-month dependency:** The function always uses `CURRENT_DATE` as the
denominator period. If the current month has no `overhead_entries` rows,
`monthly_overhead_total()` returns 0, the `NULLIF` guard fires, and the function
returns `NULL`. The 12-month seed (Jan–Dec 2026) prevents this for all 2026
calendar months. After December 2026, new entries will need to be seeded or
imported before the function returns a non-NULL value.

**Expected value after Phase 2a wiring:**
The Supabase-computed runway will be approximately **1.55 months**
(`£186,000 / £119,200–£120,000 ≈ 1.55`).

The current `CASH_RUNWAY = 3.4` constant in `cash-snapshot.ts` is illustrative
mock data. It will be replaced by the live RPC value when the `cr` tile is wired.
**The visible tile value will move from 3.4 months to approximately 1.55 months
at that point.** This is the mathematically correct result:

- `£186,000` April cash balance is already aligned to the existing `CASH_BALANCE`
  constant in `cash-snapshot.ts`.
- `£120,000/month` overhead is already aligned to the existing
  `MONTHLY_FIXED_COSTS` constant.
- `1.55 months` is therefore the correct runway at current cash and overhead levels.

The seed cash balance will not be inflated to reverse-engineer the old mock value.

---

### `operating_profit_monthly`

```
Signature:
  operating_profit_monthly(
    p_store_id   uuid,
    p_date_from  date,
    p_date_to    date
  )
  RETURNS numeric

Dependencies on existing Phase 1 functions:
  contribution_margin_pct(uuid, date, date)  — returns ratio [0,1] or NULL
  net_sales(uuid, date, date)                — returns numeric

Formula:
  v_cm_pct       := contribution_margin_pct(p_store_id, p_date_from, p_date_to)
  v_net_sales    := net_sales(p_store_id, p_date_from, p_date_to)
  v_fixed_costs  := monthly_overhead_total(p_store_id, p_date_from, p_date_to, 'actual')

  RETURN (v_net_sales * v_cm_pct) - v_fixed_costs

Returns:
  numeric  — operating profit in store currency (may be negative)
  NULL     — if v_cm_pct is NULL (store has no cost assumptions configured)
```

**NULL propagation:** If `contribution_margin_pct()` returns NULL (no
`store_cost_assumptions` row for the store), the entire expression is NULL. The
`cr` tile guard must handle NULL gracefully. The Bloom & Co. dev store has cost
assumptions seeded (migration `20260429000003`) so this path is not triggered for
dev data.

**Negative result:** If `v_fixed_costs > v_net_sales * v_cm_pct`, the function
returns a negative number. This is correct — a loss-making month should show a
negative operating profit. The frontend tile must handle negative values (e.g. `−£4,200`).

**⚠️ Expected value on Phase 1 seed data:** The Phase 1 dev data is a small test
dataset (`net_sales ≈ £700`, not a realistic `£124,500`). The computed operating
profit on Phase 1 seed data will therefore be deeply negative
(`£700 × 0.81 − £119,200 ≈ −£118,633`). This is expected — Phase 1 Shopify seed
data was sized for RPC validation, not for realistic P&L presentation. Before
wiring the `np` tile, either expand the Phase 1 order seed data to a realistic
monthly volume or consider using the current-month `MONTHLY_REVENUE` constant
as a reference for what a realistic value should look like.

---

## Rollback considerations

If Phase 2a needs to be rolled back after application, the following sequence
must be followed in order (reverse of creation order):

```
Step 1 — Drop RPCs:
  DROP FUNCTION IF EXISTS public.operating_profit_monthly(uuid, date, date);
  DROP FUNCTION IF EXISTS public.cash_runway_months(uuid);
  DROP FUNCTION IF EXISTS public.monthly_overhead_total(uuid, date, date, text);

Step 2 — Drop views:
  DROP VIEW IF EXISTS public.v_monthly_overhead_summary;
  DROP VIEW IF EXISTS public.v_current_cash_balance;

Step 3 — Delete seed data (in FK dependency order):
  DELETE FROM public.overhead_entries
    WHERE store_id = '10000000-0000-0000-0000-000000000001';
  DELETE FROM public.cash_balance_snapshots
    WHERE store_id = '10000000-0000-0000-0000-000000000001';
  DELETE FROM public.overhead_categories
    WHERE store_id = '10000000-0000-0000-0000-000000000001';

Step 4 — Drop tables (in FK dependency order):
  DROP TABLE IF EXISTS public.overhead_entries;
  DROP TABLE IF EXISTS public.overhead_categories;
  DROP TABLE IF EXISTS public.cash_balance_snapshots;
```

**Why tables must be dropped last:** `overhead_entries` has a FK to
`overhead_categories` (`ON DELETE RESTRICT`). Attempting to drop
`overhead_categories` while `overhead_entries` exists will fail. Drop
`overhead_entries` first, then `overhead_categories`.

**No Phase 1 table is touched** by Phase 2a. A Phase 2a rollback has zero impact
on Phase 1 tables, views, or RPCs.

**Supabase cloud:** The cloud project (`futkktdebdygsdrcknpr`, `eu-north-1`) does
not support transactional DDL rollback. If a migration fails partway through,
manual cleanup using the steps above is required via the Supabase SQL editor.

---

## Frontend wiring — possible after Phase 2a, not implemented yet

The following changes will be possible once all six migration files have been
applied and verified. **Do not implement these until explicitly instructed.**

### `cr` tile — Cash Runway

**Tile ID:** `cr` in `KPI_CARDS` in `dashboard.tsx`

**Current state:** Reads `CASH_RUNWAY = 3.4` from `cash-snapshot.ts`. No RPC
wiring exists.

**Post-Phase-2a change:**
1. Add `cash_runway_months` to the `getPhase1Metrics()` call pattern in
   `phase1Metrics.ts` (or a new `getPhase2Metrics()` function), calling
   `cash_runway_months(p_store_id)`.
2. Wire the result into the `cr` tile in `dashboard.tsx` `liveKpiCards` block.
3. Remove or flag the `CASH_RUNWAY = 3.4` constant as replaced.

**Note on tile value change:** The displayed value will move from the current
illustrative mock of `3.4` months to the Supabase-computed value of approximately
`1.55` months when this tile is wired. This is expected and correct — see the
`cash_runway_months` RPC section above for rationale.

---

### `np` tile — Net Profit

**Tile ID:** `np` in `KPI_CARDS` in `dashboard.tsx`

**Current state:** Displays `"£56,300"` as a hardcoded literal. No RPC wiring
exists.

**Post-Phase-2a change:**
1. Add `operating_profit_monthly` to the metrics call pattern, passing the
   current calendar month's `date_from` / `date_to`.
2. Wire the result into the `np` tile in `dashboard.tsx` `liveKpiCards` block.
3. Remove the `"£56,300"` literal.

**⚠️ Pre-wiring decision required:** The computed value on Phase 1 dev seed data
will be deeply negative (~−£118,000) because Phase 1 orders total only ~£700 in
net sales, far below the realistic £124,500 monthly figure. Either expand the
Phase 1 order seed or accept the dev-only negative value before wiring.

---

### `change` strings on Phase 1 tiles

**Current state:** All 8 Phase 1 tiles show static `change` strings (e.g.
`"↓ 2.8% vs last month"`).

**Post-Phase-2a change (Phase 2c):** No new tables are required. The existing
Phase 1 RPCs (`net_sales`, `gross_revenue`, `average_order_value`, etc.) can be
called a second time with the prior calendar month's date range. The delta is then
computed in TypeScript and formatted as `"↑ X.X% vs last month"` or
`"↓ X.Xpp vs last month"`. This is a frontend-only change deferred to Phase 2c.

---

*This document is a migration implementation plan — no SQL has been written yet.
Proceed to migration authoring only after this plan is reviewed and approved.*
