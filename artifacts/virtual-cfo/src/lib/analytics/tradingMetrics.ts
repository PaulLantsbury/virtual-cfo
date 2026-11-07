import { parseRpcNumber } from "./numeric.ts";
import type { TradingMetrics } from "./briefing.ts";

export const tradingSources = {
  grossRevenue: "gross_revenue", netSales: "net_sales", averageOrderValue: "average_order_value",
  repeatPurchaseRate: "repeat_purchase_rate", discountDependency: "discount_dependency", refundRate: "refund_rate",
} as const;
export type TradingMetricsResponse = {
  data: TradingMetrics;
  errors: { fn: string; message: string }[];
};
export type TradingRpc = (name: string, params: { p_store_id: string; p_date_from: string; p_date_to: string }) =>
  PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** Only trading sources belong in a trading briefing. Financial estimates have
 * separate completeness requirements and must not make these six reads fail.
 * Failed fields use NaN, so even an unchecked formatter cannot present them as zero.
 */
export async function fetchTradingMetrics(rpc: TradingRpc, storeId: string, dateFrom: string, dateTo: string): Promise<TradingMetricsResponse> {
  const params = { p_store_id: storeId, p_date_from: dateFrom, p_date_to: dateTo };
  const results = await Promise.all(Object.entries(tradingSources).map(async ([field, fn]) => {
    try {
      const { data, error } = await rpc(fn, params);
      const value = parseRpcNumber(data);
      return { field, value: error ? NaN : value ?? NaN,
        error: error ? { fn, message: error.message } : value === null ? { fn, message: "Missing or invalid numeric result" } : null };
    } catch {
      return { field, value: NaN, error: { fn, message: "Trading metric request failed" } };
    }
  }));
  return { data: Object.fromEntries(results.map(r => [r.field, r.value])) as TradingMetrics,
    errors: results.flatMap(r => r.error ? [r.error] : []) };
}
