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
  | "opportunity_breakdown"      // Section 2 — detailed opportunity rows with £ impact + steps
  | "channel_margin_analysis"    // General channel-level margin / acquisition analysis
  | "cac_payback"                // CAC Payback Period KPI card
  | "margin_bridge"              // Contribution Margin Bridge waterfall table
  | "driver_breakdown"           // Key Drivers — per-driver attribution rows
  | "fastest_recovery_lever"       // CFO Insight — specific lever % and £ impact
  | "growth_trajectory_risk"      // Growth Quality — 90-day forward contribution impact
  | "growth_composition_trend"    // Growth Quality — composition breakdown chart (repeat/paid/discount)
  | "score_component_detail"      // Growth Quality — grade + explanation text per score component
  | "driver_impact_detail"        // Growth Quality — quantified impact line per growth driver row
  | "growth_quality_actions";     // Growth Quality — "What to do next" action plan

// ─── Feature access matrix ────────────────────────────────────────────────────

/**
 * Defines which plans have access to each named feature.
 *
 * To unlock a feature for a new tier, add the tier string to its array.
 * Example: `opportunity_breakdown: ["pro", "growth"]`
 */
const FEATURE_ACCESS: Record<FeatureName, UserPlan[]> = {
  opportunity_breakdown:   ["pro"],
  channel_margin_analysis: ["pro"],
  cac_payback:             ["pro"],
  margin_bridge:           ["pro"],
  driver_breakdown:        ["pro"],
  fastest_recovery_lever:    ["pro"],
  growth_trajectory_risk:    ["pro"],
  growth_composition_trend:  ["pro"],
  score_component_detail:    ["pro"],
  driver_impact_detail:      ["pro"],
  growth_quality_actions:    ["pro"],
};

// ─── Plan resolution ──────────────────────────────────────────────────────────

/**
 * Resolves the current user's plan from available signals.
 * Swap this function body when auth/billing is integrated.
 */
function resolvePlan(): UserPlan {
  // Demo override: sessionStorage.setItem("userPlan", "pro") then refresh
  const stored =
    typeof window !== "undefined"
      ? window.sessionStorage.getItem("userPlan")
      : null;
  if (stored === "pro" || stored === "free") return stored;

  // Default — all visitors start on free
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
