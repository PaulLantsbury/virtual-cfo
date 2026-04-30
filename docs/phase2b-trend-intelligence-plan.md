# Phase 2b — Trend Intelligence Layer: Implementation Plan

**Status:** Planning — no migrations written yet.
**Follows:** Phase 1 (commerce schema + 9 metric functions) and Phase 2a (overhead, cash, cr/np RPCs).
**Author note:** Users are unlikely to maintain reliable budgets in Xero. Phase 2b therefore
focuses entirely on trend-based intelligence — month-on-month deltas and rolling averages
derived from actual data — rather than budget-vs-actual analysis.

---

## 0. Executive Summary

Phase 2b adds a single Postgres-side intelligence layer that computes:

- **Month-on-month (MoM) deltas** for every live dashboard KPI.
- **3-month rolling averages** for revenue, margin, costs, profit, and runway.
- **CFO alert signals** generated from threshold rules applied to live trends.

No new permanent tables are required. All work is delivered through two new SQL views
and three new RPC functions, plus one seed migration to supply the March 2026 order
data needed for prior-period comparisons.

On the frontend, one new TypeScript module (`phase2bMetrics.ts`) calls a single RPC
per page load and distributes the results to replace every static change-string on the
dashboard with a computed one.

---

## 1. What Exists Today

### Phase 1 RPC functions (all accept `p_store_id, p_date_from, p_date_to`)

| Function | Returns | Powers tile |
|---|---|---|
| `gross_revenue()` | numeric | mr |
| `net_sales()` | numeric | ns |
| `discount_cost()` | numeric | (internal) |
| `return_amount()` | numeric | (internal) |
| `order_count()` | bigint | (internal) |
| `average_order_value()` | numeric | aov |
| `repeat_purchase_rate()` | numeric [0,1] | rpr |
| `discount_dependency()` | numeric [0,1] | dd |
| `refund_rate()` | numeric [0,1] | rr |
| `contribution_margin_pct()` | numeric [0,1] or NULL | cm |
| `recoverable_contribution_range()` | TABLE(low, high) | rc |

### Phase 2a RPC functions

| Function | Returns | Powers tile |
|---|---|---|
| `monthly_overhead_total(store, from, to, type)` | numeric | (internal) |
| `cash_runway_months(store)` | numeric or NULL | cr |
| `operating_profit_monthly(store, from, to)` | numeric or NULL | np |

### Phase 2a views
- `v_monthly_overhead_summary` — overhead by category, period, entry_type
- `v_current_cash_balance` — latest snapshot total per store
- `v_current_cost_assumptions` — effective cost rates per store

### Available order data
- **April 2026:** 2,011 orders (migration 000006) — the current live period.
- **March 2026:** No orders seeded. Required for MoM comparisons on commerce metrics.
- **Pre-April:** 16 dev orders in migration 000004, unsuitable for trend analysis.

### Available overhead data
- **January–December 2026:** 72 budget rows + 72 actual rows (all categories).
- Jan–Apr 2026 actuals carry deliberate variance vs budget.
- May–Dec 2026 actuals equal budget exactly.

### Available cash snapshot data
- Feb 28, Mar 31, Apr 30 2026 — one `main` account, balances £172k / £178k / £186k.

---

## 2. Are New Tables Required?

**No new tables are required for Phase 2b.**

All trend analysis is derivable from existing tables using parametric calls to the
Phase 1 and Phase 2a functions — those functions already accept arbitrary date ranges,
so calling them with a prior-month window produces prior-period values.

The only schema additions needed are:

- **Two SQL views** (`v_monthly_metrics`, `v_month_on_month`) that materialise
  per-month snapshots and deltas for efficient multi-month queries.
- **Three RPC functions** (`month_on_month_delta`, `rolling_3m_averages`, `cfo_alerts`)
  that the frontend calls directly.

A `working_capital_snapshots` table and a `budget_lines` table are explicitly deferred
— budget data from Xero is unreliable and out of scope for Phase 2b.

---

## 3. Seed Data Required

### Why seed data is needed

The Phase 1 metric functions are fully parametric. Calling `net_sales(store, '2026-03-01',
'2026-03-31')` against the current database returns `0` because no March 2026 orders
exist. Without March order data, every MoM delta for commerce metrics (net_sales,
gross_revenue, AOV, refund_rate, discount_dependency, repeat_purchase_rate,
contribution_margin_pct) is undefined.

### March 2026 order seed — design constraints

The seed must produce a realistic prior month that tells a coherent CFO story relative
to April 2026. The target values for March 2026 are:

