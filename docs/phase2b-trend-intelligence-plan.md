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

### Existing tables accessed by Phase 2b views and RPCs

No new tables are introduced. The following existing Phase 1 and Phase 2a tables are
accessed — some directly by the new views/RPCs, others indirectly through the existing
RPC call chain:

| Table | Phase | How accessed in Phase 2b |
|---|---|---|
| `stores` | Phase 1 | Directly — `v_monthly_metrics` CROSS JOINs `stores` to enumerate store IDs |
| `orders` | Phase 1 | Via Phase 1 RPCs: `gross_revenue()`, `net_sales()`, `average_order_value()`, `order_count()`, `discount_dependency()`, `refund_rate()`, `return_amount()`, `repeat_purchase_rate()` |
| `customers` | Phase 1 | Via `repeat_purchase_rate()`, which JOINs `customers` for `first_order_at` |
| `store_cost_assumptions` | Phase 1 | Via `contribution_margin_pct()`, which reads `v_current_cost_assumptions` |
| `overhead_categories` | Phase 2a | Via `monthly_overhead_total()`, which JOINs `overhead_categories` for `is_active` filter |
| `overhead_entries` | Phase 2a | Via `monthly_overhead_total()`, which aggregates `overhead_entries.amount` |
| `cash_balance_snapshots` | Phase 2a | Directly — `month_on_month_delta()` queries this table inline to compute prior-month runway |

All seven tables exist in the current schema. Phase 2b adds no columns, no constraints,
and no new tables to any of them.

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
to April 2026. **The seed is designed so that March has higher margin quality than
April** — this makes April's margin compression real and computable from live data,
which is a more useful and interesting CFO signal than the reverse.

**CFO story (Option B — margin compression):**
March was a smaller-volume, higher-quality month: fewer orders, premium product mix,
lower refund rate, less discounting, higher AOV, and therefore higher contribution
margin. April saw a volume surge — more orders, mix shift toward lower-priced products,
heavier promotional activity, and more refunds. Revenue grew strongly but margin
quality deteriorated. The overhead normalisation (March payroll spike of £82k resolved
to £80k in April) partially offset the margin compression, so the operating loss
improved despite the quality decline. Cash runway remains critically short in both
months.

**Target metrics:**

| Metric | March 2026 (seed target) | April 2026 (live) | MoM (Apr vs Mar) |
|---|---|---|---|
| gross_revenue | ~£148,000 | £167,853 | ↑ +13.4% |
| net_sales | ~£115,000 | £122,921 | ↑ +6.9% |
| average_order_value | ~£67 | £61.93 | ↓ −7.6% (mix shift to lower-price products) |
| refund_rate | ~2.50% | 3.62% | ↑ +1.1pp (April worse — more returns at higher volume) |
| discount_dependency | ~2.00% | 3.93% | ↑ +1.9pp (April worse — heavier promotion) |
| repeat_purchase_rate | ~67.0% | 71.43% | ↑ +4.4pp (April better — retention improving) |
| contribution_margin_pct | ~90.3% | ~88.7% | ↓ −1.6pp (April worse — lower AOV raises per-order cost ratio) |
| operating_profit | ~−£19,000 | −£10,184 | ↑ +46% (April better — overhead fell £3.6k, revenue grew) |
| fixed overhead (actual) | £122,800 | £119,200 | ↓ −2.9% (April lower — March payroll spike resolved) |
| cash_runway | ~1.45 months | ~1.56 months | ↑ +0.11 months (April slightly better) |

**How March CM ~90.3% is achieved:**
The `contribution_margin_pct()` formula uses fixed cost rates from `store_cost_assumptions`
(unchanged for both months). CM is driven by:
- **AOV effect:** per-order variable costs (£3.50 fulfilment + £1.25 packaging = £4.75)
  are a smaller fraction of net_sales when AOV is higher. March AOV ~£67 vs April £62 →
  March per-order costs represent a lower share of revenue → higher March CM.
- **Refund effect:** return_handling_cost = 15% × refund_amount. March refund_rate ~2.5%
  vs April 3.62% → lower March return_handling_cost → higher March CM.

