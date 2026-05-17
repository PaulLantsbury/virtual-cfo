#!/usr/bin/env node

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? "";

const STORE_ID = "10000000-0000-0000-0000-000000000001";
const APRIL_FROM = "2026-04-01";
const APRIL_TO = "2026-04-30";

const phase1Rpcs = [
  "gross_revenue",
  "net_sales",
  "average_order_value",
  "repeat_purchase_rate",
  "discount_dependency",
  "refund_rate",
  "contribution_margin_pct",
];

function safeUrlLabel(url) {
  try {
    return new URL(url).origin;
  } catch {
    return "(invalid URL)";
  }
}

function printJson(label, value) {
  console.log(`${label}: ${JSON.stringify(value, null, 2)}`);
}

async function rpc(fnName, params) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(params),
  });

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return {
    status: res.status,
    ok: res.ok,
    data: res.ok ? body : null,
    error: res.ok ? null : body,
  };
}

async function rest(path, extraHeaders = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      Accept: "application/json",
      ...extraHeaders,
    },
  });

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return {
    status: res.status,
    ok: res.ok,
    contentRange: res.headers.get("content-range"),
    data: res.ok ? body : null,
    error: res.ok ? null : body,
  };
}

function classify({ rpcResults, ordersProbe }) {
  const gross = rpcResults.find((r) => r.fn === "gross_revenue");
  const anyRpcError = rpcResults.some((r) => !r.result.ok);
  const grossNumber = Number(gross?.result.data ?? 0);
  const ordersRows = Array.isArray(ordersProbe.data) ? ordersProbe.data.length : null;

  console.log("\n=== Initial read ===");

  if (anyRpcError) {
    console.log("- One or more RPCs returned errors. This points to an RPC/schema/security-definer issue.");
  }

  if (gross?.result.ok && grossNumber > 0) {
    console.log("- gross_revenue returned a non-zero April value. April data is reachable via RPC.");
  }

  if (gross?.result.ok && grossNumber === 0) {
    console.log("- gross_revenue returned 0 for April. Either April data is missing/unreachable, the store_id is wrong, or the RPC is reading an empty project.");
  }

  if (ordersProbe.ok && ordersRows !== null && ordersRows > 0) {
    console.log("- Direct anon orders probe returned rows. If RPCs are zero/error, investigate RPC definitions/security.");
  }

  if (ordersProbe.ok && ordersRows === 0) {
    console.log("- Direct anon orders probe returned 0 rows. This may be missing April data, wrong project/store_id, or RLS filtering anon reads.");
  }

  if (!ordersProbe.ok) {
    console.log("- Direct anon orders probe errored. This likely means RLS/table permissions block direct fallback access.");
  }
}

async function main() {
  console.log("=== Dashboard Supabase diagnostic ===");
  console.log(`VITE_SUPABASE_URL present: ${SUPABASE_URL ? "yes" : "no"}`);
  console.log(`VITE_SUPABASE_URL origin: ${SUPABASE_URL ? safeUrlLabel(SUPABASE_URL) : "(missing)"}`);
  console.log(`VITE_SUPABASE_ANON_KEY present: ${ANON_KEY ? "yes" : "no"}`);
  console.log(`store_id: ${STORE_ID}`);
  console.log(`period: ${APRIL_FROM} to ${APRIL_TO}`);

  if (!SUPABASE_URL || !ANON_KEY) {
    console.log("\nMissing Supabase env. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Replit Secrets.");
    process.exitCode = 1;
    return;
  }

  console.log("\n=== Supabase reachability ===");
  const health = await rest("orders?select=id&limit=0");
  printJson("orders HEAD-style probe", {
    status: health.status,
    ok: health.ok,
    contentRange: health.contentRange,
    error: health.error,
  });

  console.log("\n=== Phase 1 RPCs via anon key ===");
  const rpcResults = [];
  for (const fn of phase1Rpcs) {
    const result = await rpc(fn, {
      p_store_id: STORE_ID,
      p_date_from: APRIL_FROM,
      p_date_to: APRIL_TO,
    });
    rpcResults.push({ fn, result });
    printJson(fn, {
      status: result.status,
      ok: result.ok,
      data: result.data,
      error: result.error,
    });
  }

  console.log("\n=== Recoverable range RPC via anon key ===");
  const recoverable = await rpc("recoverable_contribution_range", {
    p_store_id: STORE_ID,
  });
  printJson("recoverable_contribution_range", {
    status: recoverable.status,
    ok: recoverable.ok,
    data: recoverable.data,
    error: recoverable.error,
  });

  console.log("\n=== Direct orders fallback probe via anon key ===");
  const ordersProbe = await rest(
    [
      "orders?select=id,created_at,gross_sales,total_sales",
      `store_id=eq.${STORE_ID}`,
      `created_at=gte.${APRIL_FROM}`,
      "created_at=lt.2026-05-01",
      "limit=5",
    ].join("&"),
    { Prefer: "count=exact" },
  );
  printJson("orders April probe", {
    status: ordersProbe.status,
    ok: ordersProbe.ok,
    contentRange: ordersProbe.contentRange,
    rowsReturned: Array.isArray(ordersProbe.data) ? ordersProbe.data.length : null,
    sampleRows: ordersProbe.data,
    error: ordersProbe.error,
  });

  classify({ rpcResults, ordersProbe });
}

main().catch((error) => {
  console.error("Diagnostic failed before completion:", error);
  process.exitCode = 1;
});
