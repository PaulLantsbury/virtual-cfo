/**
 * marketingChannelMetrics.ts
 *
 * Phase 3 Marketing Intelligence Query Layer.
 *
 * Fetches channel-level marketing performance from four Supabase RPCs:
 *   channel_metrics_monthly()         — per-channel monthly performance
 *   blended_marketing_performance()   — cross-channel blended summary
 *   channel_opportunities_active()    — ranked improvement opportunities
 *   cac_trend_by_channel()            — CAC trend history per channel
 *
 * DESIGN
 * ------
 * - All four RPCs are called in parallel (Promise.all) via independent
 *   callRpcRows() / callRpcRow() helpers.
 * - Each call is individually error-isolated: a failure in one returns [] or
 *   null for that field and records the error, leaving the other fields intact.
 * - Return types match the SQL RETURNS TABLE column names (snake_case from DB
 *   coerced to camelCase in this layer).
 * - All numeric fields are returned as number | null. Monetary values are in £,
 *   percentage ratios are [0,1] (multiply by 100 for display).
 * - No formatting is applied here. Callers handle display (toFixed, £ prefix, etc.)
 *
 * DATABASE ALIGNMENT
 * ------------------
 * Tables: marketing_channel_monthly_snapshots, marketing_blended_monthly,
 *         channel_opportunity_scores, cac_trend_snapshots.
 * Migration: 20260507000002_marketing_intelligence_schema.sql.
 * Seed data: March 2026 and April 2026 for dev store 10000000-…-0001.
 *
 * CHANNEL KEYS
 * ------------
 * 'meta' | 'google_shopping' | 'email' | 'organic' | 'direct' | 'other'
 *
 * MOCK DATA RELATIONSHIP
 * ----------------------
 * The CAC and CM% values in this module's seed data match channel-metrics.ts mock:
 *   Meta:            CAC £18.40 (+14% MoM), CM 34.2%, score 78
 *   Google Shopping: CAC £11.20 (+6%),      CM 40.1%, score 42
 *   Email:           CAC £4.80  (−2%),      CM 58.6%, score 0
 *   Organic:         CAC £2.10  (stable),   CM 52.3%, score 0
 * When the frontend switches from channel-metrics.ts to this module, the values
 * will match because the seed data was calibrated to produce the same KPIs.
 *
 * WIRING STATUS
 * -------------
 * Phase 3 establishes the data layer. Page-level wiring (replacing channel-metrics.ts
 * imports with calls to this module) is a separate Phase 4 step.
 */

import { supabase } from "../supabase";

// ═══════════════════════════════════════════════════════════════════════════════
// RESULT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * One channel's monthly performance metrics.
 * Mirrors the RETURNS TABLE columns of channel_metrics_monthly().
 * All monetary values in £. Ratios in [0,1].
 */
export type ChannelMonthlyMetrics = {
  /** Channel slug: 'meta' | 'google_shopping' | 'email' | 'organic' | 'direct' | 'other' */
  channel:                 string;
  periodStart:             string;
  periodEnd:               string;

  // Raw aggregates
  spend:                   number;
  impressions:             number;
  clicks:                  number;
  sessions:                number;
  attributedOrders:        number;
  attributedNewCustomers:  number;
  attributedGrossSales:    number;
  discountImpact:          number;
  returnsImpact:           number;
  shippingSubsidyImpact:   number;

  // Contribution-first derived metrics
  attributedNetSales:      number;
  contributionProfit:      number;
  /** [0,1] ratio — multiply by 100 for % display */
  contributionMarginPct:   number;

  // Efficiency metrics
  /** £ per new customer. Null when attributed_new_customers = 0. */
  cac:                     number | null;
  /** attributed_gross_sales / spend. Null when spend = 0. */
  roas:                    number | null;
  /** attributed_gross_sales / total_store_spend (blended). Null when spend = 0. */
  mer:                     number | null;
  /** Orders to recover acquisition cost. Null when no contribution data. */
  cacPaybackOrders:        number | null;

  /** 0–100 opportunity score */
  opportunityScore:        number;
  /** 'live' | 'estimated' | 'stale' */
  dataFreshness:           string;
};

/**
 * Cross-channel blended metrics for one period.
 * Mirrors the RETURNS TABLE columns of blended_marketing_performance().
 */
