/**
 * validatePhase3MarketingCloud.ts
 *
 * Cloud-side validation for the Phase 3 marketing intelligence migration.
 * Uses the Supabase REST API (PostgREST) with the service role key — no
 * direct database connection required. Native fetch only (Node 24+).
 *
 * Validates all 5 tables and all 4 RPCs against the live Supabase project.
 * Seed metrics are reconciled to the approved plan values from channel-metrics.ts.
 *
 * Prerequisites:
 *   VITE_SUPABASE_URL          — e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  — service role key (bypasses RLS on REST API)
 *
 * Run with:
 *   pnpm --filter @workspace/scripts run validate:phase3:cloud
 */

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

const HEADERS = {
  "apikey":        SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
  "Content-Type":  "application/json",
  "Accept":        "application/json",
};

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

async function restGet(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: HEADERS });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function rpc(fn: string, params: Record<string, unknown>): Promise<{ status: number; rows: unknown[] }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method:  "POST",
    headers: HEADERS,
    body:    JSON.stringify(params),
  });
  const body = await res.json().catch(() => []);
  return { status: res.status, rows: Array.isArray(body) ? body : [] };
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\nCloud validation target: ${SUPABASE_URL}`);
  console.log(`Store: ${STORE_ID}\n`);

  // ════════════════════════════════════════════════════════════════════════
  // 1. Table existence — service role bypasses RLS, HEAD returns count 0
  //    HTTP 200 = table exists, HTTP 404 = table/relation not found
  // ════════════════════════════════════════════════════════════════════════
  section("1. Table existence (REST HEAD probe — HTTP 200 = exists)");

  const tables = [
    "marketing_channel_daily_metrics",
    "marketing_channel_monthly_snapshots",
    "marketing_blended_monthly",
    "channel_opportunity_scores",
    "cac_trend_snapshots",
  ];

  for (const tbl of tables) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${tbl}?select=*&limit=0`,
      { method: "HEAD", headers: HEADERS },
    );
    const ct = res.headers.get("Content-Range") ?? "?";
    if (res.status === 200) pass(`${tbl}`, `HTTP 200, Content-Range: ${ct}`);
    else                    fail(`${tbl}`, `HTTP ${res.status} — migration not applied?`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // 2. Seed row counts via REST (service role bypasses RLS)
  // ════════════════════════════════════════════════════════════════════════
  section("2. Seed row counts (REST, service role)");

  const countChecks = [
    { tbl: "marketing_channel_daily_metrics",    expected: 8,  label: "8 rows (4 channels × 2 months)" },
    { tbl: "marketing_channel_monthly_snapshots", expected: 8,  label: "8 rows (4 channels × 2 months)" },
    { tbl: "marketing_blended_monthly",           expected: 2,  label: "2 rows (Mar + Apr)" },
    { tbl: "channel_opportunity_scores",          expected: 4,  label: "4 active opportunities" },
    { tbl: "cac_trend_snapshots",                 expected: 8,  label: "8 rows (4 channels × 2 months)" },
  ];

  for (const { tbl, expected, label } of countChecks) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${tbl}?store_id=eq.${STORE_ID}&select=*`,
      { headers: { ...HEADERS, "Prefer": "count=exact" } },
    );
    const rangeHeader = res.headers.get("Content-Range") ?? "";
    // Content-Range: 0-7/8 → total is after the slash
    const total = parseInt(rangeHeader.split("/")[1] ?? "-1", 10);
    if (total === expected) pass(`${tbl}`, `count = ${total}  (${label})`);
    else                    fail(`${tbl}`, `expected ${expected}, got ${total}`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // 3. channel_metrics_monthly() — April 2026
  //    Meta CAC £18.40, Google £11.20, Email £4.80, Organic £2.10
  //    CM%: 34.2% / 40.1% / 58.6% / 52.3%
  //    calculation_version = 'v1', data_freshness = 'estimated'
  // ════════════════════════════════════════════════════════════════════════
  section("3. channel_metrics_monthly()  —  April 2026");

  {
    const { status, rows } = await rpc("channel_metrics_monthly", {
      p_store_id:  STORE_ID,
      p_date_from: APR_FROM,
      p_date_to:   APR_TO,
    });

    if (status !== 200) {
      fail("channel_metrics_monthly RPC call", `HTTP ${status}`);
    } else {
      if (rows.length === 4) pass("returns 4 channel rows");
      else                   fail("returns 4 channel rows", `got ${rows.length}`);

      type ChannelRow = {
        channel: string; cac: number; contribution_margin_pct: number;
        opportunity_score: number; data_freshness: string; calculation_version: string;
      };

      const expected: Record<string, { cac: number; cmPct: number; score: number }> = {
        meta:            { cac: 18.40, cmPct: 0.3420, score: 78 },
        google_shopping: { cac: 11.20, cmPct: 0.4010, score: 42 },
        email:           { cac:  4.80, cmPct: 0.5860, score:  0 },
        organic:         { cac:  2.10, cmPct: 0.5230, score:  0 },
      };

      console.log(`\n  ${"Channel".padEnd(18)} ${"CAC".padStart(8)} ${"Expected".padStart(10)} ${"CM%".padStart(8)} ${"Score".padStart(6)} ${"Version".padStart(8)} ${"Freshness".padStart(10)}`);
      console.log(`  ${"─".repeat(74)}`);

      for (const row of rows as ChannelRow[]) {
        const exp = expected[row.channel];
        if (!exp) { fail(`unexpected channel: ${row.channel}`); continue; }

        console.log(
          `  ${row.channel.padEnd(18)} ${`£${Number(row.cac).toFixed(2)}`.padStart(8)}` +
          ` ${`£${exp.cac.toFixed(2)}`.padStart(10)} ${`${(Number(row.contribution_margin_pct)*100).toFixed(1)}%`.padStart(8)}` +
          ` ${String(row.opportunity_score).padStart(6)} ${row.calculation_version.padStart(8)} ${row.data_freshness.padStart(10)}`
        );

        if (near(Number(row.cac), exp.cac, 0.01))                       pass(`${row.channel}: CAC = £${Number(row.cac).toFixed(2)}`);
        else                                                              fail(`${row.channel}: CAC`, `expected £${exp.cac}, got £${row.cac}`);
        if (near(Number(row.contribution_margin_pct), exp.cmPct, 0.001)) pass(`${row.channel}: CM% = ${(Number(row.contribution_margin_pct)*100).toFixed(1)}%`);
        else                                                              fail(`${row.channel}: CM%`, `expected ${exp.cmPct}, got ${row.contribution_margin_pct}`);
        if (Number(row.opportunity_score) === exp.score)                  pass(`${row.channel}: score = ${row.opportunity_score}`);
        else                                                              fail(`${row.channel}: score`, `expected ${exp.score}, got ${row.opportunity_score}`);
        if (row.calculation_version === "v1")                             pass(`${row.channel}: calculation_version = 'v1'`);
        else                                                              fail(`${row.channel}: calculation_version`, `got '${row.calculation_version}'`);
        if (row.data_freshness === "estimated")                           pass(`${row.channel}: data_freshness = 'estimated'`);
        else                                                              fail(`${row.channel}: data_freshness`, `got '${row.data_freshness}'`);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 4. blended_marketing_performance() — April + March 2026
  //    April blended CAC £12.20 (BLENDED_CAC mock), 925 new customers
  //    March blended CAC £9.80 (BLENDED_CAC_PREV mock), 820 new customers
  // ════════════════════════════════════════════════════════════════════════
  section("4. blended_marketing_performance()  —  April + March 2026");

  for (const [label, from, to, expCac, expCust] of [
    ["April", APR_FROM, APR_TO, 12.20, 925],
    ["March", MAR_FROM, MAR_TO,  9.80, 820],
  ] as const) {
    const { status, rows } = await rpc("blended_marketing_performance", {
      p_store_id: STORE_ID, p_date_from: from, p_date_to: to,
    });

    if (status !== 200) {
      fail(`${label}: blended_marketing_performance`, `HTTP ${status}`);
      continue;
    }

    type BlendedRow = { blended_cac: number; total_new_customers: number; calculation_version: string; blended_contribution_margin_pct: number; total_attributed_revenue: number; };
    const row = (rows as BlendedRow[])[0];
    if (!row) { fail(`${label}: returns a row`, "no rows"); continue; }

    if (near(Number(row.blended_cac), expCac, 0.01)) pass(`${label}: blended_cac = £${Number(row.blended_cac).toFixed(2)}`);
    else                                              fail(`${label}: blended_cac`, `expected £${expCac}, got £${row.blended_cac}`);
    if (Number(row.total_new_customers) === expCust)  pass(`${label}: total_new_customers = ${row.total_new_customers}`);
    else                                              fail(`${label}: total_new_customers`, `expected ${expCust}, got ${row.total_new_customers}`);
    if (row.calculation_version === "v1")              pass(`${label}: calculation_version = 'v1'`);
    else                                              fail(`${label}: calculation_version`, `got '${row.calculation_version}'`);
  }

  // April extra fields
  {
    const { rows } = await rpc("blended_marketing_performance", {
      p_store_id: STORE_ID, p_date_from: APR_FROM, p_date_to: APR_TO,
    });
    type BlendedRow = { blended_cac: number; total_new_customers: number; calculation_version: string; blended_contribution_margin_pct: number; total_attributed_revenue: number; };
    const row = (rows as BlendedRow[])[0];
    if (row) {
      if (near(Number(row.blended_contribution_margin_pct), 0.4537, 0.001)) pass(`April: blended CM% = ${(Number(row.blended_contribution_margin_pct)*100).toFixed(2)}%`);
      else fail("April: blended CM%", `expected 45.37%, got ${(Number(row.blended_contribution_margin_pct)*100).toFixed(2)}%`);
      if (near(Number(row.total_attributed_revenue), 167639, 1)) pass(`April: total_attributed_revenue = £167,639`);
      else fail("April: total_attributed_revenue", `expected £167,639, got £${row.total_attributed_revenue}`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 5. channel_opportunities_active() — 4 opportunities, scores 78/65/55/42
  //    Total uplift £10,961–£24,920
  // ════════════════════════════════════════════════════════════════════════
  section("5. channel_opportunities_active()");

  {
    const { status, rows } = await rpc("channel_opportunities_active", {
      p_store_id: STORE_ID,
    });

    if (status !== 200) {
      fail("channel_opportunities_active", `HTTP ${status}`);
    } else {
      type OppRow = { channel: string; opportunity_type: string; score: number; estimated_uplift_low: number; estimated_uplift_high: number; status: string; calculation_version: string; };
      const typed = rows as OppRow[];

      if (typed.length === 4) pass("returns 4 active opportunities");
      else                    fail("returns 4 active opportunities", `got ${typed.length}`);

      const scores = typed.map((r) => Number(r.score));
      const expScores = [78, 65, 55, 42];
      if (expScores.every((s, i) => s === scores[i])) pass(`scores = [${scores.join(", ")}] ordered DESC`);
      else                                              fail(`scores`, `expected [78,65,55,42], got [${scores.join(",")}]`);

      const totalLow  = typed.reduce((s, r) => s + Number(r.estimated_uplift_low), 0);
      const totalHigh = typed.reduce((s, r) => s + Number(r.estimated_uplift_high), 0);

      if (near(totalLow, 10961, 1))  pass(`total_uplift_low  = £${totalLow.toLocaleString()}`);
      else                            fail(`total_uplift_low`,  `expected £10,961, got £${totalLow}`);
      if (near(totalHigh, 24920, 1)) pass(`total_uplift_high = £${totalHigh.toLocaleString()}`);
      else                            fail(`total_uplift_high`, `expected £24,920, got £${totalHigh}`);

      if (typed.every((r) => r.calculation_version === "v1")) pass("all: calculation_version = 'v1'");
      else                                                    fail("calculation_version", "some rows != 'v1'");
      if (typed.every((r) => r.status === "active"))          pass("all: status = 'active'");
      else                                                    fail("status", "some rows != 'active'");

      console.log(`\n  ${"Channel".padEnd(16)} ${"Type".padEnd(22)} ${"Score".padStart(5)} ${"Low".padStart(9)} ${"High".padStart(9)}`);
      console.log(`  ${"─".repeat(66)}`);
      for (const r of typed) {
        console.log(
          `  ${r.channel.padEnd(16)} ${r.opportunity_type.padEnd(22)} ` +
          `${String(r.score).padStart(5)} ${`£${Number(r.estimated_uplift_low).toLocaleString()}`.padStart(9)} ${`£${Number(r.estimated_uplift_high).toLocaleString()}`.padStart(9)}`
        );
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 6. cac_trend_by_channel() — 8 rows, April MoM changes, March NULL
  // ════════════════════════════════════════════════════════════════════════
  section("6. cac_trend_by_channel()  —  trailing 6 months up to 2026-04-30");

  {
    const { status, rows } = await rpc("cac_trend_by_channel", {
      p_store_id:    STORE_ID,
      p_as_of_date:  "2026-04-30",
      p_months_back: 6,
    });

    if (status !== 200) {
      fail("cac_trend_by_channel", `HTTP ${status}`);
    } else {
      type TrendRow = { channel: string; snapshot_date: string; cac: number; mom_change_pct: number | null; calculation_version: string; };
      const typed = rows as TrendRow[];

      if (typed.length === 8) pass("returns 8 CAC trend rows");
      else                    fail("returns 8 CAC trend rows", `got ${typed.length}`);

      const aprilRows = typed.filter((r) => r.snapshot_date.startsWith("2026-04"));
      const expCac: Record<string, number> = { meta: 18.40, google_shopping: 11.20, email: 4.80, organic: 2.10 };
      const expMoM: Record<string, number> = { meta: 0.14, google_shopping: 0.06, email: -0.02, organic: 0.00 };

      for (const r of aprilRows) {
        const ec = expCac[r.channel];
        const em = expMoM[r.channel] ?? 0;
        if (ec === undefined) continue;
        if (near(Number(r.cac), ec, 0.01))                                       pass(`${r.channel} April: CAC = £${Number(r.cac).toFixed(2)}`);
        else                                                                      fail(`${r.channel} April: CAC`, `expected £${ec}, got £${r.cac}`);
        if (r.mom_change_pct !== null && near(Number(r.mom_change_pct), em, 0.001)) pass(`${r.channel} April: MoM = ${(Number(r.mom_change_pct)*100).toFixed(1)}%`);
        else if (r.mom_change_pct === null && em === 0)                            pass(`${r.channel} April: MoM = null/0 (stable)`);
        else                                                                      fail(`${r.channel} April: MoM`, `expected ${(em*100).toFixed(1)}%, got ${r.mom_change_pct}`);
        if (r.calculation_version === "v1")                                        pass(`${r.channel} April: calculation_version = 'v1'`);
        else                                                                      fail(`${r.channel} April: calculation_version`, `got '${r.calculation_version}'`);
      }

      const marchOk = typed.filter((r) => r.snapshot_date.startsWith("2026-03")).every((r) => r.mom_change_pct === null);
      if (marchOk) pass("March rows: mom_change_pct = NULL (first seeded month)");
      else         fail("March rows: mom_change_pct should be NULL");
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 7. RLS / security posture — service role can read, anon cannot
  //    (anon key test proves deny-by-default is working on cloud)
  // ════════════════════════════════════════════════════════════════════════
  section("7. RLS / security posture — anon key must be denied on all tables");

  const ANON_KEY = process.env["VITE_SUPABASE_ANON_KEY"] ?? "";

  if (!ANON_KEY) {
    console.log("  · VITE_SUPABASE_ANON_KEY not set — skipping anon test");
  } else {
    const anonHeaders = {
      "apikey":        ANON_KEY,
      "Authorization": `Bearer ${ANON_KEY}`,
    };
    for (const tbl of tables) {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${tbl}?select=*&limit=1`,
        { headers: anonHeaders },
      );
      // Expect 401 (no policy) or empty array with 200 (but count must be 0 for RLS tables)
      // In deny-by-default: anon gets HTTP 200 with empty rows (RLS filters all) OR 401
      const body = await res.json().catch(() => []);
      const rowCount = Array.isArray(body) ? body.length : -1;
      if (rowCount === 0 || res.status === 401) pass(`anon denied on ${tbl}`, `HTTP ${res.status}, rows = ${rowCount}`);
      else                                       fail(`anon denied on ${tbl}`, `HTTP ${res.status}, rows = ${rowCount} (data leaked!)`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Summary
  // ════════════════════════════════════════════════════════════════════════
  const total = passCount + failCount;
  console.log(`\n${"═".repeat(66)}`);
  console.log(`Phase 3 cloud validation: ${passCount}/${total} checks passed`);
  if (failCount === 0) {
    console.log("All cloud checks passed ✓  — Supabase cloud matches local schema + seed.");
  } else {
    console.log(`${failCount} check(s) failed ✗`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("Cloud validation failed:", err);
  process.exit(1);
});
