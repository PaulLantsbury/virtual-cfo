/** Approved v11 calculation contract. All Money values are GBP pence, not pounds. */
export type Money = number;
export type Readiness =
  | "sample"
  | "verified"
  | "loading"
  | "no-connection"
  | "incomplete"
  | "stale"
  | "failed";
export type ViewState = Readiness | "verified-quiet" | "actionable";
export type DisplayMode = "total" | "per-order";
export interface DateRange {
  from: string;
  to: string;
}
export interface ReportContext {
  businessId: string;
  currency: "GBP";
  timezone: "Europe/London";
  period: DateRange;
  comparison: DateRange | null;
  snapshotId: string;
  snapshotAsOf: string;
  formulaVersion: string;
  readiness: Readiness;
  isSample: boolean;
}
export interface HistoricalInput {
  netProductSales: Money | null;
  netShipping: Money | null;
  productCosts: Money | null;
  variableCosts: Money | null;
  advertising: Money | null;
  overheads: Money | null;
  originalOrders: number | null;
  originalOrderProductSales: Money | null;
}
export type MetricId =
  | "netProductSales"
  | "netShipping"
  | "revenue"
  | "productCosts"
  | "grossProfit"
  | "variableCosts"
  | "contributionBeforeMarketing"
  | "advertising"
  | "cm3"
  | "overheads"
  | "ebitda";
export interface HistoricalResult {
  mode: DisplayMode;
  metrics: Record<MetricId, Money | null>;
  originalOrders: number | null;
  aov: Money | null;
  grossMargin: number | null;
  ebitdaMargin: number | null;
  contributionMargin: number | null;
  breakEvenOrders: number | null;
  breakEvenRevenue: Money | null;
  complete: boolean;
  limitations: string[];
}
export interface MetricEvidence {
  metricId: string;
  context: ReportContext;
  valuePence: Money | null;
  denominator: string;
  formula: string;
  sourceCoverage: string[];
  costCoverage: "complete" | "incomplete" | "not-required";
  inclusions: string[];
  exclusions: string[];
  rounding: string;
  readiness: Readiness;
}
export type GrowthMethod = "orders" | "spend-cpa" | "traffic-conversion";
export interface ScenarioCommon {
  aov: Money | null;
  marketing: Money | null;
  refunds: Money | null;
  netShipping: Money | null;
  productCostPerOrder: Money | null;
  returnedStockRecovery: Money | null;
  shippingPerOrder: Money | null;
  fulfilmentPerOrder: Money | null;
  paymentPerOrder: Money | null;
  staff: Money | null;
  otherOverheads: Money | null;
}
export interface ScenarioMethods {
  orders: { orders: number | null };
  "spend-cpa": { cpa: Money | null; otherOrders: number | null };
  "traffic-conversion": { sessions: number | null; conversion: number | null };
}
export interface ScenarioInput {
  method: GrowthMethod;
  common: ScenarioCommon;
  methods: ScenarioMethods;
}
export interface ScenarioResult {
  state: "ready" | "needs-assumptions";
  method: GrowthMethod;
  orders: number | null;
  netProductSales: Money | null;
  revenue: Money | null;
  productCosts: Money | null;
  variableCosts: Money | null;
  cm3: Money | null;
  ebitda: Money | null;
  formula: string;
  issues: string[];
  baselineId: "ILLUSTRATIVE-MONTH-B01";
  formulaVersion: string;
}
