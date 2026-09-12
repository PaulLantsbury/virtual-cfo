import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useTimeline } from "../timeline";
import { parseStoreReporting, storeReportingPeriod } from "./storeReporting";
import { buildVerifiedBriefing } from "./verifiedBriefing";
import { fetchVerifiedSales } from "../../../../../experiments/financial-v1/rpc-sales-adapter.mjs";

export function useVerifiedBriefing(storeId: string) {
  const { timeline } = useTimeline();
  const settings = useStoreReporting(storeId);
  const config = settings.isSuccess ? settings.data : null;
  const absent = {dateFrom:"", dateTo:"", label:"Reporting settings unavailable"};
  const period = config ? storeReportingPeriod(timeline, config.timezone) : absent;
  const prior = config ? storeReportingPeriod(timeline, config.timezone, 1) : absent;
  const read = (from: string, to: string) => {
    if(!config) throw new Error("Store reporting settings unavailable");
    return fetchVerifiedSales((name, params) => supabase.rpc(name, params), { storeId, currency: config.currency, from, to });
  };
  const current = useQuery({ queryKey: ["verified-sales", storeId, config?.currency, config?.timezone, period.dateFrom, period.dateTo], retry: false, enabled: !!config,
    queryFn: () => read(period.dateFrom, period.dateTo) });
  const previous = useQuery({ queryKey: ["verified-sales", storeId, config?.currency, config?.timezone, prior.dateFrom, prior.dateTo], retry: false, enabled: !!config && current.isSuccess,
    queryFn: () => read(prior.dateFrom, prior.dateTo) });
  const comparisonStatus = previous.isPending ? "loading" : previous.isError ? "error" : "ready";
  return { period, loading: settings.isPending || (!!config && current.isPending),
    comparison: { status: comparisonStatus, period: prior },
    briefing: config && current.isSuccess ? buildVerifiedBriefing(current.data, previous.data ?? null, comparisonStatus) : null };
}

export function useStoreReporting(storeId: string) {
  return useQuery({ queryKey: ["store-reporting", storeId], retry: false,
    queryFn: async () => {
      const {data, error} = await supabase.from("stores").select("id,currency_code,timezone").eq("id", storeId).single();
      if(error) throw new Error("Store reporting settings unavailable");
      return parseStoreReporting(data, storeId);
    } });
}