| Metric | April 2026 (current, cloud) | March 2026 (seed target) | MoM direction |
|---|---|---|---|
| gross_revenue | £167,853 | ~£149,000 | ↑ +12.4% (April up) |
| net_sales | £122,921 | ~£107,500 | ↑ +14.3% |
| average_order_value | £61.93 | ~£59.00 | ↑ +4.9% |
| refund_rate | 3.62% | ~3.75% | ↓ −0.13pp (April improved) |
| discount_dependency | 3.93% | ~3.56% | ↑ +0.37pp (April worse) |
| repeat_purchase_rate | 71.43% | ~67.00% | ↑ +4.4pp (April improved) |
| contribution_margin_pct | ~88.69% | ~87.10% | ↓ −1.6pp (April worse — more orders = higher fulfilment cost/order impact) |
| operating_profit | −£10,184 | −£10,700 | ↑ slightly better in March (lower overhead) |
| fixed overhead (actual) | £119,200 | £122,800 | ↓ April lower (March had payroll spike) |
| cash_runway | ~1.56 months | ~1.45 months | ↑ April higher |

**Design rationale for MoM story:**
- Revenue is growing (good) — April gross_revenue clearly higher than March.
- Margin is compressing slightly (concern) — contribution_margin_pct fell in April.
- Overhead rose in March (payroll spike to £82k), then normalised in April (£80k).
- Operating profit remains negative in both months — the business is still loss-making.
- Runway is improving but still critical.

