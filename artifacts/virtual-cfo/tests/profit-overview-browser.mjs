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
 assert.match(await status.innerText(), /sample|synthetic/i);
 assert.equal(await page.getByRole("button", {name:"CFO Monitoring Status"}).count(),0);
 assert.equal(await page.getByPlaceholder("Ask a question about this page…").count(),0);
 assert.equal(await page.getByText("CFO Profit Verdict",{exact:true}).count(),0);
 assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth+1), "Fits viewport");
}
const slider = (page,name) => page.locator(`[aria-label="${name}"]`).getByRole("slider");
const baseline = {Sales:"£95,000",Contribution:"£40,900","Operating profit":"£21,900"};
async function assertBaseline(page) {
 const region = page.getByRole("region",{name:"Sample profit overview",exact:true});
 for (const [metric,amount] of Object.entries({...baseline,EBITDA:"£22,900"})) {
  assert.ok((await region.getByRole("group",{name:metric,exact:true}).innerText()).includes(amount), `${metric} baseline is ${amount}`);
 }
}
async function assertScenario(page, values = baseline, changes = {}) {
 const region = page.getByRole("region",{name:"Profit scenario comparison",exact:true});
 for (const [metric,amount] of Object.entries(values)) {
  const text = (await region.getByRole("group",{name:metric,exact:true}).innerText()).replace(/−/g,"-");
  assert.ok(text.includes(amount), `${metric} scenario is ${amount}`);
  assert.ok(text.includes(baseline[metric]), `${metric} comparison retains baseline`);
  for (const token of changes[metric] || ["£0","0%"]) assert.ok(text.includes(token), `${metric} change includes ${token}`);
 }
}
async function bridgeAmount(page, name, amount) {
 const table=page.getByRole("table",{name:"Sample profit bridge"});
 const row=table.getByRole("row").filter({has:page.getByRole("rowheader").filter({has:page.getByText(name,{exact:true})})});
 assert.equal((await row.getByRole("cell").innerText()).replace(/−/g,"-"),amount, `${name} bridge amount and sign agree`);
}
for (const viewport of Object.keys(viewports)) {
 for (const state of ["current","empty","unavailable"]) test(`${viewport}: ${state} source cannot certify coherent sample profit`,async()=>fixture({viewport,state},async page=>{
  await assertTruthful(page);
  await assertBaseline(page);
  await assertScenario(page);
  const dir=process.env.NIGHT_SCOUT_PROFIT_SCREENSHOT_DIR;
  if(dir && state==="current") { await mkdir(dir,{recursive:true});await page.screenshot({path:join(dir,viewport+".png"),fullPage:true}); }
 }));
 test(`${viewport}: sample bridge reconciles costs, operating profit and EBITDA`,async()=>fixture({viewport},async page=>{
  await page.getByRole("heading",{name:"Detailed sample profit bridge",exact:true}).waitFor();
  for(const [name,amount] of [
   ["Sales","£95,000"], ["Net cost of goods sold","-£38,000"],
   ["Outbound shipping","-£4,000"], ["Fulfilment","-£3,000"], ["Payment processing","-£2,000"], ["Marketing expenditure","-£10,000"],
   ["Contribution","£40,900"], ["Depreciation and amortisation","-£1,000"], ["Add back depreciation and amortisation","£1,000"],
   ["Operating profit","£21,900"], ["EBITDA","£22,900"],
  ]) await bridgeAmount(page,name,amount);
 }));
 test(`${viewport}: more orders update one calculation and reset clears every control`,async()=>fixture({viewport},async page=>{
  await slider(page,"Order Volume Change").focus();await slider(page,"Order Volume Change").press("End");
  await assertScenario(page,{Sales:"£125,000",Contribution:"£56,200","Operating profit":"£37,200"},{
   Sales:["+£30,000","+31.6%"],Contribution:["+£15,300","+37.4%"],"Operating profit":["+£15,300","+69.9%"],
  });
  await assertBaseline(page);
  await bridgeAmount(page,"Contribution","£56,200");
  await bridgeAmount(page,"Operating profit","£37,200");
  await bridgeAmount(page,"EBITDA","£38,200");
  await slider(page,"Average Order Value Change").focus();await slider(page,"Average Order Value Change").press("End");
  await slider(page,"Marketing Spend Change").focus();await slider(page,"Marketing Spend Change").press("Home");
  await slider(page,"Other Overhead Cost Change").scrollIntoViewIfNeeded();
  await slider(page,"Other Overhead Cost Change").focus();await slider(page,"Other Overhead Cost Change").press("End");
  const comparison=page.getByRole("region",{name:"Profit scenario comparison",exact:true});
  for(const metric of Object.keys(baseline)) {
   const bounds=await comparison.getByRole("group",{name:metric,exact:true}).boundingBox();
   assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= viewports[viewport].height, `${metric} remains visible while using the last overhead control`);
  }
  await page.getByRole("button",{name:"Reset",exact:true}).click();
  await assertScenario(page);
  for(const control of await page.getByRole("slider").all()) assert.equal(await control.getAttribute("aria-valuenow"),"0");
 }));
 test(`${viewport}: AOV reduction shows losses relative to baseline`,async()=>fixture({viewport},async page=>{
  await slider(page,"Average Order Value Change").focus();await slider(page,"Average Order Value Change").press("Home");
  await assertScenario(page,{Sales:"£85,000",Contribution:"£30,900","Operating profit":"£11,900"},{
   Sales:["-£10,000","-10.5%"],Contribution:["-£10,000","-24.4%"],"Operating profit":["-£10,000","-45.7%"],
  });
 }));
 test(`${viewport}: marketing cost changes do not invent sales`,async()=>fixture({viewport},async page=>{
  await slider(page,"Marketing Spend Change").focus();await slider(page,"Marketing Spend Change").press("Home");
  await assertScenario(page,{Sales:"£95,000",Contribution:"£43,900","Operating profit":"£24,900"},{
   Sales:["£0","0%"],Contribution:["+£3,000","+7.3%"],"Operating profit":["+£3,000","+13.7%"],
  });
  await assertBaseline(page);
 }));
 test(`${viewport}: adverse assumptions display an operating loss without changing baseline`,async()=>fixture({viewport},async page=>{
  for(const [name,key] of [["Order Volume Change","Home"],["Average Order Value Change","Home"],["Marketing Spend Change","End"],["Other Overhead Cost Change","End"]]) {
   await slider(page,name).focus();await slider(page,name).press(key);
  }
  await assertScenario(page,{Sales:"£67,000",Contribution:"£19,700","Operating profit":"-£100"},{
   Sales:["-£28,000","-29.5%"],Contribution:["-£21,200","-51.8%"],"Operating profit":["-£22,000","-100.5%"],
  });
  await assertBaseline(page);
  await bridgeAmount(page,"Operating profit","-£100");
  await bridgeAmount(page,"EBITDA","£900");
 }));
 test(`${viewport}: free plan has status but no numerical simulator`,async()=>fixture({viewport,plan:"free"},async page=>{
  await assertTruthful(page);
  assert.equal(await page.getByRole("slider").count(),0);
  assert.equal(await page.getByRole("region",{name:"Profit scenario comparison",exact:true}).count(),0);
  const bridge=page.getByRole("table",{name:"Sample profit bridge"});
  for(const cell of await bridge.getByRole("cell").all()) assert.equal(await cell.innerText(),"Locked");
 }));
 test(`${viewport}: Scenario Planner opens with the same baseline and no unsaved carryover`,async()=>fixture({viewport},async page=>{
  await assertBaseline(page);
  await slider(page,"Order Volume Change").focus();await slider(page,"Order Volume Change").press("End");
  await page.getByRole("link",{name:"Open Scenario Planner",exact:true}).click();
  await page.getByRole("heading",{name:"Scenario Planner",exact:true}).waitFor();
  const summary=page.getByRole("region",{name:"Scenario summary",exact:true});
  for(const metric of ["Sales","Contribution","Operating profit"]) {
   const text=await summary.getByRole("group",{name:metric,exact:true}).innerText();
   assert.ok(text.includes(baseline[metric]), `${metric} starts at the shared baseline`);
   assert.match(text,/£0.*0%/s,"Fresh scenario does not carry unsaved Profit Overview changes");
  }
  assert.equal(await slider(page,"Order Volume Change").getAttribute("aria-valuenow"),"0");
  await page.getByRole("heading",{name:"Supporting Sample Analysis",exact:true}).click();
  const table=page.getByRole("table");
  for(const [name,amount] of [["Contribution","£40,900"],["EBITDA","£22,900"]]) {
   const row=table.getByRole("row").filter({has:page.getByRole("rowheader",{name,exact:true})});
   assert.ok((await row.innerText()).includes(amount));
  }
 }));
}
