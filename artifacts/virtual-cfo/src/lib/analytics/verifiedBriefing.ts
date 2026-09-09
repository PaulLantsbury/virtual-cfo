import { buildBriefing, type TradingMetrics, type ComparisonStatus } from "./briefing.ts";
import type { VerifiedSales } from "../../../../../experiments/financial-v1/rpc-sales-adapter.mjs";

function metrics(s: VerifiedSales): TradingMetrics {
  return { grossRevenue: s.grossProductSales / 100, netSales: s.netProductSales / 100,
    averageOrderValue: s.aov.value === null ? NaN : s.aov.value / 100,
    discountDependency: s.grossProductSales > 0 ? s.discounts / s.grossProductSales : NaN,
    repeatPurchaseRate: NaN, refundRate: NaN };
}

export function buildVerifiedBriefing(current: VerifiedSales, previous: VerifiedSales | null, status: ComparisonStatus) {
  const result = buildBriefing(metrics(current), previous ? metrics(previous) : null, status);
  const explanations: Record<string, string> = {
    netSales: "Product sales after discounts and refunds recorded in this period, excluding VAT and shipping.",
    grossRevenue: "Original product sales before discounts and refunds, excluding VAT and shipping.",
    averageOrderValue: "Original product sales after discounts, excluding VAT and shipping, per qualifying original order. Later refunds do not change this value.",
    discountDependency: "Product discounts excluding VAT divided by gross product sales. Unavailable when gross product sales are zero.",
  };
  const money = (pence: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
  const activity = !current.hasActivity ? "Verified coverage shows no sales or refunds in this period."
    : current.originalOrders === 0 && current.hasRefundActivity ? "This period contains refunds from earlier sales and no new qualifying orders. Original average order value is unavailable."
    : `${current.originalOrders} qualifying original order${current.originalOrders === 1 ? "" : "s"} in this period.`;
  return { ...result,
    summary: `${activity} Net product sales were ${money(current.netProductSales)}. ${result.metrics[0].direction === "unknown" ? "A change in performance cannot be established without a verified previous period." : `The change from the previous period was ${result.metrics[0].change}.`} Sales movement does not establish profitability or its causes.`,
    metrics: result.metrics.filter(m => m.id in explanations).map(m => ({ ...m,
      title: m.id === "netSales" ? "Net product sales" : m.id === "grossRevenue" ? "Gross product sales" : m.title,
      value: m.id === "netSales" ? money(current.netProductSales) : m.id === "grossRevenue" ? money(current.grossProductSales) : m.value,
      change: m.value === "Unavailable" ? "No comparison available" : m.change,
      explanation: explanations[m.id] })),
    signals: result.signals.map(signal => signal.title === "Review the sales change" ? { ...signal, evidence: `Net product sales: ${money(current.netProductSales)} (${result.metrics[0].change} versus the previous period).` } : signal),
    refunds: money(current.productRefundExVat), shipping: money(current.netShipping),
  };
}
