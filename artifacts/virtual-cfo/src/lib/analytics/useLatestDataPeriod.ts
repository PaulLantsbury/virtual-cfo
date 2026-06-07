/**
 * useLatestDataPeriod.ts
 *
 * React hook that selects the most recent completed CFO reporting period
 * containing order data and returns the resolved Phase 1 metrics for that
 * period.
 *
 * MOTIVATION
 * ----------
 * Phase 1 RPCs return 0 (not an error) when no orders exist for the requested
 * period. The app defaults to the latest completed week/month selected in the
 * global CFO reporting toggle. This hook walks back one completed period at a
 * time until it finds a period whose gross_revenue > 0 — i.e. a period that
 * actually has data.
 *
 * BEHAVIOUR
 * ---------
 * 1. Starts with the selected latest completed reporting period.
 * 2. Calls getPhase1Metrics() for that period.
 * 3. If grossRevenue === 0 (no data), steps back one completed period and retries.
 * 4. Repeats up to the configured lookback limit.
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
 * - periodLabel Short human-readable label, e.g. "May 2026" or
 *               "Week ending 7 Jun 2026".
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
import { useTimeline, type TimelineValue } from "@/lib/timeline";

// Maximum number of completed periods to walk back before giving up.
const MAX_LOOKBACK_MONTHS = 3;
const MAX_LOOKBACK_WEEKS = 8;

// ── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Returns the inclusive date range and display label for the completed calendar
 * month that is `periodsBack` months before the latest completed month.
 *   periodsBack=0 → last complete month
 *   periodsBack=1 → month before last
 */
function getMonthPeriod(periodsBack: number): {
  dateFrom: string;
  dateTo: string;
  label: string;
} {
  const d = new Date();
  d.setDate(1); // anchor to 1st to avoid month-end overflow when subtracting months
  d.setMonth(d.getMonth() - 1 - periodsBack);
  const year  = d.getFullYear();
  const month = d.getMonth() + 1; // getMonth() is 0-indexed
  const dateFrom = `${year}-${pad(month)}-01`;
  // Last day: day 0 of the following month = last day of this month
  const lastDay = new Date(year, month, 0).getDate();
  const dateTo = `${year}-${pad(month)}-${pad(lastDay)}`;
  const label = d.toLocaleString("en-GB", { month: "short", year: "numeric" });
  return { dateFrom, dateTo, label };
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Returns the inclusive date range and display label for the completed
 * Monday-Sunday week that is `periodsBack` weeks before the latest completed
 * week.
 */
function getWeekPeriod(periodsBack: number): {
  dateFrom: string;
  dateTo: string;
  label: string;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysSinceSunday = today.getDay();
  const end = new Date(today);
  end.setDate(today.getDate() - daysSinceSunday - (periodsBack * 7));

  const start = new Date(end);
  start.setDate(end.getDate() - 6);

  const endLabel = end.toLocaleDateString("en-GB", {
    day:   "numeric",
    month: "short",
    year:  "numeric",
  });

  return {
    dateFrom: toIsoDate(start),
    dateTo:   toIsoDate(end),
    label:    `Week ending ${endLabel}`,
  };
}

function getPeriod(timeline: TimelineValue, periodsBack: number) {
  return timeline === "last_complete_week"
    ? getWeekPeriod(periodsBack)
    : getMonthPeriod(periodsBack);
}

// ── Public API ────────────────────────────────────────────────────────────────

export type LatestDataPeriod = {
  /** Phase 1 metrics for the resolved period. null while loading or on error. */
  phase1: Phase1MetricsResponse | null;
  /** First day of the resolved period, inclusive (e.g. "2026-04-01"). */
  dateFrom: string;
  /** Last day of the resolved period, inclusive (e.g. "2026-04-30"). */
  dateTo: string;
  /** Short human-readable label for the resolved period. */
  periodLabel: string;
  /** True until the first fetch attempt completes (success or failure). */
  loading: boolean;
};

/**
 * Fetches Phase 1 metrics for the most recent selected completed reporting
 * period that has order data.
 *
 * @param storeId  UUID of the store — matches orders.store_id.
 */
export function useLatestDataPeriod(storeId: string): LatestDataPeriod {
  const { timeline } = useTimeline();
  // Initialise to the selected completed period so the returned dateFrom/dateTo
  // are always valid strings, even before the first fetch resolves.
  const initial = getPeriod(timeline, 0);

  const [dateFrom,    setDateFrom]    = useState(initial.dateFrom);
  const [dateTo,      setDateTo]      = useState(initial.dateTo);
  const [periodLabel, setPeriodLabel] = useState(initial.label);
  const [phase1,      setPhase1]      = useState<Phase1MetricsResponse | null>(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    let cancelled = false;
    const pendingPeriod = getPeriod(timeline, 0);

    setLoading(true);
    setPhase1(null);
    setDateFrom(pendingPeriod.dateFrom);
    setDateTo(pendingPeriod.dateTo);
    setPeriodLabel(pendingPeriod.label);

    (async () => {
      const maxLookback = timeline === "last_complete_week"
        ? MAX_LOOKBACK_WEEKS
        : MAX_LOOKBACK_MONTHS;

      for (let back = 0; back <= maxLookback; back++) {
        if (cancelled) return;

        const period = getPeriod(timeline, back);

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

        if (hasData || back === maxLookback) {
          // Either found a live period, or exhausted the lookback.
          // In the exhausted case the caller's || fallbacks still apply.
          setDateFrom(period.dateFrom);
          setDateTo(period.dateTo);
          setPeriodLabel(period.label);
          setPhase1(result);
          setLoading(false);
          return;
        }

        // grossRevenue === 0 and we still have headroom → try prior period.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storeId, timeline]);

  return { phase1, dateFrom, dateTo, periodLabel, loading };
}
