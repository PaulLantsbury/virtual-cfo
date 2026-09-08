import { supabase } from "../supabase";
import { fetchTradingMetrics } from "./tradingMetrics";

export function getTradingMetrics(storeId: string, dateFrom: string, dateTo: string) {
  return fetchTradingMetrics((name, params) => supabase.rpc(name, params), storeId, dateFrom, dateTo);
}
