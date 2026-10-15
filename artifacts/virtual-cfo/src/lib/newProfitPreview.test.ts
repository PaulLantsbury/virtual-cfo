import test from "node:test";
import assert from "node:assert/strict";
import {
  DAILY_SAMPLE,
  aggregateDays,
  buildProfitPreview,
  amount,
  benchmarkAmount,
  selectedAverageAmount,
  combinedScenario,
  chartRows,
  compositionSteps,
  changeSteps,
  scenarioRanges,
  opportunityPareto,
  sankeyFlows,
  type DailyProfit,
  type ProfitTotals,
  type BaseAmounts,
} from "./newProfitPreview.ts";

const DAY = 86400000;
const rawKeys = [
  "gross",
  "discounts",
  "reversals",
  "sales",
  "shipping",
  "cogs",
  "variable",
  "advertising",
  "overheads",
  "da",
  "orders",
] as const;
const close = (actual: number, expected: number) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-7,
    `${actual} differs from ${expected}`,
  );
const rows = (from: string, to: string) =>
  DAILY_SAMPLE.filter((d) => d.date >= from && d.date <= to);
const independent = (days: readonly DailyProfit[]) => {
  const totals = Object.fromEntries(
    rawKeys.map((key) => [key, days.reduce((sum, d) => sum + d[key], 0)]),
  ) as BaseAmounts;
  return {
    ...totals,
    cashOverheads: totals.overheads - totals.da,
    ebitda:
      totals.sales +
      totals.shipping -
      totals.cogs -
      totals.variable -
      totals.advertising -
      (totals.overheads - totals.da),
    grossProfit: totals.sales - totals.cogs,
    contribution:
      totals.sales +
      totals.shipping -
      totals.cogs -
      totals.variable -
      totals.advertising,
    operatingProfit:
      totals.sales +
      totals.shipping -
      totals.cogs -
      totals.variable -
      totals.advertising -
      totals.overheads,
  };
};

test("daily synthetic source is gapless immutable integer pence, with event-period reversals and no automatic refunded-cost recovery", () => {
  assert.equal(DAILY_SAMPLE[0].date, "2023-10-01");
  assert.equal(DAILY_SAMPLE.at(-1)?.date, "2026-10-11");
  for (let index = 0; index < DAILY_SAMPLE.length; index++) {
    const d = DAILY_SAMPLE[index];
    assert.ok(Object.isFrozen(d));
    for (const key of rawKeys)
      assert.ok(Number.isSafeInteger(d[key]), `${d.date}/${key}`);
    assert.equal(d.sales, d.gross - d.discounts - d.reversals);
    assert.equal(d.cogs, Math.round((d.gross - d.discounts) * 0.37));
    assert.ok(d.orders > 0);
    if (index)
      assert.equal(
        Date.parse(d.date) - Date.parse(DAILY_SAMPLE[index - 1].date),
        DAY,
      );
  }
  assert.equal(rows("2024-02-01", "2024-02-29").length, 29);
});

test("all six calendar/weekly selections aggregate the actual daily source exactly, without duplicate or missing dates", () => {
  for (const granularity of ["weekly", "monthly"] as const)
    for (const months of [3, 6, 12] as const) {
      const model = buildProfitPreview({ granularity, months });
      const selected = rows(model.from, model.to);
      assert.equal(
        selected.length,
        (Date.parse(model.to) - Date.parse(model.from)) / DAY + 1,
      );
      assert.deepEqual(model.current, independent(selected));
      assert.deepEqual(aggregateDays(selected), model.current);
      assert.equal(
        model.periods.length,
        granularity === "weekly"
          ? ({ 3: 13, 6: 26, 12: 52 } as const)[months]
          : months,
      );
      const assigned = model.periods.flatMap((p) => rows(p.from, p.to));
      assert.deepEqual(
        assigned.map((d) => d.date),
        selected.map((d) => d.date),
      );
      for (const p of model.periods) {
        assert.deepEqual(p.values, independent(rows(p.from, p.to)));
        if (granularity === "weekly") {
          assert.equal(new Date(p.from).getUTCDay(), 1);
          assert.equal(new Date(p.to).getUTCDay(), 0);
          assert.equal(rows(p.from, p.to).length, 7);
        } else {
          assert.ok(p.from.endsWith("-01"));
          assert.ok(
            new Date(Date.parse(p.to) + DAY)
              .toISOString()
              .slice(0, 10)
              .endsWith("-01"),
          );
        }
      }
      assert.equal(
        model.to,
        granularity === "weekly" ? "2026-10-11" : "2026-09-30",
      );
    }
});

