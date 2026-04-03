/**
 * User plan configuration.
 *
 * Current values: "free" | "pro"
 *
 * Override points (in priority order):
 *   1. Auth integration — replace `resolveplan()` with a call to your
 *      auth provider's user object once Clerk/Replit Auth is wired up.
 *   2. Billing integration — set `user.plan` from a Stripe/RevenueCat
 *      subscription status response after the session loads.
 *   3. Demo mode — set sessionStorage item "userPlan" to "pro" in the
 *      browser console to simulate a Pro user without a real account.
 *   4. Default — falls back to "free" for all unauthenticated visitors.
 */

export type UserPlan = "free" | "pro";

/**
 * Resolves the current user's plan from available signals.
 * Swap this function body when auth/billing is integrated.
 */
function resolvePlan(): UserPlan {
  // Demo override: sessionStorage.setItem("userPlan", "pro")
  const stored = typeof window !== "undefined"
    ? window.sessionStorage.getItem("userPlan")
    : null;
  if (stored === "pro" || stored === "free") return stored;

  // Default — all users start on free
  return "free";
}

export const user = {
  plan: resolvePlan() as UserPlan,
};

/**
 * Returns true when the current user has an active Pro plan.
 * Use this to gate Pro-only sections, features, or data.
 *
 * @example
 *   {isProUser() && <DetailedAnalysis />}
 */
export function isProUser(): boolean {
  return user.plan === "pro";
}
