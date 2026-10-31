import type {
  DisplayMode,
  HistoricalInput,
  HistoricalResult,
  MetricId,
  Money,
  ScenarioInput,
  ScenarioResult,
} from "./types.ts";
import { FORMULA_VERSION, SCENARIO_BASELINE } from "./fixtures.ts";
const finite = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);
const sum = (...values: (number | null)[]): number | null => {
  if (!values.every((value) => finite(value) && Number.isSafeInteger(value)))
    return null;
  const value = (values as number[]).reduce((a, b) => a + b, 0);
  return Number.isSafeInteger(value) ? value : null;
};
const difference = (a: number | null, b: number | null) =>
  finite(a) && finite(b) && Number.isSafeInteger(a - b) ? a - b : null;
export const safeRatio = (
  numerator: number | null,
  denominator: number | null,
): number | null =>
  finite(numerator) &&
  finite(denominator) &&
  denominator > 0 &&
  Number.isFinite(numerator / denominator)
    ? numerator / denominator
    : null;
/** Change is unavailable against a zero/missing comparison; never fabricate infinity. */
export const percentageChange = (
  current: number | null,
  comparison: number | null,
): number | null =>
  finite(current) &&
  finite(comparison) &&
  comparison > 0 &&
  Number.isFinite((current - comparison) / comparison)
    ? (current - comparison) / comparison
    : null;
