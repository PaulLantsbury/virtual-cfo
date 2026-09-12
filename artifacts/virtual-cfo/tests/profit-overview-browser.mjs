// Run only against a loopback preview using fake Supabase configuration.
// All external traffic is mocked or blocked; no real profit data or accounts.
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
async function fixture(
  {
    state = "current",
    plan = "pro",
    viewport = "desktop",
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
    (plan) => sessionStorage.setItem("userPlan", plan),
    plan,
  );
  const page = await context.newPage();
  let atProfitPage = false;
  const errors = [],
    unexpected = [];
  page.on("pageerror", (error) => errors.push(error.message));
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
      ]);
    if (
      request.method() === "GET" &&
      url.pathname === "/rest/v1/stores" &&
      url.searchParams.get("select") === "id,currency_code,timezone" &&
      url.searchParams.get("id") === `eq.${storeId}`
    )
      return json({
        id: storeId,
        currency_code: "GBP",
        timezone: "Europe/London",
      });
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      if (atProfitPage) { unexpected.push(`Profit page RPC ${url.pathname}`); return json({message:"No profit source integration expected"},503); }
      // Includes the dashboard read reached during sign-in, this sample-only page must not depend on those reads.
      const expectedReads = [
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
      if (state === "unavailable")
        return json({ message: "Synthetic unavailable" }, 503);
      if (url.pathname.endsWith("/order_count")) return json(state === "empty" ? 0 : 1);
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
    await page.getByRole("combobox", { name: "Active store" }).waitFor();
    await page.waitForLoadState("networkidle");
    atProfitPage = true;
    await page.goto(origin + "/profit-engine");
    await page.getByRole("heading", {name:"Profit Overview",exact:true}).waitFor();
    await run(page);
    assert.deepEqual(errors, [], "No browser page errors");
    assert.deepEqual(unexpected, [], "No unexpected API or write requests");
  } finally {
    await context.close();
    await browser.close();
  }
}
async function assertTruthful(page) {
  const status = page.getByRole("region", {name:"Profit reporting status"});
  assert.match(await status.innerText(), /Actual profit reporting: unavailable/);
  assert.match(await status.innerText(), /Missing inputs are not zero profit/);
  assert.doesNotMatch(await status.innerText(), /£|78,000|18,000/);
  const notice=page.getByRole("region", {name:"Sample profit model notice"});
  assert.match(await notice.innerText(), /fixed GBP examples, not your store's currency/);
  assert.match(await notice.innerText(), /annual revenue example with monthly overhead inputs/);
  assert.match(await notice.innerText(), /not operating profit, EBITDA or a forecast/);
  assert.match(await notice.innerText(), /may overlap and must not be added together/);
  assert.equal(await page.getByRole("button", {name:"CFO Monitoring Status"}).count(),0);
  assert.equal(await page.getByPlaceholder("Ask a question about this page…").count(),0);
  assert.equal(await page.getByText("CFO Profit Verdict",{exact:true}).count(),0);
  assert.equal(await page.getByText(/annualised|\(30 days\)/).count(),0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth+1), "Fits viewport");
}
for(const viewport of Object.keys(viewports)) {
  for(const state of ["current","unavailable","empty"]) test(`${viewport}: ${state} source cannot certify sample profit`,async()=>{
    await fixture({viewport,state},async page=>{
      await assertTruthful(page);
      await page.getByRole("heading",{name:"Supporting Sample Analysis",exact:true}).click();
      for(const name of ["Sample profit bridge","Sample sensitivity ranking","Sample movement","Sample staff cost efficiency"]) assert.equal(await page.getByRole("heading",{name,exact:true}).isVisible(),true);
      await page.getByRole("button",{name:"Data & benchmark assumptions"}).click();
      assert.equal(await page.getByText(/No actual profit or cost data is connected here/).isVisible(),true);
      await assertTruthful(page);
      const dir=process.env.NIGHT_SCOUT_PROFIT_SCREENSHOT_DIR;
      if(dir && state==="current") { await mkdir(dir,{recursive:true});await page.screenshot({path:join(dir,viewport+".png"),fullPage:true}); }
    });
  });
  test(`${viewport}: sample equations, negative scenario and reset preserved`,async()=>{
    await fixture({viewport},async page=>{
      const output=page.getByText("Sample Result",{exact:true}).locator("..");
      assert.match(await output.innerText(), /£78,000/);
      const slider=name=>page.locator(`[aria-label="${name}"]`).getByRole("slider");
      await slider("Revenue Change").focus();await slider("Revenue Change").press("End");
      assert.match(await output.innerText(), /£137,400/);
      await page.getByRole("button",{name:"Reset to base case"}).click();
      assert.match(await output.innerText(), /£78,000/);
      await slider("Revenue Change").focus();await slider("Revenue Change").press("Home");
      assert.match(await output.innerText(), /£38,400/);
      assert.equal(await page.getByText(/This sample result is below the base result/).count(),1);
      for(const name of ["Discount Rate Change","Returns Rate Change","Variable Cost Change","Overhead Change"]) {
        await slider(name).focus();await slider(name).press("End");
      }
      assert.match(await output.innerText(), /-£60,480/);
      assert.equal(await page.getByText(/This sample result is negative/).count(),1);
      await page.getByRole("button",{name:"Reset to base case"}).click();
      assert.match(await output.innerText(), /£78,000/);
      assert.equal(await page.getByRole("button",{name:"Reset to base case"}).count(),0);
      await assertTruthful(page);
    });
  });
  test(`${viewport}: free gates promise examples only`,async()=>{
    await fixture({viewport,plan:"free"},async page=>{
      await assertTruthful(page);
      assert.equal(await page.getByRole("slider").count(),0);
      assert.equal(await page.getByText(/Upgrading does not connect or validate actual profit reporting/).count(),1);
      assert.equal(await page.getByText(/Pro does not provide a validated forecast/).count(),1);
      await page.getByRole("heading",{name:"Supporting Sample Analysis",exact:true}).click();
      assert.equal(await page.getByText("Pro shows example rankings and sample opportunity values.",{exact:true}).isVisible(),true);
    });
  });
}
