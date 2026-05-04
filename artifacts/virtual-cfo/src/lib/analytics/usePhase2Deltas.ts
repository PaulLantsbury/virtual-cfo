/**
 * usePhase2Deltas.ts
 *
 * React hook that fetches month-on-month delta metrics for the resolved
 * period from useLatestDataPeriod().
 *
 * USAGE
 * -----
 * Always pair with useLatestDataPeriod — pass its dateFrom / dateTo directly:
 *
 *   const { phase1, dateFrom, dateTo, periodLabel, loading } =
 *     useLatestDataPeriod(storeId);
 *
 *   const { deltas, loading: deltaLoading } =
 *     usePhase2Deltas(storeId, dateFrom, dateTo);
 *
 * The hook re-fires whenever dateFrom or dateTo changes, i.e. whenever the
 * walk-back logic in useLatestDataPeriod resolves to a different period than
 * the initial current-month guess.
 *
 * LOADING STATES
 * --------------
 *   loading = true   RPC call is in flight — use card.change static sentinel
 *   loading = false  Call settled — deltas may still be null (see below)
 *   deltas  = null   RPC failed or returned 0 rows — caller uses static fallbacks
 *                    Individual delta fields inside the row may ALSO be null
 *                    (prior period had no data); formatDeltaPct / formatDeltaPp
 *                    return "—" automatically for those cases.
 *
 * ERROR ISOLATION
 * ---------------
 * A failure in this hook never affects Phase 1 or Phase 2a data — each layer
 * is independently error-isolated.  Console warnings are emitted on RPC error
 * so issues are visible during development without breaking the UI.
 */

import { useState, useEffect } from "react";
import {
  getPhase2Deltas,
  getRolling3mAverages,
  type Phase2DeltaRow,
  type Rolling3mRow,
} from "./phase2DeltaMetrics";

export type Phase2DeltasState = {
  /** null while loading or if the RPC failed / returned no rows */
  deltas:  Phase2DeltaRow | null;
  /**
   * Rolling 3-month averages — null while loading or if rolling_3m_averages()
   * failed / returned no rows.  Fetched in parallel with deltas.
   */
  trends:  Rolling3mRow | null;
  /** true until both fetch attempts settle (success or failure) */
  loading: boolean;
};

/**
 * Fetches month-on-month delta metrics for the given store and resolved period.
 *
 * @param storeId  UUID of the store — must match useLatestDataPeriod's storeId.
 * @param dateFrom First day of the resolved period ("YYYY-MM-DD").
 *                 An empty string means useLatestDataPeriod has not yet
 *                 initialised — the hook skips the fetch until it is set.
 * @param dateTo   Last day of the resolved period ("YYYY-MM-DD").
 */
export function usePhase2Deltas(
  storeId:  string,
  dateFrom: string,
  dateTo:   string,
): Phase2DeltasState {
  const [deltas,  setDeltas]  = useState<Phase2DeltaRow | null>(null);
  const [trends,  setTrends]  = useState<Rolling3mRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Guard: both dates must be present before fetching.
    // dateFrom is always set to the current month on init by useLatestDataPeriod,
    // so this guard only blocks if the consumer passes empty strings explicitly.
    if (!dateFrom || !dateTo) return;

    let cancelled = false;
    setLoading(true);
    setDeltas(null);
    setTrends(null);

    // Both RPCs are independent — fire in parallel for a single round-trip wait.
    Promise.all([
      getPhase2Deltas(storeId, dateFrom, dateTo),
      getRolling3mAverages(storeId, dateFrom),
    ])
      .then(([deltaResponse, trendsResponse]) => {
        if (cancelled) return;
        if (deltaResponse.errors.length > 0) {
          console.warn(
            "[Phase2Deltas] RPC error — delta badges will show '—':",
            deltaResponse.errors,
          );
        }
        if (trendsResponse.errors.length > 0) {
          console.warn(
            "[Phase2Deltas] rolling_3m_averages RPC error — trend context will show '—':",
            trendsResponse.errors,
          );
        }
        setDeltas(deltaResponse.data);
        setTrends(trendsResponse.data);
        setLoading(false);
      })
      .catch(() => {
        // Unhandled rejection (e.g. network offline).
        // Leave deltas/trends null so callers show static sentinels / "—".
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [storeId, dateFrom, dateTo]);

  return { deltas, trends, loading };
}
