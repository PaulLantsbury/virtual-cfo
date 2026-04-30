-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 20260430000009 — Phase 2b Trend Intelligence RPCs
--
-- Creates three SECURITY DEFINER functions for the Trend Intelligence Layer:
--
--   month_on_month_delta(store_id, date_from, date_to)
--     Returns a single row of current + prior month values and all deltas,
--     including cash runway (computed inline from cash_balance_snapshots
--     because cash_runway_months() reads CURRENT_DATE and cannot be
--     parameterised by historical month).
--
--   rolling_3m_averages(store_id, date_from)
--     Returns average metrics over the 3 most recent months with trading data
--     (gross_revenue > 0 filter).  Runway average uses per-month cash/overhead
--     matching the same month filter.
--
--   cfo_alerts(store_id, date_from, date_to)
--     Returns one row per alert rule (13 rules) with alert_key, severity,
--     the relevant metric value, threshold, and whether it triggered.
--     Internally calls month_on_month_delta() — one shared fetch.
--
-- All functions:
--   LANGUAGE plpgsql  — multi-step variable assignments required
--   STABLE            — read-only; same result for same inputs in a transaction
--   SECURITY DEFINER  — runs as function owner (bypasses RLS for anon callers)
--   SET search_path = public, pg_temp  — mitigates search-path injection
--
-- DEPENDENCIES
--   Views   : v_monthly_metrics, v_month_on_month                 (000008)
--   Phase 2a: cash_runway_months, monthly_overhead_total          (000005)
--   Phase 1b: contribution_margin_pct                             (000003)
--   Tables  : cash_balance_snapshots, overhead_entries,
--             overhead_categories
--
-- EXPECTED ALERT OUTCOMES (April 2026, seeded dev store)
--   revenue_declining       → NOT triggered (+11.7% growth)
--   revenue_stall           → NOT triggered
--   margin_falling          → NOT triggered (−0.77pp < threshold of −1.5pp)
--   margin_critical         → NOT triggered (cm ≈ 88.7% > 70% floor)
--   refunds_rising          → TRIGGERED  (+1.15pp > +0.5pp threshold)
--   refunds_critical        → NOT triggered (2.47% < 8% floor)
--   discounts_rising        → TRIGGERED  (+1.89pp > +1.0pp threshold)
--   discounts_critical      → NOT triggered (2.04% < 15% floor)
--   overhead_outpacing_rev  → NOT triggered (overhead fell −2.9%, revenue +11.7%)
--   profit_deteriorating    → NOT triggered (profit improved +51%)
--   runway_low              → NOT triggered (1.56m > 1.0m critical floor)
--   runway_tightening       → TRIGGERED  (1.56m < 2.0m warning band)
--   runway_declining        → NOT triggered (runway improving vs prior month)
--   Active alerts: 3 of 13  (refunds_rising, discounts_rising, runway_tightening)
-- ═══════════════════════════════════════════════════════════════════════════

