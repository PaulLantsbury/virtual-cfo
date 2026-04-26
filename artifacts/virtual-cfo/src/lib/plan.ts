/**
 * User plan configuration and feature-gating utilities.
 *
 * Current plan tiers: "free" | "pro"
 *
 * Override points (in priority order):
 *   1. Auth integration — replace `resolvePlan()` body with a call to your
 *      auth provider's user object once Clerk/Replit Auth is wired up.
 *   2. Billing integration — set `user.plan` from a Stripe/RevenueCat
 *      subscription status response after the session loads.
 *   3. Demo mode — set sessionStorage item "userPlan" to "pro" in the
 *      browser console to simulate a Pro user without a real account.
 *   4. Default — falls back to "free" for all unauthenticated visitors.
 *
 * Adding a new subscription tier (e.g. "growth"):
 *   1. Add "growth" to the `UserPlan` union type.
 *   2. Update `FEATURE_ACCESS` arrays for features it should unlock.
 *   3. No changes required in page-level gating code.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** All supported subscription tiers. */
export type UserPlan = "free" | "pro";

/**
 * All named gated features across the dashboard.
 *
 * Naming convention: snake_case, describing the content being unlocked.
 * Add new features here as new pages/sections are built.
 */
export type FeatureName =
  | "opportunity_breakdown"         // Opportunities — detailed rows with £ impact + steps
  | "channel_margin_analysis"       // General channel-level margin / acquisition analysis
  | "cac_payback"                   // CAC Payback Period KPI card
  | "margin_bridge"                 // Contribution Margin Bridge waterfall table
  | "driver_breakdown"              // Key Drivers — per-driver attribution rows
  | "fastest_recovery_lever"        // CFO Insight — specific lever % and £ impact
  | "growth_composition_trend"      // Growth Quality — composition breakdown chart
  | "score_component_detail"        // Growth Quality — grade + explanation per score component
  | "driver_impact_detail"          // Growth Quality — quantified impact line per growth driver
  | "growth_quality_actions"        // Growth Quality — "What to do next" action plan
  | "recoverable_growth_quality"    // Growth Quality — recoverable contribution upside block
  | "dashboard_recovery_upside"        // Dashboard — quantified £ value in recoverable strip
  | "dashboard_full_action_plan"       // Dashboard — full 3-action prioritised plan (free sees 1)
  | "dashboard_driver_detail"          // Dashboard — Pro-enriched driver explanation lines
  | "dashboard_opportunities_module"   // Dashboard — Opportunities health module card
  | "opportunities_headline_value"      // Opportunities — £ value in the total recoverable block
  | "opportunities_uplift_values"      // Opportunities — per-row £ uplift figures
  | "opportunities_execution_priority" // Opportunities — Execution priority this month strip
  | "opportunities_row_detail"         // Opportunities — full label, description, meta, badges per row
  | "opportunities_where_to_start"     // Opportunities — Where to start section
  | "profit_risk_actions"              // Profit Engine — "What would move risk lower?" advisory card
  | "profit_staff_cost_trend"         // Profit Engine — Staff cost efficiency 6-period trend chart
  | "profit_driver_table"             // Profit Engine — What Changed driver table + bar chart
  | "profit_simulator"                // Profit Engine — Profit Sensitivity Simulator
  | "profit_recommendations"          // Profit Engine — CFO Recommendations section
  | "cash_driver_table"               // Cash Control — What Changed driver table + bar chart
  | "cash_bridge_table"               // Cash Control — Detailed cash bridge table
  | "cash_cost_pressure"              // Cash Control — Cash Cost Pressure analysis section
  | "cash_simulator"                  // Cash Control — Cash Sensitivity Simulator + Ranking
  | "cash_recommendations"            // Cash Control — This Month's Cash Priorities section
  | "pricing_simulator"               // Pricing — Pricing Sensitivity Simulator + Ranking £ impacts
  | "pricing_driver_table"            // Pricing — What Changed Contribution driver table + chart
  | "pricing_trade_off"               // Pricing — Price vs Volume Trade-off Analysis
  | "pricing_trend_chart"             // Pricing — Pricing Power Trend 6-period chart
  | "pricing_recommendations"         // Pricing — This Month's Pricing Priorities section
  | "marketing_budget_simulator"      // Marketing Efficiency — Budget Reallocation Simulator + Recoverable Contribution card
  | "margin_simulator"               // Margin Analysis — Margin Recovery Simulator (5 sliders)
  | "margin_sensitivity_ranking"     // Margin Analysis — Sensitivity Ranking with £ impact per lever
  | "scenario_lab_plans"             // Scenario Lab — CFO Suggested Plans with Apply buttons
  | "scenario_lab_builder"           // Scenario Lab — Full Scenario Builder (all sliders + live outputs)
  | "scenario_lab_bridge"            // Scenario Lab — Contribution Bridge, Cash Consequence, Quality Score
  | "scenario_lab_implementation"    // Scenario Lab — Implementation Plan + AI CFO Recommendation
  | "ai_cfo_action_plans";           // AI CFO — recommended action + expected impact across all pages

