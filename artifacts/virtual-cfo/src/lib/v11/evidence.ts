import type {
  HistoricalResult,
  MetricEvidence,
  MetricId,
  Readiness,
  ReportContext,
  ViewState,
} from "./types.ts";
export const METRIC_DEFINITIONS: Record<
  MetricId,
  {
    label: string;
    formula: string;
    sourceCoverage: string[];
    costDependent: boolean;
    denominator: string;
  }
> = {
  netProductSales: {
    label: "Net product sales",
    formula:
      "Gross product sales excluding VAT/shipping − discounts − event-period refunds; discounts deducted once.",
    sourceCoverage: [
      "Eligible paid/completed original orders",
      "Actual refund events in the selected business-local period",
    ],
    costDependent: false,
    denominator: "Period flow; excludes VAT and shipping.",
  },
  netShipping: {
    label: "Net shipping",
    formula:
      "Shipping charges − shipping discounts − shipping refunds, excluding VAT.",
    sourceCoverage: ["Shipping sale/refund event components"],
    costDependent: false,
    denominator: "Period flow, not product AOV.",
  },
  revenue: {
    label: "Revenue including shipping",
    formula: "Net product sales + net shipping.",
    sourceCoverage: ["Eligible product and shipping event components"],
    costDependent: false,
    denominator: "Period flow excluding VAT.",
  },
  productCosts: {
    label: "Product costs",
    formula:
      "Effective-dated original product costs − evidenced recoveries when stock returns to saleable inventory.",
    sourceCoverage: [
      "Evidenced historical landed COGS",
      "Dated saleable-stock recovery events",
    ],
    costDependent: true,
    denominator: "Period flow; no current-price substitution.",
  },
  grossProfit: {
    label: "Gross profit",
    formula: "Net product sales − product costs.",
    sourceCoverage: [
      "Product sale/refund events",
      "Historical COGS and evidenced stock recovery",
    ],
    costDependent: true,
    denominator:
      "Gross margin divides by net product sales, excluding shipping.",
  },
  variableCosts: {
    label: "Variable costs",
    formula:
      "Applicable payment + fulfilment + delivery + packaging + return-handling costs, once each.",
    sourceCoverage: ["Actual classified variable expenses"],
    costDependent: true,
    denominator: "Period flow; staffing/agency/software excluded.",
  },
  contributionBeforeMarketing: {
    label: "Contribution before marketing",
    formula: "Gross profit + net shipping − variable costs.",
    sourceCoverage: [
      "Product and shipping event components",
      "COGS",
      "Variable expenses",
    ],
    costDependent: true,
    denominator: "Period flow before advertising and overheads.",
  },
  advertising: {
    label: "Advertising",
    formula:
      "Period advertising spend deducted once; agency, salaries and software remain overheads.",
    sourceCoverage: ["Mapped period advertising ledger"],
    costDependent: true,
    denominator: "Period flow; not attributed platform revenue.",
  },
  cm3: {
    label: "CM3",
    formula: "Gross profit + net shipping − variable costs − advertising.",
    sourceCoverage: [
      "Supported product/shipping revenue",
      "Historical COGS",
      "Classified variable expenses",
      "Period advertising",
    ],
    costDependent: true,
    denominator:
      "CM3 margin divides by revenue including net shipping, excluding VAT.",
  },
  overheads: {
    label: "Overheads excluding D&A",
    formula:
      "Classified operating overheads excluding identified depreciation and amortisation; staff, agency and software counted once.",
    sourceCoverage: ["Actual classified operating expenses and identified D&A"],
    costDependent: true,
    denominator: "Period flow; staff already included.",
  },
  ebitda: {
    label: "EBITDA",
    formula: "CM3 − overheads excluding depreciation and amortisation.",
    sourceCoverage: [
      "Complete CM3 evidence",
      "Classified overheads with identified D&A",
    ],
    costDependent: true,
    denominator:
      "EBITDA margin divides by revenue including shipping, excluding VAT; not cash or statutory profit after tax.",
  },
};
/** Evidence reproduces the exact displayed numeric basis; rounding belongs only at render time. */
export function metricEvidence(
  result: HistoricalResult,
  metricId: MetricId,
  context: ReportContext,
): MetricEvidence {
  const definition = METRIC_DEFINITIONS[metricId],
    value = result.metrics[metricId];
  const perOrder = result.mode === "per-order";
  return {
    metricId,
    context: {
      ...context,
      period: { ...context.period },
      comparison: context.comparison ? { ...context.comparison } : null,
    },
    valuePence: value,
    denominator: perOrder
      ? `${result.originalOrders ?? "Unavailable"} original eligible orders in this period. ${definition.denominator}`
      : definition.denominator,
    formula:
      definition.formula +
      (perOrder
        ? " Divide this period flow by this period’s original eligible order count using full precision."
        : ""),
    sourceCoverage: context.isSample
      ? [
          "Constructed fictional v11 fixture; no merchant-source completeness claim.",
          ...definition.sourceCoverage,
        ]
      : definition.sourceCoverage,
    costCoverage: definition.costDependent
      ? value === null
        ? "incomplete"
        : "complete"
      : "not-required",
    inclusions: [
      "Paid/completed eligible original orders, including later-refunded orders",
      "Actual sale/refund event timing in Europe/London",
    ],
    exclusions: [
      "Test/unpaid/pre-sale-cancelled orders",
      "VAT from tax-exclusive product amounts",
      "Automatic mixing of Shopify operational and Xero accounting values",
    ],
    rounding: perOrder
      ? "GBP to 2 decimal places for display; arithmetic retains full precision."
      : "GBP whole pounds for display; arithmetic retains full precision.",
    readiness: value === null ? "incomplete" : context.readiness,
  };
}
export interface SourceMetricInput {
  metricId: string;
  valuePence: number | null;
  source: "shopify-operational" | "xero-accounting";
  currency: string;
  storeId: string;
  period: { from: string; to: string };
  snapshotId: string;
  coverageVerified: boolean;
  costCoverageVerified: boolean;
  asOf: string | null;
}
/** An adapter boundary, not a live fetch. Never blend accounting and commerce values or substitute a sample. */
export function validateSourceMetric(
  input: SourceMetricInput,
  expected: {
    source: SourceMetricInput["source"];
    storeId: string;
    currency: string;
    period: { from: string; to: string };
  },
) {
  const issues: string[] = [];
  if (input.source !== expected.source)
    issues.push(
      "Source basis does not match; accounting and operational values cannot be substituted.",
    );
  if (input.storeId !== expected.storeId)
    issues.push("Business scope does not match.");
  if (input.currency !== expected.currency)
    issues.push("Currency does not match; no implicit conversion.");
  if (
    input.period.from !== expected.period.from ||
    input.period.to !== expected.period.to
  )
    issues.push("Date scope does not match.");
  if (
    !input.snapshotId ||
    !input.asOf ||
    !Number.isFinite(Date.parse(input.asOf))
  )
    issues.push("Valid dated source snapshot is required.");
  const definition = Object.hasOwn(METRIC_DEFINITIONS, input.metricId)
    ? METRIC_DEFINITIONS[input.metricId as MetricId]
    : undefined;
  if (!definition)
    issues.push("Metric ID is not supported by the approved dictionary.");
  if (definition?.costDependent && input.costCoverageVerified !== true)
    issues.push("Required cost coverage is not verified.");
  if (input.coverageVerified !== true)
    issues.push("Source coverage is not verified.");
  if (input.valuePence === null || !Number.isSafeInteger(input.valuePence))
    issues.push("Metric is unavailable.");
  return {
    state: issues.length ? ("needs-evidence" as const) : ("supported" as const),
    valuePence: issues.length ? null : input.valuePence,
    issues,
    costCoverageVerified: input.costCoverageVerified,
  };
}
/** Silence is earned by a completed same-scope check, never inferred from empty data. */
export function resolveViewState(input: {
  readiness: Readiness;
  checkCompleted: boolean;
  checkScope: string | null;
  expectedScope?: string | null;
  checkedAt: string | null;
  materialFindings: number | null;
  now?: string | Date;
}): ViewState {
  if (input.readiness !== "verified") return input.readiness;
  if (
    !input.checkCompleted ||
    !input.checkScope ||
    !input.expectedScope ||
    input.checkScope !== input.expectedScope ||
    !input.checkedAt ||
    !Number.isFinite(Date.parse(input.checkedAt)) ||
    input.materialFindings === null ||
    !Number.isInteger(input.materialFindings) ||
    input.materialFindings < 0
  )
    return "incomplete";
  const now =
    input.now instanceof Date
      ? input.now.valueOf()
      : input.now
        ? Date.parse(input.now)
        : Date.now();
  if (!Number.isFinite(now) || Date.parse(input.checkedAt) > now)
    return "incomplete";
  return input.materialFindings > 0 ? "actionable" : "verified-quiet";
}
