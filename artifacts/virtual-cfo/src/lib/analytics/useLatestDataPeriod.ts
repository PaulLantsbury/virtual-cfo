import { useState, useEffect } from "react";
import { getPhase1Metrics, type Phase1MetricsResponse } from "./phase1Metrics";
import { useTimeline } from "@/lib/timeline";
import { supabase } from "../supabase";
import { getReportingPeriod, resolveReportingPeriod, type PeriodStatus } from "./reportingPeriod";

export type LatestDataPeriod = {
  phase1: Phase1MetricsResponse | null;
  dateFrom: string;
  dateTo: string;
  periodLabel: string;
  loading: boolean;
  status: PeriodStatus;
};

export function useLatestDataPeriod(storeId: string): LatestDataPeriod {
  const { timeline } = useTimeline();
  const key = `${storeId}:${timeline}`;
  const [state, setState] = useState<(LatestDataPeriod & { key: string }) | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setState(null);
    resolveReportingPeriod({
      timeline,
      signal: controller.signal,
      countOrders: async ({ dateFrom, dateTo }) => {
        const { data, error } = await supabase.rpc("order_count", {
          p_store_id: storeId, p_date_from: dateFrom, p_date_to: dateTo,
        }).abortSignal(controller.signal);
        if (error || data === null) throw new Error("Order availability could not be checked");
        return Number(data);
      },
      loadMetrics: ({ dateFrom, dateTo }) => getPhase1Metrics(storeId, dateFrom, dateTo),
    }).then(result => {
      if (controller.signal.aborted) return;
      setState({ key, phase1: result.metrics, dateFrom: result.dateFrom, dateTo: result.dateTo,
        periodLabel: result.label, loading: false, status: result.status });
    }).catch(() => { /* Cancellation on unmount or store/period change. */ });
    return () => controller.abort();
  }, [storeId, timeline, key]);

  if (state?.key === key) return state;
  const pending = getReportingPeriod(timeline);
  return { phase1: null, dateFrom: pending.dateFrom, dateTo: pending.dateTo,
    periodLabel: pending.label, loading: true, status: "loading" };
}
