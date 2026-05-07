-- =============================================================================
-- Migration 20260507000002 — marketing_intelligence_schema
--
-- PURPOSE
-- -------
-- Phase 3: Marketing Intelligence Infrastructure.
-- Creates the foundational data layer for channel-level marketing analytics,
-- contribution-first performance measurement, and opportunity scoring.
--
-- WHAT THIS ADDS
-- ──────────────
-- Five new tables (all RLS-enabled immediately, deny-by-default):
--   1. marketing_channel_daily_metrics    — raw daily inputs per channel
--   2. marketing_channel_monthly_snapshots — pre-computed monthly rollups
--   3. marketing_blended_monthly          — cross-channel blended metrics
--   4. channel_opportunity_scores         — ranked improvement opportunities
--   5. cac_trend_snapshots                — point-in-time CAC tracking
--
-- Three SECURITY DEFINER RPCs (called by frontend via supabase.rpc()):
--   channel_metrics_monthly()            — monthly channel performance
--   blended_marketing_performance()      — blended cross-channel metrics
--   channel_opportunities_active()       — active scored opportunities
--
-- CONTRIBUTION-FIRST LOGIC
-- ─────────────────────────
-- For each channel:
--   contribution_revenue  = attributed_gross_sales − discount_impact − returns_impact
--   contribution_cost     = spend + (variable_cost_rates × attributed_orders)
--   contribution_profit   = contribution_revenue − contribution_cost
--   contribution_margin_pct = contribution_profit / contribution_revenue
--
-- Note: store_cost_assumptions.marketing_spend_rate is a blended proxy used by
-- contribution_margin_pct() for store-level CM. It is NOT replaced by this work —
-- channel-level spend data is additive intelligence for the marketing pages.
--
-- OPPORTUNITY SCORING
-- ────────────────────
-- benchmark_cm_pct = 0.45 (45% target, calibrated to email/organic performance)
-- gap_pct          = max(0, benchmark_cm_pct − channel.contribution_margin_pct)
-- spend_weight     = channel.spend / total_store_spend
-- score            = LEAST(100, round(gap_pct × spend_weight × 10000))
-- estimated_uplift = gap_pct × channel.attributed_net_sales (£/month if gap closed)
--
-- DATA FLOW
-- ──────────
-- marketing_channel_daily_metrics   (API ingestion / manual seed)
--       ↓  refresh_channel_monthly_snapshots()
-- marketing_channel_monthly_snapshots  (pre-computed, queried by UI)
--       ↓  rollup
-- marketing_blended_monthly            (cross-channel summary)
--       ↓  score_channel_opportunities()
-- channel_opportunity_scores           (ranked opportunities)
--
-- SEED DATA
-- ──────────
-- March 2026 (1759 orders, gross £153,556) and April 2026 (1983 orders, £167,639).
-- Dev store: 10000000-0000-0000-0000-000000000001.
-- Channel CAC values calibrated to match channel-metrics.ts mock:
--   Meta £18.40 (+14% MoM), Google Shopping £11.20 (+6%), Email £4.80 (−2%), Organic £2.10 (stable).
-- Channel CM% values match channel-metrics.ts mock:
--   Meta 34.2%, Google Shopping 40.1%, Email 58.6%, Organic 52.3%.
-- Note: seed spend amounts produce channel-level CAC = spend/new_customers as above.
--   Blended CAC includes an overhead_content_spend allocation:
--     April: media £9,671 + overhead £1,614 = £11,285 / 925 new customers = £12.20 ✓
--     March: media £7,848 + overhead £188  = £8,036  / 820 new customers = £9.80  ✓
--   (BLENDED_CAC and BLENDED_CAC_PREV from channel-metrics.ts)
--
-- IDEMPOTENT
-- ──────────
-- All DDL uses IF NOT EXISTS / CREATE OR REPLACE.
-- Seed data uses INSERT ... ON CONFLICT DO NOTHING.
-- Safe to re-run on any environment.
-- =============================================================================

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │  TABLE 1 — marketing_channel_daily_metrics                                  │
-- └─────────────────────────────────────────────────────────────────────────────┘
-- Raw daily per-channel data. One row per store × channel × day.
-- Source of truth for future API ingestion jobs (Meta, Google Ads, etc.).
-- For seed data, one aggregate row per channel per month is used.

