import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveReportContext,
  validRange,
  inclusiveDays,
  buildDashboardData,
} from "../v11/index.ts";

const now = "2026-10-31T12:00:00Z";

test("DT01: every completed calendar preset resolves explicit London dates", () => {
  const expected = {
    yesterday: { from: "2026-10-30", to: "2026-10-30" },
    "last-week": { from: "2026-10-19", to: "2026-10-25" },
    "last-month": { from: "2026-09-01", to: "2026-09-30" },
    "last-3-months": { from: "2026-07-01", to: "2026-09-30" },
    "last-6-months": { from: "2026-04-01", to: "2026-09-30" },
    "last-12-months": { from: "2025-10-01", to: "2026-09-30" },
  } as const;
  for (const [preset, period] of Object.entries(expected)) {
    const result = resolveReportContext(
      now,
      preset as keyof typeof expected,
      "none",
    );
    assert.deepEqual(result.period, period);
    assert.equal(result.timezone, "Europe/London");
    assert.equal(result.comparison, null);
    assert.deepEqual(result.issues, []);
  }
  assert.deepEqual(resolveReportContext(now).period, expected["last-3-months"]);
});

test("DT01: Sunday is not complete until Monday starts in the business timezone", () => {
  assert.deepEqual(
    resolveReportContext("2026-10-25T18:00:00Z", "last-week", "none").period,
    { from: "2026-10-12", to: "2026-10-18" },
  );
  assert.deepEqual(
    resolveReportContext("2026-10-26T00:00:00Z", "last-week", "none").period,
    { from: "2026-10-19", to: "2026-10-25" },
  );
});

test("DT01: summer timezone and DST boundaries use business-local calendar days", () => {
  assert.deepEqual(
    resolveReportContext("2026-07-01T23:30:00Z", "yesterday", "none").period,
    { from: "2026-07-01", to: "2026-07-01" },
  );
  assert.deepEqual(
    resolveReportContext("2026-03-29T23:30:00Z", "yesterday", "none").period,
    { from: "2026-03-29", to: "2026-03-29" },
  );
  assert.deepEqual(
    resolveReportContext("2026-10-25T23:30:00Z", "yesterday", "none").period,
    { from: "2026-10-24", to: "2026-10-24" },
  );
});

test("DT02: previous-equivalent calendars and fixed prior comparisons end before current scope", () => {
  const expected = {
    "previous-equivalent": { from: "2026-04-01", to: "2026-06-30" },
    "prior-week": { from: "2026-06-24", to: "2026-06-30" },
    "prior-month": { from: "2026-06-01", to: "2026-06-30" },
    "prior-3-months": { from: "2026-04-01", to: "2026-06-30" },
    "prior-6-months": { from: "2026-01-01", to: "2026-06-30" },
    "prior-12-months": { from: "2025-07-01", to: "2026-06-30" },
    "same-period-last-year": { from: "2025-07-01", to: "2025-09-30" },
  } as const;
  for (const [preset, comparison] of Object.entries(expected)) {
    const result = resolveReportContext(
      now,
      "last-3-months",
      preset as keyof typeof expected,
    );
    assert.deepEqual(result.comparison, comparison);
    assert.deepEqual(result.issues, []);
    assert.ok(result.comparison!.to < result.period!.from);
  }
});

test("DT02: arbitrary custom previous-equivalent uses inclusive equal duration", () => {
  const result = resolveReportContext(now, "custom", "previous-equivalent", {
    period: { from: "2026-09-12", to: "2026-09-21" },
  });
  assert.deepEqual(result.comparison, { from: "2026-09-02", to: "2026-09-11" });
  assert.equal(inclusiveDays(result.period!), 10);
  assert.equal(inclusiveDays(result.comparison!), 10);
});

test("DT02: leap-day policy is explicit and yields real prior-year dates", () => {
  const result = resolveReportContext(
    "2024-03-02T12:00:00Z",
    "custom",
    "same-period-last-year",
    { period: { from: "2024-02-29", to: "2024-02-29" } },
  );
  assert.deepEqual(result.comparison, { from: "2023-02-28", to: "2023-02-28" });
  assert.match(result.leapDayPolicy, /28 February/);
  assert.ok(result.notices.some((n) => /Leap day/.test(n)));
});

test("DT03: custom unequal and absent comparisons remain explicit", () => {
  const result = resolveReportContext(now, "last-3-months", "custom", {
    comparison: { from: "2025-09-01", to: "2025-09-30" },
  });
  assert.ok(result.notices.some((n) => /Unequal/.test(n)));
  const none = resolveReportContext(now, "last-3-months", "none");
  assert.equal(none.comparison, null);
  assert.deepEqual(none.issues, []);
  const missing = resolveReportContext(now, "last-3-months", "custom");
  assert.equal(missing.comparison, null);
  assert.ok(missing.issues.length > 0);
});

test("DT02/DT03: invalid, current-day, future and overlapping ranges fail closed", () => {
  for (const period of [
    { from: "2026-02-30", to: "2026-03-01" },
    { from: "2026-10-01", to: "2026-09-01" },
    { from: "2026-10-31", to: "2026-10-31" },
    { from: "2026-11-01", to: "2026-11-02" },
  ]) {
    const result = resolveReportContext(now, "custom", "none", { period });
    assert.equal(result.period, null);
    assert.ok(result.issues.length > 0);
  }
  assert.equal(validRange({ from: "2026-02-29", to: "2026-03-01" }), false);
  const overlap = resolveReportContext(now, "last-3-months", "custom", {
    comparison: { from: "2026-06-01", to: "2026-07-01" },
  });
  assert.equal(overlap.comparison, null);
  assert.ok(overlap.issues.some((x) => /overlap/.test(x)));
  const invalidNow = resolveReportContext("invalid", "last-month", "none");
  assert.equal(invalidNow.period, null);
  assert.ok(invalidNow.issues.length > 0);
});

test("UN02/DT04: no invented monthly order counts are used to populate a per-order trend", () => {
  const totals = buildDashboardData(),
    perOrder = buildDashboardData("per-order");
  assert.equal(
    totals.trends.reduce((s, p) => s + p.revenue, 0),
    698006,
  );
  assert.equal(
    totals.trends.reduce((s, p) => s + p.ebitda, 0),
    35533,
  );
  assert.equal(totals.trends.length, 3);
  assert.deepEqual(perOrder.trends, []);
  assert.match(perOrder.trendUnavailableReason!, /order/i);
});