test("prior-year chart comparators use 52 weekday-aligned weeks or matching calendar months, not shifted/mixed bases", () => {
  for (const granularity of ["weekly", "monthly"] as const)
    for (const months of [3, 6, 12] as const) {
      const m = buildProfitPreview({ granularity, months });
      const expectedDays = m.periods.flatMap((p) => {
        const start = new Date(p.from + "T00:00:00Z");
        const from =
          granularity === "weekly"
            ? new Date(start.valueOf() - 364 * DAY).toISOString().slice(0, 10)
            : `${start.getUTCFullYear() - 1}-${p.from.slice(5)}`;
        const end =
          granularity === "weekly"
            ? new Date(Date.parse(p.to) - 364 * DAY).toISOString().slice(0, 10)
            : new Date(
                Date.UTC(
                  start.getUTCFullYear() - 1,
                  start.getUTCMonth() + 1,
                  0,
                ),
              )
                .toISOString()
                .slice(0, 10);
        const days = rows(from, end);
        assert.deepEqual(p.priorYear, independent(days));
        return days;
      });
      assert.deepEqual(m.priorYear, independent(expectedDays));
    }
});

test("rolling reference uses 12 weeks or 3 complete months BEFORE selection, with own weighted per-order denominator", () => {
  for (const granularity of ["weekly", "monthly"] as const)
    for (const months of [3, 6, 12] as const) {
      const m = buildProfitPreview({ granularity, months });
      assert.equal(m.benchmarkCount, granularity === "weekly" ? 12 : 3);
      assert.equal(Date.parse(m.benchmarkTo) + DAY, Date.parse(m.from));
      assert.ok(m.benchmarkFrom < m.from);
      const reference = independent(rows(m.benchmarkFrom, m.benchmarkTo));
      assert.deepEqual(m.benchmark, reference);
      close(
        benchmarkAmount(m, "operatingProfit", false)!,
        reference.operatingProfit / m.benchmarkCount,
      );
      close(
        benchmarkAmount(m, "operatingProfit", true)!,
        reference.operatingProfit / reference.orders,
      );
      assert.deepEqual(
        m.previous,
        independent(rows(m.previousFrom, m.previousTo)),
      );
      assert.equal(Date.parse(m.previousTo) + DAY, Date.parse(m.from));
    }
});

test("chart totals and per-order modes retain their own period and prior-year original-order denominators", () => {
  for (const granularity of ["weekly", "monthly"] as const) {
    const m = buildProfitPreview({ granularity, months: 3 });
    const totals = chartRows(m, false),
      perOrder = chartRows(m, true);
    assert.equal(
      totals.reduce((sum, p) => sum + p.profit!, 0),
      m.current.ebitda,
    );
    for (let i = 0; i < totals.length; i++) {
      const period = m.periods[i];
      assert.equal(totals[i].sales, period.values.sales);
      close(perOrder[i].sales!, period.values.sales / period.values.orders);
      close(perOrder[i].profit!, period.values.ebitda / period.values.orders);
      close(
        perOrder[i].priorYearProfit!,
        period.priorYear.ebitda / period.priorYear.orders,
      );
    }
    if (granularity === "weekly")
      assert.ok(
        totals.some((p) => p.profit! < 0),
        "weekly sample retains a visible loss period; monthly aggregation may legitimately offset it",
      );
  }
  const zero = aggregateDays([]);
  assert.equal(amount(zero, "operatingProfit", true), null);
  assert.deepEqual(compositionSteps(zero, true), []);
});