export type BlendedMarketingPerformance = {
  periodStart:                    string;
  periodEnd:                      string;

  /** Pure media/channel spend (does not include overhead_content_spend) */
  totalSpend:                     number;
  /** Brand, content, agency costs not attributed to a channel */
  overheadContentSpend:           number;

  totalAttributedRevenue:         number;
  totalAttributedOrders:          number;
  totalNewCustomers:              number;

  /** (total_spend + overhead_content_spend) / total_new_customers */
  blendedCac:                     number | null;
  /** total_attributed_revenue / total_spend (pure media ROAS) */
  blendedRoas:                    number | null;
  /** total_attributed_revenue / (total_spend + overhead_content_spend) */
  blendedMer:                     number | null;
  /** Weighted average CM% across channels [0,1] */
  blendedContributionMarginPct:   number | null;
  totalContributionProfit:        number;
  totalAttributedNetSales:        number;
};

/**
 * One ranked opportunity for a channel.
 * Mirrors the RETURNS TABLE columns of channel_opportunities_active().
 */
export type ChannelOpportunity = {
  /** Channel slug or 'blended' for cross-channel opportunities */
  channel:             string;
  assessedAt:          string;
  /** 'contribution_gap' | 'cac_reduction' | 'budget_reallocation' | 'roas_improvement' | 'channel_mix' */
  opportunityType:     string;
  /** 0–100 */
  score:               number;
  estimatedUpliftLow:  number;
  estimatedUpliftHigh: number;
  rationale:           string | null;
  /** 'active' | 'dismissed' | 'implemented' | 'monitoring' */
  status:              string;
};

/**
 * One CAC snapshot for one channel at one point in time.
 * Mirrors the RETURNS TABLE columns of cac_trend_by_channel().
 */
export type CacTrendPoint = {
  channel:                 string;
  snapshotDate:            string;
  cac:                     number;
  trailing30dCac:          number | null;
  trailing90dCac:          number | null;
  /** Decimal ratio — e.g. 0.14 = +14%. Null for first seeded period. */
  momChangePct:            number | null;
  attributedNewCustomers:  number;
  spend:                   number;
};

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type MarketingChannelError = {
  /** Name of the Supabase RPC function that failed. */
  fn:      string;
  message: string;
};

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE ENVELOPE
// ═══════════════════════════════════════════════════════════════════════════════

export type MarketingChannelMetricsResponse = {
  /**
   * Per-channel monthly performance rows.
   * Empty array when no data exists for the period or on RPC failure.
   */
  channels:     ChannelMonthlyMetrics[];

  /**
   * Cross-channel blended metrics for the period.
   * Null when no blended snapshot exists or on RPC failure.
   */
  blended:      BlendedMarketingPerformance | null;

  /**
   * Active ranked opportunities, ordered by score DESC.
   * Empty array when no active opportunities exist or on RPC failure.
   */
  opportunities: ChannelOpportunity[];

  /**
   * CAC trend history across channels.
   * Empty array when no trend data exists or on RPC failure.
   */
  cacTrend:     CacTrendPoint[];

  /**
   * Per-function errors. Empty array when all calls succeed.
   * A null/empty field whose fn does NOT appear here means the RPC succeeded
   * but returned no rows (period has no data) — not a failure.
   */
  errors:       MarketingChannelError[];
};

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Coerce a DB-returned value to number or null. */
function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Coerce a DB-returned value to number, defaulting to 0. */
function toNumber(value: unknown): number {
  return toNumberOrNull(value) ?? 0;
}

/**
 * Calls an RPC that returns multiple rows.
 * On Supabase/network error, pushes to the shared errors array and returns [].
 */
