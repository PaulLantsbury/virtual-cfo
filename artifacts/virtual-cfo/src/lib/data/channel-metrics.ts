/**
 * channel-metrics.ts
 *
 * Central mock data for marketing channel performance.
 * Single source of truth for: Marketing Efficiency, Margin Analysis,
 *                             Growth Quality, Dashboard, Scenario Lab.
 *
 * @temporary This is a static mock snapshot for March 2026.
 * @future Replace with live feeds from Meta Ads API, Google Ads API, and
 *         Shopify attribution data:
 *         - channel CM %: (channelRevenue − channelCosts) / channelRevenue
 *         - CAC by channel: channelSpend / channelNewCustomers
 *         - ROAS by channel: channelRevenue / channelSpend
 * Pages should import from this file rather than declaring these values locally.
 */

/** Blended (all-channel) cost to acquire one new customer (£) */
export const BLENDED_CAC      = 12.20;
export const BLENDED_CAC_PREV = 9.80;  // prior month
export const BLENDED_CAC_LY   = 10.20; // 12-month average

/** Blended (all-channel) return on ad spend */
export const BLENDED_ROAS      = 2.8;
export const BLENDED_ROAS_PREV = 3.4;  // prior month
export const BLENDED_ROAS_LY   = 3.2;  // 12-month average

/**
 * Contribution margin % by channel — after all channel-specific costs.
 * These % values are shared between Margin Analysis (CHANNELS array)
 * and Marketing Efficiency (CHANNEL_CM array).
 * Revenue figures differ by page period — each page adds its own revenue column.
 * @future Computed from: (channelRevenue − variableCosts − channelMarketingSpend) / channelRevenue
 */
export const CHANNEL_CM_PCT = {
  meta:           34.2,
  googleShopping: 40.1,
  email:          58.6,
  organic:        52.3,
} as const;

type EfficiencyRating = "strong" | "watch" | "weak";

/**
 * CAC by channel — cost to acquire one new customer per acquisition channel.
 * Shared between Marketing Efficiency and Dashboard (headline Meta CAC figure).
 * @future Sourced from ad platform APIs: channelSpend / uniqueNewCustomersAttributed
 */
export const CAC_BY_CHANNEL: {
  channel:     string;
  cac:         number;
  change:      number | null;
  changeLabel: string;
  efficiency:  EfficiencyRating;
}[] = [
  { channel: "Meta",            cac: 18.40, change: 14,   changeLabel: "+14%",   efficiency: "weak"   },
  { channel: "Google Shopping", cac: 11.20, change: 6,    changeLabel: "+6%",    efficiency: "watch"  },
  { channel: "Email",           cac:  4.80, change: -2,   changeLabel: "−2%",    efficiency: "strong" },
  { channel: "Organic",         cac:  2.10, change: null, changeLabel: "Stable", efficiency: "strong" },
];

/**
 * CAC payback by channel — orders required for a new customer to cover their acquisition cost.
 * Threshold: Safe < 1.2 orders · Monitor 1.2–1.6 · Risk > 1.6
 * @future Computed per channel: channelCAC / channelContributionPerOrder
 */
export const PAYBACK_BY_CHANNEL = [
  { channel: "Email",           payback: 0.6 },
  { channel: "Organic",         payback: 0.8 },
  { channel: "Google Shopping", payback: 1.3 },
  { channel: "Meta",            payback: 2.1 },
];