**Scale:** March seed should use ~1,750 orders (≈87% of April's 2,011). Same customer
pool (c01–c20), same product mix, slightly lower AOV, slightly higher refund rate,
slightly lower discount ratio.

**Idempotency:** All INSERTs use `ON CONFLICT DO NOTHING`.

**Schema-adaptive:** Same `is_cloud` detection pattern as migration 000006
(`shopify_order_id BIGINT` vs `TEXT`, column name differences).

**Shopify order ID range:** Use 60001–61750 to avoid collision with April's 50001–52125
and the original 20001–20195 dev orders.

---

## 4. SQL Views

### 4.1 `v_monthly_metrics`

**Purpose:** One row per store per calendar month, containing all Phase 1 and Phase 2a
metric values for that month. Eliminates the need to call N individual RPCs with the
same date range when computing multi-month summaries.

**Implementation approach:** `GENERATE_SERIES` over a hard-coded 6-month window
(January–June 2026) cross-joined with `stores`, then calling each function once per
row. This avoids a self-join or `RECURSIVE` CTE and is safe at Phase 2b data volumes.

```sql
-- Conceptual structure (not final SQL):
CREATE OR REPLACE VIEW public.v_monthly_metrics AS
WITH months AS (
  SELECT
    generate_series(
      '2026-01-01'::date,
      '2026-06-01'::date,
      interval '1 month'
    )::date AS month_start
),
stores_list AS (
  SELECT id AS store_id FROM public.stores
)
SELECT
  s.store_id,
  m.month_start                                      AS period_start,
  (m.month_start + interval '1 month')::date - 1    AS period_end,
  public.gross_revenue(s.store_id, m.month_start,
    (m.month_start + interval '1 month')::date - 1) AS gross_revenue,
  public.net_sales(s.store_id, m.month_start,
    (m.month_start + interval '1 month')::date - 1) AS net_sales,
  public.average_order_value(s.store_id, m.month_start,
    (m.month_start + interval '1 month')::date - 1) AS average_order_value,
  public.refund_rate(s.store_id, m.month_start,
    (m.month_start + interval '1 month')::date - 1) AS refund_rate,
  public.discount_dependency(s.store_id, m.month_start,
    (m.month_start + interval '1 month')::date - 1) AS discount_dependency,
  public.repeat_purchase_rate(s.store_id, m.month_start,
    (m.month_start + interval '1 month')::date - 1) AS repeat_purchase_rate,
  public.contribution_margin_pct(s.store_id, m.month_start,
    (m.month_start + interval '1 month')::date - 1) AS contribution_margin_pct,
  public.operating_profit_monthly(s.store_id, m.month_start,
    (m.month_start + interval '1 month')::date - 1) AS operating_profit,
  public.monthly_overhead_total(s.store_id, m.month_start,
    (m.month_start + interval '1 month')::date - 1, 'actual') AS fixed_overhead_actual
FROM months m
CROSS JOIN stores_list s;
```

**Note on `GENERATE_SERIES` range:** The 6-month window (Jan–Jun 2026) is hard-coded
rather than `CURRENT_DATE`-relative. This prevents the view from producing NULL-heavy
rows for future months with no data. The range must be extended as new data is seeded
or imported. This is a known limitation and is documented in the view comment.

**Note on `cash_runway_months()`:** This function always reads `CURRENT_DATE` and the
latest snapshot — it cannot be parameterised by month. It is **excluded from this view**
and handled separately via a dedicated column in `v_month_on_month` (see §4.2).

**Security:** `CREATE OR REPLACE VIEW` — no `SECURITY DEFINER` on views (views inherit
the caller's permissions). The underlying functions are already `SECURITY DEFINER`, so
the view will return data correctly for `anon` callers via Supabase.

---

### 4.2 `v_month_on_month`

**Purpose:** For each store and month, shows the current month's values alongside the
prior month's values and the absolute and percentage deltas. This is what the frontend
`month_on_month_delta()` RPC reads from.

**Implementation:** Self-join on `v_monthly_metrics` where prior month =
`current period_start - 1 month`.

```sql
-- Conceptual structure (not final SQL):
CREATE OR REPLACE VIEW public.v_month_on_month AS
SELECT
  cur.store_id,
  cur.period_start,
  cur.period_end,

  -- Current month values
  cur.gross_revenue             AS gross_revenue_cur,
  cur.net_sales                 AS net_sales_cur,
  cur.average_order_value       AS aov_cur,
  cur.refund_rate               AS refund_rate_cur,
  cur.discount_dependency       AS discount_dep_cur,
  cur.repeat_purchase_rate      AS rpr_cur,
  cur.contribution_margin_pct   AS cm_pct_cur,
  cur.operating_profit          AS op_profit_cur,
  cur.fixed_overhead_actual     AS overhead_cur,

  -- Prior month values
  prv.gross_revenue             AS gross_revenue_prv,
  prv.net_sales                 AS net_sales_prv,
  prv.average_order_value       AS aov_prv,
  prv.refund_rate               AS refund_rate_prv,
  prv.discount_dependency       AS discount_dep_prv,
  prv.repeat_purchase_rate      AS rpr_prv,
  prv.contribution_margin_pct   AS cm_pct_prv,
  prv.operating_profit          AS op_profit_prv,
  prv.fixed_overhead_actual     AS overhead_prv,

  -- Percentage deltas (current vs prior, relative change)
  -- NULL when prior = 0 or prior IS NULL (NULLIF division guard)
  ROUND(
    (cur.gross_revenue - prv.gross_revenue)
    / NULLIF(ABS(prv.gross_revenue), 0) * 100,
    1
  )                             AS gross_revenue_delta_pct,
  -- ... (same pattern for net_sales, aov, operating_profit)

  -- Percentage-point deltas (for ratio metrics — more meaningful than relative %)
  ROUND((cur.refund_rate        - prv.refund_rate)        * 100, 2) AS refund_rate_delta_pp,
  ROUND((cur.discount_dependency - prv.discount_dependency) * 100, 2) AS discount_dep_delta_pp,
  ROUND((cur.repeat_purchase_rate - prv.repeat_purchase_rate) * 100, 1) AS rpr_delta_pp,
  ROUND((cur.contribution_margin_pct - prv.contribution_margin_pct) * 100, 2) AS cm_pct_delta_pp

FROM public.v_monthly_metrics cur
LEFT JOIN public.v_monthly_metrics prv
  ON  prv.store_id    = cur.store_id
  AND prv.period_start = (cur.period_start - interval '1 month')::date;
```

**Why LEFT JOIN (not INNER):** The earliest month in the view (January 2026) has no
prior month. A LEFT JOIN keeps January as a row with NULL deltas rather than suppressing
it. RPCs that read this view always filter to a specific month, so the full set of rows
is never returned to the frontend.

**Delta conventions:**
- **Money metrics** (gross_revenue, net_sales, AOV, operating_profit): relative %
  change. `(cur − prv) / ABS(prv) × 100`. `ABS(prv)` prevents sign inversion when
  the prior value is negative (e.g. operating_profit going from −£10,700 to −£10,184:
  the business improved, delta should be positive).
- **Ratio metrics** (refund_rate, discount_dependency, repeat_purchase_rate,
  contribution_margin_pct): absolute percentage-point change. A move from 3.75% to
  3.62% refund rate is −0.13pp, not −3.5% relative.
- **Fixed overhead**: relative % change (same as money metrics).
- **Operating profit**: relative % change using ABS(prv) as denominator — see above.

---

## 5. RPC Functions

### 5.1 `month_on_month_delta`

```
Signature:
  month_on_month_delta(
    p_store_id   uuid,
    p_date_from  date,   -- first day of the current month
    p_date_to    date    -- last day of the current month
  )
  RETURNS TABLE (
    gross_revenue_cur       numeric,
    gross_revenue_prv       numeric,
    gross_revenue_delta_pct numeric,
    net_sales_cur           numeric,
    net_sales_prv           numeric,
    net_sales_delta_pct     numeric,
    aov_cur                 numeric,
    aov_prv                 numeric,
    aov_delta_pct           numeric,
    refund_rate_cur         numeric,
    refund_rate_prv         numeric,
    refund_rate_delta_pp    numeric,
    discount_dep_cur        numeric,
    discount_dep_prv        numeric,
    discount_dep_delta_pp   numeric,
    rpr_cur                 numeric,
    rpr_prv                 numeric,
    rpr_delta_pp            numeric,
    cm_pct_cur              numeric,
    cm_pct_prv              numeric,
    cm_pct_delta_pp         numeric,
    op_profit_cur           numeric,
    op_profit_prv           numeric,
    op_profit_delta_pct     numeric,
    overhead_cur            numeric,
    overhead_prv            numeric,
    overhead_delta_pct      numeric,
    -- Cash runway (current CURRENT_DATE based, prior = month-ago snapshot)
    runway_cur              numeric,
    runway_prv              numeric,
    runway_delta_months     numeric
  )
```

**Implementation:** Reads one row from `v_month_on_month` filtered to
`store_id = p_store_id AND period_start = p_date_from`. This is a single index
lookup — no fan-out. Returns a single-row TABLE type (consistent with the
`recoverable_contribution_range()` TABLE return pattern).

**Cash runway MoM:** `cash_runway_months()` cannot be called with a prior date.
Instead:
- `runway_cur` = `cash_runway_months(p_store_id)` (current, live).
- `runway_prv` = prior month's cash balance ÷ prior month's overhead, both derived
  from `cash_balance_snapshots` and `monthly_overhead_total()` using the prior period
  bounds. This is a two-step local computation inside the function, not a recursive
  call to `cash_runway_months()`.
- `runway_delta_months` = `runway_cur − runway_prv` (absolute months change).

**LANGUAGE:** `plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp`.

---

### 5.2 `rolling_3m_averages`

```
Signature:
  rolling_3m_averages(
    p_store_id   uuid,
    p_date_from  date   -- first day of the most-recent month (T)
  )
  RETURNS TABLE (
    gross_revenue_3m_avg      numeric,
    net_sales_3m_avg          numeric,
    cm_pct_3m_avg             numeric,
    fixed_overhead_3m_avg     numeric,
    operating_profit_3m_avg   numeric,
    runway_3m_avg             numeric
  )
```

**Formula:** Average of months T, T−1, T−2.

**Implementation:** Reads three rows from `v_monthly_metrics` where `period_start IN
(p_date_from, p_date_from − 1 month, p_date_from − 2 months)` and computes `AVG()`
for each column. If fewer than 3 months of data exist, `AVG()` over the available rows
is returned (no NULL suppression for missing months — the caller receives an average of
what exists).

**Why only 6 metrics (not all 10):** Rolling averages are most meaningful for
magnitudes that vary with business cycles. Ratio metrics (refund_rate, discount_dep,
rpr) are better expressed as the most-recent period value with a MoM delta; a 3-month
average obscures trend direction.

**Dashboard use:** The 3-month averages feed the "Expected Impact if Implemented"
panel (baseline reference) and the Scenario Lab comparison baseline. They are not
shown as primary KPI tile values.

---

### 5.3 `cfo_alerts`

```
Signature:
  cfo_alerts(
    p_store_id  uuid,
    p_date_from date,
    p_date_to   date
  )
  RETURNS TABLE (
    alert_key    text,
    severity     text,   -- 'critical' | 'warning' | 'info'
    metric       text,   -- e.g. 'contribution_margin_pct'
    current_val  numeric,
    prior_val    numeric,
    threshold    numeric,
    triggered    boolean
  )
```

**Implementation:** Calls `month_on_month_delta()` internally to get the current and
prior values, then applies threshold rules. Returns one row per rule (triggered or not),
so the frontend can display all triggered alerts and the total count.

**Alert rules (initial set):**

| `alert_key` | `severity` | Rule | Trigger condition |
|---|---|---|---|
| `revenue_declining` | `warning` | gross_revenue_delta_pct < −5.0 | Revenue fell more than 5% MoM |
| `revenue_stall` | `info` | gross_revenue_delta_pct BETWEEN −5.0 AND 0 | Revenue flat or slight decline |
| `margin_falling` | `warning` | cm_pct_delta_pp < −1.5 | Contribution margin fell more than 1.5pp MoM |
| `margin_critical` | `critical` | cm_pct_cur < 0.70 | Contribution margin below 70% absolute |
| `refunds_rising` | `warning` | refund_rate_delta_pp > 0.5 | Refund rate rose more than 0.5pp MoM |
| `refunds_critical` | `critical` | refund_rate_cur > 0.08 | Refund rate above 8% absolute |
| `discounts_rising` | `warning` | discount_dep_delta_pp > 1.0 | Discount dependency rose more than 1pp MoM |
| `discounts_high` | `critical` | discount_dep_cur > 0.15 | Discount dependency above 15% absolute |
| `overhead_outpacing` | `warning` | overhead_delta_pct > gross_revenue_delta_pct + 5.0 | Fixed costs growing faster than revenue by >5pp |
| `profit_deteriorating` | `warning` | op_profit_delta_pct < −10.0 (using ABS basis) | Operating profit worsened by more than 10% MoM |
| `runway_low` | `critical` | runway_cur < 1.0 | Runway below 1 month |
| `runway_tightening` | `warning` | runway_cur BETWEEN 1.0 AND 2.0 | Runway below 2 months |
| `runway_declining` | `warning` | runway_delta_months < −0.25 | Runway shortened by more than 0.25 months MoM |

**Threshold rationale:** All thresholds are defined as named constants inside the
function body (not hard-coded literals in the CASE expressions) so they can be updated
without rewriting the branching logic. Example:

```sql
DECLARE
  c_revenue_decline_pct    constant numeric := -5.0;
  c_margin_fall_pp         constant numeric := -1.5;
  c_margin_critical_floor  constant numeric :=  0.70;
  -- ...
```

**Future extensibility:** Alert thresholds should eventually live in a `store_alert_config`
table so merchants can adjust them without a migration. This is Phase 3 scope. For Phase 2b
the constants-in-function approach is correct.

---

## 6. How Change Strings Are Computed Dynamically

### Current state (all static)

Every KPI tile's `change` string is either hardcoded in `KPI_CARDS[]` or set to `""`:

```ts
{ id: "mr",  change: "↑ 12.4% vs last month"  }  // DEV-ONLY
{ id: "cm",  change: "↓ 2.8% vs last month"   }  // DEV-ONLY
{ id: "dd",  change: "↑ 11% vs last month"    }  // DEV-ONLY
{ id: "rpr", change: "↑ 4.2% vs last month"   }  // DEV-ONLY
{ id: "cr",  change: "Moderate"                }  // qualitative, not computed
{ id: "ns",  change: ""                        }  // intentionally empty
{ id: "np",  change: ""                        }  // intentionally empty
{ id: "aov", change: ""                        }  // intentionally empty
{ id: "rr",  change: ""                        }  // intentionally empty
```

### Phase 2b approach

A new `phase2bMetrics.ts` module calls `month_on_month_delta()` once per page load,
receives the full delta row, and exports a typed object. The `liveKpiCards` computation
block in `dashboard.tsx` reads from this object in the same three-tier pattern used for
Phase 2a metrics.

**Change string formatting rules** (to be implemented in `phase2bMetrics.ts`):

```
formatDeltaPct(delta: number | null, label = "vs last month"): string
  null  → ""
  > 0   → "↑ {delta.toFixed(1)}% {label}"
  < 0   → "↓ {Math.abs(delta).toFixed(1)}% {label}"
  === 0 → "→ flat vs last month"

formatDeltaPp(delta: number | null, label = "vs last month"): string
  null  → ""
  > 0   → "↑ {delta.toFixed(1)}pp {label}"      (pp = percentage points)
  < 0   → "↓ {Math.abs(delta).toFixed(1)}pp {label}"
  === 0 → "→ flat vs last month"

formatRunwayDelta(delta: number | null): string
  null    → ""
  > 0.1   → "↑ {delta.toFixed(1)} months"
  < -0.1  → "↓ {Math.abs(delta).toFixed(1)} months"
  else    → "→ stable"
```

**Tile mapping:**

| Tile | Change string source | Format |
|---|---|---|
| mr | `gross_revenue_delta_pct` | `formatDeltaPct` |
| ns | `net_sales_delta_pct` | `formatDeltaPct` |
| aov | `aov_delta_pct` | `formatDeltaPct` |
| cm | `cm_pct_delta_pp` | `formatDeltaPp` |
| rr | `refund_rate_delta_pp` | `formatDeltaPp` |
| dd | `discount_dep_delta_pp` | `formatDeltaPp` |
| rpr | `rpr_delta_pp` | `formatDeltaPp` |
| np | `op_profit_delta_pct` | `formatDeltaPct` (ABS-based) |
| cr | `runway_delta_months` + computed narrative | `formatRunwayDelta` |

**Cash Runway change string special case:** The `cr` tile currently shows "Moderate"
as a qualitative label. Phase 2b replaces this with a two-part string:
- If `runway_delta_months < −0.25` → `"↓ tightening"` (or exact months delta)
- If `runway_delta_months > 0.25` → `"↑ improving"`
- If within ±0.25 → `"→ stable"`

The existing `crChange` computation block in `dashboard.tsx` (which generates
"Critical — under 1 month" and similar) is retained for the absolute-threshold
messaging. The MoM delta string is appended or used as the sub-label.

---

## 7. Dashboard Sections Unlocked

| Section | What changes |
|---|---|
| **BUSINESS HEALTH SUMMARY** tiles | All 4 tiles get computed change strings (ns, cm, rc unchanged, cr gets trend) |
| **REVENUE QUALITY DIAGNOSTICS** tiles | mr, aov, rpr, dd all get real MoM deltas |
| **EFFICIENCY AND PROFIT LEAKAGE** tiles | rr and np get computed deltas |
| **OVERALL BUSINESS HEALTH** narrative | CFO alert count drives "Action recommended" badge and amber/red status |
| **CFO Monitoring banner** | `cfo_alerts()` response populates alert list and severity count |
| **"What to focus on this week"** panel | Alert keys map to pre-authored action text per alert type |

---

## 8. Migration Files — Recommended Filenames

All files go in `supabase/migrations/`. Numbering follows the existing convention:
`20260430NNNNNN_slug.sql` (same date prefix since these are authored on April 30 2026).

| File | Contents | Sequence |
|---|---|---|
| `20260430000007_phase2b_march_seed.sql` | March 2026 orders + customers seed (~1,750 orders) | 1 |
| `20260430000008_phase2b_trend_views.sql` | `v_monthly_metrics`, `v_month_on_month` | 2 |
| `20260430000009_phase2b_trend_rpcs.sql` | `month_on_month_delta`, `rolling_3m_averages`, `cfo_alerts` | 3 |

**Dependency order:** The seed must precede the views (views call Phase 1 functions
which scan orders, so seeding first ensures the view is non-trivially populated on
creation). The views must precede the RPCs (RPCs read from the views).

**No separate frontend migration file** — TypeScript changes are not migrations.

---

## 9. Validation SQL

After all three migrations are applied, the following queries confirm correctness:

```sql
-- 1. March 2026 order volume
SELECT COUNT(*), financial_status
FROM orders
WHERE store_id = '10000000-0000-0000-0000-000000000001'
  AND created_at::date BETWEEN '2026-03-01' AND '2026-03-31'
GROUP BY financial_status;
-- Expected: ~1,530 paid, ~60 partially_refunded, ~25 refunded (totalling ~1,615 paid-equivalent)

-- 2. March 2026 metric spot-checks
SELECT
  public.gross_revenue('10000000-0000-0000-0000-000000000001', '2026-03-01', '2026-03-31'),
  public.net_sales('10000000-0000-0000-0000-000000000001', '2026-03-01', '2026-03-31'),
  public.average_order_value('10000000-0000-0000-0000-000000000001', '2026-03-01', '2026-03-31'),
  public.refund_rate('10000000-0000-0000-0000-000000000001', '2026-03-01', '2026-03-31'),
  public.discount_dependency('10000000-0000-0000-0000-000000000001', '2026-03-01', '2026-03-31'),
  public.contribution_margin_pct('10000000-0000-0000-0000-000000000001', '2026-03-01', '2026-03-31');
-- Expected: gross ~£149k, net ~£107k, AOV ~£59, refund ~3.7%, discount ~3.6%, cm ~87%

-- 3. v_monthly_metrics populated for March and April
SELECT period_start, gross_revenue, net_sales, contribution_margin_pct, operating_profit
FROM public.v_monthly_metrics
WHERE store_id = '10000000-0000-0000-0000-000000000001'
  AND period_start IN ('2026-03-01', '2026-04-01')
ORDER BY period_start;
-- Expected: 2 rows, Apr values match Phase 1 acceptance checks

-- 4. MoM delta correctness
SELECT
  gross_revenue_delta_pct,
  net_sales_delta_pct,
  cm_pct_delta_pp,
  refund_rate_delta_pp,
  discount_dep_delta_pp,
  rpr_delta_pp,
  op_profit_delta_pct,
  overhead_delta_pct
FROM public.v_month_on_month
WHERE store_id = '10000000-0000-0000-0000-000000000001'
  AND period_start = '2026-04-01';
-- Expected: gross_revenue +12.4%, cm_pct slightly negative, refund_rate negative (April improved)

-- 5. month_on_month_delta RPC
SELECT * FROM public.month_on_month_delta(
  '10000000-0000-0000-0000-000000000001',
  '2026-04-01',
  '2026-04-30'
);
-- Expected: single row matching v_month_on_month output above

-- 6. rolling_3m_averages RPC
SELECT * FROM public.rolling_3m_averages(
  '10000000-0000-0000-0000-000000000001',
  '2026-04-01'
);
-- Expected: single row with averages of Feb–Apr (or available months)

-- 7. cfo_alerts RPC — check which alerts fire
SELECT alert_key, severity, triggered, current_val, prior_val
FROM public.cfo_alerts(
  '10000000-0000-0000-0000-000000000001',
  '2026-04-01',
  '2026-04-30'
)
WHERE triggered = true
ORDER BY severity, alert_key;
-- Expected: 'runway_tightening' (critical, 1.56 months), 'margin_falling' or similar
```

---

## 10. Naming Risks and Schema Conflicts

| Risk | Detail | Mitigation |
|---|---|---|
| `v_monthly_metrics` name collision | No view with this name exists in current migrations. | Verified by grepping all migration files. Use `CREATE OR REPLACE`. |
| `v_month_on_month` name collision | No view with this name exists. | As above. |
| `month_on_month_delta` function collision | No function with this name exists. | As above. |
| `generate_series` in a view | `GENERATE_SERIES` inside a view is a table function — safe in Postgres 12+ (Supabase cloud is Postgres 15). Not safe for RLS if view is exposed directly via PostgREST. | All three trend RPCs read from the views internally; views are not exposed directly to the frontend. Frontend calls RPCs only. |
| `v_monthly_metrics` calling all Phase 1 RPCs | The view calls 9+ functions per row × N months × N stores. At Phase 2b volumes (1 store, 6 months) this is 54+ function invocations per full view scan. | The view is only ever read through the RPCs, which add a `WHERE store_id = ? AND period_start = ?` filter — reducing the scan to 1–3 rows. Do **not** expose the view directly via PostgREST or allow unbounded queries against it. |
| `cash_runway_months()` inside `v_monthly_metrics` | The function reads `CURRENT_DATE` — it cannot produce a historical runway value. Including it in the view would give the same live value for every month row. | Excluded from `v_monthly_metrics`. Handled inline in `month_on_month_delta()` using a manual prior-month cash/overhead calculation. |
| `ABS(prv)` in delta calculation for operating_profit | When prior value is −£10,700 and current is −£10,184, naive `(cur−prv)/prv` gives a negative delta (which would suggest things got worse). `ABS(prv)` as denominator gives a positive delta (things improved). | `ABS(prv)` is the correct denominator. Document this convention in the view comment and the RPC comment. |
| `generate_series` upper bound | If the upper bound of `GENERATE_SERIES` is set to `CURRENT_DATE` rather than a hard-coded month, future months (with no data) will appear as NULL-filled rows. | Hard-code the upper bound as `'2026-06-01'`. Extend as data is seeded or imported. |

---

## 11. Implementation Order

```
Step 1  Write and validate 20260430000007_phase2b_march_seed.sql
        - Local apply + acceptance checks (order count, net_sales, AOV, refund_rate, cm_pct)
        - Cloud apply + same checks

Step 2  Write and validate 20260430000008_phase2b_trend_views.sql
        - Local apply + spot-check v_monthly_metrics for Mar and Apr rows
        - Verify v_month_on_month delta direction matches expectations

Step 3  Write and validate 20260430000009_phase2b_trend_rpcs.sql
        - Local apply + run all 7 validation queries from §9
        - Verify cfo_alerts() triggers the expected alerts

Step 4  Write phase2bMetrics.ts (frontend data layer)
        - Call month_on_month_delta() and rolling_3m_averages() in one Effect
        - Export typed result object matching the RPC TABLE columns

Step 5  Wire change strings in dashboard.tsx
        - Replace all static KPI_CARDS `change:` strings with computed values
        - Add phase2bMetrics loading tier to liveKpiCards (same three-tier pattern)
        - No change to value or status logic

Step 6  Wire cfo_alerts() to the CFO Monitoring banner
        - Replace the hardcoded "Action recommended" logic with alert count
        - Map alert_key → human-readable banner text

Step 7  End-to-end test
        - Screenshot dashboard — all change strings show real deltas
        - Verify correct sign direction (↑/↓) for each tile
        - Confirm "Moderate" on cr tile is replaced
```

---

## 12. What Remains Out of Scope for Phase 2b

| Item | Reason |
|---|---|
| `budget_lines` table | Users unlikely to maintain Xero budgets reliably. Deferred indefinitely. |
| `budget_variance_summary()` RPC | Depends on `budget_lines`. Deferred. |
| `working_capital_snapshots` table | Mentioned in Phase 2a out-of-scope list. Requires receivables/payables data not yet available. Phase 2c. |
| Marketing / CAC tables | Explicitly excluded per scope. Phase 3. |
| Year-over-year comparisons | No prior-year order data. |
| Rolling 6m or 12m averages | Insufficient historical data at current seed depth. |
| Predictive/forecast RPCs | Phase 3 scope — requires trend regression. |
| Custom alert thresholds per store | Phase 3 — requires `store_alert_config` table. |
| Exposing `v_monthly_metrics` or `v_month_on_month` directly via PostgREST | Risk of unbounded multi-store, multi-month scans. Access via RPCs only. |
| Wiring `rolling_3m_averages()` to KPI tiles | 3m averages are a reference baseline, not a primary KPI value. Used in Scenario Lab and Expected Impact panel only. |
| Margin Analysis page wiring | Out of scope for Phase 2b. That page uses `commerceMetrics.ts` and has its own live data layer. |

---

## 13. Frontend Module Shape (Preview)

```ts
// artifacts/virtual-cfo/src/lib/analytics/phase2bMetrics.ts

export interface MonthOnMonthDelta {
  grossRevenue:    { cur: number; prv: number; deltaPct: number | null };
  netSales:        { cur: number; prv: number; deltaPct: number | null };
  aov:             { cur: number; prv: number; deltaPct: number | null };
  refundRate:      { cur: number; prv: number; deltaPp:  number | null };
  discountDep:     { cur: number; prv: number; deltaPp:  number | null };
  rpr:             { cur: number; prv: number; deltaPp:  number | null };
  cmPct:           { cur: number; prv: number; deltaPp:  number | null };
  opProfit:        { cur: number; prv: number; deltaPct: number | null };
  overhead:        { cur: number; prv: number; deltaPct: number | null };
  runway:          { cur: number; prv: number; deltaMonths: number | null };
}

export interface Rolling3mAverages {
  grossRevenue:    number | null;
  netSales:        number | null;
  cmPct:           number | null;
  fixedOverhead:   number | null;
  opProfit:        number | null;
  runway:          number | null;
}

export interface CfoAlert {
  alertKey:    string;
  severity:    'critical' | 'warning' | 'info';
  metric:      string;
  currentVal:  number;
  priorVal:    number;
  threshold:   number;
  triggered:   boolean;
}

export interface Phase2bMetrics {
  delta:    MonthOnMonthDelta;
  rolling:  Rolling3mAverages;
  alerts:   CfoAlert[];
  errors:   { fn: string; message: string }[];
}

export async function getPhase2bMetrics(
  storeId: string,
  dateFrom: string,
  dateTo: string
): Promise<Phase2bMetrics> { /* ... */ }
```

---

## 14. Expected Metric Values After Phase 2b (Seed Validation Targets)

For reference when writing the March 2026 seed and validating deltas:

| Metric | March 2026 (seed target) | April 2026 (live) | Delta |
|---|---|---|---|
| gross_revenue | ~£149,000 | £167,853 | +12.7% |
| net_sales | ~£107,500 | £122,921 | +14.3% |
| average_order_value | ~£59.00 | £61.93 | +5.0% |
| refund_rate | ~3.75% | 3.62% | −0.13pp |
| discount_dependency | ~3.56% | 3.93% | +0.37pp |
| repeat_purchase_rate | ~67% | 71.43% | +4.4pp |
| contribution_margin_pct | ~87.1% | ~88.7% | −1.6pp |
| operating_profit | ~−£10,700 | −£10,184 | +4.8% (improved) |
| fixed_overhead_actual | £122,800 | £119,200 | −2.9% |
| cash_runway | ~1.45 months | ~1.56 months | +0.11 months |

**CFO story this tells:**
Revenue is growing strongly (+14%). Margins are under modest pressure (−1.6pp) — the
March payroll spike (£82k vs £80k in April) is now gone, but variable cost rates have
crept up. Operating loss is improving slightly. Runway is critically short at 1.56 months
and was even shorter in March. Refunds improved, discounting worsened slightly.
The net assessment: growth is real but the path to profitability requires overhead
control and margin defence — a coherent CFO story for the dashboard.