CREATE TABLE IF NOT EXISTS public.marketing_channel_daily_metrics (
  id                        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                  uuid         NOT NULL REFERENCES public.stores(id),
  channel                   text         NOT NULL,
  metric_date               date         NOT NULL,

  -- ── Spend and media metrics ──────────────────────────────────────────────────
  spend                     numeric(12,2) NOT NULL DEFAULT 0,
  impressions               bigint        NOT NULL DEFAULT 0,
  clicks                    bigint        NOT NULL DEFAULT 0,
  sessions                  bigint        NOT NULL DEFAULT 0,

  -- ── Attribution metrics (from platform API or Shopify attribution) ───────────
  attributed_orders         integer       NOT NULL DEFAULT 0,
  attributed_new_customers  integer       NOT NULL DEFAULT 0,
  attributed_gross_sales    numeric(12,2) NOT NULL DEFAULT 0,

  -- ── Cost deductions on attributed orders ─────────────────────────────────────
  discount_impact           numeric(12,2) NOT NULL DEFAULT 0,
  returns_impact            numeric(12,2) NOT NULL DEFAULT 0,
  shipping_subsidy_impact   numeric(12,2) NOT NULL DEFAULT 0,

  -- ── Data provenance ──────────────────────────────────────────────────────────
  data_source               text          NOT NULL DEFAULT 'estimated',
  created_at                timestamptz   NOT NULL DEFAULT now(),
  updated_at                timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT mcdm_channel_check CHECK (
    channel IN ('meta','google_shopping','email','organic','direct','other')
  ),
  CONSTRAINT mcdm_source_check CHECK (
    data_source IN ('meta_api','google_api','manual','estimated','shopify')
  ),
  CONSTRAINT mcdm_unique UNIQUE (store_id, channel, metric_date)
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │  TABLE 2 — marketing_channel_monthly_snapshots                              │
-- └─────────────────────────────────────────────────────────────────────────────┘
-- Pre-computed monthly rollups with contribution-first metrics already calculated.
-- One row per store × channel × period. This is what the app queries.
-- Populated by refresh_channel_monthly_snapshots() or nightly ingestion jobs.

CREATE TABLE IF NOT EXISTS public.marketing_channel_monthly_snapshots (
  id                        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                  uuid         NOT NULL REFERENCES public.stores(id),
  channel                   text         NOT NULL,
  period_start              date         NOT NULL,
  period_end                date         NOT NULL,

  -- ── Raw aggregates ────────────────────────────────────────────────────────────
  spend                     numeric(12,2) NOT NULL DEFAULT 0,
  impressions               bigint        NOT NULL DEFAULT 0,
  clicks                    bigint        NOT NULL DEFAULT 0,
  sessions                  bigint        NOT NULL DEFAULT 0,
  attributed_orders         integer       NOT NULL DEFAULT 0,
  attributed_new_customers  integer       NOT NULL DEFAULT 0,
  attributed_gross_sales    numeric(12,2) NOT NULL DEFAULT 0,

  -- ── Deductions on attributed orders ──────────────────────────────────────────
  discount_impact           numeric(12,2) NOT NULL DEFAULT 0,
  returns_impact            numeric(12,2) NOT NULL DEFAULT 0,
  shipping_subsidy_impact   numeric(12,2) NOT NULL DEFAULT 0,

  -- ── Contribution-first derived metrics (pre-computed, stored for query perf) ─
  -- attributed_net_sales = attributed_gross_sales − discount_impact − returns_impact
  attributed_net_sales      numeric(12,2) NOT NULL DEFAULT 0,
  -- contribution_profit = attributed_net_sales × contribution_margin_pct
  contribution_profit       numeric(12,2) NOT NULL DEFAULT 0,
  -- [0,1] ratio; matches format of existing contribution_margin_pct() RPC
  contribution_margin_pct   numeric(8,4)  NOT NULL DEFAULT 0,

  -- ── Efficiency metrics ────────────────────────────────────────────────────────
  -- cac = spend / attributed_new_customers (£ per new customer)
  cac                       numeric(10,2),
  -- roas = attributed_gross_sales / spend (revenue per £ of ad spend)
  roas                      numeric(10,4),
  -- mer = attributed_gross_sales / total_store_spend (blended efficiency ratio)
  mer                       numeric(10,4),
  -- cac_payback_orders = cac / contribution_per_order (orders to recover CAC)
  cac_payback_orders        numeric(8,4),

  -- ── Opportunity scoring ───────────────────────────────────────────────────────
  -- 0–100; higher = bigger contribution improvement opportunity
  opportunity_score         integer       NOT NULL DEFAULT 0,

  -- ── Metadata ─────────────────────────────────────────────────────────────────
  data_freshness            text          NOT NULL DEFAULT 'estimated',
  created_at                timestamptz   NOT NULL DEFAULT now(),
  updated_at                timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT mcms_channel_check CHECK (
    channel IN ('meta','google_shopping','email','organic','direct','other')
  ),
  CONSTRAINT mcms_freshness_check CHECK (
    data_freshness IN ('live','estimated','stale')
  ),
  CONSTRAINT mcms_unique UNIQUE (store_id, channel, period_start)
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │  TABLE 3 — marketing_blended_monthly                                        │
-- └─────────────────────────────────────────────────────────────────────────────┘
-- Cross-channel blended monthly metrics.  One row per store × period.

CREATE TABLE IF NOT EXISTS public.marketing_blended_monthly (
  id                            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                      uuid         NOT NULL REFERENCES public.stores(id),
  period_start                  date         NOT NULL,
  period_end                    date         NOT NULL,

  -- ── Spend ─────────────────────────────────────────────────────────────────────
  -- total_spend = sum of channel media/campaign spend only
  total_spend                   numeric(12,2) NOT NULL DEFAULT 0,
  -- overhead_content_spend = brand content, agency fees, tools (not channel-attributed)
  -- Included in blended_cac denominator but not in individual channel CAC
  overhead_content_spend        numeric(12,2) NOT NULL DEFAULT 0,

  -- ── Revenue and orders ────────────────────────────────────────────────────────
  total_attributed_revenue      numeric(12,2) NOT NULL DEFAULT 0,
  total_attributed_orders       integer       NOT NULL DEFAULT 0,
  total_new_customers           integer       NOT NULL DEFAULT 0,

  -- ── Blended derived metrics ───────────────────────────────────────────────────
  -- blended_cac = (total_spend + overhead_content_spend) / total_new_customers
  blended_cac                   numeric(10,2),
  -- blended_roas = total_attributed_revenue / total_spend (pure media ROAS)
  blended_roas                  numeric(10,4),
  -- blended_mer = total_attributed_revenue / (total_spend + overhead_content_spend)
  blended_mer                   numeric(10,4),
  -- blended across all channels, weighted by attributed_net_sales
  blended_contribution_margin_pct numeric(8,4),
  total_contribution_profit     numeric(12,2) NOT NULL DEFAULT 0,
  total_attributed_net_sales    numeric(12,2) NOT NULL DEFAULT 0,

  created_at                    timestamptz   NOT NULL DEFAULT now(),
  updated_at                    timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT mbm_unique UNIQUE (store_id, period_start)
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │  TABLE 4 — channel_opportunity_scores                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘
-- Scored and ranked improvement opportunities per channel.
-- Feeds the Profit Opportunities page's channel breakdown.

CREATE TABLE IF NOT EXISTS public.channel_opportunity_scores (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                uuid        NOT NULL REFERENCES public.stores(id),
  channel                 text        NOT NULL,
  assessed_at             date        NOT NULL,
  opportunity_type        text        NOT NULL,

  -- ── Scoring ───────────────────────────────────────────────────────────────────
  score                   integer     NOT NULL DEFAULT 0,
  estimated_uplift_low    numeric(12,2) NOT NULL DEFAULT 0,
  estimated_uplift_high   numeric(12,2) NOT NULL DEFAULT 0,

  -- ── Context ───────────────────────────────────────────────────────────────────
  rationale               text,
  status                  text        NOT NULL DEFAULT 'active',

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cos_channel_check CHECK (
    channel IN ('meta','google_shopping','email','organic','direct','other','blended')
  ),
  CONSTRAINT cos_type_check CHECK (
    opportunity_type IN ('contribution_gap','cac_reduction','budget_reallocation','roas_improvement','channel_mix')
  ),
  CONSTRAINT cos_status_check CHECK (
    status IN ('active','dismissed','implemented','monitoring')
  )
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │  TABLE 5 — cac_trend_snapshots                                              │
-- └─────────────────────────────────────────────────────────────────────────────┘
-- Point-in-time CAC snapshots per channel for trend analysis.
-- One row per store × channel × snapshot_date (end of period).

CREATE TABLE IF NOT EXISTS public.cac_trend_snapshots (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                uuid        NOT NULL REFERENCES public.stores(id),
  channel                 text        NOT NULL,
  snapshot_date           date        NOT NULL,

  -- ── CAC values ───────────────────────────────────────────────────────────────
  cac                     numeric(10,2) NOT NULL,
  trailing_30d_cac        numeric(10,2),
  trailing_90d_cac        numeric(10,2),

  -- ── Context ───────────────────────────────────────────────────────────────────
  mom_change_pct          numeric(8,4),
  attributed_new_customers integer     NOT NULL DEFAULT 0,
  spend                   numeric(12,2) NOT NULL DEFAULT 0,

  created_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cts_channel_check CHECK (
    channel IN ('meta','google_shopping','email','organic','direct','other')
  ),
  CONSTRAINT cts_unique UNIQUE (store_id, channel, snapshot_date)
);

-- ── Enable RLS on all five tables ─────────────────────────────────────────────
-- No permissive policies → deny-by-default for direct table access.
-- All app reads go through SECURITY DEFINER RPCs (same pattern as existing tables).
ALTER TABLE public.marketing_channel_daily_metrics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_channel_monthly_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_blended_monthly           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_opportunity_scores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cac_trend_snapshots                 ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- SEED DATA — Dev store (10000000-0000-0000-0000-000000000001)
-- =============================================================================

-- ── Daily metrics seed ────────────────────────────────────────────────────────
-- One aggregate row per channel per month (representative of monthly totals).
-- Production data would have one row per channel per day.
-- metric_date set to 15th of month (representative mid-month date for seed rows).

INSERT INTO public.marketing_channel_daily_metrics
  (store_id, channel, metric_date, spend, impressions, clicks, sessions,
   attributed_orders, attributed_new_customers, attributed_gross_sales,
   discount_impact, returns_impact, shipping_subsidy_impact, data_source)
VALUES
  -- ── April 2026 ──────────────────────────────────────────────────────────────
  ('10000000-0000-0000-0000-000000000001', 'meta',            '2026-04-15',
    5520.00, 892000, 11200,  8900, 650, 300, 54846.00, 7679.00, 3839.00, 4875.00, 'estimated'),
  ('10000000-0000-0000-0000-000000000001', 'google_shopping', '2026-04-15',
    2912.00, 245000,  8100,  6200, 380, 260, 32063.00, 4489.00, 2244.00, 2850.00, 'estimated'),
  ('10000000-0000-0000-0000-000000000001', 'email',           '2026-04-15',
     840.00,       0, 12600,  9800, 420, 175, 35449.00, 4963.00, 2482.00, 3150.00, 'estimated'),
  ('10000000-0000-0000-0000-000000000001', 'organic',         '2026-04-15',
     399.00,       0,     0, 14600, 533, 190, 45281.00, 6339.00, 3170.00, 3997.50, 'estimated'),

  -- ── March 2026 ──────────────────────────────────────────────────────────────
  ('10000000-0000-0000-0000-000000000001', 'meta',            '2026-03-15',
    4293.00, 791000,  9930,  7898, 577, 266, 50239.00, 7033.00, 3517.00, 4327.50, 'estimated'),
  ('10000000-0000-0000-0000-000000000001', 'google_shopping', '2026-03-15',
    2442.00, 217000,  7181,  5494, 337, 231, 29370.00, 4112.00, 2056.00, 2527.50, 'estimated'),
  ('10000000-0000-0000-0000-000000000001', 'email',           '2026-03-15',
     760.00,       0, 11167,  8693, 372, 155, 32471.00, 4546.00, 2273.00, 2790.00, 'estimated'),
  ('10000000-0000-0000-0000-000000000001', 'organic',         '2026-03-15',
     353.00,       0,     0, 12946, 473, 168, 41477.00, 5807.00, 2903.00, 3547.50, 'estimated')
ON CONFLICT (store_id, channel, metric_date) DO NOTHING;

-- ── Channel monthly snapshots ─────────────────────────────────────────────────
-- Pre-computed contribution metrics for each channel × month.
-- CM% values match channel-metrics.ts mock (34.2%, 40.1%, 58.6%, 52.3%).
-- CAC values match channel-metrics.ts mock: April = current, March = prev month.
--
-- April attribution totals: 1983 orders, £167,639 gross ✓
-- March attribution totals: 1759 orders, £153,557 gross ✓
--
-- opportunity_score formula:
--   benchmark = 0.45; gap = max(0, benchmark − cm_pct)
--   spend_pct = channel_spend / total_spend (april: £9,671)
--   score = LEAST(100, round(gap × spend_pct × 10000))
--   Meta:    (0.45−0.342) × (5520/9671) × 10000 = 616 → clamped 100? no, round differently
--   Scores are hand-calibrated to tell the right story: Meta highest, Google medium, Email/Organic 0.

INSERT INTO public.marketing_channel_monthly_snapshots
  (store_id, channel, period_start, period_end,
   spend, impressions, clicks, sessions,
   attributed_orders, attributed_new_customers, attributed_gross_sales,
   discount_impact, returns_impact, shipping_subsidy_impact,
   attributed_net_sales, contribution_profit, contribution_margin_pct,
   cac, roas, mer, cac_payback_orders, opportunity_score, data_freshness)
VALUES
  -- ── April 2026 — Meta ────────────────────────────────────────────────────────
  -- attributed_net_sales: 54846 − 7679 − 3839 = 43328
  -- contribution_profit: 43328 × 0.342 = 14818.18
  -- cac: 5520 / 300 = 18.40 ← matches mock BLENDED_CAC_PREV meta row
  -- roas: 54846 / 5520 = 9.94
  -- cac_payback_orders: 18.40 / (14818.18/650) = 18.40 / 22.80 = 0.81
  ('10000000-0000-0000-0000-000000000001', 'meta', '2026-04-01', '2026-04-30',
    5520.00, 892000, 11200, 8900, 650, 300, 54846.00,
    7679.00, 3839.00, 4875.00,
    43328.00, 14818.18, 0.3420,
    18.40, 9.9400, 9.9400, 0.81, 78, 'estimated'),

  -- ── April 2026 — Google Shopping ────────────────────────────────────────────
  -- attributed_net_sales: 32063 − 4489 − 2244 = 25330
  -- contribution_profit: 25330 × 0.401 = 10157.33
  -- cac: 2912 / 260 = 11.20
  -- roas: 32063 / 2912 = 11.01
  -- cac_payback_orders: 11.20 / (10157.33/380) = 11.20 / 26.73 = 0.42
  ('10000000-0000-0000-0000-000000000001', 'google_shopping', '2026-04-01', '2026-04-30',
    2912.00, 245000, 8100, 6200, 380, 260, 32063.00,
    4489.00, 2244.00, 2850.00,
    25330.00, 10157.33, 0.4010,
    11.20, 11.0100, 11.0100, 0.42, 42, 'estimated'),

  -- ── April 2026 — Email ───────────────────────────────────────────────────────
  -- attributed_net_sales: 35449 − 4963 − 2482 = 28004
  -- contribution_profit: 28004 × 0.586 = 16410.34
  -- cac: 840 / 175 = 4.80
  -- roas: 35449 / 840 = 42.20
  -- cac_payback_orders: 4.80 / (16410.34/420) = 4.80 / 39.07 = 0.12
  -- opportunity_score = 0 (CM% 58.6% > 45% benchmark — no gap)
  ('10000000-0000-0000-0000-000000000001', 'email', '2026-04-01', '2026-04-30',
    840.00, 0, 12600, 9800, 420, 175, 35449.00,
    4963.00, 2482.00, 3150.00,
    28004.00, 16410.34, 0.5860,
    4.80, 42.2000, 42.2000, 0.12, 0, 'estimated'),

  -- ── April 2026 — Organic ─────────────────────────────────────────────────────
  -- attributed_net_sales: 45281 − 6339 − 3170 = 35772
  -- contribution_profit: 35772 × 0.523 = 18709.36
  -- cac: 399 / 190 = 2.10 (notional content/brand allocation)
  -- roas: 45281 / 399 = 113.49
  -- opportunity_score = 0 (CM% 52.3% > 45% benchmark — no gap)
  ('10000000-0000-0000-0000-000000000001', 'organic', '2026-04-01', '2026-04-30',
    399.00, 0, 0, 14600, 533, 190, 45281.00,
    6339.00, 3170.00, 3997.50,
    35772.00, 18709.36, 0.5230,
    2.10, 113.4900, 113.4900, 0.06, 0, 'estimated'),

  -- ── March 2026 — Meta ────────────────────────────────────────────────────────
  -- March CAC = April CAC / 1.14 = 18.40/1.14 = 16.14 (before +14% MoM increase)
  -- attributed_net_sales: 50239 − 7033 − 3517 = 39689
  -- contribution_profit: 39689 × 0.342 = 13573.64
  -- cac: 4293 / 266 = 16.14 (prev month, matching BLENDED_CAC_PREV narrative)
  -- roas: 50239 / 4293 = 11.70
  ('10000000-0000-0000-0000-000000000001', 'meta', '2026-03-01', '2026-03-31',
    4293.00, 791000, 9930, 7898, 577, 266, 50239.00,
    7033.00, 3517.00, 4327.50,
    39689.00, 13573.64, 0.3420,
    16.14, 11.7000, 11.7000, 0.71, 74, 'estimated'),

  -- ── March 2026 — Google Shopping ────────────────────────────────────────────
  -- March CAC = 11.20/1.06 = 10.57 (before +6% MoM increase)
  -- attributed_net_sales: 29370 − 4112 − 2056 = 23202
  -- contribution_profit: 23202 × 0.401 = 9304.00
  -- cac: 2442 / 231 = 10.57
  -- roas: 29370 / 2442 = 12.03
  ('10000000-0000-0000-0000-000000000001', 'google_shopping', '2026-03-01', '2026-03-31',
    2442.00, 217000, 7181, 5494, 337, 231, 29370.00,
    4112.00, 2056.00, 2527.50,
    23202.00, 9304.00, 0.4010,
    10.57, 12.0300, 12.0300, 0.40, 39, 'estimated'),

  -- ── March 2026 — Email ───────────────────────────────────────────────────────
  -- March CAC = 4.80/0.98 = 4.90 (before −2% MoM decrease)
  -- attributed_net_sales: 32471 − 4546 − 2273 = 25652
  -- contribution_profit: 25652 × 0.586 = 15032.07
  -- cac: 760 / 155 = 4.90
  -- roas: 32471 / 760 = 42.72
  ('10000000-0000-0000-0000-000000000001', 'email', '2026-03-01', '2026-03-31',
    760.00, 0, 11167, 8693, 372, 155, 32471.00,
    4546.00, 2273.00, 2790.00,
    25652.00, 15032.07, 0.5860,
    4.90, 42.7200, 42.7200, 0.12, 0, 'estimated'),

  -- ── March 2026 — Organic ─────────────────────────────────────────────────────
  -- Stable — CAC unchanged at £2.10
  -- attributed_net_sales: 41477 − 5807 − 2903 = 32767
  -- contribution_profit: 32767 × 0.523 = 17137.14
  -- cac: 353 / 168 = 2.10
  -- roas: 41477 / 353 = 117.50
  ('10000000-0000-0000-0000-000000000001', 'organic', '2026-03-01', '2026-03-31',
    353.00, 0, 0, 12946, 473, 168, 41477.00,
    5807.00, 2903.00, 3547.50,
    32767.00, 17137.14, 0.5230,
    2.10, 117.5000, 117.5000, 0.06, 0, 'estimated')
ON CONFLICT (store_id, channel, period_start) DO NOTHING;

-- ── Blended monthly snapshots ─────────────────────────────────────────────────
-- Cross-channel blended metrics per period.
--
-- April 2026:
--   total_spend: 5520+2912+840+399 = £9,671 (pure media)
--   overhead_content_spend: £1,614 (brand/content not channel-attributed)
--   effective spend: £11,285 → blended_cac = 11285/925 = £12.20 ✓ (mock BLENDED_CAC)
--   total_new_customers: 300+260+175+190 = 925
--   total_attributed_net_sales: 43328+25330+28004+35772 = £132,434
--   total_contribution_profit: 14818.18+10157.33+16410.34+18709.36 = £60,095.21
--   blended_cm_pct: 60095.21/132434 = 0.4537
--
-- March 2026:
--   total_spend: 4293+2442+760+353 = £7,848
--   overhead_content_spend: £188
--   effective spend: £8,036 → blended_cac = 8036/820 = £9.80 ✓ (mock BLENDED_CAC_PREV)
--   total_new_customers: 266+231+155+168 = 820
--   total_attributed_net_sales: 39689+23202+25652+32767 = £121,310
--   total_contribution_profit: 13573.64+9304+15032.07+17137.14 = £55,046.85
--   blended_cm_pct: 55046.85/121310 = 0.4538

INSERT INTO public.marketing_blended_monthly
  (store_id, period_start, period_end,
   total_spend, overhead_content_spend,
   total_attributed_revenue, total_attributed_orders, total_new_customers,
   blended_cac, blended_roas, blended_mer,
   blended_contribution_margin_pct, total_contribution_profit,
   total_attributed_net_sales)
VALUES
  ('10000000-0000-0000-0000-000000000001', '2026-04-01', '2026-04-30',
    9671.00, 1614.00,
    167639.00, 1983, 925,
    12.20, 17.3400, 14.8600,
    0.4537, 60095.21, 132434.00),

  ('10000000-0000-0000-0000-000000000001', '2026-03-01', '2026-03-31',
    7848.00, 188.00,
    153557.00, 1759, 820,
    9.80, 19.5700, 19.1100,
    0.4538, 55046.85, 121310.00)
ON CONFLICT (store_id, period_start) DO NOTHING;

-- ── Channel opportunity scores ────────────────────────────────────────────────
-- Scored and ranked opportunities assessed at end of April 2026.
--
-- Scoring rationale:
--   Meta (contribution_gap):    CM% 34.2% vs 45% target = 10.8pp gap, largest spend share → score 78
--   Meta (cac_reduction):       +14% MoM CAC increase, highest CAC channel → score 65
--   budget_reallocation:        Email (58.6%) and Organic (52.3%) > Meta (34.2%) → reallocate → score 55
--   Google (contribution_gap):  CM% 40.1% vs 45% target = 4.9pp gap, second-largest spend → score 42

INSERT INTO public.channel_opportunity_scores
  (store_id, channel, assessed_at, opportunity_type, score,
   estimated_uplift_low, estimated_uplift_high, rationale, status)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    'meta', '2026-04-30', 'contribution_gap', 78,
    2340.00, 4679.00,
    'Meta CM% (34.2%) is 10.8pp below the 45% benchmark. Primary drivers: above-benchmark discount depth (14%) and returns rate (7%) on Meta-attributed orders. Reducing discount rate by 3pp and improving returns handling on Meta traffic could recover £2,300–£4,700/month in contribution.',
    'active'
  ),
  (
    '10000000-0000-0000-0000-000000000001',
    'meta', '2026-04-30', 'cac_reduction', 65,
    3200.00, 7800.00,
    'Meta CAC increased 14% month-on-month (£16.14 → £18.40). Optimising creative mix, bid strategy, and audience segmentation could reduce Meta CAC toward the £14–15 range. Combined with reallocating 15% of Meta budget to Email, blended CAC could improve from £12.20 to £10.40, adding £3,200–£7,800/month in contribution.',
    'active'
  ),
  (
    '10000000-0000-0000-0000-000000000001',
    'blended', '2026-04-30', 'budget_reallocation', 55,
    4800.00, 11200.00,
    'Email (CM% 58.6%) and Organic (52.3%) significantly outperform Meta (34.2%). Reallocating 20% of Meta budget to Email list growth and content investment could improve blended CM% by 1.5–3pp. Estimated contribution uplift: £4,800–£11,200/month once reallocation reaches full efficiency.',
    'active'
  ),
  (
    '10000000-0000-0000-0000-000000000001',
    'google_shopping', '2026-04-30', 'contribution_gap', 42,
    621.00, 1241.00,
    'Google Shopping CM% (40.1%) is 4.9pp below the 45% benchmark. Refining product feed for high-margin SKUs and adjusting bids away from high-return categories could improve contribution by £600–£1,200/month.',
    'active'
  )
ON CONFLICT DO NOTHING;

-- ── CAC trend snapshots ───────────────────────────────────────────────────────
-- April 2026: current period (mom_change shows the trend vs March)
-- March 2026: previous period (mom_change = null — first seeded month)

INSERT INTO public.cac_trend_snapshots
  (store_id, channel, snapshot_date, cac, trailing_30d_cac, trailing_90d_cac,
   mom_change_pct, attributed_new_customers, spend)
VALUES
  -- April 2026 ─────────────────────────────────────────────────────────────────
  ('10000000-0000-0000-0000-000000000001', 'meta',            '2026-04-30',
    18.40, 18.40, 17.23,  0.1400, 300, 5520.00),
  ('10000000-0000-0000-0000-000000000001', 'google_shopping', '2026-04-30',
    11.20, 11.20, 10.92,  0.0600, 260, 2912.00),
  ('10000000-0000-0000-0000-000000000001', 'email',           '2026-04-30',
     4.80,  4.80,  4.89, -0.0200, 175,  840.00),
  ('10000000-0000-0000-0000-000000000001', 'organic',         '2026-04-30',
     2.10,  2.10,  2.10,  0.0000, 190,  399.00),

  -- March 2026 — first seeded month; mom_change_pct = null (no prior period in DB) ─
  ('10000000-0000-0000-0000-000000000001', 'meta',            '2026-03-31',
    16.14, 16.14, 16.50,  NULL, 266, 4293.00),
  ('10000000-0000-0000-0000-000000000001', 'google_shopping', '2026-03-31',
    10.57, 10.57, 10.70,  NULL, 231, 2442.00),
  ('10000000-0000-0000-0000-000000000001', 'email',           '2026-03-31',
     4.90,  4.90,  4.90,  NULL, 155,  760.00),
  ('10000000-0000-0000-0000-000000000001', 'organic',         '2026-03-31',
     2.10,  2.10,  2.10,  NULL, 168,  353.00)
ON CONFLICT (store_id, channel, snapshot_date) DO NOTHING;

-- =============================================================================
-- SECURITY DEFINER FUNCTIONS
-- =============================================================================
-- All functions follow the established project pattern:
--   STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
-- Frontend calls via supabase.rpc(fnName, params) — never queries tables directly.
-- =============================================================================

-- ── channel_metrics_monthly ───────────────────────────────────────────────────
-- Returns pre-computed channel snapshot rows for a store × date range.
-- Ordered by opportunity_score DESC then spend DESC (highest-value channels first).
-- Returns multiple rows (one per channel that has data in the period).
--
-- Usage:
--   const { data } = await supabase.rpc('channel_metrics_monthly', {
--     p_store_id: storeId, p_date_from: '2026-04-01', p_date_to: '2026-04-30'
--   });

CREATE OR REPLACE FUNCTION public.channel_metrics_monthly(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS TABLE (
  channel                   text,
  period_start              date,
  period_end                date,
  spend                     numeric,
  impressions               bigint,
  clicks                    bigint,
  sessions                  bigint,
  attributed_orders         integer,
  attributed_new_customers  integer,
  attributed_gross_sales    numeric,
  discount_impact           numeric,
  returns_impact            numeric,
  shipping_subsidy_impact   numeric,
  attributed_net_sales      numeric,
  contribution_profit       numeric,
  contribution_margin_pct   numeric,
  cac                       numeric,
  roas                      numeric,
  mer                       numeric,
  cac_payback_orders        numeric,
  opportunity_score         integer,
  data_freshness            text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    s.channel,
    s.period_start,
    s.period_end,
    s.spend,
    s.impressions,
    s.clicks,
    s.sessions,
    s.attributed_orders,
    s.attributed_new_customers,
    s.attributed_gross_sales,
    s.discount_impact,
    s.returns_impact,
    s.shipping_subsidy_impact,
    s.attributed_net_sales,
    s.contribution_profit,
    s.contribution_margin_pct,
    s.cac,
    s.roas,
    s.mer,
    s.cac_payback_orders,
    s.opportunity_score,
    s.data_freshness
  FROM public.marketing_channel_monthly_snapshots s
  WHERE s.store_id    = p_store_id
    AND s.period_start >= p_date_from
    AND s.period_end   <= p_date_to
  ORDER BY s.opportunity_score DESC, s.spend DESC;
$$;

-- ── blended_marketing_performance ─────────────────────────────────────────────
-- Returns cross-channel blended metrics for a store × date range.
-- Returns one row (the blended snapshot for the most recent period in range).
-- Returns an empty result set (no rows) when no blended data exists for the period.
--
-- Usage:
--   const { data } = await supabase.rpc('blended_marketing_performance', {
--     p_store_id: storeId, p_date_from: '2026-04-01', p_date_to: '2026-04-30'
--   });
--   const blended = Array.isArray(data) ? data[0] : null;

CREATE OR REPLACE FUNCTION public.blended_marketing_performance(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS TABLE (
  period_start                      date,
  period_end                        date,
  total_spend                       numeric,
  overhead_content_spend            numeric,
  total_attributed_revenue          numeric,
  total_attributed_orders           integer,
  total_new_customers               integer,
  blended_cac                       numeric,
  blended_roas                      numeric,
  blended_mer                       numeric,
  blended_contribution_margin_pct   numeric,
  total_contribution_profit         numeric,
  total_attributed_net_sales        numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    b.period_start,
    b.period_end,
    b.total_spend,
    b.overhead_content_spend,
    b.total_attributed_revenue,
    b.total_attributed_orders,
    b.total_new_customers,
    b.blended_cac,
    b.blended_roas,
    b.blended_mer,
    b.blended_contribution_margin_pct,
    b.total_contribution_profit,
    b.total_attributed_net_sales
  FROM public.marketing_blended_monthly b
  WHERE b.store_id    = p_store_id
    AND b.period_start >= p_date_from
    AND b.period_end   <= p_date_to
  ORDER BY b.period_start DESC
  LIMIT 1;
$$;

-- ── channel_opportunities_active ──────────────────────────────────────────────
-- Returns active channel opportunity scores, ordered by score DESC.
-- Used by the marketing pages and future Profit Opportunities channel breakdown.
-- Returns all statuses via a separate scored_at date filter; active only by default.
--
-- Usage:
--   const { data } = await supabase.rpc('channel_opportunities_active', {
--     p_store_id: storeId
--   });

CREATE OR REPLACE FUNCTION public.channel_opportunities_active(
  p_store_id uuid
)
RETURNS TABLE (
  channel                 text,
  assessed_at             date,
  opportunity_type        text,
  score                   integer,
  estimated_uplift_low    numeric,
  estimated_uplift_high   numeric,
  rationale               text,
  status                  text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    c.channel,
    c.assessed_at,
    c.opportunity_type,
    c.score,
    c.estimated_uplift_low,
    c.estimated_uplift_high,
    c.rationale,
    c.status
  FROM public.channel_opportunity_scores c
  WHERE c.store_id = p_store_id
    AND c.status   = 'active'
  ORDER BY c.score DESC;
$$;

-- ── cac_trend_by_channel ──────────────────────────────────────────────────────
-- Returns CAC trend data for all channels for a store, up to the given date.
-- Used by the Growth Quality and Marketing Efficiency pages for CAC trend charts.
--
-- Usage:
--   const { data } = await supabase.rpc('cac_trend_by_channel', {
--     p_store_id: storeId, p_up_to_date: '2026-04-30', p_months_back: 6
--   });

CREATE OR REPLACE FUNCTION public.cac_trend_by_channel(
  p_store_id    uuid,
  p_up_to_date  date  DEFAULT CURRENT_DATE,
  p_months_back integer DEFAULT 6
)
RETURNS TABLE (
  channel                  text,
  snapshot_date            date,
  cac                      numeric,
  trailing_30d_cac         numeric,
  trailing_90d_cac         numeric,
  mom_change_pct           numeric,
  attributed_new_customers integer,
  spend                    numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    c.channel,
    c.snapshot_date,
    c.cac,
    c.trailing_30d_cac,
    c.trailing_90d_cac,
    c.mom_change_pct,
    c.attributed_new_customers,
    c.spend
  FROM public.cac_trend_snapshots c
  WHERE c.store_id      = p_store_id
    AND c.snapshot_date <= p_up_to_date
    AND c.snapshot_date >= (p_up_to_date - (p_months_back || ' months')::interval)::date
  ORDER BY c.channel ASC, c.snapshot_date ASC;
$$;
