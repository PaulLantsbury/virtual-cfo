/**
 * useLatestDataPeriod.ts
 *
 * React hook that selects the most recent calendar month containing order data
 * and returns the resolved Phase 1 metrics for that period.
 *
 * MOTIVATION
 * ----------
 * Phase 1 RPCs return 0 (not an error) when no orders exist for the requested
 * period.  The app defaults to the current calendar month, which is empty at
 * the start of each month until the Shopify ingestion pipeline catches up.
 * This hook solves that by walking back one month at a time until it finds a
 * period whose gross_revenue > 0 — i.e. a period that actually has data.
 *
 * BEHAVIOUR
 * ---------
 * 1. Starts with the current calendar month (offset = 0).
 * 2. Calls getPhase1Metrics() for that period.
 * 3. If grossRevenue === 0 (no data), steps back one month and retries.
 * 4. Repeats up to MAX_LOOKBACK_MONTHS times.
 * 5. Returns the first period that has data, or the furthest period tried if
 *    all are empty — the caller's static fallbacks then apply.
 *
 * The walk-back stops immediately on a network/RPC error (does not retry
 * further) so the component falls back gracefully rather than spinning.
 *
 * RETURN VALUE
 * ------------
 * - phase1      Phase1MetricsResponse | null
 *               null while loading or on unrecoverable error.
 * - dateFrom    "YYYY-MM-DD"  first day of the resolved period.
 * - dateTo      "YYYY-MM-DD"  last day of the resolved period.
 * - periodLabel Short human-readable label, e.g. "Apr 2026".
 * - loading     true until the first successful (or failed) fetch completes.
 *
 * DATE RANGE CONVENTION
 * ---------------------
 * Both dateFrom and dateTo are inclusive ISO date strings, matching the
 * convention used by all Phase 1 SQL functions:
 *   created_at::date BETWEEN p_date_from AND p_date_to
 *
 * DEV NOTE
 * --------
 * The storeId parameter is currently hardcoded to the seed store UUID by both
 * callers (dashboard.tsx and margin-analysis.tsx).  When auth is wired the
 * callers will pass the session store_id; this hook requires no changes.
 */

import { useState, useEffect } from "react";
import { getPhase1Metrics, type Phase1MetricsResponse } from "./phase1Metrics";

// Maximum number of months to walk back before giving up.
const MAX_LOOKBACK_MONTHS = 3;

// ── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Returns the inclusive date range and display label for the calendar month
 * that is `monthsBack` months before today.
 *   monthsBack=0 → current month
 *   monthsBack=1 → prior month
 */
function getPeriod(monthsBack: number): {
  dateFrom: string;
  dateTo: string;
  label: string;
} {
  const d = new Date();
  d.setDate(1); // anchor to 1st to avoid month-end overflow when subtracting months
  d.setMonth(d.getMonth() - monthsBack);
  const year  = d.getFullYear();
  const month = d.getMonth() + 1; // getMonth() is 0-indexed
  const dateFrom = `${year}-${pad(month)}-01`;
  // Last day: day 0 of the following month = last day of this month
  const lastDay = new Date(year, month, 0).getDate();
  const dateTo = `${year}-${pad(month)}-${pad(lastDay)}`;
  const label = d.toLocaleString("en-GB", { month: "short", year: "numeric" });
  return { dateFrom, dateTo, label };
}

// ── Public API ────────────────────────────────────────────────────────────────

export type LatestDataPeriod = {
  /** Phase 1 metrics for the resolved period. null while loading or on error. */
  phase1: Phase1MetricsResponse | null;
  /** First day of the resolved period, inclusive (e.g. "2026-04-01"). */
  dateFrom: string;
  /** Last day of the resolved period, inclusive (e.g. "2026-04-30"). */
  dateTo: string;
  /** Short human-readable label for the resolved period (e.g. "Apr 2026"). */
  periodLabel: string;
  /** True until the first fetch attempt completes (success or failure). */
  loading: boolean;
};

/**
 * Fetches Phase 1 metrics for the most recent calendar month that has order
 * data, walking back up to MAX_LOOKBACK_MONTHS months from today.
 *
 * @param storeId  UUID of the store — matches orders.store_id.
 */
export function useLatestDataPeriod(storeId: string): LatestDataPeriod {
  // Initialise to the current calendar month so the returned dateFrom/dateTo
  // are always valid strings, even before the first fetch resolves.
  const initial = getPeriod(0);

  const [dateFrom,    setDateFrom]    = useState(initial.dateFrom);
  const [dateTo,      setDateTo]      = useState(initial.dateTo);
  const [periodLabel, setPeriodLabel] = useState(initial.label);
  const [phase1,      setPhase1]      = useState<Phase1MetricsResponse | null>(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setPhase1(null);

    (async () => {
      for (let back = 0; back <= MAX_LOOKBACK_MONTHS; back++) {
        if (cancelled) return;

        const period = getPeriod(back);

        let result: Phase1MetricsResponse;
        try {
          result = await getPhase1Metrics(storeId, period.dateFrom, period.dateTo);
        } catch {
          // Network or unrecoverable RPC error — stop walking, leave phase1 null.
          if (!cancelled) setLoading(false);
          return;
        }

        if (cancelled) return;

        const hasData = result.data.grossRevenue > 0;

        if (hasData || back === MAX_LOOKBACK_MONTHS) {
          // Either found a live period, or exhausted the lookback.
          // In the exhausted case the caller's || fallbacks still apply.
          setDateFrom(period.dateFrom);
          setDateTo(period.dateTo);
          setPeriodLabel(period.label);
          setPhase1(result);
          setLoading(false);
          return;
        }

        // grossRevenue === 0 and we still have headroom → try prior month.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  return { phase1, dateFrom, dateTo, periodLabel, loading };
}
