import test from "node:test";
import assert from "node:assert/strict";
import { adaptSupportedReporting } from "../v11/index.ts";
import type {
  ReportingAdapterInput,
  SupportedProfitMetric,
  SupportedProfitReport,
  SupportedSalesReport,
} from "../v11/reporting-adapter.ts";

const scope = {
  storeId: "fictional-authorised-business",
  currency: "GBP",
  from: "2026-07-01",
  to: "2026-09-30",
};
const metric = (value: number | null): SupportedProfitMetric => ({
  value,
  state: value === null ? "unavailable" : "ready",
  reason: value === null ? "Missing verified evidence" : null,
});
const sales: SupportedSalesReport = {
  grossProductSales: 75000000,
  discounts: 5140000,
  netProductSales: 68000100,
  netShipping: 1800500,
  originalOrders: 9980,
  aov: { value: 7000, reason: null },
  provenance: { ...scope, coverageEvidence: "source-coverage-version-a" },
};
const profit: SupportedProfitReport = {
  scope,
  state: "complete",
  reason: null,
  cogs: metric(26041300),
  variableCosts: metric(10608000),
  advertising: metric(17430000),
  overheads: metric(12268000),
  da: metric(100000),
  grossProfit: metric(41958800),
  contributionBeforeMarketing: metric(33151300),
  contribution: metric(15721300),
  ebitda: metric(3553300),
  sales,
};
const input = (): ReportingAdapterInput => ({
  expected: {
    storeId: scope.storeId,
    currency: "GBP",
    timezone: "Europe/London",
    period: { from: scope.from, to: scope.to },
  },
  sales: structuredClone(sales),
  profit: structuredClone(profit),
  access: "allowed",
  freshness: "current",
  snapshot: { id: "authorised-quarter-version-a", asOf: "2026-09-30" },
});

test("SH04: authorised source adapter maps the exact reporting scope without sample fallback", () => {
  const result = adaptSupportedReporting(input());
  assert.equal(result.state, "supported");
  assert.equal(result.source, "shopify-operational");
  assert.equal(result.context!.isSample, false);
  assert.equal(result.context!.businessId, scope.storeId);
  assert.equal(result.result.metrics.netProductSales, 68000100);
  assert.equal(result.result.metrics.cm3, 15721300);
  assert.equal(result.result.metrics.overheads, 12168000); // Source includes D&A; v11 overheads exclude it.
  assert.equal(result.result.metrics.ebitda, 3553300);
  assert.equal(result.result.aov, 7000);
  assert.equal(result.context!.snapshotId, "authorised-quarter-version-a");
  assert.equal(result.context!.readiness, "verified");
});

test("SH03/SH04: absent or incomplete profit evidence preserves sales without fabricated costs", () => {
  const absent = input();
  absent.profit = null;
  const a = adaptSupportedReporting(absent);
  assert.equal(a.state, "partial");
  assert.equal(a.result.metrics.netProductSales, 68000100);
  assert.equal(a.result.metrics.cm3, null);
  const partial = input();
  partial.profit!.state = "partial";
  partial.profit!.cogs = metric(null);
  partial.profit!.grossProfit = metric(null);
  partial.profit!.contributionBeforeMarketing = metric(null);
  partial.profit!.contribution = metric(null);
  partial.profit!.ebitda = metric(null);
  const p = adaptSupportedReporting(partial);
  assert.equal(p.state, "partial");
  assert.equal(p.result.metrics.revenue, 69800600);
  assert.equal(p.result.metrics.grossProfit, null);
  assert.equal(p.result.metrics.ebitda, null);
  assert.equal(p.context!.readiness, "incomplete");
});

test("SH04: source individual unavailable subtotals cannot be promoted by recomputing ready components", () => {
  const x = input();
  x.profit!.state = "partial";
  x.profit!.ebitda = metric(null);
  const result = adaptSupportedReporting(x);
  assert.equal(result.state, "partial");
  assert.equal(result.result.metrics.cm3, 15721300);
  assert.equal(result.result.metrics.ebitda, null);
  assert.equal(result.result.ebitdaMargin, null);
});

test("PR03/SH04: missing identified D&A blocks EBITDA but leaves supported CM3", () => {
  const x = input();
  x.profit!.da = metric(null);
  x.profit!.ebitda = metric(null);
  x.profit!.state = "partial";
  const result = adaptSupportedReporting(x);
  assert.equal(result.result.metrics.cm3, 15721300);
  assert.equal(result.result.metrics.overheads, null);
  assert.equal(result.result.metrics.ebitda, null);
});

test("SH04: cross-business or conflicting profit is withheld while same-scope sales survive", () => {
  const other = input();
  other.profit!.scope.storeId = "another-business";
  const mismatched = adaptSupportedReporting(other);
  assert.equal(mismatched.state, "partial");
  assert.equal(mismatched.result.metrics.netProductSales, 68000100);
  assert.equal(mismatched.result.metrics.cm3, null);
  const conflict = input();
  conflict.profit!.ebitda = metric(999999);
  const result = adaptSupportedReporting(conflict);
  assert.equal(result.state, "partial");
  assert.equal(result.result.metrics.netProductSales, 68000100);
  assert.equal(result.result.metrics.ebitda, null);
  assert.ok(result.issues.some((x) => /reconcile/.test(x)));
});

test("SH03: failed/stale refresh retains only an explicitly matching supported snapshot", () => {
  for (const freshness of ["failed", "stale"] as const) {
    const x = input();
    x.freshness = freshness;
    assert.equal(adaptSupportedReporting(x).state, "unavailable");
    x.retainedScope = { ...scope };
    const retained = adaptSupportedReporting(x);
    assert.equal(retained.state, "stale");
    assert.equal(retained.isRetained, true);
    assert.equal(retained.result.metrics.ebitda, 3553300);
    assert.equal(retained.context!.readiness, "stale");
    x.retainedScope.storeId = "another-business";
    const wrong = adaptSupportedReporting(x);
    assert.equal(wrong.state, "unavailable");
    assert.equal(wrong.result.metrics.netProductSales, null);
  }
});

test("SH04: denied, invalidated, undated or wrong-scope sources expose no financial values", () => {
  const cases: ReportingAdapterInput[] = [];
  const denied = input();
  denied.access = "denied";
  cases.push(denied);
  const invalidated = input();
  invalidated.freshness = "invalidated";
  cases.push(invalidated);
  const undated = input();
  undated.snapshot = null;
  cases.push(undated);
  const badDate = input();
  badDate.snapshot!.asOf = "not-a-date";
  cases.push(badDate);
  const wrong = input();
  wrong.sales!.provenance.storeId = "another-business";
  cases.push(wrong);
  const currency = input();
  currency.expected.currency = "USD";
  cases.push(currency);
  for (const x of cases) {
    const result = adaptSupportedReporting(x);
    assert.ok(["denied", "unavailable"].includes(result.state));
    assert.equal(result.context, null);
    assert.ok(Object.values(result.result.metrics).every((x) => x === null));
  }
});

test("UN01/UN02: authorised report adapter uses its original-order denominator without rounded unit inputs", () => {
  const x = input();
  x.mode = "per-order";
  const result = adaptSupportedReporting(x);
  assert.equal(result.result.metrics.cm3, 15721300 / 9980);
  assert.equal(result.result.metrics.ebitda, 3553300 / 9980);
  assert.equal(result.result.aov, 7000);
});
