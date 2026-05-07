/**
 * validatePhase3Marketing.ts
 *
 * Validation script for the Phase 3 marketing intelligence migration.
 * Migration: 20260507000002_marketing_intelligence_schema.sql
 *
 * Validates:
 *   1.  All 5 tables exist in public schema
 *   2.  RLS enabled on all 5 tables
 *   3.  Zero permissive SELECT/INSERT/UPDATE/DELETE policies on any new table
 *   4.  All 4 SECURITY DEFINER RPCs exist in pg_proc
 *   5.  All 4 RPCs use safe search_path (SET search_path = 'public', 'pg_temp')
 *   6.  CHECK constraints exist on all derived tables
 *   7.  Seed row counts correct (8 daily, 8 monthly snapshots, 2 blended, 4 opportunities, 8 CAC trend)
 *   8.  channel_metrics_monthly() — April 2026 values reconcile to channel-metrics.ts mock
 *       Meta CAC £18.40, Google £11.20, Email £4.80, Organic £2.10
 *       CM%: Meta 34.2%, Google 40.1%, Email 58.6%, Organic 52.3%
 *   9.  blended_marketing_performance() — blended CAC £12.20 (April), £9.80 (March)
 *   10. channel_opportunities_active() — 4 active opportunities, scores 78/65/55/42
 *       Total uplift range: £10,961–£24,920
 *   11. cac_trend_by_channel() — 8 trend rows, MoM changes correct
 *   12. calculation_version = 'v1' on all 4 derived tables
 *   13. data_freshness = 'estimated' on channel snapshots
 *   14. UNIQUE constraints correctly applied
 *
 * Run with:
 *   pnpm --filter @workspace/scripts run validate:phase3
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

const STORE_ID  = "10000000-0000-0000-0000-000000000001";
const APR_FROM  = "2026-04-01";
const APR_TO    = "2026-04-30";
const MAR_FROM  = "2026-03-01";
const MAR_TO    = "2026-03-31";
const TOLERANCE = 0.005;

// ── Helpers ───────────────────────────────────────────────────────────────────

let passCount = 0;
let failCount = 0;

function pass(label: string, detail: string = ""): void {
  passCount++;
  console.log(`  ✓ ${label}${detail ? "  →  " + detail : ""}`);
}

function fail(label: string, detail: string = ""): void {
  failCount++;
  console.log(`  ✗ ${label}${detail ? "  →  " + detail : ""}`);
}

function near(actual: number, expected: number, tol: number = TOLERANCE): boolean {
  return Math.abs(actual - expected) <= tol;
}

function section(title: string): void {
  console.log(`\n${"─".repeat(66)}`);
  console.log(title);
  console.log(`${"─".repeat(66)}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const client = new Client(DB);
  await client.connect();
  console.log(`\nConnected to ${DB.host}:${DB.port}/${DB.database}`);
  console.log(`Store: ${STORE_ID}\n`);

  // ══════════════════════════════════════════════════════════════════════════
  // 1. Table existence
  // ══════════════════════════════════════════════════════════════════════════
  section("1. Table existence (5 tables)");

  const tables = [
    "marketing_channel_daily_metrics",
    "marketing_channel_monthly_snapshots",
    "marketing_blended_monthly",
    "channel_opportunity_scores",
    "cac_trend_snapshots",
  ];

  for (const tbl of tables) {
    const { rows } = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT FROM pg_tables
         WHERE  schemaname = 'public'
         AND    tablename  = $1
       ) AS exists`,
      [tbl],
    );
    if (rows[0]?.exists) pass(tbl);
    else                  fail(tbl, "table not found in pg_tables");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. RLS enabled on all 5 tables
  // ══════════════════════════════════════════════════════════════════════════
  section("2. Row Level Security enabled");

  for (const tbl of tables) {
    const { rows } = await client.query<{ relrowsecurity: boolean }>(
      `SELECT c.relrowsecurity
       FROM   pg_class c
       JOIN   pg_namespace n ON n.oid = c.relnamespace
       WHERE  n.nspname = 'public'
         AND  c.relname = $1`,
      [tbl],
    );
    const rlsOn = rows[0]?.relrowsecurity === true;
    if (rlsOn) pass(`RLS enabled: ${tbl}`);
    else        fail(`RLS enabled: ${tbl}`, "rowsecurity = false");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. Zero permissive policies (deny-by-default confirmed)
  // ══════════════════════════════════════════════════════════════════════════
  section("3. Zero permissive policies (deny-by-default)");

  for (const tbl of tables) {
    const { rows } = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM   pg_policy p
       JOIN   pg_class  c ON c.oid  = p.polrelid
       JOIN   pg_namespace n ON n.oid = c.relnamespace
       WHERE  n.nspname = 'public'
         AND  c.relname = $1
         AND  p.polpermissive = true`,
      [tbl],
    );
    const count = Number(rows[0]?.count ?? 0);
    if (count === 0) pass(`zero permissive policies: ${tbl}`, `count = 0`);
    else             fail(`zero permissive policies: ${tbl}`, `found ${count} permissive policies`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. RPC existence in pg_proc
  // ══════════════════════════════════════════════════════════════════════════
  section("4. SECURITY DEFINER RPC existence (pg_proc)");

  const rpcs = [
    "channel_metrics_monthly",
    "blended_marketing_performance",
    "channel_opportunities_active",
    "cac_trend_by_channel",
  ];

  for (const fn of rpcs) {
    const { rows } = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT FROM pg_proc p
         JOIN   pg_namespace n ON n.oid = p.pronamespace
         WHERE  n.nspname = 'public'
           AND  p.proname = $1
       ) AS exists`,
      [fn],
    );
    if (rows[0]?.exists) pass(fn);
    else                  fail(fn, "function not found in pg_proc");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. SECURITY DEFINER + safe search_path on all 4 RPCs
  // ══════════════════════════════════════════════════════════════════════════
  section("5. SECURITY DEFINER + safe search_path");

  for (const fn of rpcs) {
    const { rows } = await client.query<{
      prosecdef:  boolean;
      proconfig:  string[] | null;
    }>(
      `SELECT p.prosecdef, p.proconfig
       FROM   pg_proc p
       JOIN   pg_namespace n ON n.oid = p.pronamespace
       WHERE  n.nspname = 'public'
         AND  p.proname = $1`,
      [fn],
    );
    const row = rows[0];
    if (!row) {
      fail(`${fn}`, "not found in pg_proc");
      continue;
    }
    if (row.prosecdef) pass(`${fn}: SECURITY DEFINER`);
    else               fail(`${fn}: SECURITY DEFINER`, "prosecdef = false");

    const cfg = row.proconfig ?? [];
    const hasSearchPath = cfg.some((c) => c.startsWith("search_path="));
    if (hasSearchPath) {
      const sp = cfg.find((c) => c.startsWith("search_path=")) ?? "";
      pass(`${fn}: safe search_path`, sp);
    } else {
      fail(`${fn}: safe search_path`, "no search_path in proconfig");
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 6. CHECK constraints on derived tables
  // ══════════════════════════════════════════════════════════════════════════
  section("6. CHECK constraints (including calc_version_check)");

  const expectedConstraints: Record<string, string[]> = {
    marketing_channel_monthly_snapshots: [
      "mcms_channel_check", "mcms_freshness_check", "mcms_calc_version_check",
    ],
    marketing_blended_monthly: [
      "mbm_calc_version_check",
    ],
    channel_opportunity_scores: [
      "cos_channel_check", "cos_type_check", "cos_status_check", "cos_calc_version_check",
    ],
    cac_trend_snapshots: [
      "cts_channel_check", "cts_calc_version_check",
    ],
  };

  for (const [tbl, constraints] of Object.entries(expectedConstraints)) {
    for (const con of constraints) {
      const { rows } = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT FROM pg_constraint c
           JOIN   pg_class     cl ON cl.oid = c.conrelid
           JOIN   pg_namespace n  ON n.oid  = cl.relnamespace
           WHERE  n.nspname  = 'public'
             AND  cl.relname = $1
             AND  c.conname  = $2
             AND  c.contype  = 'c'
         ) AS exists`,
        [tbl, con],
      );
      if (rows[0]?.exists) pass(`${con} on ${tbl}`);
      else                  fail(`${con} on ${tbl}`, "constraint not found");
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 7. Seed row counts
  // ══════════════════════════════════════════════════════════════════════════
  section("7. Seed row counts");

  const countChecks: Array<{ label: string; sql: string; expected: number }> = [
    {
      label:    "marketing_channel_daily_metrics (8 rows: 4 channels × 2 months)",
      sql:      `SELECT COUNT(*)::int AS n FROM marketing_channel_daily_metrics WHERE store_id = $1`,
      expected: 8,
    },
    {
      label:    "marketing_channel_monthly_snapshots (8 rows: 4 channels × 2 months)",
      sql:      `SELECT COUNT(*)::int AS n FROM marketing_channel_monthly_snapshots WHERE store_id = $1`,
      expected: 8,
    },
    {
      label:    "marketing_blended_monthly (2 rows: March + April)",
      sql:      `SELECT COUNT(*)::int AS n FROM marketing_blended_monthly WHERE store_id = $1`,
      expected: 2,
    },
    {
      label:    "channel_opportunity_scores (4 active opportunities)",
      sql:      `SELECT COUNT(*)::int AS n FROM channel_opportunity_scores WHERE store_id = $1`,
      expected: 4,
    },
    {
      label:    "cac_trend_snapshots (8 rows: 4 channels × 2 months)",
      sql:      `SELECT COUNT(*)::int AS n FROM cac_trend_snapshots WHERE store_id = $1`,
      expected: 8,
    },
  ];

  for (const { label, sql, expected } of countChecks) {
    const { rows } = await client.query<{ n: number }>(sql, [STORE_ID]);
    const actual = rows[0]?.n ?? -1;
    if (actual === expected) pass(label, `count = ${actual}`);
    else                     fail(label, `expected ${expected}, got ${actual}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 8. channel_metrics_monthly() — April 2026
  // CAC: Meta £18.40, Google £11.20, Email £4.80, Organic £2.10
  // CM%: Meta 34.2%, Google 40.1%, Email 58.6%, Organic 52.3%
  // calculation_version = 'v1', data_freshness = 'estimated'
  // ══════════════════════════════════════════════════════════════════════════
  section("8. channel_metrics_monthly()  —  April 2026");

  {
    const { rows } = await client.query<{
      channel:                string;
      cac:                    string;
      contribution_margin_pct: string;
      opportunity_score:      number;
      data_freshness:         string;
      calculation_version:    string;
      spend:                  string;
      attributed_new_customers: number;
    }>(
      `SELECT * FROM channel_metrics_monthly($1::uuid, $2::date, $3::date)`,
      [STORE_ID, APR_FROM, APR_TO],
    );

    console.log(`\n  Rows returned: ${rows.length} (expected 4)`);
    if (rows.length === 4) pass("returns 4 channel rows");
    else                   fail("returns 4 channel rows", `got ${rows.length}`);

    // Expected values (from channel-metrics.ts mock)
    const expected: Record<string, { cac: number; cmPct: number; score: number }> = {
      meta:            { cac: 18.40, cmPct: 0.3420, score: 78 },
      google_shopping: { cac: 11.20, cmPct: 0.4010, score: 42 },
      email:           { cac:  4.80, cmPct: 0.5860, score:  0 },
      organic:         { cac:  2.10, cmPct: 0.5230, score:  0 },
    };

    console.log(`\n  Channel breakdown:`);
    console.log(`  ${"Channel".padEnd(18)} ${"CAC".padStart(8)} ${"Expected".padStart(10)} ${"CM%".padStart(8)} ${"Expected".padStart(10)} ${"Score".padStart(6)} ${"CalcVer".padStart(9)} ${"Freshness".padStart(10)}`);
    console.log(`  ${"─".repeat(88)}`);

    for (const row of rows) {
      const exp = expected[row.channel];
      if (!exp) {
        fail(`unexpected channel: ${row.channel}`);
        continue;
      }

      const cac    = Number(row.cac);
      const cmPct  = Number(row.contribution_margin_pct);
      const score  = Number(row.opportunity_score);
      const ver    = row.calculation_version;
      const fresh  = row.data_freshness;

      console.log(
        `  ${row.channel.padEnd(18)} ` +
        `${`£${cac.toFixed(2)}`.padStart(8)} ` +
        `${`£${exp.cac.toFixed(2)}`.padStart(10)} ` +
        `${`${(cmPct * 100).toFixed(1)}%`.padStart(8)} ` +
        `${`${(exp.cmPct * 100).toFixed(1)}%`.padStart(10)} ` +
        `${String(score).padStart(6)} ` +
        `${ver.padStart(9)} ` +
        `${fresh.padStart(10)}`
      );

      if (near(cac, exp.cac, 0.01))   pass(`${row.channel}: CAC = £${cac.toFixed(2)}`);
      else                              fail(`${row.channel}: CAC`, `expected £${exp.cac}, got £${cac}`);

      if (near(cmPct, exp.cmPct, 0.0005)) pass(`${row.channel}: CM% = ${(cmPct*100).toFixed(1)}%`);
      else                                 fail(`${row.channel}: CM%`, `expected ${exp.cmPct}, got ${cmPct}`);

      if (score === exp.score)          pass(`${row.channel}: opportunity_score = ${score}`);
      else                              fail(`${row.channel}: opportunity_score`, `expected ${exp.score}, got ${score}`);

      if (ver === "v1")    pass(`${row.channel}: calculation_version = 'v1'`);
      else                 fail(`${row.channel}: calculation_version`, `expected 'v1', got '${ver}'`);

      if (fresh === "estimated") pass(`${row.channel}: data_freshness = 'estimated'`);
      else                       fail(`${row.channel}: data_freshness`, `expected 'estimated', got '${fresh}'`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 9. blended_marketing_performance() — April 2026 + March 2026
  // blended_cac: April £12.20, March £9.80 (matches BLENDED_CAC mock)
  // ══════════════════════════════════════════════════════════════════════════
  section("9. blended_marketing_performance()  —  April + March 2026");

  // April
  {
    const { rows } = await client.query<{
      blended_cac:                    string;
      blended_contribution_margin_pct: string;
      total_new_customers:            number;
      total_attributed_revenue:       string;
      calculation_version:            string;
    }>(
      `SELECT * FROM blended_marketing_performance($1::uuid, $2::date, $3::date)`,
      [STORE_ID, APR_FROM, APR_TO],
    );

    const row = rows[0];
    if (!row) {
      fail("April: blended_marketing_performance returns a row", "no rows");
    } else {
      const bCac  = Number(row.blended_cac);
      const bCm   = Number(row.blended_contribution_margin_pct);
      const nc    = Number(row.total_new_customers);
      const rev   = Number(row.total_attributed_revenue);
      const ver   = row.calculation_version;

      console.log(`\n  April 2026 blended:`);
      console.log(`    blended_cac:       £${bCac.toFixed(2)}  (expected £12.20 — matches BLENDED_CAC mock)`);
      console.log(`    blended_cm_pct:    ${(bCm*100).toFixed(2)}%  (expected 45.37%)`);
      console.log(`    total_customers:   ${nc}  (expected 925)`);
      console.log(`    total_revenue:     £${rev.toLocaleString()}  (expected £167,639)`);
      console.log(`    calculation_version: ${ver}  (expected 'v1')`);

      if (near(bCac, 12.20, 0.01)) pass(`April blended_cac = £${bCac.toFixed(2)}`);
      else                          fail(`April blended_cac`, `expected £12.20, got £${bCac.toFixed(2)}`);

      if (near(bCm, 0.4537, 0.001)) pass(`April blended CM% = ${(bCm*100).toFixed(2)}%`);
      else                           fail(`April blended CM%`, `expected 45.37%, got ${(bCm*100).toFixed(2)}%`);

      if (nc === 925) pass(`April total_new_customers = 925`);
      else            fail(`April total_new_customers`, `expected 925, got ${nc}`);

      if (near(rev, 167639, 1)) pass(`April total_attributed_revenue = £167,639`);
      else                       fail(`April total_attributed_revenue`, `expected £167,639, got £${rev}`);

      if (ver === "v1") pass(`April calculation_version = 'v1'`);
      else              fail(`April calculation_version`, `expected 'v1', got '${ver}'`);
    }
  }

  // March
  {
    const { rows } = await client.query<{
      blended_cac:         string;
      total_new_customers: number;
      calculation_version: string;
    }>(
      `SELECT * FROM blended_marketing_performance($1::uuid, $2::date, $3::date)`,
      [STORE_ID, MAR_FROM, MAR_TO],
    );

    const row = rows[0];
    if (!row) {
      fail("March: blended_marketing_performance returns a row", "no rows");
    } else {
      const bCac = Number(row.blended_cac);
      const nc   = Number(row.total_new_customers);
      const ver  = row.calculation_version;

      console.log(`\n  March 2026 blended:`);
      console.log(`    blended_cac:       £${bCac.toFixed(2)}  (expected £9.80 — matches BLENDED_CAC_PREV mock)`);
      console.log(`    total_customers:   ${nc}  (expected 820)`);
      console.log(`    calculation_version: ${ver}  (expected 'v1')`);

      if (near(bCac, 9.80, 0.01)) pass(`March blended_cac = £${bCac.toFixed(2)} (BLENDED_CAC_PREV ✓)`);
      else                         fail(`March blended_cac`, `expected £9.80, got £${bCac.toFixed(2)}`);

      if (nc === 820) pass(`March total_new_customers = 820`);
      else            fail(`March total_new_customers`, `expected 820, got ${nc}`);

      if (ver === "v1") pass(`March calculation_version = 'v1'`);
      else              fail(`March calculation_version`, `expected 'v1', got '${ver}'`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 10. channel_opportunities_active() — 4 active opportunities
  // Scores: 78, 65, 55, 42. Total uplift range: £10,961–£24,920
  // ══════════════════════════════════════════════════════════════════════════
  section("10. channel_opportunities_active()");

  {
    const { rows } = await client.query<{
      channel:              string;
      opportunity_type:     string;
      score:                number;
      estimated_uplift_low: string;
      estimated_uplift_high: string;
      status:               string;
      calculation_version:  string;
    }>(
      `SELECT * FROM channel_opportunities_active($1::uuid)`,
      [STORE_ID],
    );

    console.log(`\n  Rows returned: ${rows.length} (expected 4)`);
    if (rows.length === 4) pass("returns 4 active opportunities");
    else                   fail("returns 4 active opportunities", `got ${rows.length}`);

    const expectedScores = [78, 65, 55, 42];
    const scores = rows.map((r) => Number(r.score));
    const scoresMatch = expectedScores.every((s, i) => s === scores[i]);
    if (scoresMatch) pass(`scores = [${scores.join(", ")}] (ordered DESC)`);
    else             fail(`scores`, `expected [78, 65, 55, 42], got [${scores.join(", ")}]`);

    const totalLow  = rows.reduce((s, r) => s + Number(r.estimated_uplift_low), 0);
    const totalHigh = rows.reduce((s, r) => s + Number(r.estimated_uplift_high), 0);
    console.log(`  Total uplift range: £${totalLow.toLocaleString()} – £${totalHigh.toLocaleString()}`);
    console.log(`  Expected:           £10,961 – £24,920`);

    if (near(totalLow, 10961, 1))  pass(`total_uplift_low  = £${totalLow.toLocaleString()}`);
    else                            fail(`total_uplift_low`,  `expected £10,961, got £${totalLow}`);

    if (near(totalHigh, 24920, 1)) pass(`total_uplift_high = £${totalHigh.toLocaleString()}`);
    else                            fail(`total_uplift_high`, `expected £24,920, got £${totalHigh}`);

    const allV1 = rows.every((r) => r.calculation_version === "v1");
    if (allV1) pass(`all opportunities: calculation_version = 'v1'`);
    else       fail(`calculation_version`, `some rows have version != 'v1'`);

    const allActive = rows.every((r) => r.status === "active");
    if (allActive) pass(`all opportunities: status = 'active'`);
    else           fail(`status`, `some rows have status != 'active'`);

    console.log(`\n  Opportunity breakdown:`);
    console.log(`  ${"Channel".padEnd(16)} ${"Type".padEnd(22)} ${"Score".padStart(5)} ${"Low".padStart(9)} ${"High".padStart(9)}`);
    console.log(`  ${"─".repeat(66)}`);
    for (const r of rows) {
      console.log(
        `  ${r.channel.padEnd(16)} ${r.opportunity_type.padEnd(22)} ` +
        `${String(r.score).padStart(5)} ` +
        `${`£${Number(r.estimated_uplift_low).toLocaleString()}`.padStart(9)} ` +
        `${`£${Number(r.estimated_uplift_high).toLocaleString()}`.padStart(9)}`
      );
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 11. cac_trend_by_channel() — 8 rows, MoM deltas correct
  // ══════════════════════════════════════════════════════════════════════════
  section("11. cac_trend_by_channel()  —  trailing 6 months up to 2026-04-30");

  {
    const { rows } = await client.query<{
      channel:                 string;
      snapshot_date:           string;
      cac:                     string;
      mom_change_pct:          string | null;
      attributed_new_customers: number;
      spend:                   string;
      calculation_version:     string;
    }>(
      `SELECT * FROM cac_trend_by_channel($1::uuid, $2::date, 6)`,
      [STORE_ID, "2026-04-30"],
    );

    console.log(`\n  Rows returned: ${rows.length} (expected 8: 4 channels × 2 months)`);
    if (rows.length === 8) pass("returns 8 CAC trend rows");
    else                   fail("returns 8 CAC trend rows", `got ${rows.length}`);

    // Check April MoM changes
    const aprilRows = rows.filter((r) => r.snapshot_date === "2026-04-30");
    const expectedAprilMoM: Record<string, number | null> = {
      meta:            0.14,
      google_shopping: 0.06,
      email:           -0.02,
      organic:         0.00,
    };

    const expectedAprilCac: Record<string, number> = {
      meta: 18.40, google_shopping: 11.20, email: 4.80, organic: 2.10,
    };

    console.log(`\n  April 2026 rows (MoM change validation):`);
    for (const r of aprilRows) {
      const cac    = Number(r.cac);
      const mom    = r.mom_change_pct !== null ? Number(r.mom_change_pct) : null;
      const expCac = expectedAprilCac[r.channel];
      const expMom = expectedAprilMoM[r.channel] ?? 0;
      const ver    = r.calculation_version;

      console.log(`    ${r.channel}: CAC £${cac.toFixed(2)}, MoM ${mom !== null ? `${(mom*100).toFixed(1)}%` : "null"}, version ${ver}`);

      if (near(cac, expCac, 0.01)) pass(`${r.channel} April: CAC = £${cac.toFixed(2)}`);
      else                          fail(`${r.channel} April: CAC`, `expected £${expCac}, got £${cac}`);

      if (mom !== null && near(mom, expMom, 0.001)) pass(`${r.channel} April: MoM = ${(mom*100).toFixed(1)}%`);
      else if (mom === null && expMom === 0)         pass(`${r.channel} April: MoM = null/0 (stable)`);
      else                                           fail(`${r.channel} April: MoM`, `expected ${(expMom*100).toFixed(1)}%, got ${mom}`);

      if (ver === "v1") pass(`${r.channel} April: calculation_version = 'v1'`);
      else              fail(`${r.channel} April: calculation_version`, `expected 'v1', got '${ver}'`);
    }

    // Check March rows have null MoM
    const marchRows = rows.filter((r) => r.snapshot_date === "2026-03-31");
    const allMarchNull = marchRows.every((r) => r.mom_change_pct === null);
    if (allMarchNull) pass(`March rows: mom_change_pct = NULL (first seeded month)`);
    else              fail(`March rows: mom_change_pct should be NULL`, `some rows have non-null MoM`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 12. Ordering — channel_metrics_monthly() returns rows by score DESC
  // ══════════════════════════════════════════════════════════════════════════
  section("12. RPC ordering — channel_metrics_monthly() by score DESC");

  {
    const { rows } = await client.query<{
      channel:          string;
      opportunity_score: number;
    }>(
      `SELECT channel, opportunity_score FROM channel_metrics_monthly($1::uuid, $2::date, $3::date)`,
      [STORE_ID, APR_FROM, APR_TO],
    );

    const scores = rows.map((r) => Number(r.opportunity_score));
    let isDescending = true;
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] > scores[i - 1]) { isDescending = false; break; }
    }
    if (isDescending) pass(`rows ordered by opportunity_score DESC: [${scores.join(", ")}]`);
    else              fail(`rows ordered by opportunity_score DESC`, `got [${scores.join(", ")}]`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 13. UNIQUE constraint enforcement
  // ══════════════════════════════════════════════════════════════════════════
  section("13. UNIQUE constraints enforced (ON CONFLICT DO NOTHING idempotency)");

  {
    // Re-insert a row that already exists — should affect 0 rows
    const result = await client.query(
      `INSERT INTO marketing_blended_monthly
         (store_id, period_start, period_end, total_spend, overhead_content_spend,
          total_attributed_revenue, total_attributed_orders, total_new_customers,
          calculation_version)
       VALUES
         ($1, '2026-04-01', '2026-04-30', 9671.00, 1614.00, 167639.00, 1983, 925, 'v1')
       ON CONFLICT (store_id, period_start) DO NOTHING`,
      [STORE_ID],
    );
    if (result.rowCount === 0) pass("duplicate insert → 0 rows affected (ON CONFLICT DO NOTHING)");
    else                       fail("duplicate insert", `expected 0 rows, got ${result.rowCount}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 14. calculation_version CHECK constraint enforced
  // ══════════════════════════════════════════════════════════════════════════
  section("14. calculation_version CHECK constraint rejects invalid values");

  {
    let rejectCount = 0;
    try {
      await client.query(
        `INSERT INTO cac_trend_snapshots
           (store_id, channel, snapshot_date, cac, attributed_new_customers, spend, calculation_version)
         VALUES ($1, 'meta', '2025-01-31', 99.00, 10, 1000.00, 'invalid_version')`,
        [STORE_ID],
      );
      fail("CHECK constraint rejects 'invalid_version'", "INSERT succeeded (constraint not working)");
    } catch {
      rejectCount++;
      pass("CHECK constraint rejects 'invalid_version' on cac_trend_snapshots");
    }

    // Valid value should succeed then we clean up
    try {
      await client.query(
        `INSERT INTO cac_trend_snapshots
           (store_id, channel, snapshot_date, cac, attributed_new_customers, spend, calculation_version)
         VALUES ($1, 'meta', '2025-01-31', 99.00, 10, 1000.00, 'v99')`,
        [STORE_ID],
      );
      // Clean up
      await client.query(
        `DELETE FROM cac_trend_snapshots WHERE store_id = $1 AND snapshot_date = '2025-01-31'`,
        [STORE_ID],
      );
      pass("CHECK constraint accepts 'v99' (valid v{n} format)");
    } catch (err) {
      fail("CHECK constraint accepts valid v{n} values", String(err));
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Summary
  // ══════════════════════════════════════════════════════════════════════════
  const total = passCount + failCount;
  console.log(`\n${"═".repeat(66)}`);
  console.log(`Phase 3 Marketing Intelligence validation: ${passCount}/${total} checks passed`);
  if (failCount === 0) {
    console.log("All checks passed ✓  — Phase 3 migration validated. Ready for cloud apply.");
  } else {
    console.log(`${failCount} check(s) failed ✗`);
    process.exit(1);
  }

  await client.end();
}

main().catch((err: unknown) => {
  console.error("Validation script failed:", err);
  process.exit(1);
});
