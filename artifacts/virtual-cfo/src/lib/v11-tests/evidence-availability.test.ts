import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateHistorical,
  metricEvidence,
  validateSourceMetric,
  resolveViewState,
} from "../v11/index.ts";
import type { ReportContext } from "../v11/types.ts";
import type { SourceMetricInput } from "../v11/evidence.ts";

const context: ReportContext = {
  businessId: "fictional-a",
  currency: "GBP",
  timezone: "Europe/London",
  period: { from: "2026-07-01", to: "2026-09-30" },
  comparison: { from: "2025-07-01", to: "2025-09-30" },
  snapshotId: "SAMPLE-Q3-26",
  snapshotAsOf: "2026-09-30",
  formulaVersion: "night-scout-v11-2026-10-30",
  readiness: "sample",
  isSample: true,
};
const input = {
  netProductSales: 68000100,
  netShipping: 1800500,
  productCosts: 26041300,
  variableCosts: 10608000,
  advertising: 17430000,
  overheads: 12168000,
  originalOrders: 9980,
  originalOrderProductSales: 69860000,
};
const source: SourceMetricInput = {
  metricId: "cm3",
  valuePence: 15721300,
  source: "shopify-operational",
  currency: "GBP",
  storeId: "fictional-a",
  period: { from: "2026-07-01", to: "2026-09-30" },
  snapshotId: "verified-source-a",
  coverageVerified: true,
  costCoverageVerified: true,
  asOf: "2026-09-30",
};
const expected = {
  source: "shopify-operational" as const,
  storeId: "fictional-a",
  currency: "GBP",
  period: { from: "2026-07-01", to: "2026-09-30" },
};

test("SH04: per-order evidence reproduces the unrounded displayed result with its own denominator", () => {
  const result = calculateHistorical(input, "per-order"),
    evidence = metricEvidence(result, "cm3", context);
  assert.equal(evidence.valuePence, 15721300 / 9980);
  assert.match(evidence.denominator, /9980/);
  assert.match(evidence.formula, /full precision/i);
  assert.equal(evidence.context.snapshotId, "SAMPLE-Q3-26");
  assert.equal(evidence.readiness, "sample");
  assert.match(evidence.sourceCoverage.join(" "), /fictional/i);
  assert.match(evidence.exclusions.join(" "), /Test/);
  assert.match(evidence.exclusions.join(" "), /Shopify.*Xero/);
});

test("SH04: evidence scope is copied, so mutating a later context does not rewrite prior evidence", () => {
  const scope = structuredClone(context),
    evidence = metricEvidence(calculateHistorical(input), "ebitda", scope);
  scope.period.from = "2026-08-01";
  scope.comparison!.from = "2025-08-01";
  assert.equal(evidence.context.period.from, "2026-07-01");
  assert.equal(evidence.context.comparison!.from, "2025-07-01");
});

test("SH03/SH04: missing costs are incomplete evidence, preserving supported sales separately", () => {
  const result = calculateHistorical({ ...input, productCosts: null });
  const profit = metricEvidence(result, "cm3", context),
    sales = metricEvidence(result, "netProductSales", context);
  assert.equal(profit.valuePence, null);
  assert.equal(profit.costCoverage, "incomplete");
  assert.equal(profit.readiness, "incomplete");
  assert.equal(sales.valuePence, 68000100);
  assert.equal(sales.costCoverage, "not-required");
});

test("SH04: source metadata rejects cross-business, cross-period, cross-currency and accounting substitution", () => {
  for (const change of [
    { storeId: "fictional-b" },
    { period: { from: "2026-08-01", to: "2026-09-30" } },
    { currency: "USD" },
    { source: "xero-accounting" as const },
    { coverageVerified: false },
    { snapshotId: "" },
    { asOf: null },
    { asOf: "not-a-date" },
    { valuePence: null },
    { valuePence: NaN },
    { costCoverageVerified: false },
  ]) {
    const result = validateSourceMetric({ ...source, ...change }, expected);
    assert.equal(result.state, "needs-evidence");
    assert.equal(result.valuePence, null);
    assert.ok(result.issues.length > 0);
  }
  assert.equal(validateSourceMetric(source, expected).state, "supported");
  const zero = validateSourceMetric({ ...source, valuePence: 0 }, expected);
  assert.equal(zero.state, "supported");
  assert.equal(zero.valuePence, 0);
});

test("SH03/MN03: unavailable, stale, failed and sample sources never become a quiet all-clear", () => {
  for (const readiness of [
    "loading",
    "no-connection",
    "incomplete",
    "stale",
    "failed",
    "sample",
  ] as const) {
    assert.equal(
      resolveViewState({
        readiness,
        checkCompleted: true,
        checkScope: "fictional-a:Q3",
        expectedScope: "fictional-a:Q3",
        checkedAt: "2026-10-01T08:00:00+01:00",
        materialFindings: 0,
      }),
      readiness,
    );
  }
});

test("SH03/MN03: quiet requires completed, scoped, dated, valid checks rather than an empty queue", () => {
  const complete = {
    readiness: "verified" as const,
    checkCompleted: true,
    checkScope: "fictional-a:Q3",
    expectedScope: "fictional-a:Q3",
    checkedAt: "2026-10-01T08:00:00+01:00",
    materialFindings: 0,
  };
  assert.equal(resolveViewState(complete), "verified-quiet");
  assert.equal(
    resolveViewState({ ...complete, materialFindings: 1 }),
    "actionable",
  );
  for (const change of [
    { checkCompleted: false },
    { checkScope: null },
    { expectedScope: undefined },
    { expectedScope: "fictional-b:Q3" },
    { checkedAt: null },
    { checkedAt: "not-a-date" },
    { materialFindings: null },
    { materialFindings: -1 },
    { materialFindings: 0.5 },
  ]) {
    assert.equal(resolveViewState({ ...complete, ...change }), "incomplete");
  }
});

test("SH04: source cost coverage gates cost-dependent advice but not independently verified sales", () => {
  const sales = validateSourceMetric(
    {
      ...source,
      metricId: "netProductSales",
      valuePence: 68000100,
      costCoverageVerified: false,
    },
    expected,
  );
  assert.equal(sales.state, "supported");
  assert.equal(sales.valuePence, 68000100);
  const profit = validateSourceMetric(
    { ...source, costCoverageVerified: false },
    expected,
  );
  assert.equal(profit.state, "needs-evidence");
  assert.equal(profit.valuePence, null);
});

test("SH04: unknown metric identifiers cannot bypass the shared financial dictionary", () => {
  for (const metricId of [
    "unsupported-profit",
    "EBITDA",
    "cm3-typo",
    "toString",
    "__proto__",
  ]) {
    const result = validateSourceMetric(
      { ...source, metricId, costCoverageVerified: false },
      expected,
    );
    assert.equal(result.state, "needs-evidence");
    assert.equal(result.valuePence, null);
  }
});
