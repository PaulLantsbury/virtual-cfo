import { test } from "node:test";
import assert from "node:assert/strict";
import { getReportingPeriod, resolveReportingPeriod } from "./reportingPeriod.ts";

const now = new Date(2026, 8, 8, 15);
const metrics = { data: { grossRevenue: 0 }, errors: [] as string[] };

test("September finds April beyond the previous three-month limit, explicitly historical", async () => {
  const loaded: string[] = [];
  const result = await resolveReportingPeriod({ timeline: "last_complete_month", now,
    countOrders: async p => p.dateFrom === "2026-04-01" ? 2013 : 0,
    loadMetrics: async p => { loaded.push(p.dateFrom); return metrics; } });
  assert.equal(result.status, "stale");
  assert.equal(result.dateFrom, "2026-04-01");
  assert.equal(result.dateTo, "2026-04-30");
  assert.deepEqual(loaded, ["2026-04-01"]);
});

test("zero revenue with orders is a valid period", async () => {
  const result = await resolveReportingPeriod({ timeline: "last_complete_month", now,
    countOrders: async () => 2, loadMetrics: async () => metrics });
  assert.equal(result.status, "ready");
  assert.equal(result.metrics?.data.grossRevenue, 0);
});

test("exhausted history has no fabricated metric result or old period label", async () => {
  let calls = 0;
  const result = await resolveReportingPeriod({ timeline: "last_complete_month", now, maxLookback: 3,
    countOrders: async () => { calls++; return 0; },
    loadMetrics: async () => { throw Error("Must not load metrics without orders"); } });
  assert.equal(calls, 4);
  assert.equal(result.status, "empty");
  assert.equal(result.metrics, null);
  assert.equal(result.dateFrom, "2026-08-01");
});

test("availability RPC failure stops without looking for an older substitute", async () => {
  let calls = 0;
  const result = await resolveReportingPeriod({ timeline: "last_complete_month", now,
    countOrders: async () => { calls++; throw Error("offline"); }, loadMetrics: async () => metrics });
  assert.equal(result.status, "error");
  assert.equal(result.metrics, null);
  assert.equal(calls, 1);
});

test("partial metric failure does not turn default zeros into a briefing", async () => {
  const result = await resolveReportingPeriod({ timeline: "last_complete_month", now,
    countOrders: async () => 1, loadMetrics: async () => ({ ...metrics, errors: ["net_sales denied"] }) });
  assert.equal(result.status, "error");
  assert.equal(result.metrics, null);
});

test("invalid counts are unavailable, not empty", async () => {
  for (const count of [NaN, -1, 1.5, Infinity]) {
    const result = await resolveReportingPeriod({ timeline: "last_complete_month", now,
      countOrders: async () => count, loadMetrics: async () => metrics });
    assert.equal(result.status, "error");
  }
});

test("cancelled store or timeline requests never publish a result", async () => {
  const controller = new AbortController();
  await assert.rejects(resolveReportingPeriod({ timeline: "last_complete_month", now, signal: controller.signal,
    countOrders: async () => { controller.abort(); return 2; }, loadMetrics: async () => metrics }), { name: "AbortError" });
});

test("Sunday itself is never included in a completed week", () => {
  const sunday = getReportingPeriod("last_complete_week", 0, new Date(2026, 8, 6, 23, 59));
  assert.equal(sunday.dateFrom, "2026-08-24");
  assert.equal(sunday.dateTo, "2026-08-30");
  const monday = getReportingPeriod("last_complete_week", 0, new Date(2026, 8, 7));
  assert.equal(monday.dateFrom, "2026-08-31");
  assert.equal(monday.dateTo, "2026-09-06");
});

test("month boundaries handle leap years and year changes", () => {
  assert.equal(getReportingPeriod("last_complete_month", 0, new Date(2024, 2, 31)).dateTo, "2024-02-29");
  assert.equal(getReportingPeriod("last_complete_month", 0, new Date(2026, 0, 31)).dateFrom, "2025-12-01");
});