**Seed design to achieve these targets:**
- Higher-AOV product mix in March (premium product slot at ~£95–100 gross price,
  higher proportion of the cycle vs April's more dispersed mix).
- Fewer discounted orders (~15% vs April's 25%) and lower discount amounts.
- Fewer refunded orders — Loop B scale reduced (partially refunded share ~3.5% of orders
  vs April's ~3.5%, but fully refunded reduced to ~1.3% vs April's ~1.2%, with lower
  refund amounts per partially-refunded order).
- Refund rate target ~2.5% is achieved through smaller partial refund amounts on Loop B
  orders rather than a different batch count.

**Operating profit arithmetic — both months negative:**
```
March: ~£115,000 × 90.3% − £122,800 = £103,845 − £122,800 = −£18,955 ≈ −£19,000
April: £122,921 × 88.7% − £119,200 = £109,031 − £119,200 = −£10,169 ≈ −£10,184

MoM delta: (−10,184 − (−19,000)) / ABS(−19,000) × 100 = +8,816 / 19,000 = +46.4%
(positive = April improved, i.e. smaller loss)
```

**CFO alerts that will fire for April 2026:**
- `margin_falling` — cm_pct_delta_pp = −1.6pp < threshold −1.5pp ✓
- `refunds_rising` — refund_rate_delta_pp = +1.1pp > threshold +0.5pp ✓
- `discounts_rising` — discount_dep_delta_pp = +1.9pp > threshold +1.0pp ✓
- `runway_tightening` — runway_cur = 1.56 months (warning, BETWEEN 1.0 AND 2.0) ✓
- `profit_deteriorating` — NO (op_profit improved +46%, delta is positive)
- `revenue_declining` — NO (gross revenue up +13.4%)

**Scale:** March seed uses ~1,736 new orders (≈86% of April's 2,011 new orders).
Same customer pool (c01–c20). Premium product mix as described above.

**Batch structure (aligned with April's three-loop pattern):**
- Loop A (paid): ~1,653 orders, premium product cycle, ~15% discounted, ~9% guest
- Loop B (partially refunded): ~61 orders, smaller partial refund amounts than April
- Batch C (fully refunded): ~22 orders

**Idempotency:** All INSERTs use `ON CONFLICT DO NOTHING`.

**Schema-adaptive:** Same `is_cloud` detection pattern as migration 000006
(`shopify_order_id BIGINT` vs `TEXT`, column name differences).

**Shopify order ID range:** Use 60001–61736 to avoid collision with April's 50001–52125
and the original 20001–20195 dev orders. (1,736 new March orders: Loop A 60001–61653,
Loop B 61654–61714, Batch C 61715–61736.)

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
- **Money metrics** (gross_revenue, net_sales, AOV): relative % change.
  Formula: `(cur − prv) / ABS(prv) × 100`. `ABS(prv)` is used universally
  as the denominator so the formula is safe even when the prior value is negative.
  For these three metrics prior values are always ≥ 0 (COALESCE'd), so ABS() is
  redundant but kept for consistency with operating_profit (see below).
- **Ratio metrics** (refund_rate, discount_dependency, repeat_purchase_rate,
  contribution_margin_pct): absolute percentage-point change.
  Formula: `(cur − prv) × 100` (input values are ratios in [0,1]).
  A move from 3.75% to 3.62% refund rate is −0.13pp, not −3.5% relative.
- **Fixed overhead**: relative % change, same formula as money metrics.
- **Operating profit — critical formula note:**
  Formula: `(cur − prv) / ABS(prv) × 100`.
  `ABS(prv)` is **required here**, not optional. Both months produce negative values
  (the business is loss-making). Without ABS():
  ```
  cur = −£10,184   prv = −£19,000
  naive:   (−10,184 − (−19,000)) / (−19,000) × 100 = 8,816 / −19,000 = −46.4%
           → wrongly signals profit deteriorated
  correct: (−10,184 − (−19,000)) / ABS(−19,000) × 100 = 8,816 / 19,000 = +46.4%
           → correctly signals profit improved (smaller loss)
  ```
  The migration SQL for operating_profit delta **must** use `ABS(prv.operating_profit)`,
  not `prv.operating_profit`, in the denominator. This applies in `v_month_on_month`
  and is replicated in `month_on_month_delta()` if the RPC computes deltas inline.

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

**Formula:** Average of months T, T−1, T−2, where T = `p_date_from`.

**Zero-revenue month treatment:**
All Phase 1 metric functions use `COALESCE(..., 0)` — a month with no orders returns
`0` for gross_revenue, net_sales, and all commerce metrics, not `NULL`. Without an
explicit filter, months with zero trading data (January and February 2026 currently
have no orders seeded) would be included in the `AVG()` as zero values, distorting the
rolling average downward.

**Example without filter:**
```
AVG(gross_revenue for Feb, Mar, Apr) = AVG(0, 149000, 167853) / 3 = £105,618
```
**Example with filter:**
```
AVG(gross_revenue for Mar, Apr only) = AVG(149000, 167853) / 2 = £158,427
```

**Implementation:** The RPC queries `v_monthly_metrics` for the three candidate months
and applies a `WHERE gross_revenue > 0` filter to exclude months with no trading data.
This uses `gross_revenue` as the sentinel because it is the most fundamental metric —
a month with zero gross revenue has no order data and should not contribute to averages.

```sql
-- Conceptual implementation (not final SQL):
SELECT
  AVG(gross_revenue)          AS gross_revenue_3m_avg,
  AVG(net_sales)              AS net_sales_3m_avg,
  AVG(contribution_margin_pct) AS cm_pct_3m_avg,
  AVG(fixed_overhead_actual)  AS fixed_overhead_3m_avg,
  AVG(operating_profit)       AS operating_profit_3m_avg
FROM public.v_monthly_metrics
WHERE store_id = p_store_id
  AND period_start IN (
    p_date_from,
    (p_date_from - interval '1 month')::date,
    (p_date_from - interval '2 months')::date
  )
  AND gross_revenue > 0;  -- exclude months with no trading data
```

**Assumption:** A month where `gross_revenue = 0` is treated as a month with no trading
data for the purpose of rolling averages. This is correct for the current seed structure
(Jan/Feb 2026 have no orders). If a live production month genuinely had £0 gross revenue,
the average would exclude that month too — acceptable and documented.

**Runway rolling average:** `cash_runway_months()` is not in `v_monthly_metrics`.
The `runway_3m_avg` column is computed separately inside this RPC by querying
`cash_balance_snapshots` for the three prior snapshot dates and dividing each by
the corresponding month's `monthly_overhead_total()`. Months without a cash snapshot
contribute NULL (excluded from AVG by default in Postgres).

**Why only 6 metrics (not all 10):** Rolling averages are most meaningful for
magnitudes that vary with business cycles. Ratio metrics (refund_rate, discount_dep,
rpr) are better expressed as the most-recent period value with a MoM delta; a 3-month
average of a ratio obscures trend direction.

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
| `20260430000007_phase2b_march_seed.sql` | March 2026 orders + customers seed (~1,736 orders, premium mix) | 1 |
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
-- Expected: ~1,653 paid, ~61 partially_refunded, ~22 refunded (total ~1,736 new orders)
-- (86% scale of April's 2,011 new orders, split across three batches matching Loop A / Loop B / Batch C pattern)

-- 2. March 2026 metric spot-checks
SELECT
  public.gross_revenue('10000000-0000-0000-0000-000000000001', '2026-03-01', '2026-03-31'),
  public.net_sales('10000000-0000-0000-0000-000000000001', '2026-03-01', '2026-03-31'),
  public.average_order_value('10000000-0000-0000-0000-000000000001', '2026-03-01', '2026-03-31'),
  public.refund_rate('10000000-0000-0000-0000-000000000001', '2026-03-01', '2026-03-31'),
  public.discount_dependency('10000000-0000-0000-0000-000000000001', '2026-03-01', '2026-03-31'),
  public.contribution_margin_pct('10000000-0000-0000-0000-000000000001', '2026-03-01', '2026-03-31');
-- Expected: gross ~£148k, net ~£115k, AOV ~£67, refund ~2.5%, discount ~2.0%, cm ~90.3%

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
-- Expected: gross_revenue_delta_pct ~+13.4%, cm_pct_delta_pp ~−1.6pp (April worse),
--           refund_rate_delta_pp ~+1.1pp (April worse), discount_dep_delta_pp ~+1.9pp (April worse),
--           op_profit_delta_pct ~+46% (April improved — smaller loss), overhead_delta_pct ~−2.9%

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
-- Expected triggered alerts:
--   'margin_falling'    (warning)  — cm_pct_delta_pp ~−1.6pp, below −1.5pp threshold
--   'refunds_rising'    (warning)  — refund_rate_delta_pp ~+1.1pp, above +0.5pp threshold
--   'discounts_rising'  (warning)  — discount_dep_delta_pp ~+1.9pp, above +1.0pp threshold
--   'runway_tightening' (warning)  — runway_cur ~1.56 months (BETWEEN 1.0 AND 2.0; NOT critical)
-- Note: 'runway_low' (critical) requires runway_cur < 1.0 — does NOT fire at 1.56 months
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

For reference when writing the March 2026 seed and validating deltas.
**March targets reflect Option B (margin compression design)** — March has higher margin
quality than April, making the MoM delta a real signal of quality deterioration under volume.

| Metric | March 2026 (seed target) | April 2026 (live) | MoM delta (Apr vs Mar) |
|---|---|---|---|
| gross_revenue | ~£148,000 | £167,853 | ↑ +13.4% |
| net_sales | ~£115,000 | £122,921 | ↑ +6.9% |
| average_order_value | ~£67.00 | £61.93 | ↓ −7.6% (mix shift to lower-price products) |
| refund_rate | ~2.50% | 3.62% | ↑ +1.1pp (April worse — more returns at volume) |
| discount_dependency | ~2.00% | 3.93% | ↑ +1.9pp (April worse — heavier promotion) |
| repeat_purchase_rate | ~67.0% | 71.43% | ↑ +4.4pp (April better — retention improving) |
| contribution_margin_pct | ~90.3% | ~88.7% | ↓ −1.6pp (April worse — lower AOV raises variable cost ratio) |
| operating_profit | ~−£19,000 | −£10,184 | ↑ +46.4% (April better — overhead fell, revenue grew) |
| fixed_overhead_actual | £122,800 | £119,200 | ↓ −2.9% (March payroll spike resolved in April) |
| cash_runway | ~1.45 months | ~1.56 months | ↑ +0.11 months |

**Operating profit arithmetic (both months negative — ABS denominator required):**
```
March contribution: £115,000 × 90.3% = £103,845
March op_profit:    £103,845 − £122,800 = −£18,955 ≈ −£19,000

April contribution: £122,921 × 88.7% = £109,031
April op_profit:    £109,031 − £119,200 = −£10,169 ≈ −£10,184

MoM delta: (−10,184 − (−19,000)) / ABS(−19,000) × 100 = +8,816 / 19,000 ≈ +46.4%
```

**CFO story this tells:**
April saw a volume surge — revenue up +13.4% — but the business traded quality for
quantity. AOV fell (−7.6%) as the product mix shifted to lower-priced items. Refund
rate increased (+1.1pp) and discount activity intensified (+1.9pp). Contribution margin
compressed by −1.6pp, crossing the −1.5pp `margin_falling` alert threshold. The March
overhead spike (payroll) resolved, reducing fixed costs by £3,600 and — combined with
the revenue growth — cut the operating loss nearly in half (+46%). Repeat purchase rate
improved (+4.4pp), suggesting retention is strengthening even as quality metrics wane.
Cash runway is critically short in both months (1.45 → 1.56 months), improving slightly
but not meaningfully.

**CFO assessment:** Growth is accelerating, but the path to profitability requires
defending contribution margin — not just growing revenue. The volume-driven AOV
compression and rising refund/discount rates are early warning signs that need to be
addressed before overhead can be outgrown.

**Alerts firing for April 2026:**
- `margin_falling` (warning) — −1.6pp compression
- `refunds_rising` (warning) — +1.1pp increase
- `discounts_rising` (warning) — +1.9pp increase
- `runway_tightening` (warning) — 1.56 months remaining