test("composition waterfall reconciles sales to gross profit, contribution and EBITDA in both display bases", () => {
  for (const granularity of ["weekly", "monthly"] as const)
    for (const months of [3, 6, 12] as const)
      for (const perOrder of [false, true]) {
        const m = buildProfitPreview({ granularity, months }),
          steps = compositionSteps(m.current, perOrder);
        const divisor = perOrder ? m.current.orders : 1;
        assert.equal(steps[0].id, "sales");
        close(steps[0].end, m.current.sales / divisor);
        for (let i = 1; i < steps.length; i++) {
          const step = steps[i];
          if (step.subtotal) close(step.end, steps[i - 1].end);
          else {
            close(step.start, steps[i - 1].end);
            close(step.end - step.start, step.amount);
          }
        }
        close(
          steps.find((p) => p.id === "grossProfit")!.end,
          m.current.grossProfit / divisor,
        );
        close(
          steps.find((p) => p.id === "contribution")!.end,
          m.current.contribution / divisor,
        );
        close(steps.at(-1)!.end, m.current.ebitda / divisor);
      }
});

test("expanded EBITDA bridge shows gross, discount and reversals with one net-sales checkpoint and no double-count", () => {
  for (const granularity of ["weekly", "monthly"] as const)
    for (const months of ["last-week", "last-month", 3, 6, 12] as const)
      for (const perOrder of [false, true]) {
        const m = buildProfitPreview({ granularity, months }),
          steps = changeSteps(m, perOrder);
        const c = perOrder ? 1 / m.current.orders : 1,
          p = perOrder ? 1 / m.previous.orders : 1;
        const before = m.previous.ebitda * p,
          after = m.current.ebitda * c;
        assert.deepEqual(
          steps.map((s) => s.id),
          [
            "previous",
            "gross",
            "discounts",
            "reversals",
            "netSales",
            "shipping",
            "cogs",
            "variable",
            "ads",
            "cashOverheads",
            "current",
          ],
        );
        close(steps[0].end, before);
        close(steps.at(-1)!.end, after);
        const byId = (id: string) => steps.find((s) => s.id === id)!;
        close(byId("gross").amount, m.current.gross * c - m.previous.gross * p);
        close(
          byId("discounts").amount,
          m.previous.discounts * p - m.current.discounts * c,
        );
        close(
          byId("reversals").amount,
          m.previous.reversals * p - m.current.reversals * c,
        );
        const netSales = m.current.sales * c - m.previous.sales * p;
        close(
          byId("gross").amount +
            byId("discounts").amount +
            byId("reversals").amount,
          netSales,
        );
        const checkpoint = byId("netSales");
        assert.equal(checkpoint.subtotal, true);
        assert.equal(checkpoint.checkpoint, true);
        close(checkpoint.start, before);
        close(checkpoint.end, before + netSales);
        close(checkpoint.amount, netSales);
        close(checkpoint.effect!, netSales);
        close(checkpoint.end, byId("reversals").end);
        close(byId("shipping").start, checkpoint.end);
        close(
          steps
            .filter((s) => !s.subtotal)
            .reduce((sum, s) => sum + s.amount, 0),
          after - before,
        );
        close(
          byId("cashOverheads").amount,
          m.previous.cashOverheads * p - m.current.cashOverheads * c,
        );
        close(steps.at(-2)!.end, after);
        assert.ok(!steps.some((s) => s.id === "da"));
      }
});