SET search_path TO public, pg_temp;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. month_on_month_delta
--
-- Reads from v_month_on_month for the supplied period_start and appends
-- runway data computed inline from cash_balance_snapshots.
--
-- Runway prior month:
--   v_prior_from = first day of the month preceding p_date_from
--   v_prior_to   = last  day of the month preceding p_date_from
--   Prior cash   = SUM(cash_balance) at the latest snapshot_date ≤ v_prior_to
--   Prior ovhd   = monthly_overhead_total(store, v_prior_from, v_prior_to)
--   runway_prv   = prior_cash / NULLIF(prior_ovhd, 0)
--
-- p_date_from must equal period_start in v_monthly_metrics (i.e., the first
-- day of a calendar month).  Non-month-start dates return no rows.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.month_on_month_delta(
  p_store_id   uuid,
  p_date_from  date,
  p_date_to    date
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
  runway_cur              numeric,
  runway_prv              numeric,
  runway_delta_months     numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row        record;
  v_prior_from date;
  v_prior_to   date;
  v_prior_cash numeric;
  v_prior_ovhd numeric;
  v_runway_cur numeric;
  v_runway_prv numeric;
BEGIN
  -- ── 1. Load the delta row from the view ────────────────────────────────────
  SELECT *
  INTO   v_row
  FROM   public.v_month_on_month
  WHERE  store_id     = p_store_id
    AND  period_start = p_date_from;

  IF NOT FOUND THEN
    RETURN; -- empty result set — caller receives zero rows
  END IF;

  -- ── 2. Current runway (live, always reads CURRENT_DATE snapshot) ───────────
  v_runway_cur := public.cash_runway_months(p_store_id);

  -- ── 3. Prior-month runway: cash at end of prior month / prior overhead ──────
  v_prior_from := date_trunc('month', p_date_from - interval '1 month')::date;
  v_prior_to   := (v_prior_from + interval '1 month')::date - 1;

  -- Most recent snapshot on or before the last day of the prior month
  SELECT COALESCE(SUM(s.cash_balance), 0)
  INTO   v_prior_cash
  FROM   public.cash_balance_snapshots s
  WHERE  s.store_id     = p_store_id
    AND  s.snapshot_date = (
           SELECT MAX(s2.snapshot_date)
           FROM   public.cash_balance_snapshots s2
           WHERE  s2.store_id     = p_store_id
             AND  s2.snapshot_date <= v_prior_to
         );

  v_prior_ovhd := public.monthly_overhead_total(
    p_store_id, v_prior_from, v_prior_to, 'actual'
  );

  v_runway_prv := v_prior_cash / NULLIF(v_prior_ovhd, 0);

  -- ── 4. Return the combined row ─────────────────────────────────────────────
  RETURN QUERY
  SELECT
    v_row.gross_revenue_cur,
    v_row.gross_revenue_prv,
    v_row.gross_revenue_delta_pct,
    v_row.net_sales_cur,
    v_row.net_sales_prv,
    v_row.net_sales_delta_pct,
    v_row.aov_cur,
    v_row.aov_prv,
    v_row.aov_delta_pct,
    v_row.refund_rate_cur,
    v_row.refund_rate_prv,
    v_row.refund_rate_delta_pp,
    v_row.discount_dep_cur,
    v_row.discount_dep_prv,
    v_row.discount_dep_delta_pp,
    v_row.rpr_cur,
    v_row.rpr_prv,
    v_row.rpr_delta_pp,
    v_row.cm_pct_cur,
    v_row.cm_pct_prv,
    v_row.cm_pct_delta_pp,
    v_row.op_profit_cur,
    v_row.op_profit_prv,
    v_row.op_profit_delta_pct,
    v_row.overhead_cur,
    v_row.overhead_prv,
    v_row.overhead_delta_pct,
    v_runway_cur,
    v_runway_prv,
    v_runway_cur - v_runway_prv;
END;
$$;

COMMENT ON FUNCTION public.month_on_month_delta(uuid, date, date) IS
  'Month-on-month delta for a single store and calendar month. '
  'Reads from v_month_on_month for pre-computed revenue and quality deltas. '
  'Runway is computed inline: '
  '  runway_cur = cash_runway_months() (live CURRENT_DATE based), '
  '  runway_prv = cash at prior month-end / prior monthly overhead. '
  'Returns 0 rows when no data exists for the supplied period_start. '
  'p_date_from must be the first day of a calendar month. '
  'Calls: v_month_on_month, cash_runway_months(), monthly_overhead_total(). '
  'Powers cfo_alerts().';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. rolling_3m_averages
--
-- Returns the average of each metric over the 3 months ending at p_date_from
-- (inclusive: T, T-1, T-2), excluding any months where gross_revenue = 0
-- (i.e., months with no trading data — empty months must not dilute averages).
--
-- Commerce metrics are averaged directly from v_monthly_metrics.
-- Runway average is computed separately per month using cash_balance_snapshots
-- and monthly_overhead_total(), restricted to the same months that pass the
-- gross_revenue > 0 filter.
--
-- p_date_from must be the first day of a calendar month.
-- Returns 0 rows if none of the 3 months have trading data.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rolling_3m_averages(
  p_store_id  uuid,
  p_date_from date
)
RETURNS TABLE (
  months_included         int,
  gross_revenue_3m_avg    numeric,
  net_sales_3m_avg        numeric,
  aov_3m_avg              numeric,
  cm_pct_3m_avg           numeric,
  fixed_overhead_3m_avg   numeric,
  operating_profit_3m_avg numeric,
  runway_3m_avg           numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_m0         date := p_date_from;
  v_m1         date := (p_date_from - interval '1 month')::date;
  v_m2         date := (p_date_from - interval '2 months')::date;
  v_runway_avg numeric;
  v_months_inc int;
BEGIN
  -- ── Per-month runway (only for months with trading data) ──────────────────
  -- For each of T, T-1, T-2: compute (cash at month-end) / (monthly overhead).
  -- The JOIN to v_monthly_metrics applies the gross_revenue > 0 filter so
  -- the runway denominator matches the commerce metric denominator exactly.
  SELECT
    AVG(
      (SELECT COALESCE(SUM(s.cash_balance), 0)
       FROM   public.cash_balance_snapshots s
       WHERE  s.store_id     = p_store_id
         AND  s.snapshot_date = (
                SELECT MAX(s2.snapshot_date)
                FROM   public.cash_balance_snapshots s2
                WHERE  s2.store_id     = p_store_id
                  AND  s2.snapshot_date <= (m.month_start + interval '1 month')::date - 1
              )
      ) / NULLIF(
        public.monthly_overhead_total(
          p_store_id,
          m.month_start,
          (m.month_start + interval '1 month')::date - 1,
          'actual'
        ),
        0
      )
    )
  INTO v_runway_avg
  FROM (VALUES (v_m0), (v_m1), (v_m2)) AS m(month_start)
  -- Only include months that passed the gross_revenue > 0 filter
  WHERE EXISTS (
    SELECT 1
    FROM   public.v_monthly_metrics mm
    WHERE  mm.store_id     = p_store_id
      AND  mm.period_start = m.month_start
      AND  mm.gross_revenue > 0
  );

  -- ── Commerce metric averages (gross_revenue > 0 months only) ──────────────
  RETURN QUERY
  SELECT
    COUNT(*)::int                          AS months_included,
    ROUND(AVG(mm.gross_revenue),       2)  AS gross_revenue_3m_avg,
    ROUND(AVG(mm.net_sales),           2)  AS net_sales_3m_avg,
    ROUND(AVG(mm.average_order_value), 2)  AS aov_3m_avg,
    ROUND(AVG(mm.contribution_margin_pct), 6) AS cm_pct_3m_avg,
    ROUND(AVG(mm.fixed_overhead_actual), 2) AS fixed_overhead_3m_avg,
    ROUND(AVG(mm.operating_profit),    2)  AS operating_profit_3m_avg,
    v_runway_avg                           AS runway_3m_avg
  FROM public.v_monthly_metrics mm
  WHERE mm.store_id     = p_store_id
    AND mm.period_start IN (v_m0, v_m1, v_m2)
    AND mm.gross_revenue > 0;
END;
$$;

COMMENT ON FUNCTION public.rolling_3m_averages(uuid, date) IS
  'Rolling 3-month averages for a store, ending at p_date_from (inclusive). '
  'Covers months T, T-1, T-2 where T = p_date_from. '
  'gross_revenue > 0 filter excludes months with no trading data so that '
  'empty months (no seed / future months) do not dilute averages. '
  'months_included = count of qualifying months (0, 1, 2, or 3). '
  'Runway average uses per-month cash_balance_snapshots / monthly_overhead_total, '
  'restricted to the same gross_revenue > 0 months. '
  'Returns 0 rows if no qualifying months exist. '
  'p_date_from must be the first day of a calendar month.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. cfo_alerts
--
-- Returns one row per alert rule (13 rules) describing whether each alert
-- condition is triggered for the given store and period.
--
-- Internally calls month_on_month_delta() once and applies threshold rules.
-- Returns all 13 rows regardless of whether each alert is triggered —
-- the frontend can filter to triggered=true for the active alert summary.
--
-- COLUMNS
--   alert_key   : machine-readable rule identifier (snake_case)
--   severity    : 'info' | 'warning' | 'critical'
--   metric      : which metric the rule monitors
--   current_val : current value of the monitored metric (delta or absolute)
--   threshold   : the comparison threshold that determines triggered
--   triggered   : TRUE when the alert condition is met
--
-- THRESHOLD CONSTANTS (named for maintainability and auditability)
--   revenue_decline_pct     : −5.0%       (gross_revenue delta < this)
--   margin_fall_pp          : −1.5pp      (cm_pct delta < this)
--   margin_critical_floor   :  70.0%      (cm_pct_cur < this)
--   refund_rise_pp          :  +0.5pp     (refund_rate delta > this)
--   refund_critical_floor   :   8.0%      (refund_rate_cur > this)
--   discount_rise_pp        :  +1.0pp     (discount_dep delta > this)
--   discount_critical_floor :  15.0%      (discount_dep_cur > this)
--   overhead_outpace_gap    :  +5.0pp     (overhead_delta − revenue_delta > this)
--   profit_deteriorate_pct  : −10.0%      (op_profit delta < this)
--   runway_low_months       :   1.0m      (runway_cur < this → critical)
--   runway_tighten_months   :   2.0m      (runway_cur < this, ≥ 1.0m → warning)
--   runway_decline_months   :  −0.25m     (runway delta < this → info)
--
-- NULL SAFETY
--   Delta-based alerts guard with IS NOT NULL checks so that the first month
--   in the view (no prior) does not produce false positives.
--   Absolute-threshold alerts (margin_critical, refunds_critical,
--   discounts_critical, runway_low) can fire even without prior-month data.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cfo_alerts(
  p_store_id   uuid,
  p_date_from  date,
  p_date_to    date
)
RETURNS TABLE (
  alert_key    text,
  severity     text,
  metric       text,
  current_val  numeric,
  threshold    numeric,
  triggered    boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- ── Named threshold constants ──────────────────────────────────────────────
  c_revenue_decline_pct     constant numeric :=  -5.0;
  c_margin_fall_pp          constant numeric :=  -1.5;
  c_margin_critical_floor   constant numeric :=  70.0;   -- percent (cm_pct × 100)
  c_refund_rise_pp          constant numeric :=   0.5;
  c_refund_critical_floor   constant numeric :=   8.0;   -- percent (refund_rate × 100)
  c_discount_rise_pp        constant numeric :=   1.0;
  c_discount_critical_floor constant numeric :=  15.0;   -- percent (discount_dep × 100)
  c_overhead_outpace_gap    constant numeric :=   5.0;   -- percentage-point gap
  c_profit_deteriorate_pct  constant numeric := -10.0;
  c_runway_low_months       constant numeric :=   1.0;
  c_runway_tighten_months   constant numeric :=   2.0;
  c_runway_decline_months   constant numeric :=  -0.25;

  -- ── Delta row from month_on_month_delta() ──────────────────────────────────
  r  record;
BEGIN
  -- Single call to month_on_month_delta — all 13 rules share this fetch
  SELECT * INTO r
  FROM public.month_on_month_delta(p_store_id, p_date_from, p_date_to);

  IF NOT FOUND THEN
    RETURN; -- no data for this period — return empty set
  END IF;

  RETURN QUERY

  -- ── 1. revenue_declining ───────────────────────────────────────────────────
  SELECT
    'revenue_declining'::text,
    'warning'::text,
    'gross_revenue'::text,
    r.gross_revenue_delta_pct,
    c_revenue_decline_pct::numeric,
    (r.gross_revenue_delta_pct IS NOT NULL
     AND r.gross_revenue_delta_pct < c_revenue_decline_pct)::boolean

  UNION ALL

  -- ── 2. revenue_stall (growth between decline threshold and 0%) ─────────────
  SELECT
    'revenue_stall',
    'info',
    'gross_revenue',
    r.gross_revenue_delta_pct,
    0.0,
    (r.gross_revenue_delta_pct IS NOT NULL
     AND r.gross_revenue_delta_pct >= c_revenue_decline_pct
     AND r.gross_revenue_delta_pct <= 0.0)::boolean

  UNION ALL

  -- ── 3. margin_falling (cm pp delta below warning threshold) ───────────────
  SELECT
    'margin_falling',
    'warning',
    'contribution_margin_pct',
    r.cm_pct_delta_pp,
    c_margin_fall_pp::numeric,
    (r.cm_pct_delta_pp IS NOT NULL
     AND r.cm_pct_delta_pp < c_margin_fall_pp)::boolean

  UNION ALL

  -- ── 4. margin_critical (absolute cm below 70% floor) ──────────────────────
  SELECT
    'margin_critical',
    'critical',
    'contribution_margin_pct',
    ROUND(r.cm_pct_cur * 100, 2),
    c_margin_critical_floor::numeric,
    (r.cm_pct_cur IS NOT NULL
     AND r.cm_pct_cur * 100 < c_margin_critical_floor)::boolean

  UNION ALL

  -- ── 5. refunds_rising (refund rate pp delta above warning threshold) ───────
  SELECT
    'refunds_rising',
    'warning',
    'refund_rate',
    r.refund_rate_delta_pp,
    c_refund_rise_pp::numeric,
    (r.refund_rate_delta_pp IS NOT NULL
     AND r.refund_rate_delta_pp > c_refund_rise_pp)::boolean

  UNION ALL

  -- ── 6. refunds_critical (absolute refund rate above 8% floor) ─────────────
  SELECT
    'refunds_critical',
    'critical',
    'refund_rate',
    ROUND(r.refund_rate_cur * 100, 2),
    c_refund_critical_floor::numeric,
    (r.refund_rate_cur IS NOT NULL
     AND r.refund_rate_cur * 100 > c_refund_critical_floor)::boolean

  UNION ALL

  -- ── 7. discounts_rising (discount dep pp delta above warning threshold) ────
  SELECT
    'discounts_rising',
    'warning',
    'discount_dependency',
    r.discount_dep_delta_pp,
    c_discount_rise_pp::numeric,
    (r.discount_dep_delta_pp IS NOT NULL
     AND r.discount_dep_delta_pp > c_discount_rise_pp)::boolean

  UNION ALL

  -- ── 8. discounts_critical (absolute discount dep above 15% floor) ──────────
  SELECT
    'discounts_critical',
    'critical',
    'discount_dependency',
    ROUND(r.discount_dep_cur * 100, 2),
    c_discount_critical_floor::numeric,
    (r.discount_dep_cur IS NOT NULL
     AND r.discount_dep_cur * 100 > c_discount_critical_floor)::boolean

  UNION ALL

  -- ── 9. overhead_outpacing_revenue ─────────────────────────────────────────
  -- Overhead is growing faster than revenue by more than the gap threshold.
  -- current_val = (overhead_delta_pct − gross_revenue_delta_pct).
  SELECT
    'overhead_outpacing_revenue',
    'warning',
    'fixed_overhead_actual',
    ROUND(COALESCE(r.overhead_delta_pct, 0) - COALESCE(r.gross_revenue_delta_pct, 0), 1),
    c_overhead_outpace_gap::numeric,
    (r.overhead_delta_pct IS NOT NULL
     AND r.gross_revenue_delta_pct IS NOT NULL
     AND (r.overhead_delta_pct - r.gross_revenue_delta_pct) > c_overhead_outpace_gap)::boolean

  UNION ALL

  -- ── 10. profit_deteriorating (op_profit delta worse than −10%) ─────────────
  SELECT
    'profit_deteriorating',
    'warning',
    'operating_profit',
    r.op_profit_delta_pct,
    c_profit_deteriorate_pct::numeric,
    (r.op_profit_delta_pct IS NOT NULL
     AND r.op_profit_delta_pct < c_profit_deteriorate_pct)::boolean

  UNION ALL

  -- ── 11. runway_low (cash runway below 1.0-month critical floor) ────────────
  SELECT
    'runway_low',
    'critical',
    'cash_runway_months',
    r.runway_cur,
    c_runway_low_months::numeric,
    (r.runway_cur IS NOT NULL
     AND r.runway_cur < c_runway_low_months)::boolean

  UNION ALL

  -- ── 12. runway_tightening (runway in the 1.0–2.0 month warning band) ───────
  SELECT
    'runway_tightening',
    'warning',
    'cash_runway_months',
    r.runway_cur,
    c_runway_tighten_months::numeric,
    (r.runway_cur IS NOT NULL
     AND r.runway_cur >= c_runway_low_months
     AND r.runway_cur < c_runway_tighten_months)::boolean

  UNION ALL

  -- ── 13. runway_declining (runway shrinking by > 0.25 months MoM) ──────────
  SELECT
    'runway_declining',
    'info',
    'cash_runway_months',
    r.runway_delta_months,
    c_runway_decline_months::numeric,
    (r.runway_delta_months IS NOT NULL
     AND r.runway_delta_months < c_runway_decline_months)::boolean;

END;
$$;

COMMENT ON FUNCTION public.cfo_alerts(uuid, date, date) IS
  'CFO alert rules for a store and period. Returns 13 rows (one per rule). '
  'Calls month_on_month_delta() once; all rules share that fetch. '
  'triggered = TRUE when the alert condition is met for the current data. '
  'The full set of 13 rows is always returned — filter on triggered=true for '
  'the active alert summary. '
  'Severity levels: info | warning | critical. '
  'Expected active alerts for April 2026 dev store: '
  '  refunds_rising (+1.15pp), discounts_rising (+1.89pp), '
  '  runway_tightening (1.56m in warning band). '
  'margin_falling NOT triggered: −0.77pp delta < −1.5pp threshold. '
  'SECURITY DEFINER — runs as function owner, bypasses RLS for anon callers.';