export function calculateHistorical(
  input: HistoricalInput,
  mode: DisplayMode = "total",
): HistoricalResult {
  const valid = (n: number | null) =>
    finite(n) && Number.isSafeInteger(n) ? n : null;
  const netProductSales = valid(input.netProductSales),
    netShipping = valid(input.netShipping),
    productCosts = valid(input.productCosts),
    variableCosts = valid(input.variableCosts),
    advertising = valid(input.advertising),
    overheads = valid(input.overheads);
  const revenue = sum(netProductSales, netShipping),
    grossProfit = difference(netProductSales, productCosts);
  const contributionBeforeMarketing = difference(
      sum(grossProfit, netShipping),
      variableCosts,
    ),
    cm3 = difference(contributionBeforeMarketing, advertising),
    ebitda = difference(cm3, overheads);
  const orders =
    finite(input.originalOrders) &&
    Number.isSafeInteger(input.originalOrders) &&
    input.originalOrders >= 0
      ? input.originalOrders
      : null;
  const totals: Record<MetricId, Money | null> = {
    netProductSales,
    netShipping,
    revenue,
    productCosts,
    grossProfit,
    variableCosts,
    contributionBeforeMarketing,
    advertising,
    cm3,
    overheads,
    ebitda,
  };
  const metrics = Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [
      key,
      mode === "per-order" ? safeRatio(value, orders) : value,
    ]),
  ) as HistoricalResult["metrics"];
  const contributionPerOrder = safeRatio(cm3, orders);
  const wholeOrderBreakEven =
    finite(overheads) &&
    finite(contributionPerOrder) &&
    overheads >= 0 &&
    contributionPerOrder > 0
      ? overheads / contributionPerOrder
      : null;
  const limitations: string[] = [];
  if (productCosts === null)
    limitations.push(
      "Product costs are incomplete; profit-dependent results are unavailable.",
    );
  if (variableCosts === null || advertising === null)
    limitations.push(
      "Variable costs or advertising are incomplete; contribution is unavailable.",
    );
  if (overheads === null)
    limitations.push("Overheads are incomplete; EBITDA is unavailable.");
  if (mode === "per-order" && (!finite(orders) || orders <= 0))
    limitations.push(
      "Per order unavailable: a reliable positive original-order count is required.",
    );
  if (revenue === null || revenue <= 0)
    limitations.push("Revenue margin interpretation is unavailable.");
  return {
    mode,
    metrics,
    originalOrders: orders,
    aov: safeRatio(valid(input.originalOrderProductSales), orders),
    grossMargin: safeRatio(grossProfit, netProductSales),
    ebitdaMargin: safeRatio(ebitda, revenue),
    contributionMargin: safeRatio(cm3, revenue),
    breakEvenOrders:
      wholeOrderBreakEven === null ? null : Math.ceil(wholeOrderBreakEven),
    breakEvenRevenue:
      finite(wholeOrderBreakEven) &&
      finite(revenue) &&
      finite(orders) &&
      orders > 0
        ? wholeOrderBreakEven * (revenue / orders)
        : null,
    complete: Object.values(metrics).every(finite),
    limitations,
  };
}
export function aggregateHistorical(
  inputs: HistoricalInput[],
): HistoricalInput {
  const keys: (keyof HistoricalInput)[] = [
    "netProductSales",
    "netShipping",
    "productCosts",
    "variableCosts",
    "advertising",
    "overheads",
    "originalOrders",
    "originalOrderProductSales",
  ];
  return Object.fromEntries(
    keys.map((key) => [
      key,
      inputs.length ? sum(...inputs.map((input) => input[key])) : null,
    ]),
  ) as unknown as HistoricalInput;
}
export function calculateScenario(input: ScenarioInput): ScenarioResult {
  const method = input.method,
    common = input.common,
    issues: string[] = [];
  const base = {
    state: "needs-assumptions" as const,
    method,
    orders: null,
    netProductSales: null,
    revenue: null,
    productCosts: null,
    variableCosts: null,
    cm3: null,
    ebitda: null,
    formula: "",
    issues,
    baselineId: "ILLUSTRATIVE-MONTH-B01" as const,
    formulaVersion: FORMULA_VERSION,
  };
  for (const [key, value] of Object.entries(common))
    if (!finite(value) || !Number.isSafeInteger(value) || value < 0)
      issues.push(`${key}: enter a non-negative amount.`);
  const required = (key: keyof typeof common) => {
    if (!(key in common)) issues.push(`${key}: enter an amount.`);
  };
  (
    [
      "aov",
      "marketing",
      "refunds",
      "netShipping",
      "productCostPerOrder",
      "returnedStockRecovery",
      "shippingPerOrder",
      "fulfilmentPerOrder",
      "paymentPerOrder",
      "staff",
      "otherOverheads",
    ] as const
  ).forEach(required);
  let orders: number | null = null,
    formula = "";
  if (method === "orders") {
    orders = input.methods.orders.orders;
    formula =
      "Orders = directly entered total orders. Marketing changes cost only.";
    if (!finite(orders) || orders < 0)
      issues.push("orders: enter non-negative total orders.");
  } else if (method === "spend-cpa") {
    const { cpa, otherOrders } = input.methods["spend-cpa"];
    formula =
      "Orders = performance marketing spend / CPA + Other orders (excluding paid first orders).";
    if (!finite(cpa) || cpa <= 0)
      issues.push("cpa: enter a CPA greater than zero.");
    if (!finite(otherOrders) || otherOrders < 0)
      issues.push("otherOrders: enter non-negative Other orders.");
    if (
      finite(cpa) &&
      cpa > 0 &&
      finite(otherOrders) &&
      finite(common.marketing)
    )
      orders = common.marketing / cpa + otherOrders;
  } else if (method === "traffic-conversion") {
    const { sessions, conversion } = input.methods["traffic-conversion"];
    formula =
      "Orders = whole-site sessions × eligible orders per session. No Other orders are added.";
    if (!finite(sessions) || sessions < 0)
      issues.push("sessions: enter non-negative whole-site sessions.");
    if (!finite(conversion) || conversion < 0 || conversion > 1)
      issues.push(
        "conversion: enter an eligible orders-per-session rate between 0% and 100%.",
      );
    if (finite(sessions) && finite(conversion)) orders = sessions * conversion;
  } else issues.push("method: select one supported growth method.");
  if (issues.length || !finite(orders)) return { ...base, formula };
  // Validated all common fields above. Fractions are retained for sensitivity calculations.
  const c = common as Record<keyof typeof common, number>;
  const netProductSales = orders * c.aov - c.refunds,
    revenue = netProductSales + c.netShipping;
  const productCosts = orders * c.productCostPerOrder - c.returnedStockRecovery;
  if (productCosts < 0)
    return {
      ...base,
      formula,
      issues: [
        "Returned-stock recovery exceeds the modelled product cost. Review the evidence.",
      ],
    };
  const variableCosts =
    orders * (c.shippingPerOrder + c.fulfilmentPerOrder + c.paymentPerOrder);
  const cm3 = revenue - productCosts - variableCosts - c.marketing,
    ebitda = cm3 - c.staff - c.otherOverheads;
  if (
    ![netProductSales, revenue, productCosts, variableCosts, cm3, ebitda].every(
      (value) =>
        Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER,
    )
  )
    return {
      ...base,
      formula,
      issues: ["Assumptions exceed the supported calculation range."],
    };
  return {
    ...base,
    state: "ready",
    orders,
    netProductSales,
    revenue,
    productCosts,
    variableCosts,
    cm3,
    ebitda,
    formula,
  };
}
/** Volume first, then AOV at scenario volume; interactions are counted once. */
export function scenarioBridge(
  input: ScenarioInput,
  baselineInput: ScenarioInput = SCENARIO_BASELINE,
) {
  const result = calculateScenario(input),
    baseline = calculateScenario(baselineInput);
  if (result.state !== "ready" || baseline.state !== "ready") return null;
  const c = input.common as Record<keyof ScenarioInput["common"], number>,
    b = baselineInput.common as Record<keyof ScenarioInput["common"], number>;
  const volume =
    (result.orders! - baseline.orders!) *
    (b.aov -
      b.productCostPerOrder -
      b.shippingPerOrder -
      b.fulfilmentPerOrder -
      b.paymentPerOrder);
  const aov = result.orders! * (c.aov - b.aov),
    marketing = -(c.marketing - b.marketing);
  const total = result.ebitda! - baseline.ebitda!;
  // Changes to shared costs/overheads/refunds/shipping remain transparent, not attributed to volume/AOV.
  const other = total - volume - aov - marketing;
  return {
    baseline: baseline.ebitda!,
    volume,
    aov,
    marketing,
    other,
    result: result.ebitda!,
    change: total,
  };
}
