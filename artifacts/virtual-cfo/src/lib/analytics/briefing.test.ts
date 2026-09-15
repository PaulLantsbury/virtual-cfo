import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBriefing, previousReportingPeriod, type TradingMetrics } from "./briefing.ts";
const previous: TradingMetrics = { netSales: 1000, grossRevenue: 1500, averageOrderValue: 50, repeatPurchaseRate: .3, discountDependency: .1, refundRate: .02 };

test("copy responds to changing values, with identical arithmetic on cards and headline", () => {
  const rising = buildBriefing({ ...previous, netSales: 1200 }, previous, "ready");
  const falling = buildBriefing({ ...previous, netSales: 800 }, previous, "ready");
  assert.equal(rising.headline, "Net sales increased");
  assert.equal(falling.headline, "Net sales decreased");
  assert.match(rising.summary, /\+20.0%/);
  assert.match(falling.summary, /−20.0%/);
  assert.equal(falling.metrics[0].change, "−20.0%");
  assert.ok(falling.signals.some(signal => signal.title === "Review the sales change"));
  assert.ok(!rising.signals.some(signal => signal.title === "Review the sales change"));
});

test("rate changes are percentage points and review prompts follow evidence", () => {
  const result = buildBriefing({ ...previous, discountDependency: .12, refundRate: .01, repeatPurchaseRate: .25 }, previous, "ready");
  assert.equal(result.metrics.find(m => m.id === "discountDependency")?.change, "+2.0 percentage points");
  assert.deepEqual(result.signals.map(s => s.title), ["Review discounting", "Review repeat purchasing"]);
});

test("missing, loading and failed comparison data never generates a trend or action", () => {
  for (const state of ["empty", "loading", "error"] as const) {
    const result = buildBriefing({ ...previous, netSales: 0 }, previous, state);
    assert.equal(result.headline, "Your trading period at a glance");
    assert.equal(result.signals.length, 0);
    assert.ok(result.metrics.every(m => m.direction === "unknown"));
    assert.equal(result.metrics[0].value, "£0");
    assert.doesNotMatch(result.summary, /100%|increased|decreased/);
  }
});

test("zero current sales remain zero, never a fallback snapshot", () => {
  const result = buildBriefing({ ...previous, netSales: 0, averageOrderValue: 0 }, previous, "ready");
  assert.equal(result.metrics[0].value, "£0");
  assert.equal(result.metrics[0].change, "−100.0%");
});

test("zero and negative prior bases use absolute change rather than invalid percentages", () => {
  for (const prior of [0, -100]) {
    const result = buildBriefing({ ...previous, netSales: 100 }, { ...previous, netSales: prior }, "ready");
    assert.match(result.metrics[0].change, /percentage comparison unavailable/);
    assert.doesNotMatch(result.summary, /Infinity|NaN/);
    assert.equal(result.headline, "Net sales increased");
  }
});

test("unchanged values do not fabricate deterioration or opportunity", () => {
  const result = buildBriefing(previous, previous, "ready");
  assert.equal(result.headline, "Net sales were unchanged");
  assert.equal(result.signals.length, 0);
  assert.ok(result.metrics.every(m => m.direction === "flat"));
});

test("non-finite values are unavailable and cannot produce advice", () => {
  const result = buildBriefing({ ...previous, discountDependency: NaN }, previous, "ready");
  assert.equal(result.metrics.find(m => m.id === "discountDependency")?.value, "Unavailable");
  assert.equal(result.signals.length, 0);
});

test("monthly comparison chooses only the immediately preceding month", () => {
  assert.equal(previousReportingPeriod("2026-08-01", "last_complete_month").dateFrom, "2026-07-01");
  assert.equal(previousReportingPeriod("2024-03-01", "last_complete_month").dateTo, "2024-02-29");
});

test("weekly comparison uses a full preceding week across month boundaries", () => {
  const result = previousReportingPeriod("2026-08-31", "last_complete_week");
  assert.equal(result.dateFrom, "2026-08-24");
  assert.equal(result.dateTo, "2026-08-30");
});
