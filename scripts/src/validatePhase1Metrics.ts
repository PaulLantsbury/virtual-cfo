/**
 * validatePhase1Metrics.ts
 *
 * Validation script for the Phase 1 Supabase metric functions.
 *
 * Connects directly to local PostgreSQL (helium:5432) and calls all nine
 * metric functions for three periods — Feb, Mar and Apr 2026 — against the
 * seeded store.  Results are compared to the expected values from the SQL
 * validation report in the implementation log.
 *
 * Run with:
 *   pnpm --filter @workspace/scripts run validate:phase1-metrics
 */

import { Client } from "pg";

// ── Config ────────────────────────────────────────────────────────────────────

const DB = {
  host:     "helium",
  port:     5432,
  user:     "postgres",
  password: "password",
  database: "heliumdb",
};

const STORE_ID = "10000000-0000-0000-0000-000000000001";

// ── Periods ───────────────────────────────────────────────────────────────────

const PERIODS = [
  { label: "Feb 2026", dateFrom: "2026-02-01", dateTo: "2026-02-28" },
  { label: "Mar 2026", dateFrom: "2026-03-01", dateTo: "2026-03-31" },
  { label: "Apr 2026", dateFrom: "2026-04-01", dateTo: "2026-04-30" },
] as const;

// ── Expected values (from SQL validation report, migration 20260429000001) ────
//    Rates (repeat_purchase_rate, discount_dependency, refund_rate) are stored
//    as percentages here for readability; the SQL functions return [0, 1].

const EXPECTED: Record<
  string,
  {
    grossRevenue: number;
    discountCost: number;
    returnAmount: number;
    netSales:     number;
    orderCount:   number;
    aov:          number;
    repeatRatePct:    number;
    discountDepPct:   number;
    refundRatePct:    number;
  }
> = {
  "Feb 2026": {
    grossRevenue:   2761.00,
    discountCost:    115.00,
    returnAmount:    200.00,
    netSales:       1916.80,
    orderCount:       38,
    aov:              50.44,
    repeatRatePct:     0.00,
    discountDepPct:    4.17,  // rounded to 2dp for comparison tolerance
    refundRatePct:     7.24,
  },
  "Mar 2026": {
    grossRevenue:   3311.00,
    discountCost:    120.85,
    returnAmount:    345.00,
    netSales:       2207.12,
    orderCount:       45,
    aov:              49.05,
    repeatRatePct:   100.00,
    discountDepPct:    3.65,
    refundRatePct:    10.42,
  },
  "Apr 2026": {
    grossRevenue:   1062.00,
    discountCost:     47.35,
    returnAmount:    274.80,
    netSales:        536.92,
    orderCount:       13,
    aov:              41.30,
    repeatRatePct:   100.00,
    discountDepPct:    4.46,
    refundRatePct:    25.88,
  },
};

// ── Functions to call ─────────────────────────────────────────────────────────

const FN_NAMES = [
  "gross_revenue",
  "discount_cost",
  "return_amount",
  "net_sales",
  "order_count",
  "average_order_value",
  "repeat_purchase_rate",
  "discount_dependency",
  "refund_rate",
] as const;

type FnName = typeof FN_NAMES[number];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function callFn(
  client: Client,
  fn: FnName,
  storeId: string,
  dateFrom: string,
  dateTo: string,
): Promise<number> {
  const res = await client.query<{ result: string }>(
    `SELECT ${fn}($1::uuid, $2::date, $3::date) AS result`,
    [storeId, dateFrom, dateTo],
  );
  return Number(res.rows[0]?.result ?? 0);
}

function check(
  label: string,
  actual: number,
  expected: number,
  toleranceDp: number = 2,
): { ok: boolean; label: string; actual: number; expected: number; delta: number } {
  const tol = Math.pow(10, -toleranceDp) / 2;   // half a unit at toleranceDp decimal places
  const delta = Math.abs(actual - expected);
  return { ok: delta < tol, label, actual, expected, delta };
}