test("scenario ranges are standalone arithmetic with explicit assumptions, not promised cash/revenue recovery", () => {
  const m = buildProfitPreview({ granularity: "monthly", months: 3 });
  const scenarios = scenarioRanges(m);
  assert.equal(scenarios.length, 3);
  for (const s of scenarios) {
    assert.ok(s.low >= 0 && s.high >= s.low);
    close(s.midpoint, (s.low + s.high) / 2);
    assert.ok(s.input.length && s.assumption.length && s.next.length);
    assert.match(s.confidence, /Arithmetic only/);
  }
  assert.match(
    scenarios.find((s) => s.id === "discount")!.assumption,
    /may reduce sales/,
  );
  assert.match(
    scenarios.find((s) => s.id === "payment")!.assumption,
    /excluded from the combined/,
  );
  assert.match(
    scenarios.find((s) => s.id === "carrier")!.assumption,
    /not cash/,
  );
});

test("opportunity Pareto ranks individual midpoint scenarios and reaches 100% without claiming combined achievable benefit", () => {
  for (const granularity of ["weekly", "monthly"] as const)
    for (const months of [3, 6, 12] as const) {
      const m = buildProfitPreview({ granularity, months }),
        total = opportunityPareto(m, false),
        perOrder = opportunityPareto(m, true);
      const denominator = scenarioRanges(m).reduce(
        (sum, s) => sum + s.midpoint,
        0,
      );
      let running = 0;
      assert.deepEqual(
        total.map((s) => s.id),
        perOrder.map((s) => s.id),
      );
      for (let i = 0; i < total.length; i++) {
        const s = total[i];
        if (i) assert.ok(total[i - 1].midpoint >= s.midpoint);
        running += s.midpoint;
        close(s.individualMidpointDenominator, denominator);
        close(s.cumulativePct, (running / denominator) * 100);
        close(perOrder[i].displayImpact!, s.midpoint / m.current.orders);
        close(perOrder[i].cumulativePct, s.cumulativePct);
      }
      close(total.at(-1)!.cumulativePct, 100);
    }
  const m = buildProfitPreview({ granularity: "weekly", months: 3 });
  assert.deepEqual(
    opportunityPareto({ ...m, current: aggregateDays([]) }, false),
    [],
  );
});

test("Sankey conserves net product sales plus shipping and refuses losses/signed or non-reconciling flows", () => {
  for (const granularity of ["weekly", "monthly"] as const)
    for (const months of [3, 6, 12] as const)
      for (const perOrder of [false, true]) {
        const m = buildProfitPreview({ granularity, months }),
          s = sankeyFlows(m.current, perOrder);
        assert.equal(s.state, "ready");
        if (s.state !== "ready") assert.fail("expected positive sample flow");
        close(
          s.sources.reduce((sum, f) => sum + f.amount, 0),
          s.total,
        );
        close(
          s.uses.reduce((sum, f) => sum + f.amount, 0),
          s.total,
        );
        close(
          s.total,
          (m.current.sales + m.current.shipping) /
            (perOrder ? m.current.orders : 1),
        );
      }
  const loss = DAILY_SAMPLE.find((d) => independent([d]).ebitda < 0)!;
  assert.ok(loss);
  assert.equal(sankeyFlows(aggregateDays([loss]), false).state, "unavailable");
  const good = buildProfitPreview({
    granularity: "monthly",
    months: 3,
  }).current;
  assert.equal(
    sankeyFlows({ ...good, ebitda: good.ebitda + 1 }, false).state,
    "unavailable",
  );
  assert.equal(sankeyFlows({ ...good, orders: 0 }, true).state, "unavailable");
  assert.equal(sankeyFlows(aggregateDays([]), false).state, "unavailable");
});

