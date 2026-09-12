import test from "node:test";
import assert from "node:assert/strict";
import { fetchTradingMetrics, tradingSources } from "./tradingMetrics.ts";
import { buildBriefing } from "./briefing.ts";

test("trading reads use only the six mapped sources and the exact store and dates", async () => {
  const calls: string[] = [];
  const result = await fetchTradingMetrics(async (name, params) => {
    calls.push(name);
    assert.deepEqual(params, { p_store_id: "store-A", p_date_from: "2026-04-01", p_date_to: "2026-04-30" });
    return { data: "0", error: null };
  }, "store-A", "2026-04-01", "2026-04-30");
  assert.deepEqual(calls.sort(), Object.values(tradingSources).sort());
  assert.equal(result.errors.length, 0);
  assert.ok(Object.values(result.data).every(value => value === 0));
});

test("missing, failed and rejected requests remain unavailable, preserving successful metrics", async () => {
  const result = await fetchTradingMetrics(async name => {
    if (name === "net_sales") return { data: null, error: null };
    if (name === "average_order_value") return { data: 0, error: { message: "offline" } };
    if (name === "refund_rate") throw Error("offline");
    return { data: "12", error: null };
  }, "store-A", "2026-04-01", "2026-04-30");
  assert.equal(result.errors.length, 3);
  assert.ok(Number.isNaN(result.data.netSales));
  assert.ok(Number.isNaN(result.data.averageOrderValue));
  assert.ok(Number.isNaN(result.data.refundRate));
  assert.equal(result.data.grossRevenue, 12);
  assert.equal(buildBriefing(result.data, null, "error").metrics[0].value, "Unavailable");
});

// Aggregate-only observations from the read-only reconciliation on 8 September.
// These establish transport/formatting agreement, NOT correct tax accounting.
test("observed March/April RPC values reach cards and copy without snapshot substitution", async () => {
  const months = [
    { gross_revenue: 153556, net_sales: 116244.59, average_order_value: 66.08561114269472, repeat_purchase_rate: 0.6521739130434783, discount_dependency: 0.02067128604548178, refund_rate: 0.02644540102633567 },
    { gross_revenue: 167853, net_sales: 122921.4, average_order_value: 61.92513853904282, repeat_purchase_rate: 0.7142857142857143, discount_dependency: 0.039321608788642444, refund_rate: 0.03622693666481981 },
  ];
  const results = await Promise.all(months.map(values => fetchTradingMetrics(async name => ({ data: String(values[name as keyof typeof values]), error: null }), "test", "from", "to")));
  const briefing = buildBriefing(results[1].data, results[0].data, "ready");
  assert.equal(briefing.headline, "Net sales increased");
  assert.equal(briefing.metrics.find(m => m.id === "netSales")?.value, "£122,921");
  assert.equal(briefing.metrics.find(m => m.id === "netSales")?.change, "+5.7%");
  assert.equal(briefing.metrics.find(m => m.id === "averageOrderValue")?.value, "£61.93");
  assert.equal(briefing.metrics.find(m => m.id === "averageOrderValue")?.change, "−6.3%");
  assert.equal(briefing.metrics.find(m => m.id === "refundRate")?.change, "+1.0 percentage points");
  assert.ok(briefing.summary.includes("£122,921"));
});
