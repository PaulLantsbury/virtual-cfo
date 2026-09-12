// Run only against a loopback preview using fake Supabase configuration.
// All external traffic is mocked or blocked; no real marketing data or accounts.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
const { chromium } = await import(
  process.env.NIGHT_SCOUT_PLAYWRIGHT_MODULE || "playwright"
);
const origin = process.env.NIGHT_SCOUT_TEST_URL || "http://127.0.0.1:5187";
if (new URL(origin).hostname !== "127.0.0.1")
  throw new Error("Loopback preview required");
const storeId = "50000000-0000-0000-0000-000000000001";
const user = {
  id: "60000000-0000-0000-0000-000000000001",
  email: "test@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
  identities: [],
  created_at: "2026-09-08T00:00:00Z",
};
const token = [
  { alg: "HS256", typ: "JWT" },
  {
    sub: user.id,
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
  "signature",
]
  .map((x) =>
    Buffer.from(typeof x === "string" ? x : JSON.stringify(x)).toString(
      "base64url",
    ),
  )
  .join(".");
const session = {
  access_token: token,
  refresh_token: "test-refresh",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user,
};
const viewports = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 },
};
const statusCopy = {
  current: "Unverified source figures: latest completed period",
  historical: "Unverified source figures: historical period",
  unavailable: "Source figures unavailable",
  empty: "No source orders found in the reporting search",
  partial: "Source figures unavailable",
  missing: "Source figures unavailable",
  invalid: "Source figures unavailable",
  loading: "Source figures loading",
};
async function fixture(
  {
    state = "current",
    plan = "pro",
    viewport = "desktop",
    revenue = 0,
    aov = 0,
    marketing = "zero",
    delayedStore = false,
  },
  run,
) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.NIGHT_SCOUT_CHROME_PATH,
  });
  const context = await browser.newContext({
    viewport: viewports[viewport],
    serviceWorkers: "block",
  });
  await context.addInitScript(
    ({ plan, origin }) => {
      if (location.origin === origin) sessionStorage.setItem("userPlan", plan);
    },
    { plan, origin },
  );
  const page = await context.newPage();
  let releaseOld;
  const oldResponse = new Promise(resolve => { releaseOld = resolve; });
  let enteredGrowth = false;
  const errors = [],
    unexpected = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const currentMonth = new Date();
  currentMonth.setMonth(currentMonth.getMonth() - 1, 1);
  const latestFrom = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-01`;
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const json = (data, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (url.origin === origin) {
      if (url.pathname.startsWith("/api/")) {
        unexpected.push(url.pathname);
        return json({ error: "Unexpected API request" }, 503);
      }
      return route.continue();
    }
    if (url.hostname !== "night-scout-test.invalid") return route.abort();
    if (url.pathname === "/auth/v1/token") return json(session);
    if (url.pathname === "/auth/v1/user") return json(user);
    if (url.pathname === "/rest/v1/store_memberships")
      return json([
        { store_id: storeId, stores: { id: storeId, name: "Synthetic Store" } },
        ...(delayedStore ? [{store_id: storeId.replace(/1$/, "2"), stores: {id: storeId.replace(/1$/, "2"), name: "Second Synthetic Store"}}] : []),
      ]);
    if (
      request.method() === "GET" &&
      url.pathname === "/rest/v1/stores" &&
      url.searchParams.get("select") === "id,currency_code,timezone" &&
      [ `eq.${storeId}`, `eq.${storeId.replace(/1$/, "2")}` ].includes(url.searchParams.get("id"))
    )
      return json({
        id: storeId,
        currency_code: "GBP",
        timezone: "Europe/London",
      });
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      // Exact allowlist for the dashboard reached during sign-in only.
      // Opportunity Finder and Scenario Planner must issue no data RPCs.
      const expectedReads = [
        "channel_metrics_monthly",
        "blended_marketing_performance",
        "order_count",
        "gross_revenue",
        "net_sales",
        "average_order_value",
        "repeat_purchase_rate",
        "discount_dependency",
        "refund_rate",
        "contribution_margin_pct",
        "recoverable_contribution_range",
        "verified_sales_source",
      ];
      if (
        request.method() !== "POST" ||
        !expectedReads.includes(url.pathname.split("/").at(-1))
      ) {
        unexpected.push(`${request.method()} ${url.pathname}`);
        return json({ message: "Unexpected RPC" }, 400);
      }
      const rpc = url.pathname.split("/").at(-1);
      if (enteredGrowth) { unexpected.push(rpc); return json({}, 503); }
      if (enteredGrowth && delayedStore && request.postDataJSON().p_store_id === storeId) await oldResponse;
      if (["channel_metrics_monthly", "blended_marketing_performance"].includes(rpc)) {
        if (marketing === "error" || (marketing === "partial" && rpc === "channel_metrics_monthly")) return json({message: "Synthetic failure"}, 503);
        if (marketing === "empty") return json([]);
        const oldStore = request.postDataJSON().p_store_id === storeId;
        if (delayedStore && oldStore) await oldResponse;
        const value = delayedStore ? (oldStore ? 999 : 35) : marketing === "invalid" ? "" : marketing === "missing" ? null : marketing === "nonzero" ? 27.5 : 0;
        return json(rpc === "channel_metrics_monthly" ? [{channel: "test-channel", cac: value, roas: value, cac_payback_orders: value}] : [{blended_cac: value, blended_roas: value}]);
      }
      if (state === "loading") return;
      if (state === "partial" && url.pathname.endsWith("/average_order_value"))
        return json({ message: "Synthetic AOV unavailable" }, 503);
      if (state === "missing" && url.pathname.endsWith("/gross_revenue"))
        return json(null);
      if (state === "invalid" && url.pathname.endsWith("/repeat_purchase_rate"))
        return json("not a number");
      if (["repeat_purchase_rate", "discount_dependency"].includes(rpc) && state !== "unavailable") return json(delayedStore ? request.postDataJSON().p_store_id === storeId ? 0.99 : 0.35 : revenue);
      if (url.pathname.endsWith("/gross_revenue") && state !== "unavailable")
        return json(revenue);
      if (
        url.pathname.endsWith("/average_order_value") &&
        state !== "unavailable"
      )
        return json(aov);
      if (state === "unavailable")
        return json({ message: "Synthetic unavailable" }, 503);
      if (url.pathname.endsWith("/order_count"))
        return json(
          state === "empty" ||
            (state === "historical" &&
              request.postDataJSON().p_date_from === latestFrom)
            ? 0
            : 1,
        );
      if (url.pathname.endsWith("/recoverable_contribution_range"))
        return json([{ recoverable_low: 0, recoverable_high: 0 }]);
      return json(0);
    }
    unexpected.push(url.pathname);
    return json({ message: "Unexpected request" }, 400);
  });
  try {
    await page.goto(origin + "/login");
    await page.getByLabel("Email address").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill("test-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    if (delayedStore) await page.getByRole("button", {name:"Synthetic Store", exact:true}).click();
    await page.getByRole("combobox", { name: "Active store" }).waitFor();
    // Complete dashboard bootstrap before applying the zero-data-call assertion.
    // Navigating through a blank document also unmounts its asynchronous effects;
    // no dashboard requests or unexpected-call records are discarded.
    await page.waitForLoadState("networkidle");
    await page.goto("about:blank");
    enteredGrowth = true;
    await page.goto(origin + "/profit-opportunities");
    if (delayedStore) await page.getByRole("button", {name:"Synthetic Store", exact:true}).click();
    await page.getByRole("heading", {name: "Opportunity Finder", exact: true}).waitFor();
    await run(page, releaseOld);
    const directory = process.env.NIGHT_SCOUT_OPPORTUNITIES_SCREENSHOT_DIR;
    if (directory && state === "current" && marketing === "zero" && !delayedStore && plan === "pro") {
      await mkdir(directory, {recursive: true});
      await page.screenshot({path: join(directory, viewport + ".png"), fullPage: true});
    }
    assert.deepEqual(errors, [], "No browser page errors");
    assert.deepEqual(unexpected, [], "No unexpected API or write requests");
  } finally {
    releaseOld();
    await context.close();
    await browser.close();
  }
}

async function truthful(page) {
  const source = page.getByRole("region", {name:"Opportunity reporting status"});
  assert.match(await source.innerText(), /Actual opportunity analysis: unavailable/);
  assert.doesNotMatch(await source.innerText(), /£|GBP|0\.00/);
  const notice = await page.getByRole("region", {name:"Sample opportunity model notice"}).innerText();
  assert.match(notice, /fixed examples/);
  assert.match(notice, /without resolving overlapping actions/);
  assert.match(notice, /Upgrading does not activate real analysis/);
  assert.equal(await page.getByRole("button", {name:"CFO Monitoring Status"}).count(),0);
  assert.equal(await page.getByPlaceholder("Ask a question about this page…").count(),0);
  assert.doesNotMatch(await page.locator("main").innerText(), /continuously scans|All identified value|current connected data quality|Live contribution/);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Fits viewport");
}
for (const viewport of Object.keys(viewports)) {
  for (const state of ["current", "unavailable", "empty"]) test(`${viewport}: ${state} cannot certify sample opportunities`, async () => {
    await fixture({viewport,state}, async page => {
      await truthful(page);
      assert.equal(await page.getByText("£31k–£49k", {exact:true}).count(),1);
      assert.equal(await page.getByText("£40k–£60k cash", {exact:true}).count(),1);
      assert.equal(await page.getByRole("heading",{name:"Sample Actions",exact:true}).count(),1);
      assert.equal(await page.getByText("Example evidence",{exact:true}).count(),1);
      const meta = page.getByRole("button").filter({hasText:"Reallocate inefficient Meta spend"});
      await meta.click();
      const preset = page.getByRole("link", {name:"Open Scenario Planner",exact:true});
      assert.equal(await preset.getAttribute("href"),"/scenario-lab?preset=reallocate-meta-spend");
      assert.equal(await page.getByText("Sample amount",{exact:true}).count(),1);
    });
  });
  test(`${viewport}: free gate only offers sample detail`, async () => {
    await fixture({viewport,plan:"free"}, async page => {
      await truthful(page);
      assert.equal(await page.getByText("£31k–£49k",{exact:true}).count(),0);
      assert.equal(await page.getByText("Example evidence",{exact:true}).count(),0);
      assert.equal(await page.getByRole("link",{name:"Open Scenario Planner",exact:true}).count(),0);
      assert.match(await page.locator("main").innerText(), /Pro preview/);
    });
  });
}
test("sample action navigates to its existing Scenario Planner preset", async () => {
  await fixture({}, async page => {
    await page.getByRole("button").filter({hasText:"Reallocate inefficient Meta spend"}).click();
    await page.getByRole("link", {name:"Open Scenario Planner",exact:true}).click();
    await page.getByRole("heading",{name:"Scenario Planner",exact:true}).waitFor();
    await page.getByText("Sample preset loaded from Opportunity Finder:", {exact:false}).waitFor();
    assert.equal(await page.locator('[aria-label="Meta Spend Change"]').getByRole("slider").getAttribute("aria-valuenow"), "-15");
    assert.equal(await page.locator('[aria-label="Email / Organic Mix Uplift"]').getByRole("slider").getAttribute("aria-valuenow"), "12");
    assert.equal(await page.locator('[aria-label="Blended CAC Change"]').getByRole("slider").getAttribute("aria-valuenow"), "-10");
  });
});