test("last-week and last-month force true completed horizons and retain correct independent PY/benchmark bases", () => {
  for (const granularity of ["weekly", "monthly"] as const) {
    const week = buildProfitPreview({ granularity, months: "last-week" });
    assert.equal(week.granularity, "weekly");
    assert.equal(week.from, "2026-10-05");
    assert.equal(week.to, "2026-10-11");
    assert.equal(week.periods.length, 1);
    assert.equal(week.benchmarkCount, 12);
    const month = buildProfitPreview({ granularity, months: "last-month" });
    assert.equal(month.granularity, "monthly");
    assert.equal(month.from, "2026-09-01");
    assert.equal(month.to, "2026-09-30");
    assert.equal(month.periods.length, 1);
    assert.equal(month.benchmarkCount, 3);
    for (const m of [week, month]) {
      assert.deepEqual(m.current, independent(rows(m.from, m.to)));
      assert.equal(Date.parse(m.benchmarkTo) + DAY, Date.parse(m.from));
      assert.equal(Date.parse(m.previousTo) + DAY, Date.parse(m.from));
    }
    assert.deepEqual(
      week.priorYear,
      independent(rows("2025-10-06", "2025-10-12")),
    );
    assert.deepEqual(
      month.priorYear,
      independent(rows("2025-09-01", "2025-09-30")),
    );
  }
});

test("EBITDA, cash overheads and operating profit remain distinct, with exact D&A identity for every horizon", () => {
  for (const granularity of ["weekly", "monthly"] as const)
    for (const months of ["last-week", "last-month", 3, 6, 12] as const) {
      const m = buildProfitPreview({ granularity, months });
      for (const v of [
        m.current,
        m.priorYear,
        m.previous,
        m.benchmark,
        ...m.periods.flatMap((p) => [p.values, p.priorYear]),
      ]) {
        assert.ok(v.da > 0);
        assert.equal(v.cashOverheads, v.overheads - v.da);
        assert.equal(v.ebitda, v.contribution - v.cashOverheads);
        assert.equal(v.operatingProfit, v.ebitda - v.da);
        assert.notEqual(v.operatingProfit, v.ebitda);
      }
      close(
        selectedAverageAmount(m, "ebitda", false)!,
        m.current.ebitda / m.selectedCount,
      );
      close(
        benchmarkAmount(m, "ebitda", false)!,
        m.benchmark.ebitda / m.benchmarkCount,
      );
      close(
        selectedAverageAmount(m, "ebitda", true)!,
        m.current.ebitda / m.current.orders,
      );
      close(
        benchmarkAmount(m, "ebitda", true)!,
        m.benchmark.ebitda / m.benchmark.orders,
      );
    }
});

test("combined scenario excludes the payment/carrier overlap and shows arithmetic EBITDA range without a bank-cash promise", () => {
  for (const granularity of ["weekly", "monthly"] as const)
    for (const months of ["last-week", "last-month", 3, 6, 12] as const) {
      const m = buildProfitPreview({ granularity, months }),
        r = scenarioRanges(m),
        combined = combinedScenario(m),
        perOrder = combinedScenario(m, true);
      assert.deepEqual([...combined.includedIds].sort(), [
        "carrier",
        "discount",
      ]);
      assert.deepEqual(combined.excludedIds, ["payment"]);
      const selected = r.filter(
        (s) => s.id === "carrier" || s.id === "discount",
      );
      close(
        combined.low,
        selected.reduce((sum, s) => sum + s.low, 0),
      );
      close(
        combined.high,
        selected.reduce((sum, s) => sum + s.high, 0),
      );
      close(combined.midpoint, (combined.low + combined.high) / 2);
      close(combined.ebitdaLow, m.current.ebitda + combined.low);
      close(combined.ebitdaHigh, m.current.ebitda + combined.high);
      close(perOrder.displayLow!, combined.low / m.current.orders);
      close(perOrder.displayHigh!, combined.high / m.current.orders);
      assert.ok(combined.assumptions.length);
      assert.ok(combined.cashTimingAssumptions.length);
      const text = [
        ...combined.assumptions,
        ...combined.cashTimingAssumptions,
      ].join(" ");
      assert.match(text, /cash|bank/i);
      assert.match(text, /assum|timing|not|unknown|unverified/i);
    }
});
