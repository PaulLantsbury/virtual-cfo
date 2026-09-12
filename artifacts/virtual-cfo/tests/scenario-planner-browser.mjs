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
    preset = "",
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
  let atScenarioPage = false;
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
      if (atScenarioPage) { unexpected.push(`Scenario page RPC ${url.pathname}`); return json({message:"No scenario source integration expected"},503); }
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
    atScenarioPage = true;
    await page.goto(origin + "/scenario-lab" + (preset ? "?preset="+preset : ""));
    await page.getByRole("heading", {name:"Scenario Planner",exact:true}).waitFor();
    await run(page);
    assert.deepEqual(errors, [], "No browser page errors");
    assert.deepEqual(unexpected, [], "No unexpected API or write requests");
  } finally {
    await context.close();
    await browser.close();
  }
}
async function truth(page) {
 const notice=page.getByRole("region",{name:"Scenario planning status"});
 assert.match(await notice.innerText(), /Actual scenario planning: unavailable/);
 assert.match(await notice.innerText(), /fixed GBP examples/);
 assert.match(await notice.innerText(), /Payment fee, Meta spend and Google spend sliders currently have no effect/);
 assert.equal(await page.getByRole("button",{name:"CFO Monitoring Status"}).count(),0);
 assert.equal(await page.getByPlaceholder("Ask a question about this page…").count(),0);
 assert.equal(await page.getByText("Why Night Scout Chose This",{exact:true}).count(),0);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"Fits viewport");
}
const slider=(page,label)=>page.locator(`[aria-label="${label}"]`).getByRole("slider");
for(const viewport of Object.keys(viewports)) {
 test(`${viewport}: sample status, disabled persistence and supporting model`,async()=>fixture({viewport},async page=>{
  await truth(page);
  for(const b of await page.getByRole("button",{name:"Saving unavailable",exact:true}).all()) assert.equal(await b.isDisabled(),true);
  assert.equal(await page.getByRole("button",{name:"Comparison unavailable"}).isDisabled(),true);
  await page.getByRole("heading",{name:"Supporting Sample Analysis"}).click();
  const table=page.getByRole("table");
  assert.match(await table.innerText(),/£198k/);
  assert.match(await table.innerText(),/£232k/);
  await page.getByRole("button",{name:"Reset",exact:true}).click();
  assert.match(await table.innerText(), /Contribution\s+£198k\s+£198k/);
  await slider(page,"Revenue Change").focus();await slider(page,"Revenue Change").press("End");
  assert.match(await table.innerText(),/£246k/);
  await page.getByRole("button",{name:"Reload preset",exact:true}).click();
  assert.match(await table.innerText(),/£232k/);
  for(const tab of ["Margin","Marketing","Cash","Overheads"]) await page.getByRole("button",{name:tab,exact:true}).click();
  await truth(page);
  const dir=process.env.NIGHT_SCOUT_SCENARIO_SCREENSHOT_DIR;
  if(dir){await mkdir(dir,{recursive:true});await page.screenshot({path:join(dir,viewport+".png"),fullPage:true});}
 }));
 test(`${viewport}: free gate keeps sample status and blocks plan loading`,async()=>fixture({viewport,plan:"free"},async page=>{
  await truth(page);
  assert.equal(await page.getByRole("slider").count(),0);
  const buttons=await page.getByRole("button",{name:"Sample preset locked"}).all();assert.equal(buttons.length,3);
  for(const b of buttons) assert.equal(await b.isDisabled(),true);
  assert.match(await page.locator("main").innerText(),/upgrading does not activate analysis/);
 }));
 for(const [preset,label,values] of [
  ["reduce-discount-depth","Reduce average discount depth",{"Discount Rate Change":-4,"Returns Rate Change":-1}],
  ["reallocate-meta-spend","Reallocate inefficient Meta spend",{"Meta Spend Change":-15,"Email / Organic Mix Uplift":12,"Blended CAC Change":-10}],
  ["improve-fullprice-ratio","Improve full-price order ratio",{"Discount Rate Change":-3}]
 ]) test(`${viewport}: ${preset} sample handoff and reload`,async()=>fixture({viewport,preset},async page=>{
  assert.match(await page.locator("main").innerText(),/Sample preset loaded from Opportunity Finder/);
  for(const [name,value] of Object.entries(values)) assert.equal(await slider(page,name).getAttribute("aria-valuenow"),String(value));
  assert.equal(new URL(page.url()).searchParams.has("preset"),false);
  await page.getByRole("button",{name:"Dismiss",exact:true}).click();
  assert.equal(await page.getByText(/Sample preset loaded from Opportunity Finder/).count(),0);
  await page.reload();await page.getByRole("heading",{name:"Scenario Planner",exact:true}).waitFor();
  assert.equal(await slider(page,"Revenue Change").getAttribute("aria-valuenow"),"5");
 }));
}
test("Missing source data cannot certify scenario outputs",async()=>fixture({state:"unavailable"},truth));
test("Unknown preset retains default sample",async()=>fixture({preset:"unknown-example"},async page=>{
 assert.equal(await slider(page,"Revenue Change").getAttribute("aria-valuenow"),"5");await truth(page);
}));
test("Sample preset buttons retain original outputs and unused sliders are disclosed",async()=>fixture({},async page=>{
 await page.getByRole("heading",{name:"Supporting Sample Analysis"}).click();
 const table=page.getByRole("table");
 const buttons=page.getByRole("button",{name:"Load sample preset",exact:true});
 await buttons.nth(0).click();assert.match(await table.innerText(),/Contribution\s+£198k\s+£236k/);
 await buttons.nth(1).click();assert.match(await table.innerText(),/Contribution\s+£198k\s+£198k/);
 await buttons.nth(2).click();assert.match(await table.innerText(),/Contribution\s+£198k\s+£232k/);
 const original=await table.innerText();
 await page.getByRole("button",{name:"Marketing",exact:true}).click();
 for(const name of ["Meta Spend Change","Google Spend Change"]){await slider(page,name).focus();await slider(page,name).press("End");}
 await page.getByRole("button",{name:"Margin",exact:true}).click();
 await slider(page,"Payment Fee Rate Change").focus();await slider(page,"Payment Fee Rate Change").press("End");
 assert.equal(await table.innerText(),original);
}));