// ─── Feature access matrix ────────────────────────────────────────────────────

/**
 * Defines which plans have access to each named feature.
 *
 * To unlock a feature for a new tier, add the tier string to its array.
 * Example: `opportunity_breakdown: ["pro", "growth"]`
 */
const FEATURE_ACCESS: Record<FeatureName, UserPlan[]> = {
  opportunity_breakdown:          ["pro"],
  channel_margin_analysis:        ["pro"],
  cac_payback:                    ["pro"],
  margin_bridge:                  ["pro"],
  driver_breakdown:               ["pro"],
  fastest_recovery_lever:         ["pro"],
  growth_composition_trend:       ["pro"],
  score_component_detail:         ["pro"],
  driver_impact_detail:           ["pro"],
  growth_quality_actions:         ["pro"],
  recoverable_growth_quality:     ["pro"],
  dashboard_recovery_upside:        ["pro"],
  dashboard_full_action_plan:       ["pro"],
  dashboard_driver_detail:          ["pro"],
  dashboard_opportunities_module:   ["pro"],
  opportunities_headline_value:     ["pro"],
  opportunities_uplift_values:      ["pro"],
  opportunities_execution_priority: ["pro"],
  opportunities_row_detail:         ["pro"],
  opportunities_where_to_start:     ["pro"],
  profit_risk_actions:              ["pro"],
  profit_staff_cost_trend:          ["pro"],
  profit_driver_table:              ["pro"],
  profit_simulator:                 ["pro"],
  profit_recommendations:           ["pro"],
  cash_driver_table:                ["pro"],
  cash_bridge_table:                ["pro"],
  cash_cost_pressure:               ["pro"],
  cash_simulator:                   ["pro"],
  cash_recommendations:             ["pro"],
  pricing_simulator:                ["pro"],
  pricing_driver_table:             ["pro"],
  pricing_trade_off:                ["pro"],
  pricing_trend_chart:              ["pro"],
  pricing_recommendations:          ["pro"],
  marketing_budget_simulator:       ["pro"],
  margin_simulator:                 ["pro"],
  margin_sensitivity_ranking:       ["pro"],
  scenario_lab_plans:               ["pro"],
  scenario_lab_builder:             ["pro"],
  scenario_lab_bridge:              ["pro"],
  scenario_lab_implementation:      ["pro"],
  ai_cfo_action_plans:              ["pro"],
};

// ─── Plan resolution ──────────────────────────────────────────────────────────

/**
 * Resolves the current user's plan from available signals.
 * Swap this function body when auth/billing is integrated.
 */
function resolvePlan(): UserPlan {
  if (typeof window === "undefined") return "free";

  // 1. Review Mode override — localStorage, persists across browser sessions
  const reviewPlan = window.localStorage.getItem("reviewPlan");
  if (reviewPlan === "pro" || reviewPlan === "free") return reviewPlan;

  // 2. Dev toggle override — sessionStorage, same tab only
  const devPlan = window.sessionStorage.getItem("userPlan");
  if (devPlan === "pro" || devPlan === "free") return devPlan;

  // 3. Default — all visitors start on free
  return "free";
}

export const user = {
  plan: resolvePlan() as UserPlan,
};

// ─── Gating helpers ───────────────────────────────────────────────────────────

/**
 * Returns true when the current user's plan grants access to the named feature.
 *
 * Prefer this over `isProUser()` for all new gating logic — it is
 * tier-agnostic and requires no page changes when new plans are introduced.
 *
 * @example
 *   {canAccess("opportunity_breakdown") ? <Detail /> : <UpgradePreviewCard />}
 *   {canAccess("margin_bridge") ? <BridgeTable /> : <UpgradePreviewCard />}
 */
export function canAccess(feature: FeatureName): boolean {
  return FEATURE_ACCESS[feature].includes(user.plan);
}

/**
 * Returns true when the current user has an active Pro plan.
 *
 * @deprecated Prefer `canAccess(featureName)` for all new gating.
 * Kept for backward compatibility; existing callsites will be migrated.
 */
export function isProUser(): boolean {
  return user.plan === "pro";
}
