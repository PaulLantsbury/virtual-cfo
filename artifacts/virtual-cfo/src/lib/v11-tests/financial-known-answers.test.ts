/** Independent expected outcomes transcribed from approved v11 written fixtures.
 * Expected values use direct arithmetic/rational expressions, never production helpers.
 * GBP values are converted to pence only at the input boundary.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { calculateHistorical, calculateScenario } from "../v11/index.ts";
import type {
  HistoricalInput,
  ScenarioInput,
  GrowthMethod,
} from "../v11/types.ts";

const historical: HistoricalInput = {
  netProductSales: 68000100,
  netShipping: 1800500,
  productCosts: 26041300,
  variableCosts: 10608000,
  advertising: 17430000,
  overheads: 12168000,
  originalOrders: 9980,
  originalOrderProductSales: 69860000,
};
const prior: HistoricalInput = {
  netProductSales: 66800000,
  netShipping: 1766400,
  productCosts: 25000000,
  variableCosts: 10000000,
  advertising: 13810400,
  overheads: 12147200,
  originalOrders: 9600,
  originalOrderProductSales: 68160000,
};
const close = (actual: number | null, expected: number, tolerance = 1e-7) => {
  assert.notEqual(actual, null);
  assert.ok(
    Math.abs(actual! - expected) < tolerance,
    `${actual} != ${expected}`,
  );
};
const baseline: ScenarioInput = {
  method: "orders",
  common: {
    aov: 10000,
    marketing: 1000000,
    refunds: 500000,
    netShipping: 290000,
    productCostPerOrder: 4000,
    returnedStockRecovery: 200000,
    shippingPerOrder: 400,
    fulfilmentPerOrder: 300,
    paymentPerOrder: 200,
    staff: 1000000,
    otherOverheads: 800000,
  },
  methods: {
    orders: { orders: 1000 },
    "spend-cpa": { cpa: 2000, otherOrders: 500 },
    "traffic-conversion": { sessions: 50000, conversion: 0.02 },
  },
};
const scenario = (): ScenarioInput => ({
  ...structuredClone(baseline),
  common: { ...baseline.common, aov: 10500, marketing: 1200000 },
  methods: {
    orders: { orders: 1100 },
    "spend-cpa": { cpa: 2000, otherOrders: 500 },
    "traffic-conversion": { sessions: 50000, conversion: 0.022 },
  },
});
const methods: GrowthMethod[] = ["orders", "spend-cpa", "traffic-conversion"];

test("PR01/PR03: both complete quarters reconcile independently, without deducting discounts twice", () => {
  const current = calculateHistorical(historical),
    comparison = calculateHistorical(prior);
  assert.deepEqual(current.metrics, {
    netProductSales: 68000100,
    netShipping: 1800500,
    revenue: 69800600,
    productCosts: 26041300,
    grossProfit: 41958800,
    variableCosts: 10608000,
    contributionBeforeMarketing: 33151300,
    advertising: 17430000,
    cm3: 15721300,
    overheads: 12168000,
    ebitda: 3553300,
  });
  assert.equal(comparison.metrics.revenue, 68566400);
  assert.equal(comparison.metrics.grossProfit, 41800000);
  assert.equal(comparison.metrics.cm3, 19756000);
  assert.equal(comparison.metrics.ebitda, 7608800);
  // The separate £46,314 discount change is already inside net sales; it is no bridge deduction.
  assert.equal(
    7608800 + 1234200 - 1041300 - 608000 - 3619600 - 20800,
    current.metrics.ebitda,
  );
});

test("UN01/UN02: own-period denominators and full precision survive every historical flow", () => {
  const total = calculateHistorical(historical),
    per = calculateHistorical(historical, "per-order");
  const comparison = calculateHistorical(prior, "per-order");
  for (const [metric, value] of Object.entries(total.metrics))
    close(per.metrics[metric as keyof typeof per.metrics], value! / 9980);
  close(per.metrics.cm3, 15721300 / 9980);
  close(comparison.metrics.cm3, 19756000 / 9600);
  close(
    per.metrics.cm3! - comparison.metrics.cm3!,
    15721300 / 9980 - 19756000 / 9600,
  );
  assert.notEqual(per.metrics.ebitda, 356); // Do not round £3.56042084 before composing totals.
  close(per.aov, 7000);
  close(comparison.aov, 7100);
  assert.notEqual(per.aov, per.metrics.netProductSales); // AOV is before later refunds.
});

test("PR03: gross-margin and EBITDA-margin use different approved denominators", () => {
  const result = calculateHistorical(historical),
    per = calculateHistorical(historical, "per-order");
  close(result.grossMargin, 419588 / 680001);
  close(result.ebitdaMargin, 35533 / 698006);
  close(result.contributionMargin, 157213 / 698006);
  close(per.grossMargin, result.grossMargin!);
  close(per.ebitdaMargin, result.ebitdaMargin!);
  assert.notEqual(result.ebitdaMargin, 35533 / 680001);
});

test("PR03: break-even preserves continuous revenue separately from rounded whole orders", () => {
  const result = calculateHistorical(historical);
  assert.equal(result.breakEvenOrders, 7725);
  close(result.breakEvenRevenue, 8493337008000 / 157213, 1e-5);
  assert.notEqual(result.breakEvenRevenue, 7725 * (69800600 / 9980));
});

test("SH03: missing COGS preserves independently supported sales, not fictional profit", () => {
  const result = calculateHistorical({ ...historical, productCosts: null });
  assert.equal(result.metrics.netProductSales, 68000100);
  assert.equal(result.metrics.revenue, 69800600);
  for (const key of [
    "grossProfit",
    "contributionBeforeMarketing",
    "cm3",
    "ebitda",
  ] as const)
    assert.equal(result.metrics[key], null);
  assert.equal(result.grossMargin, null);
  assert.equal(result.complete, false);
});

test("SH03: missing later-stage expenses preserve earlier supported subtotals", () => {
  const overheadMissing = calculateHistorical({
    ...historical,
    overheads: null,
  });
  assert.equal(overheadMissing.metrics.cm3, 15721300);
  assert.equal(overheadMissing.metrics.ebitda, null);
  const adMissing = calculateHistorical({ ...historical, advertising: null });
  assert.equal(adMissing.metrics.contributionBeforeMarketing, 33151300);
  assert.equal(adMissing.metrics.cm3, null);
});

test("UN01: missing, zero and unreliable original-order counts never become per-order zero", () => {
  for (const originalOrders of [null, 0, -1, NaN, Infinity]) {
    const total = calculateHistorical({ ...historical, originalOrders });
    assert.equal(total.metrics.netProductSales, 68000100);
    const per = calculateHistorical(
      { ...historical, originalOrders },
      "per-order",
    );
    for (const value of Object.values(per.metrics)) assert.equal(value, null);
    assert.equal(per.aov, null);
  }
});

test("DT03: nonpositive product/revenue bases suppress unsupported margin interpretation", () => {
  for (const netProductSales of [0, -10000]) {
    const result = calculateHistorical({
      ...historical,
      netProductSales,
      netShipping: 0,
    });
    assert.equal(result.grossMargin, null);
    assert.equal(result.ebitdaMargin, null);
  }
});

test("SP06: all three matched-baseline methods reproduce £95,000 / £40,900 / £22,900", () => {
  for (const method of methods) {
    const result = calculateScenario({ ...structuredClone(baseline), method });
    assert.equal(result.state, "ready");
    assert.equal(result.orders, 1000);
    assert.equal(result.netProductSales, 9500000);
    assert.equal(result.productCosts, 3800000);
    assert.equal(result.variableCosts, 900000);
    assert.equal(result.cm3, 4090000);
    assert.equal(result.ebitda, 2290000);
  }
});

test("SP01/SP06: three active methods independently reproduce the £8,600 scenario uplift", () => {
  for (const method of methods) {
    const result = calculateScenario({ ...scenario(), method });
    assert.equal(result.state, "ready");
    assert.equal(result.orders, 1100);
    assert.equal(result.netProductSales, 11050000);
    assert.equal(result.productCosts, 4200000);
    assert.equal(result.variableCosts, 990000);
    assert.equal(result.cm3, 4950000);
    assert.equal(result.ebitda, 3150000);
    assert.equal(result.ebitda! - 2290000, 860000);
    assert.equal(2290000 + 510000 + 550000 - 200000, result.ebitda);
  }
});

test("SP02: every method switch excludes even invalid inactive assumptions", () => {
  for (const from of methods)
    for (const to of methods)
      if (from !== to) {
        const input = scenario();
        input.method = from;
        // Poison the mode being left. Switching must not validate it or reuse its old result.
        if (from === "orders") input.methods.orders.orders = NaN;
        if (from === "spend-cpa") input.methods["spend-cpa"].cpa = 0;
        if (from === "traffic-conversion")
          input.methods["traffic-conversion"].conversion = null;
        input.method = to;
        const result = calculateScenario(input);
        assert.equal(result.state, "ready", `${from} → ${to}`);
        assert.equal(result.orders, 1100);
        assert.equal(result.ebitda, 3150000);
      }
});

test("SP02: marketing creates no extra orders in direct-order or whole-site traffic methods", () => {
  for (const method of ["orders", "traffic-conversion"] as const) {
    const input = scenario();
    input.method = method;
    const before = calculateScenario(input);
    input.common.marketing = 1300000;
    const after = calculateScenario(input);
    assert.equal(after.orders, before.orders);
    assert.equal(after.ebitda, before.ebitda! - 100000);
  }
});

test("SP02: spend/CPA replaces order resolution and counts other orders exactly once", () => {
  const input = scenario();
  input.method = "spend-cpa";
  input.common.marketing = 1400000;
  const result = calculateScenario(input);
  assert.equal(result.orders, 1200); // 700 acquired + 500 other; do not add direct orders or traffic orders.
  assert.equal(result.netProductSales, 12100000);
});

test("SP06: adverse CPA is a sensitivity, with £25,900 EBITDA rather than a stale base case", () => {
  const input = scenario();
  input.method = "spend-cpa";
  input.methods["spend-cpa"].cpa = 2400;
  const result = calculateScenario(input);
  assert.equal(result.orders, 1000);
  assert.equal(result.netProductSales, 10000000);
  assert.equal(result.cm3, 4390000);
  assert.equal(result.ebitda, 2590000);
});

test("SP02/SP06: active CPA must be positive and missing common costs yield no result", () => {
  for (const cpa of [null, 0, -1, NaN, Infinity]) {
    const input = scenario();
    input.method = "spend-cpa";
    input.methods["spend-cpa"].cpa = cpa;
    const result = calculateScenario(input);
    assert.equal(result.state, "needs-assumptions");
    assert.equal(result.ebitda, null);
    assert.equal(result.orders, null);
  }
  const missing = scenario();
  missing.common.paymentPerOrder = null;
  assert.equal(calculateScenario(missing).state, "needs-assumptions");
  assert.equal(calculateScenario(missing).ebitda, null);
});

test("SP06: invalid active method fields fail closed instead of preserving an earlier method result", () => {
  const cases: ScenarioInput[] = [];
  const orders = scenario();
  orders.methods.orders.orders = null;
  cases.push(orders);
  const traffic = scenario();
  traffic.method = "traffic-conversion";
  traffic.methods["traffic-conversion"].sessions = -1;
  cases.push(traffic);
  const conversion = scenario();
  conversion.method = "traffic-conversion";
  conversion.methods["traffic-conversion"].conversion = 1.01;
  cases.push(conversion);
  for (const input of cases) {
    const result = calculateScenario(input);
    assert.equal(result.state, "needs-assumptions");
    assert.equal(result.ebitda, null);
  }
});

test("UN01: combined periods sum flows and order counts before calculating per-order results", async () => {
  const { aggregateHistorical } = await import("../v11/index.ts");
  const combined = calculateHistorical(
    aggregateHistorical([historical, prior]),
    "per-order",
  );
  close(combined.metrics.cm3, (15721300 + 19756000) / (9980 + 9600));
  assert.notEqual(
    combined.metrics.cm3,
    (15721300 / 9980 + 19756000 / 9600) / 2,
  );
  const incomplete = aggregateHistorical([
    historical,
    { ...prior, productCosts: null },
  ]);
  assert.equal(incomplete.productCosts, null);
  assert.equal(calculateHistorical(incomplete).metrics.grossProfit, null);
  assert.equal(aggregateHistorical([]).netProductSales, null);
});

test("CC02/CC03: cash, inventory, supplier credit and collections reconcile independently", async () => {
  const { buildDashboardData } = await import("../v11/index.ts");
  const { cash: c } = buildDashboardData();
  assert.equal(c.ebitda, 35533);
  assert.equal(c.operatingCash, 14000);
  assert.equal(c.bankMovement, -14000);
  assert.equal(c.openingBank + c.bankMovement, c.closingBank);
  assert.equal(c.closingBank, 186000);
  assert.equal(c.asOf, "2026-09-30");
  assert.equal(
    c.ebitda + c.operatingAdjustments.reduce((s, x) => s + x.value, 0),
    14000,
  );
  assert.equal(
    14000 + c.bankAdjustments.reduce((s, x) => s + x.value, 0),
    -14000,
  );
  assert.equal(c.openingStock + c.purchases - c.cogs, c.closingStock);
  assert.equal(c.purchases - c.supplierPayments, 12000);
  assert.equal(c.inventoryIncrease, 24000);
  close(c.inventoryIncreaseRatio, 0.2);
  close(c.inventoryShareOfEbitda, 24000 / 35533);
  assert.equal(
    Object.values(c.providerBalances).reduce((a, b) => a + b, 0),
    12000,
  );
  assert.equal(c.providerBalances.failed, 1000);
  assert.equal(c.debtors.overdue1to30 + c.debtors.overdue31plus, 6000);
  assert.equal(
    Object.values(c.debtors).reduce((a, b) => a + b, 0),
    18000,
  );
});

test("GM01/GM02: acquisition gap and first-order break-even CAC use unrounded denominators", async () => {
  const { buildDashboardData } = await import("../v11/index.ts");
  const m = buildDashboardData().marketing;
  close(m.cac, 100 / 3);
  close(m.acquisitionGapPerCustomer, 22 / 3);
  close(m.acquisitionGap, 19800);
  close(m.breakEvenFirstOrderCac, 6890 / 499);
  assert.notEqual(m.acquisitionGap, 7.33 * 2700);
  assert.equal(
    m.acquisitionSpend + m.unallocatedAdvertising,
    m.ledgerAdvertising,
  );
  assert.equal(m.ledgerAdvertising, 174300);
});

test("GM05: mature cohort remains separate and crosses exact matched CAC at observed day 55", async () => {
  const { buildDashboardData } = await import("../v11/index.ts");
  const d = buildDashboardData(),
    m = d.marketing;
  assert.deepEqual(m.cohort.period, { from: "2026-04-01", to: "2026-06-30" });
  assert.notDeepEqual(m.cohort.period, d.context.period);
  assert.equal(m.cohort.observedThrough, "2026-09-30");
  assert.equal(m.cohort.gpToCac, 2.25);
  close(m.cohort.contributionAfterCac, 65 / 3);
  assert.equal(m.paybackDays, 55);
  assert.ok(m.cohort.curve.find((p) => p.day === 30)!.value < m.cohort.cac);
  close(m.cohort.curve.find((p) => p.day === 55)!.value, m.cohort.cac);
  assert.equal(m.newRevenueShare + m.returningRevenueShare, 1);
});

test("GM07/GM08: channel ratios use summed matched amounts; blended attribution stays unavailable", async () => {
  const { buildDashboardData } = await import("../v11/index.ts");
  const m = buildDashboardData().marketing,
    meta = m.channels.find((c) => c.id === "meta")!,
    google = m.channels.find((c) => c.id === "google")!;
  assert.equal(meta.roas, 3);
  assert.equal(google.roas, 4);
  assert.equal(meta.cac, 40);
  assert.equal(google.cac, 25);
  close(meta.spendChange, 2 / 13);
  assert.equal(google.spendChange, null);
  close(
    m.monthly.reduce((s, p) => s + p.metaRevenue, 0) /
      m.monthly.reduce((s, p) => s + p.metaSpend, 0),
    meta.roas!,
  );
  assert.notEqual(
    m.monthly.reduce((s, p) => s + p.metaRoas!, 0) / 3,
    meta.roas,
  );
  assert.equal(m.combinedRoas, null); // Channel revenue overlap is unresolved.
});

test("SP04/SP05: changed shared expenses conserve the scenario bridge without double-counted labour", async () => {
  const { scenarioBridge } = await import("../v11/index.ts");
  const input = scenario();
  input.common.staff = 1100000;
  input.common.otherOverheads = 850000;
  input.common.paymentPerOrder = 250;
  const result = calculateScenario(input),
    b = scenarioBridge(input)!;
  assert.equal(result.ebitda, 2945000);
  assert.equal(b.volume, 510000);
  assert.equal(b.aov, 550000);
  assert.equal(b.marketing, -200000);
  assert.equal(b.other, -205000);
  assert.equal(b.baseline + b.volume + b.aov + b.marketing + b.other, b.result);
});

test("DT03: zero, missing and negative comparison amounts do not fabricate percentage change", async () => {
  const { percentageChange, safeRatio } = await import("../v11/index.ts");
  close(percentageChange(15721300, 19756000), -201735 / 987800);
  close(percentageChange(3553300, 7608800), -40555 / 76088);
  for (const value of [0, null, -1, NaN, Infinity]) {
    assert.equal(percentageChange(100, value), null);
    assert.equal(safeRatio(100, value), null);
  }
});

test("SV01/PR01: the exposed sample adapter retains the approved quarterly fixtures and precision", async () => {
  const { buildDashboardData } = await import("../v11/index.ts");
  const d = buildDashboardData(),
    p = buildDashboardData("per-order");
  assert.equal(d.current.netSales, 680001);
  assert.equal(d.current.cm3, 157213);
  assert.equal(d.current.ebitda, 35533);
  assert.equal(d.comparison.netSales, 668000);
  assert.equal(d.comparison.cm3, 197560);
  assert.equal(d.comparison.ebitda, 76088);
  assert.equal(d.context.snapshotId, "SAMPLE-Q3-26");
  assert.equal(d.context.isSample, true);
  assert.deepEqual(d.context.period, { from: "2026-07-01", to: "2026-09-30" });
  close(p.current.cm3, 157213 / 9980);
  close(p.comparison.cm3, 197560 / 9600);
  assert.equal((p.current.cm3! - p.comparison.cm3!).toFixed(2), "-4.83");
  assert.equal(
    (p.current.grossProfit! - p.comparison.grossProfit!).toFixed(2),
    "-1.50",
  );
  assert.equal(
    (p.current.advertising! - p.comparison.advertising!).toFixed(2),
    "3.08",
  );
  assert.equal((p.current.ebitda! - p.comparison.ebitda!).toFixed(2), "-4.37");
  assert.equal(p.cash.closingBank, 186000); // A bank balance is never divided by order counts.
});

test("PR01/PR02/UN02: historical waterfalls reconcile both total and own-period per-order modes", async () => {
  const { profitBridge, buildProfitBridge } = await import("../v11/index.ts");
  for (const mode of ["total", "per-order"] as const) {
    const c = calculateHistorical(historical, mode),
      p = calculateHistorical(prior, mode),
      bridge = profitBridge(c, p)!;
    close(
      bridge.baseline + bridge.rows.reduce((s, r) => s + r.value, 0),
      bridge.result,
      1e-7,
    );
    if (mode === "total") {
      assert.equal(bridge.baseline, 76088);
      assert.equal(bridge.result, 35533);
      assert.equal(bridge.change, -40555);
    } else {
      close(bridge.baseline, 76088 / 9600);
      close(bridge.result, 35533 / 9980);
      close(bridge.change, 35533 / 9980 - 76088 / 9600);
    }
    close(buildProfitBridge(mode)!.result, bridge.result);
  }
  assert.equal(profitBridge(calculateHistorical(historical), null), null);
  assert.equal(
    profitBridge(
      calculateHistorical(historical),
      calculateHistorical(prior, "per-order"),
    ),
    null,
  );
  assert.equal(
    profitBridge(
      calculateHistorical({ ...historical, productCosts: null }),
      calculateHistorical(prior),
    ),
    null,
  );
});

test("PR04/DT03: historical comparison distinguishes percentage points and suppresses absent comparison", async () => {
  const { historicalComparison } = await import("../v11/index.ts");
  const c = calculateHistorical(historical),
    p = calculateHistorical(prior);
  const delta = historicalComparison(c, p)!;
  close(delta.ebitdaMarginPoints, (35533 / 698006 - 76088 / 685664) * 100);
  close(delta.metrics.ebitda.percentageChange, -40555 / 76088);
  assert.notEqual(
    delta.ebitdaMarginPoints,
    delta.metrics.ebitda.percentageChange,
  );
  assert.equal(historicalComparison(c, null), null);
});

test("PR03: staff diagnostics use the approved included-overheads fixture exactly once", async () => {
  const { buildDashboardData } = await import("../v11/index.ts");
  const d = buildDashboardData(),
    p = buildDashboardData("per-order");
  assert.equal(d.staffDiagnostics.totalStaffCosts, 60000);
  assert.equal(d.staffDiagnostics.staffCosts, 60000);
  assert.equal(d.staffDiagnostics.alreadyIncludedInOverheads, true);
  close(d.staffDiagnostics.revenueRatio, 60000 / 698006);
  close(d.staffDiagnostics.contributionPerPoundStaff, 157213 / 60000);
  close(p.staffDiagnostics.staffCosts, 60000 / 9980);
  close(d.current.overheadPerOrder, 121680 / 9980);
  assert.equal(d.current.ebitda, 35533); // Staff is not deducted a second time by diagnostics.
});