const PAD = 32;
const tick  = (s: string) => `  ✓ ${s}`;
const cross = (s: string) => `  ✗ ${s}`;

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const client = new Client(DB);
  await client.connect();
  console.log(`Connected to ${DB.host}:${DB.port}/${DB.database}\n`);

  let totalChecks = 0;
  let passedChecks = 0;

  for (const { label, dateFrom, dateTo } of PERIODS) {
    console.log(`${"─".repeat(56)}`);
    console.log(`Period : ${label}  (${dateFrom} → ${dateTo})`);
    console.log(`${"─".repeat(56)}`);

    // Fetch all functions in sequence (could parallelise, but serial is simpler for a script)
    const raw: Record<FnName, number> = {} as Record<FnName, number>;
    for (const fn of FN_NAMES) {
      raw[fn] = await callFn(client, fn, STORE_ID, dateFrom, dateTo);
    }

    // ── Raw results ───────────────────────────────────────────────────────────
    console.log("\n  Raw results from Supabase functions:");
    for (const fn of FN_NAMES) {
      const v = raw[fn];
      const isRate = fn === "repeat_purchase_rate" || fn === "discount_dependency" || fn === "refund_rate";
      const display = isRate ? `${(v * 100).toFixed(4)} %  (ratio: ${v.toFixed(6)})` : v.toFixed(4);
      console.log(`  ${fn.padEnd(PAD)} ${display}`);
    }

    // ── Reconciliation ────────────────────────────────────────────────────────
    const exp = EXPECTED[label];
    if (!exp) {
      console.log("\n  No expected values for this period — skipping reconciliation.\n");
      continue;
    }

    const checks = [
      check("gross_revenue",         raw.gross_revenue,                          exp.grossRevenue),
      check("discount_cost",         raw.discount_cost,                          exp.discountCost),
      check("return_amount",         raw.return_amount,                          exp.returnAmount),
      check("net_sales",             raw.net_sales,                              exp.netSales),
      check("order_count",           raw.order_count,                            exp.orderCount,   0),
      check("average_order_value",   raw.average_order_value,                    exp.aov),
      check("repeat_purchase_rate%", raw.repeat_purchase_rate * 100,             exp.repeatRatePct),
      check("discount_dependency%",  raw.discount_dependency  * 100,             exp.discountDepPct),
      check("refund_rate%",          raw.refund_rate          * 100,             exp.refundRatePct),
    ];

    console.log("\n  Reconciliation vs SQL validation report:");
    for (const c of checks) {
      totalChecks++;
      const desc = `${c.label.padEnd(PAD)} actual=${c.actual.toFixed(2)}  expected=${c.expected.toFixed(2)}  Δ=${c.delta.toFixed(4)}`;
      if (c.ok) {
        passedChecks++;
        console.log(tick(desc));
      } else {
        console.log(cross(desc));
      }
    }

    // ── Formula identity checks ───────────────────────────────────────────────
    console.log("\n  Formula identity checks (internal consistency):");

    const netSalesManual  = raw.gross_revenue - raw.discount_cost - raw.return_amount;
    // net_sales also subtracts tax; we can only verify without tax here, so check the sign
    const netSalesDelta   = raw.net_sales - (raw.gross_revenue - raw.discount_cost - raw.return_amount);
    const taxImplied      = -netSalesDelta;   // should be positive (tax > 0)
    console.log(`  ${"net_sales ≤ gross − disc − ret".padEnd(PAD)} gross−disc−ret=${netSalesManual.toFixed(2)}  net_sales=${raw.net_sales.toFixed(2)}  implied_tax=${taxImplied.toFixed(2)}  ${taxImplied >= 0 ? "✓" : "✗ NEGATIVE TAX"}`);

    const aovManual       = raw.order_count > 0 ? raw.net_sales / raw.order_count : 0;
    const aovDelta        = Math.abs(raw.average_order_value - aovManual);
    console.log(`  ${"aov = net_sales / order_count".padEnd(PAD)} manual=${aovManual.toFixed(4)}  fn=${raw.average_order_value.toFixed(4)}  Δ=${aovDelta.toFixed(6)}  ${aovDelta < 0.0001 ? "✓" : "✗"}`);

    const ddManual        = raw.gross_revenue > 0 ? raw.discount_cost / raw.gross_revenue : 0;
    const ddDelta         = Math.abs(raw.discount_dependency - ddManual);
    console.log(`  ${"disc_dep = disc_cost / gross".padEnd(PAD)} manual=${ddManual.toFixed(6)}  fn=${raw.discount_dependency.toFixed(6)}  Δ=${ddDelta.toFixed(8)}  ${ddDelta < 0.000001 ? "✓" : "✗"}`);

    const rrManual        = raw.gross_revenue > 0 ? raw.return_amount / raw.gross_revenue : 0;
    const rrDelta         = Math.abs(raw.refund_rate - rrManual);
    console.log(`  ${"refund_rate = returns / gross".padEnd(PAD)} manual=${rrManual.toFixed(6)}  fn=${raw.refund_rate.toFixed(6)}  Δ=${rrDelta.toFixed(8)}  ${rrDelta < 0.000001 ? "✓" : "✗"}`);

    console.log("");
  }

  await client.end();

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`${"═".repeat(56)}`);
  console.log(`Reconciliation: ${passedChecks}/${totalChecks} checks passed`);
  if (passedChecks === totalChecks) {
    console.log("All checks passed ✓");
  } else {
    console.log(`${totalChecks - passedChecks} check(s) failed ✗`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("Validation script failed:", err);
  process.exit(1);
});
