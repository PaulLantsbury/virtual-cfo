/**
 * validatePhase3MarketingCloud.ts
 *
 * Cloud-side validation for the Phase 3 marketing intelligence migration.
 * Connects to Supabase cloud via the REST API using the service role key.
 * Exercises all 4 RPCs and verifies seed data reconciles to the approved plan.
 *
 * Run AFTER the migration SQL has been applied to the Supabase project.
 *
 * Run with:
 *   pnpm --filter @workspace/scripts run validate:phase3:cloud
 */

import { createClient } from "@supabase/supabase-js";

// ── Config ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env["VITE_SUPABASE_URL"] ?? "";
const SERVICE_KEY  = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const STORE_ID = "10000000-0000-0000-0000-000000000001";
const APR_FROM = "2026-04-01";
const APR_TO   = "2026-04-30";
const MAR_FROM = "2026-03-01";
const MAR_TO   = "2026-03-31";
const TOL      = 0.005;

// ── Helpers ────────────────────────────────────────────────────────────────

let passCount = 0;
let failCount = 0;

function pass(label: string, detail = ""): void {
  passCount++;
  console.log(`  ✓ ${label}${detail ? "  →  " + detail : ""}`);
}

function fail(label: string, detail = ""): void {
  failCount++;
  console.log(`  ✗ ${label}${detail ? "  →  " + detail : ""}`);
}

function near(a: number, b: number, t = TOL): boolean {
  return Math.abs(a - b) <= t;
}

function section(title: string): void {
  console.log(`\n${"─".repeat(66)}`);
  console.log(title);
  console.log(`${"─".repeat(66)}`);
}

// ── Types matching RPC return shapes ──────────────────────────────────────

interface ChannelRow {
  channel:                 string;
  cac:                     number;
  contribution_margin_pct: number;
  opportunity_score:       number;
  data_freshness:          string;
  calculation_version:     string;
  spend:                   number;
  attributed_new_customers: number;
}

interface BlendedRow {
  blended_cac:                     number;
  blended_contribution_margin_pct: number;
  total_new_customers:             number;
  total_attributed_revenue:        number;
  calculation_version:             string;
}

interface OpportunityRow {
  channel:               string;
  opportunity_type:      string;
  score:                 number;
  estimated_uplift_low:  number;
  estimated_uplift_high: number;
  status:                string;
  calculation_version:   string;
}

interface TrendRow {
  channel:                  string;
  snapshot_date:            string;
  cac:                      number;
  mom_change_pct:           number | null;
  attributed_new_customers: number;
  spend:                    number;
  calculation_version:      string;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  console.log(`\nConnected to: ${SUPABASE_URL}`);
  console.log(`Store: ${STORE_ID}\n`);

  // ════════════════════════════════════════════════════════════════════════
  // 1. Table existence via REST (HTTP 200 = table exists + RLS permits access
  //    through service role, HTTP 404 = table not found)
  // ════════════════════════════════════════════════════════════════════════
  section("1. Table existence (service role REST probe — HEAD request)");

  const tables = [
    "marketing_channel_daily_metrics",
    "marketing_channel_monthly_snapshots",
    "marketing_blended_monthly",
    "channel_opportunity_scores",
    "cac_trend_snapshots",
  ] as const;

  for (const tbl of tables) {
    const { error, count } = await sb
      .from(tbl as string)
      .select("*", { count: "exact", head: true });
    if (!error) pass(`${tbl}`, `count = ${count ?? "?"}`);
    else        fail(`${tbl}`, error.message);
  }

  // ════════════════════════════════════════════════════════════════════════
  // 2. channel_metrics_monthly() — April 2026
  // ════════════════════════════════════════════════════════════════════════
  section("2. channel_metrics_monthly()  —  April 2026");

