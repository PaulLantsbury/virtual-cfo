import { getReportingPeriod, type ReportingTimeline } from "./reportingPeriod.ts";

export type TradingMetrics = {
  grossRevenue: number; netSales: number; averageOrderValue: number;
  repeatPurchaseRate: number; discountDependency: number; refundRate: number;
};
export type ComparisonStatus = "loading" | "ready" | "empty" | "error";
export type BriefingMetric = {
  id: keyof TradingMetrics; title: string; value: string; change: string;
  direction: "up" | "down" | "flat" | "unknown"; explanation: string;
};
export type ReviewSignal = { title: string; evidence: string; href: string };

export function previousReportingPeriod(dateFrom: string, timeline: ReportingTimeline) {
  // At the start of the active period, the previous period is fully complete.
  return getReportingPeriod(timeline, 0, new Date(`${dateFrom}T12:00:00`));
}

const definitions: { id: keyof TradingMetrics; title: string; rate: boolean; explanation: string }[] = [
  { id: "netSales", title: "Net sales", rate: false, explanation: "Sales after discounts, refunds and tax, excluding cancelled orders." },
  { id: "grossRevenue", title: "Gross sales", rate: false, explanation: "Gross sales on non-cancelled orders in this period." },
  { id: "averageOrderValue", title: "Average order value", rate: false, explanation: "Net sales per qualifying order; fully refunded orders are excluded from the order count." },
  { id: "repeatPurchaseRate", title: "Repeat purchase rate", rate: true, explanation: "Share of linked purchasing customers who first ordered before this period. Customers without a linked customer record are excluded." },
  { id: "discountDependency", title: "Discount rate", rate: true, explanation: "Discount value as a share of gross sales." },
  { id: "refundRate", title: "Refund rate", rate: true, explanation: "Refund value as a share of gross sales, attributed to the original order period." },
];

export function buildBriefing(current: TradingMetrics, previous: TradingMetrics | null, comparisonStatus: ComparisonStatus) {
  const comparable = comparisonStatus === "ready" && previous !== null;
  const comparisonNote = comparisonStatus === "loading" ? "Checking the previous period"
    : comparisonStatus === "empty" ? "No qualifying orders in the previous period — no comparison available"
    : comparisonStatus === "error" ? "Previous-period data unavailable — no comparison shown"
    : "Compared with the immediately preceding completed period";
  const metrics: BriefingMetric[] = definitions.map(def => {
    const value = current[def.id];
    const valid = Number.isFinite(value);
    const prior = comparable ? previous[def.id] : null;
    const canCompare = valid && prior !== null && Number.isFinite(prior);
    const delta = canCompare ? value - prior : null;
    const direction = delta === null ? "unknown" : Math.abs(delta) < 1e-9 ? "flat" : delta > 0 ? "up" : "down";
    let change = comparisonNote;
    if (delta !== null) {
      const prefix = delta > 0 ? "+" : delta < 0 ? "−" : "";
      if (def.rate) change = `${prefix}${(Math.abs(delta) * 100).toFixed(1)} percentage points`;
      else if (prior! > 0) change = `${prefix}${(Math.abs(delta) / prior! * 100).toFixed(1)}%`;
      else change = `${prefix}£${Math.abs(delta).toLocaleString("en-GB", { maximumFractionDigits: 2 })} (percentage comparison unavailable)`;
    }
    return { id: def.id, title: def.title,
      value: !valid ? "Unavailable" : def.rate ? `${(value * 100).toFixed(1)}%`
        : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: def.id === "averageOrderValue" ? 2 : 0 }).format(value),
      change, direction, explanation: def.explanation };
  });
  const sales = metrics.find(metric => metric.id === "netSales")!;
  const headline = sales.direction === "up" ? "Net sales increased"
    : sales.direction === "down" ? "Net sales decreased"
    : sales.direction === "flat" ? "Net sales were unchanged"
    : "Your trading period at a glance";
  const summary = sales.direction === "unknown"
    ? "The selected period’s trading figures are available. A change in performance cannot be established without a verified previous period."
    : `${sales.title} were ${sales.value}, with a change of ${sales.change} from the previous period. This describes sales movement; it does not establish profitability or explain what caused the change.`;
  const signals: ReviewSignal[] = [];
  for (const [id, title, href, direction] of [
    ["discountDependency", "Review discounting", "/pricing-optimisation", "up"],
    ["refundRate", "Review refunds", "/margin-analysis", "up"],
    ["repeatPurchaseRate", "Review repeat purchasing", "/growth-quality", "down"],
    ["netSales", "Review the sales change", "/growth-quality", "down"],
  ] as const) {
    const metric = metrics.find(m => m.id === id)!;
    if (metric.direction === direction) signals.push({ title, evidence: `${metric.title}: ${metric.value} (${metric.change} versus the previous period).`, href });
  }
  return { headline, summary, metrics, signals, comparisonNote };
}
