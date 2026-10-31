import {
  calculateHistorical,
  safeRatio,
  percentageChange,
  calculateScenario,
  scenarioBridge,
} from "./calculations.ts";
import { V11_SAMPLE } from "./fixtures.ts";
import type {
  DisplayMode,
  HistoricalResult,
  Money,
  ScenarioInput,
} from "./types.ts";
export const pounds = (value: Money | null): number | null =>
  value === null ? null : value / 100;
export function formatMoney(
  valuePence: Money | null,
  options: { decimals?: number; sign?: boolean } = {},
) {
  if (valuePence === null || !Number.isFinite(valuePence)) return "Unavailable";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: options.decimals ?? 0,
    maximumFractionDigits: options.decimals ?? 0,
    signDisplay: options.sign ? "exceptZero" : "auto",
  }).format(valuePence / 100);
}
export function formatPercent(ratio: number | null, decimals = 1) {
  return ratio === null || !Number.isFinite(ratio)
    ? "Unavailable"
    : new Intl.NumberFormat("en-GB", {
        style: "percent",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(ratio);
}
export function historicalView(result: HistoricalResult) {
  const m = result.metrics;
  return {
    netSales: pounds(m.netProductSales),
    netProductSales: pounds(m.netProductSales),
    netShipping: pounds(m.netShipping),
    revenue: pounds(m.revenue),
    productCosts: pounds(m.productCosts),
    grossProfit: pounds(m.grossProfit),
    cm1: pounds(m.grossProfit),
    cm2: pounds(m.contributionBeforeMarketing),
    contributionBeforeMarketing: pounds(m.contributionBeforeMarketing),
    variableCosts: pounds(m.variableCosts),
    advertising: pounds(m.advertising),
    cm3: pounds(m.cm3),
    overheads: pounds(m.overheads),
    ebitda: pounds(m.ebitda),
    orders: result.originalOrders,
    aov: pounds(result.aov),
    overheadPerOrder: pounds(
      safeRatio(
        result.mode === "total"
          ? m.overheads
          : m.overheads === null
            ? null
            : m.overheads * (result.originalOrders ?? 0),
        result.originalOrders,
      ),
    ),
    grossMargin: result.grossMargin,
    ebitdaMargin: result.ebitdaMargin,
    contributionMargin: result.contributionMargin,
    breakEvenOrders: result.breakEvenOrders,
    breakEvenRevenue: pounds(result.breakEvenRevenue),
    complete: result.complete,
    limitations: result.limitations,
  };
}
/** Explicit fictional fixture view. This function must only be used in labelled sample mode. */
export function buildDashboardData(mode: DisplayMode = "total") {
  const sample = V11_SAMPLE,
    current = calculateHistorical(sample.current, mode),
    comparison = calculateHistorical(sample.comparison, mode),
    c = sample.cash,
    m = sample.marketing;
  const cac = safeRatio(m.acquisitionSpend, m.newCustomers)!;
  const initialGap = cac - m.firstOrderContributionPerCustomer;
  const operatingCash =
    c.ebitda +
    c.operatingAdjustments.reduce((total, item) => total + item.value, 0);
  const bankMovement =
    operatingCash +
    c.bankAdjustments.reduce((total, item) => total + item.value, 0);
  const overheadPerOrder = safeRatio(
    sample.current.overheads,
    sample.current.originalOrders,
  )!;
  const cohortCac = safeRatio(m.cohort.acquisitionSpend, m.cohort.customers)!;
  const payback =
    m.cohort.cumulativeContribution.find((item) => item.value >= cohortCac)
      ?.day ?? null;
  const cash = {
    asOf: c.asOf,
    openingBank: pounds(c.openingBank)!,
    closingBank: pounds(c.closingBank)!,
    ebitda: pounds(c.ebitda)!,
    operatingCash: pounds(operatingCash)!,
    bankMovement: pounds(bankMovement)!,
    inventoryIncrease: pounds(c.closingStock - c.openingStock)!,
    inventoryIncreaseRatio: (c.closingStock - c.openingStock) / c.openingStock,
    inventoryShareOfEbitda: (c.closingStock - c.openingStock) / c.ebitda,
    openingStock: pounds(c.openingStock)!,
    purchases: pounds(c.purchases)!,
    cogs: pounds(c.cogs)!,
    closingStock: pounds(c.closingStock)!,
    supplierPayments: pounds(c.supplierPayments)!,
    providerBalances: Object.fromEntries(
      Object.entries(c.providerBalances).map(([key, value]) => [
        key,
        pounds(value)!,
      ]),
    ),
    debtors: Object.fromEntries(
      Object.entries(c.debtors).map(([key, value]) => [key, pounds(value)!]),
    ),
    operatingAdjustments: c.operatingAdjustments.map((item) => ({
      ...item,
      value: pounds(item.value)!,
    })),
    bankAdjustments: c.bankAdjustments.map((item) => ({
      ...item,
      value: pounds(item.value)!,
    })),
  };
  const marketing = {
    acquisitionSpend: pounds(m.acquisitionSpend)!,
    newCustomers: m.newCustomers,
    cac: pounds(cac)!,
    firstOrderContribution: pounds(m.firstOrderContributionPerCustomer)!,
    firstOrderAfterCac: pounds(m.firstOrderContributionPerCustomer - cac)!,
    acquisitionGapPerCustomer: pounds(initialGap)!,
    acquisitionGap: pounds(initialGap * m.newCustomers)!,
    breakEvenFirstOrderCac: pounds(
      m.firstOrderContributionPerCustomer - overheadPerOrder,
    )!,
    ledgerAdvertising: pounds(m.ledgerAdvertising)!,
    unallocatedAdvertising: pounds(m.unallocatedAdvertising)!,
    combinedRoas: null,
    newRevenueShare: m.newRevenueShare,
    returningRevenueShare: m.returningRevenueShare,
    paybackDays: payback,
    cohort: {
      period: m.cohort.period,
      observedThrough: m.cohort.observedThrough,
      customers: m.cohort.customers,
      cac: pounds(cohortCac)!,
      grossProfitPerCustomer: pounds(m.cohort.grossProfitPerCustomer)!,
      contributionPerCustomer: pounds(m.cohort.contributionPerCustomer)!,
      additionalContributionAfterFirstOrder: pounds(
        m.cohort.contributionPerCustomer -
          m.cohort.cumulativeContribution[0].value,
      )!,
      contributionAfterCac: pounds(
        m.cohort.contributionPerCustomer - cohortCac,
      )!,
      gpToCac: m.cohort.grossProfitPerCustomer / cohortCac,
      repeatMarketingTreatment:
        "No additional repeat marketing in this fictional fixture; overheads excluded.",
      curve: m.cohort.cumulativeContribution.map((item) => ({
        day: item.day,
        value: pounds(item.value)!,
      })),
    },
    channels: m.channels.map((channel) => ({
      ...channel,
      spend: pounds(channel.spend)!,
      attributedRevenue: pounds(channel.attributedRevenue)!,
      comparisonSpend: pounds(channel.comparisonSpend),
      comparisonRevenue: pounds(channel.comparisonRevenue),
      roas: safeRatio(channel.attributedRevenue, channel.spend),
      cac: pounds(safeRatio(channel.spend, channel.newCustomers)),
      spendChange: percentageChange(channel.spend, channel.comparisonSpend),
    })),
    monthly: m.monthly.map((month) => ({
      ...month,
      spend: pounds(month.spend)!,
      cac: pounds(safeRatio(month.spend, month.newCustomers))!,
      comparisonCac: pounds(month.comparisonCac)!,
      metaSpend: pounds(month.metaSpend)!,
      metaRevenue: pounds(month.metaRevenue)!,
      metaRoas: safeRatio(month.metaRevenue, month.metaSpend),
      comparisonMetaRoas: safeRatio(
        m.channels[0].comparisonRevenue,
        m.channels[0].comparisonSpend,
      ),
    })),
  };
  return {
    context: sample.context,
    mode,
    current: historicalView(current),
    comparison: historicalView(comparison),
    trendUnavailableReason:
      mode === "per-order"
        ? "Monthly original-order denominators are not available in the approved fixture."
        : null,
    trends: (mode === "per-order" ? [] : sample.trends).map((month) => ({
      ...month,
      revenue: pounds(month.revenue)!,
      ebitda: pounds(month.ebitda)!,
      comparisonEbitda: pounds(month.comparisonEbitda)!,
      overheads: pounds(month.overheads)!,
      comparisonRevenue: pounds(month.comparisonRevenue)!,
      operatingCash: pounds(month.operatingCash)!,
      comparisonOperatingCash: pounds(month.comparisonOperatingCash)!,
      bankCash: pounds(month.bankCash)!,
      overheadRatio: month.overheads / month.revenue,
      comparisonOverheadRatio:
        sample.comparison.overheads! /
        (sample.comparison.netProductSales! + sample.comparison.netShipping!),
    })),
    cash,
    marketing,
    staffDiagnostics: {
      staffCosts: pounds(
        mode === "per-order"
          ? safeRatio(sample.staff.cost, sample.current.originalOrders)
          : sample.staff.cost,
      ),
      totalStaffCosts: pounds(sample.staff.cost),
      revenueRatio: safeRatio(
        sample.staff.cost,
        sample.current.netProductSales! + sample.current.netShipping!,
      ),
      contributionPerPoundStaff: safeRatio(
        calculateHistorical(sample.current).metrics.cm3,
        sample.staff.cost,
      ),
      alreadyIncludedInOverheads: true,
      comparison: null,
    },
  };
}
export function calculateScenarioView(input: ScenarioInput) {
  const result = calculateScenario(input),
    bridge = scenarioBridge(input);
  return {
    ...result,
    netProductSales: pounds(result.netProductSales),
    revenue: pounds(result.revenue),
    productCosts: pounds(result.productCosts),
    variableCosts: pounds(result.variableCosts),
    cm3: pounds(result.cm3),
    ebitda: pounds(result.ebitda),
    bridge: bridge
      ? Object.fromEntries(
          Object.entries(bridge).map(([key, value]) => [key, pounds(value)]),
        )
      : null,
  };
}
/** Matched-mode waterfall; signed rows reconcile comparison EBITDA to current EBITDA. Amounts are GBP. */
export function profitBridge(
  current: HistoricalResult,
  comparison: HistoricalResult | null,
) {
  if (!comparison || current.mode !== comparison.mode) return null;
  const cm = current.metrics,
    pm = comparison.metrics;
  const keys = [
    "netProductSales",
    "netShipping",
    "productCosts",
    "variableCosts",
    "advertising",
    "overheads",
  ] as const;
  if (
    cm.ebitda === null ||
    pm.ebitda === null ||
    keys.some((key) => cm[key] === null || pm[key] === null)
  )
    return null;
  const rows = keys.map((key) => ({
    id: key,
    label: {
      netProductSales: "Net product sales",
      netShipping: "Net shipping",
      productCosts: "Product costs",
      variableCosts: "Variable costs",
      advertising: "Advertising",
      overheads: "Overheads excluding D&A",
    }[key],
    value: pounds(
      (cm[key]! - pm[key]!) *
        (["netProductSales", "netShipping"].includes(key) ? 1 : -1),
    )!,
  }));
  return {
    baseline: pounds(pm.ebitda)!,
    result: pounds(cm.ebitda)!,
    change: pounds(cm.ebitda - pm.ebitda)!,
    rows,
    mode: current.mode,
  };
}
export function buildProfitBridge(mode: DisplayMode = "total") {
  return profitBridge(
    calculateHistorical(V11_SAMPLE.current, mode),
    calculateHistorical(V11_SAMPLE.comparison, mode),
  );
}
/** No comparison means no comparative verdict. Percentage-point changes are distinct from percent changes. */
export function historicalComparison(
  current: HistoricalResult,
  comparison: HistoricalResult | null,
) {
  if (!comparison || current.mode !== comparison.mode) return null;
  const metrics = Object.fromEntries(
    Object.entries(current.metrics).map(([id, value]) => {
      const previous =
        comparison.metrics[id as keyof typeof comparison.metrics];
      return [
        id,
        {
          change:
            value === null || previous === null
              ? null
              : pounds(value - previous),
          percentageChange: percentageChange(value, previous),
        },
      ];
    }),
  );
  return {
    metrics,
    grossMarginPoints:
      current.grossMargin === null || comparison.grossMargin === null
        ? null
        : (current.grossMargin - comparison.grossMargin) * 100,
    ebitdaMarginPoints:
      current.ebitdaMargin === null || comparison.ebitdaMargin === null
        ? null
        : (current.ebitdaMargin - comparison.ebitdaMargin) * 100,
    contributionMarginPoints:
      current.contributionMargin === null ||
      comparison.contributionMargin === null
        ? null
        : (current.contributionMargin - comparison.contributionMargin) * 100,
  };
}
