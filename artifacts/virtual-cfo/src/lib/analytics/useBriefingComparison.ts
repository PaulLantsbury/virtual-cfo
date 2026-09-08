import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { getPhase1Metrics } from "./phase1Metrics";
import { previousReportingPeriod, type ComparisonStatus, type TradingMetrics } from "./briefing";
import type { ReportingTimeline } from "./reportingPeriod";

export function useBriefingComparison(storeId: string, dateFrom: string, timeline: ReportingTimeline, enabled: boolean) {
  const period = previousReportingPeriod(dateFrom, timeline);
  const key = `${storeId}:${period.dateFrom}:${period.dateTo}:${enabled}`;
  const [state, setState] = useState<{ key: string; status: ComparisonStatus; data: TradingMetrics | null } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const publish = (status: ComparisonStatus, data: TradingMetrics | null = null) => {
      if (!controller.signal.aborted) setState({ key, status, data });
    };
    (async () => {
      try {
        const { data: count, error } = await supabase.rpc("order_count", {
          p_store_id: storeId, p_date_from: period.dateFrom, p_date_to: period.dateTo,
        }).abortSignal(controller.signal);
        const orders = Number(count);
        if (error || count === null || !Number.isSafeInteger(orders) || orders < 0) { publish("error"); return; }
        if (orders === 0) { publish("empty"); return; }
        if (controller.signal.aborted) return;
        const result = await getPhase1Metrics(storeId, period.dateFrom, period.dateTo);
        if (result.errors.length) { publish("error"); return; }
        publish("ready", result.data);
      } catch { publish("error"); }
    })();
    return () => controller.abort();
  }, [key, enabled, storeId, period.dateFrom, period.dateTo]);
  return { period, status: enabled && state?.key === key ? state.status : "loading" as ComparisonStatus,
    data: enabled && state?.key === key ? state.data : null };
}
