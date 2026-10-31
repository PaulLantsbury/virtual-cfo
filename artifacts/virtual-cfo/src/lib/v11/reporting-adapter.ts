import { calculateHistorical } from "./calculations.ts";
import { FORMULA_VERSION } from "./fixtures.ts";
import type {
  DateRange,
  DisplayMode,
  HistoricalInput,
  HistoricalResult,
  ReportContext,
} from "./types.ts";
import { validRange } from "./periods.ts";
/** Structural subset of useSalesReporting().data; source amounts are already pence. */
export interface SupportedSalesReport {
  grossProductSales: number;
  discounts: number;
  netProductSales: number;
  netShipping: number;
  originalOrders: number;
  aov: { value: number | null; reason: string | null };
  provenance: {
    storeId: string;
    currency: string;
    from: string;
    to: string;
    coverageEvidence: string;
  };
}
/** Structural subset of useProfitReporting().report. Overheads INCLUDE D&A here. */
export interface SupportedProfitMetric {
  value: number | null;
  state: "ready" | "unavailable";
  reason: string | null;
}
export interface SupportedProfitReport {
  scope: { storeId: string; currency: string; from: string; to: string };
  state: "complete" | "partial" | "unavailable";
  reason: string | null;
  cogs: SupportedProfitMetric;
  variableCosts: SupportedProfitMetric;
  advertising: SupportedProfitMetric;
  overheads: SupportedProfitMetric;
  da: SupportedProfitMetric;
  grossProfit: SupportedProfitMetric;
  contributionBeforeMarketing: SupportedProfitMetric;
  contribution: SupportedProfitMetric;
  ebitda: SupportedProfitMetric;
  sales?: SupportedSalesReport | null;
}
export interface ReportingAdapterInput {
  expected: {
    storeId: string;
    currency: string;
    timezone: string;
    period: DateRange;
  };
  sales: SupportedSalesReport | null;
  profit: SupportedProfitReport | null;
  access: "allowed" | "denied";
  freshness: "current" | "stale" | "failed" | "invalidated";
  /** Only a caller-verified date/version may be supplied; hooks currently do not expose all of these. */
  snapshot: { id: string; asOf: string } | null;
  retainedScope?: {
    storeId: string;
    currency: string;
    from: string;
    to: string;
  } | null;
  mode?: DisplayMode;
}
const empty: HistoricalInput = {
  netProductSales: null,
  netShipping: null,
  productCosts: null,
  variableCosts: null,
  advertising: null,
  overheads: null,
  originalOrders: null,
  originalOrderProductSales: null,
};
const safePence = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value);
function matches(
  scope:
    | { storeId: string; currency: string; from: string; to: string }
    | undefined,
  input: ReportingAdapterInput,
) {
  const e = input.expected;
  return (
    !!scope &&
    scope.storeId === e.storeId &&
    scope.currency === e.currency &&
    scope.from === e.period.from &&
    scope.to === e.period.to
  );
}
function readMetric(metric: SupportedProfitMetric | undefined): number | null {
  return metric?.state === "ready" && safePence(metric.value)
    ? metric.value
    : null;
}
/** Pure adapter over already authorised existing reporting results. No fetch, grant, fixture fallback or Xero merge. */
export function adaptSupportedReporting(input: ReportingAdapterInput): {
  state: "supported" | "partial" | "stale" | "unavailable" | "denied";
  context: ReportContext | null;
  result: HistoricalResult;
  issues: string[];
  source: "shopify-operational";
  isRetained: boolean;
} {
  const issues: string[] = [],
    mode = input.mode ?? "total",
    unavailable = calculateHistorical(empty, mode);
  const fail = (state: "unavailable" | "denied") => ({
    state,
    context: null,
    result: unavailable,
    issues,
    source: "shopify-operational" as const,
    isRetained: false,
  });
  if (input.access !== "allowed") {
    issues.push("Evidence access is not authorised for this business.");
    return fail("denied");
  }
  if (
    !["current", "stale", "failed", "invalidated"].includes(input.freshness)
  ) {
    issues.push("Source freshness state is not recognised.");
    return fail("unavailable");
  }
  const expected = input.expected;
  if (
    !expected.storeId ||
    expected.currency !== "GBP" ||
    expected.timezone !== "Europe/London" ||
    !validRange(expected.period)
  ) {
    issues.push(
      "This v11 adapter requires a verified GBP / Europe/London business and valid date scope.",
    );
    return fail("unavailable");
  }
  if (input.freshness === "invalidated") {
    issues.push(
      "Source evidence was invalidated; previous values require review.",
    );
    return fail("unavailable");
  }
  const isRetained =
    input.freshness === "stale" || input.freshness === "failed";
  if (isRetained && !matches(input.retainedScope ?? undefined, input)) {
    issues.push(
      "A failed/stale refresh has no supported same-scope retained snapshot.",
    );
    return fail("unavailable");
  }
  if (
    !input.snapshot?.id ||
    !input.snapshot.asOf ||
    !Number.isFinite(Date.parse(input.snapshot.asOf))
  ) {
    issues.push(
      "A verified dated snapshot is required; a fetch time must not be substituted.",
    );
    return fail("unavailable");
  }
  const sales = input.sales;
  if (
    !sales ||
    !matches(sales.provenance, input) ||
    !sales.provenance.coverageEvidence
  ) {
    issues.push(
      "Supported sales evidence does not match the selected business, currency and dates.",
    );
    return fail("unavailable");
  }
  if (
    ![
      sales.grossProductSales,
      sales.discounts,
      sales.netProductSales,
      sales.netShipping,
    ].every(safePence) ||
    !Number.isSafeInteger(sales.originalOrders) ||
    sales.originalOrders < 0
  ) {
    issues.push("Sales money or original-order evidence is invalid.");
    return fail("unavailable");
  }
  const originalProduct = sales.grossProductSales - sales.discounts;
  if (!Number.isSafeInteger(originalProduct)) {
    issues.push("Original-order product amount exceeds safe precision.");
    return fail("unavailable");
  }
  const historical: HistoricalInput = {
    ...empty,
    netProductSales: sales.netProductSales,
    netShipping: sales.netShipping,
    originalOrders: sales.originalOrders,
    originalOrderProductSales: originalProduct,
  };
  let profit = input.profit;
  if (
    profit &&
    !["complete", "partial", "unavailable"].includes(profit.state)
  ) {
    issues.push(
      "Profit report state is not recognised; supported sales are retained.",
    );
    profit = null;
  }
  if (profit && !matches(profit.scope, input)) {
    issues.push(
      "Profit evidence does not match the selected scope; supported sales are retained.",
    );
    profit = null;
  }
  if (
    profit?.sales &&
    (!matches(profit.sales.provenance, input) ||
      profit.sales.netProductSales !== sales.netProductSales ||
      profit.sales.netShipping !== sales.netShipping ||
      profit.sales.originalOrders !== sales.originalOrders)
  ) {
    issues.push("Profit and sales evidence conflict; profit is withheld.");
    profit = null;
  }
  if (profit && profit.state !== "unavailable") {
    historical.productCosts = readMetric(profit.cogs);
    historical.variableCosts = readMetric(profit.variableCosts);
    historical.advertising = readMetric(profit.advertising);
    const includingDa = readMetric(profit.overheads),
      da = readMetric(profit.da);
    historical.overheads =
      includingDa !== null &&
      da !== null &&
      Number.isSafeInteger(includingDa - da)
        ? includingDa - da
        : null;
  }
  let result = calculateHistorical(historical, mode);
  // Retain the source's individual subtotal readiness; never promote an unavailable report metric by re-derivation.
  if (profit) {
    const reported = {
      grossProfit: readMetric(profit.grossProfit),
      contributionBeforeMarketing: readMetric(
        profit.contributionBeforeMarketing,
      ),
      cm3: readMetric(profit.contribution),
      ebitda: readMetric(profit.ebitda),
    };
    const total = calculateHistorical(historical);
    let conflict = false;
    for (const key of Object.keys(reported) as (keyof typeof reported)[]) {
      if (reported[key] !== null && total.metrics[key] !== reported[key]) {
        issues.push(
          `${key} does not reconcile with its supported source components; profit is withheld.`,
        );
        conflict = true;
      }
    }
    if (conflict) {
      historical.productCosts = null;
      historical.variableCosts = null;
      historical.advertising = null;
      historical.overheads = null;
      result = calculateHistorical(historical, mode);
    } else
      for (const key of Object.keys(reported) as (keyof typeof reported)[])
        if (reported[key] === null) result.metrics[key] = null;
    if (result.metrics.grossProfit === null) result.grossMargin = null;
    if (result.metrics.cm3 === null) {
      result.contributionMargin = null;
      result.breakEvenOrders = null;
      result.breakEvenRevenue = null;
    }
    if (result.metrics.ebitda === null) result.ebitdaMargin = null;
    result.complete = Object.values(result.metrics).every(
      (value) => value !== null && Number.isFinite(value),
    );
  }
  const complete = result.complete;
  if (!complete)
    issues.push(
      "Profit evidence is partial; independently supported sales and subtotals remain visible.",
    );
  if (isRetained)
    issues.push(
      "Showing a dated same-scope retained snapshot; the latest refresh did not establish current freshness.",
    );
  const context: ReportContext = {
    businessId: expected.storeId,
    currency: "GBP",
    timezone: "Europe/London",
    period: { ...expected.period },
    comparison: null,
    snapshotId: input.snapshot.id,
    snapshotAsOf: input.snapshot.asOf,
    formulaVersion: FORMULA_VERSION,
    readiness: isRetained ? "stale" : complete ? "verified" : "incomplete",
    isSample: false,
  };
  return {
    state: isRetained ? "stale" : complete ? "supported" : "partial",
    context,
    result,
    issues,
    source: "shopify-operational",
    isRetained,
  };
}
