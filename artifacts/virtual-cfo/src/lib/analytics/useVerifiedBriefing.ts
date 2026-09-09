import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useTimeline } from "../timeline";
import { getReportingPeriod } from "./reportingPeriod";
import { buildVerifiedBriefing } from "./verifiedBriefing";
import { fetchVerifiedSales } from "../../../../../experiments/financial-v1/rpc-sales-adapter.mjs";

export function useVerifiedBriefing(storeId: string) {
  const { timeline } = useTimeline();
  // The verified staging stores use Europe/London and GBP. Other store settings
  // require explicit configuration before this bounded integration is expanded.
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date());
  const part = (name: string) => Number(parts.find(p => p.type === name)!.value);
  const now = new Date(part("year"), part("month") - 1, part("day"), 12);
  const period = getReportingPeriod(timeline, 0, now);
  const prior = getReportingPeriod(timeline, 1, now);
  const read = (from: string, to: string) => fetchVerifiedSales((name, params) => supabase.rpc(name, params), { storeId, currency: "GBP", from, to });
  const current = useQuery({ queryKey: ["verified-sales", storeId, period.dateFrom, period.dateTo], retry: false,
    queryFn: () => read(period.dateFrom, period.dateTo) });
  const previous = useQuery({ queryKey: ["verified-sales", storeId, prior.dateFrom, prior.dateTo], retry: false, enabled: current.isSuccess,
    queryFn: () => read(prior.dateFrom, prior.dateTo) });
  const comparisonStatus = previous.isPending ? "loading" : previous.isError ? "error" : "ready";
  return { period, loading: current.isPending,
    comparison: { status: comparisonStatus, period: prior },
    briefing: current.isSuccess ? buildVerifiedBriefing(current.data, previous.data ?? null, comparisonStatus) : null };
}