async function callRpcRows<T>(
  fnName:    string,
  params:    Record<string, unknown>,
  errors:    MarketingChannelError[],
  transform: (row: Record<string, unknown>) => T,
): Promise<T[]> {
  const { data, error } = await supabase.rpc(fnName, params);
  if (error) {
    errors.push({ fn: fnName, message: error.message });
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.map((row) => transform(row as Record<string, unknown>));
}

/**
 * Calls an RPC that returns one row (LIMIT 1 in SQL).
 * On error or empty result, returns null.
 */
async function callRpcRow<T>(
  fnName:    string,
  params:    Record<string, unknown>,
  errors:    MarketingChannelError[],
  transform: (row: Record<string, unknown>) => T,
): Promise<T | null> {
  const { data, error } = await supabase.rpc(fnName, params);
  if (error) {
    errors.push({ fn: fnName, message: error.message });
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (row === null || row === undefined) return null;
  return transform(row as Record<string, unknown>);
}

// ── Row transformers ──────────────────────────────────────────────────────────

function toChannelMonthlyMetrics(row: Record<string, unknown>): ChannelMonthlyMetrics {
  return {
    channel:                 String(row.channel ?? ""),
    periodStart:             String(row.period_start ?? ""),
    periodEnd:               String(row.period_end ?? ""),
    spend:                   toNumber(row.spend),
    impressions:             toNumber(row.impressions),
    clicks:                  toNumber(row.clicks),
    sessions:                toNumber(row.sessions),
    attributedOrders:        toNumber(row.attributed_orders),
    attributedNewCustomers:  toNumber(row.attributed_new_customers),
    attributedGrossSales:    toNumber(row.attributed_gross_sales),
    discountImpact:          toNumber(row.discount_impact),
    returnsImpact:           toNumber(row.returns_impact),
    shippingSubsidyImpact:   toNumber(row.shipping_subsidy_impact),
    attributedNetSales:      toNumber(row.attributed_net_sales),
    contributionProfit:      toNumber(row.contribution_profit),
    contributionMarginPct:   toNumber(row.contribution_margin_pct),
    cac:                     toNumberOrNull(row.cac),
    roas:                    toNumberOrNull(row.roas),
    mer:                     toNumberOrNull(row.mer),
    cacPaybackOrders:        toNumberOrNull(row.cac_payback_orders),
    opportunityScore:        toNumber(row.opportunity_score),
    dataFreshness:           String(row.data_freshness ?? "estimated"),
  };
}

function toBlendedPerformance(row: Record<string, unknown>): BlendedMarketingPerformance {
  return {
    periodStart:                  String(row.period_start ?? ""),
    periodEnd:                    String(row.period_end ?? ""),
    totalSpend:                   toNumber(row.total_spend),
    overheadContentSpend:         toNumber(row.overhead_content_spend),
    totalAttributedRevenue:       toNumber(row.total_attributed_revenue),
    totalAttributedOrders:        toNumber(row.total_attributed_orders),
    totalNewCustomers:            toNumber(row.total_new_customers),
    blendedCac:                   toNumberOrNull(row.blended_cac),
    blendedRoas:                  toNumberOrNull(row.blended_roas),
    blendedMer:                   toNumberOrNull(row.blended_mer),
    blendedContributionMarginPct: toNumberOrNull(row.blended_contribution_margin_pct),
    totalContributionProfit:      toNumber(row.total_contribution_profit),
    totalAttributedNetSales:      toNumber(row.total_attributed_net_sales),
  };
}

function toChannelOpportunity(row: Record<string, unknown>): ChannelOpportunity {
  return {
    channel:             String(row.channel ?? ""),
    assessedAt:          String(row.assessed_at ?? ""),
    opportunityType:     String(row.opportunity_type ?? ""),
    score:               toNumber(row.score),
    estimatedUpliftLow:  toNumber(row.estimated_uplift_low),
    estimatedUpliftHigh: toNumber(row.estimated_uplift_high),
    rationale:           row.rationale !== null && row.rationale !== undefined
                           ? String(row.rationale)
                           : null,
    status:              String(row.status ?? "active"),
  };
}

function toCacTrendPoint(row: Record<string, unknown>): CacTrendPoint {
  return {
    channel:                String(row.channel ?? ""),
    snapshotDate:           String(row.snapshot_date ?? ""),
    cac:                    toNumber(row.cac),
    trailing30dCac:         toNumberOrNull(row.trailing_30d_cac),
    trailing90dCac:         toNumberOrNull(row.trailing_90d_cac),
    momChangePct:           toNumberOrNull(row.mom_change_pct),
    attributedNewCustomers: toNumber(row.attributed_new_customers),
    spend:                  toNumber(row.spend),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetches all Phase 3 marketing channel metrics from Supabase in parallel.
 *
 * Four RPCs are called concurrently:
 *   1. channel_metrics_monthly()       — per-channel performance for the period
 *   2. blended_marketing_performance() — blended cross-channel summary
 *   3. channel_opportunities_active()  — active ranked opportunities (store-level)
 *   4. cac_trend_by_channel()          — CAC trend history (trailing 6 months)
 *
 * A failure in any one RPC is isolated and recorded in errors[]. The other
 * three calls are unaffected. Check errors[] to distinguish network failure
 * (field empty + error entry) from "no data for period" (field empty, no error).
 *
 * @param storeId    UUID of the store.
 * @param dateFrom   First day of the current period, inclusive (e.g. "2026-04-01").
 * @param dateTo     Last day of the current period, inclusive (e.g. "2026-04-30").
 *
 * @returns MarketingChannelMetricsResponse with all four data sets and any errors.
 *
 * @example
 *   const { channels, blended, opportunities, cacTrend, errors } =
 *     await getMarketingChannelMetrics(storeId, "2026-04-01", "2026-04-30");
 *   if (errors.length) console.warn("[Phase3] Partial failure", errors);
 *   const meta = channels.find(c => c.channel === 'meta');
 *   console.log(meta?.contributionMarginPct * 100, '%');  // 34.2
 */
export async function getMarketingChannelMetrics(
  storeId:  string,
  dateFrom: string,
  dateTo:   string,
): Promise<MarketingChannelMetricsResponse> {
  const errors: MarketingChannelError[] = [];

  const channelParams = {
    p_store_id:  storeId,
    p_date_from: dateFrom,
    p_date_to:   dateTo,
  };

  const opportunityParams = { p_store_id: storeId };

  const cacTrendParams = {
    p_store_id:    storeId,
    p_up_to_date:  dateTo,
    p_months_back: 6,
  };

  const [channels, blended, opportunities, cacTrend] = await Promise.all([
    callRpcRows(
      "channel_metrics_monthly",
      channelParams,
      errors,
      toChannelMonthlyMetrics,
    ),
    callRpcRow(
      "blended_marketing_performance",
      channelParams,
      errors,
      toBlendedPerformance,
    ),
    callRpcRows(
      "channel_opportunities_active",
      opportunityParams,
      errors,
      toChannelOpportunity,
    ),
    callRpcRows(
      "cac_trend_by_channel",
      cacTrendParams,
      errors,
      toCacTrendPoint,
    ),
  ]);

  if (errors.length > 0) {
    console.warn(
      "[Phase3 MarketingChannelMetrics] RPC error(s) — affected data sets will be empty:",
      errors,
    );
  }

  return { channels, blended, opportunities, cacTrend, errors };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE SELECTORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Finds a specific channel's data from the channels array.
 * Returns null when the channel has no data for the period.
 *
 * @example
 *   const meta = findChannel(channels, 'meta');
 *   if (meta) console.log(meta.cac);  // 18.40
 */
export function findChannel(
  channels: ChannelMonthlyMetrics[],
  channel:  string,
): ChannelMonthlyMetrics | null {
  return channels.find((c) => c.channel === channel) ?? null;
}

/**
 * Returns channels sorted by contribution_margin_pct ascending (worst performers first).
 * Useful for opportunity ranking views.
 */
export function sortByContributionGap(
  channels: ChannelMonthlyMetrics[],
): ChannelMonthlyMetrics[] {
  return [...channels].sort((a, b) => a.contributionMarginPct - b.contributionMarginPct);
}

/**
 * Returns opportunities filtered by type.
 *
 * @example
 *   const gaps = filterOpportunitiesByType(opportunities, 'contribution_gap');
 */
export function filterOpportunitiesByType(
  opportunities: ChannelOpportunity[],
  type:          string,
): ChannelOpportunity[] {
  return opportunities.filter((o) => o.opportunityType === type);
}

/**
 * Returns CAC trend points for a specific channel, ordered by date ascending.
 *
 * @example
 *   const metaTrend = getCacTrendForChannel(cacTrend, 'meta');
 *   // [ { snapshotDate: '2026-03-31', cac: 16.14, momChangePct: null },
 *   //   { snapshotDate: '2026-04-30', cac: 18.40, momChangePct: 0.14 } ]
 */
export function getCacTrendForChannel(
  cacTrend: CacTrendPoint[],
  channel:  string,
): CacTrendPoint[] {
  return cacTrend
    .filter((p) => p.channel === channel)
    .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
}

/**
 * Computes total estimated uplift across all active opportunities.
 * Returns { low, high } in £.
 *
 * @example
 *   const { low, high } = totalOpportunityUplift(opportunities);
 *   // { low: 10961, high: 24920 }
 */
export function totalOpportunityUplift(opportunities: ChannelOpportunity[]): {
  low:  number;
  high: number;
} {
  return opportunities.reduce(
    (acc, o) => ({
      low:  acc.low  + o.estimatedUpliftLow,
      high: acc.high + o.estimatedUpliftHigh,
    }),
    { low: 0, high: 0 },
  );
}