  {
    const { data, error } = await sb.rpc("channel_metrics_monthly", {
      p_store_id:  STORE_ID,
      p_date_from: APR_FROM,
      p_date_to:   APR_TO,
    });

    if (error) {
      fail("channel_metrics_monthly RPC call", error.message);
    } else {
      const rows = (data as ChannelRow[]) ?? [];
      if (rows.length === 4) pass("returns 4 channel rows");
      else                   fail("returns 4 channel rows", `got ${rows.length}`);

      const expected: Record<string, { cac: number; cmPct: number; score: number }> = {
        meta:            { cac: 18.40, cmPct: 0.3420, score: 78 },
        google_shopping: { cac: 11.20, cmPct: 0.4010, score: 42 },
        email:           { cac:  4.80, cmPct: 0.5860, score:  0 },
        organic:         { cac:  2.10, cmPct: 0.5230, score:  0 },
      };

      for (const row of rows) {
        const exp = expected[row.channel];
        if (!exp) { fail(`unexpected channel: ${row.channel}`); continue; }

        if (near(row.cac, exp.cac, 0.01))   pass(`${row.channel}: CAC = £${row.cac.toFixed(2)}`);
        else                                  fail(`${row.channel}: CAC`, `expected £${exp.cac}, got £${row.cac}`);

        if (near(row.contribution_margin_pct, exp.cmPct, 0.001)) pass(`${row.channel}: CM% = ${(row.contribution_margin_pct*100).toFixed(1)}%`);
        else                                                       fail(`${row.channel}: CM%`, `expected ${exp.cmPct}, got ${row.contribution_margin_pct}`);

        if (row.opportunity_score === exp.score) pass(`${row.channel}: score = ${row.opportunity_score}`);
        else                                      fail(`${row.channel}: score`, `expected ${exp.score}, got ${row.opportunity_score}`);

        if (row.calculation_version === "v1")   pass(`${row.channel}: calculation_version = 'v1'`);
        else                                     fail(`${row.channel}: calculation_version`, `got '${row.calculation_version}'`);

        if (row.data_freshness === "estimated") pass(`${row.channel}: data_freshness = 'estimated'`);
        else                                     fail(`${row.channel}: data_freshness`, `got '${row.data_freshness}'`);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 3. blended_marketing_performance() — April + March 2026
  // ════════════════════════════════════════════════════════════════════════
  section("3. blended_marketing_performance()  —  April + March 2026");

  for (const [label, from, to, expCac, expCust] of [
    ["April", APR_FROM, APR_TO, 12.20, 925] as const,
    ["March", MAR_FROM, MAR_TO,  9.80, 820] as const,
  ]) {
    const { data, error } = await sb.rpc("blended_marketing_performance", {
      p_store_id:  STORE_ID,
      p_date_from: from,
      p_date_to:   to,
    });

    if (error) {
      fail(`${label}: blended_marketing_performance`, error.message);
      continue;
    }

    const rows = (data as BlendedRow[]) ?? [];
    const row  = rows[0];
    if (!row) { fail(`${label}: returns a row`, "no rows"); continue; }

    if (near(row.blended_cac, expCac, 0.01)) pass(`${label}: blended_cac = £${row.blended_cac.toFixed(2)}`);
    else                                       fail(`${label}: blended_cac`, `expected £${expCac}, got £${row.blended_cac}`);

    if (row.total_new_customers === expCust) pass(`${label}: total_new_customers = ${row.total_new_customers}`);
    else                                     fail(`${label}: total_new_customers`, `expected ${expCust}, got ${row.total_new_customers}`);

    if (row.calculation_version === "v1") pass(`${label}: calculation_version = 'v1'`);
    else                                   fail(`${label}: calculation_version`, `got '${row.calculation_version}'`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // 4. channel_opportunities_active() — scores, uplift range
  // ════════════════════════════════════════════════════════════════════════
  section("4. channel_opportunities_active()");

  {
    const { data, error } = await sb.rpc("channel_opportunities_active", {
      p_store_id: STORE_ID,
    });

    if (error) {
      fail("channel_opportunities_active RPC call", error.message);
    } else {
      const rows = (data as OpportunityRow[]) ?? [];
      if (rows.length === 4) pass("returns 4 active opportunities");
      else                   fail("returns 4 active opportunities", `got ${rows.length}`);

      const scores = rows.map((r) => r.score);
      const expScores = [78, 65, 55, 42];
      if (expScores.every((s, i) => s === scores[i])) pass(`scores = [${scores.join(", ")}] ordered DESC`);
      else                                              fail(`scores`, `expected [78,65,55,42], got [${scores.join(",")}]`);

      const totalLow  = rows.reduce((s, r) => s + r.estimated_uplift_low, 0);
      const totalHigh = rows.reduce((s, r) => s + r.estimated_uplift_high, 0);

      if (near(totalLow, 10961, 1))  pass(`total_uplift_low  = £${totalLow.toLocaleString()}`);
      else                            fail(`total_uplift_low`,  `expected £10,961, got £${totalLow}`);

      if (near(totalHigh, 24920, 1)) pass(`total_uplift_high = £${totalHigh.toLocaleString()}`);
      else                            fail(`total_uplift_high`, `expected £24,920, got £${totalHigh}`);

      if (rows.every((r) => r.calculation_version === "v1")) pass("all: calculation_version = 'v1'");
      else                                                    fail("calculation_version", "some rows != 'v1'");

      if (rows.every((r) => r.status === "active")) pass("all: status = 'active'");
      else                                           fail("status", "some rows != 'active'");
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 5. cac_trend_by_channel() — 8 rows, MoM deltas, March NULL
  // ════════════════════════════════════════════════════════════════════════
  section("5. cac_trend_by_channel()  —  trailing 6 months up to 2026-04-30");

  {
    const { data, error } = await sb.rpc("cac_trend_by_channel", {
      p_store_id:    STORE_ID,
      p_as_of_date:  "2026-04-30",
      p_months_back: 6,
    });

    if (error) {
      fail("cac_trend_by_channel RPC call", error.message);
    } else {
      const rows = (data as TrendRow[]) ?? [];
      if (rows.length === 8) pass("returns 8 CAC trend rows");
      else                   fail("returns 8 CAC trend rows", `got ${rows.length}`);

      const aprilRows = rows.filter((r) => r.snapshot_date.startsWith("2026-04"));
      const expAprilCac: Record<string, number>  = { meta: 18.40, google_shopping: 11.20, email: 4.80, organic: 2.10 };
      const expAprilMoM: Record<string, number>  = { meta: 0.14, google_shopping: 0.06, email: -0.02, organic: 0.00 };

      for (const r of aprilRows) {
        const expC = expAprilCac[r.channel];
        const expM = expAprilMoM[r.channel] ?? 0;
        if (expC === undefined) continue;

        if (near(r.cac, expC, 0.01)) pass(`${r.channel} April: CAC = £${r.cac.toFixed(2)}`);
        else                          fail(`${r.channel} April: CAC`, `expected £${expC}, got £${r.cac}`);

        if (r.mom_change_pct !== null && near(r.mom_change_pct, expM, 0.001)) pass(`${r.channel} April: MoM = ${(r.mom_change_pct*100).toFixed(1)}%`);
        else if (r.mom_change_pct === null && expM === 0)                      pass(`${r.channel} April: MoM = null/0 (stable)`);
        else                                                                    fail(`${r.channel} April: MoM`, `expected ${(expM*100).toFixed(1)}%, got ${r.mom_change_pct}`);

        if (r.calculation_version === "v1") pass(`${r.channel} April: calculation_version = 'v1'`);
        else                                 fail(`${r.channel} April: calculation_version`, `got '${r.calculation_version}'`);
      }

      const marchNull = rows.filter((r) => r.snapshot_date.startsWith("2026-03")).every((r) => r.mom_change_pct === null);
      if (marchNull) pass("March rows: mom_change_pct = NULL (first seeded month)");
      else           fail("March rows: mom_change_pct should be NULL");
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Summary
  // ════════════════════════════════════════════════════════════════════════
  const total = passCount + failCount;
  console.log(`\n${"═".repeat(66)}`);
  console.log(`Phase 3 cloud validation: ${passCount}/${total} checks passed`);
  if (failCount === 0) {
    console.log("All cloud checks passed ✓  — Supabase cloud is in sync with local.");
  } else {
    console.log(`${failCount} check(s) failed ✗`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("Cloud validation failed:", err);
  process.exit(1);
});
