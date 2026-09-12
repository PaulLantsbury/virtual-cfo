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
 assert.match(await notice.innerText(), /single synthetic month/);
 assert.equal(await page.getByRole("button",{name:"CFO Monitoring Status"}).count(),0);
 assert.equal(await page.getByPlaceholder("Ask a question about this page…").count(),0);
 assert.equal(await page.getByText("Why Night Scout Chose This",{exact:true}).count(),0);
 assert.equal(await page.getByRole("button",{name:"Load sample preset",exact:true}).count(),0);
 assert.equal(await page.getByRole("button",{name:"Reload preset",exact:true}).count(),0);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"Fits viewport");
}
const slider=(page,label)=>page.locator(`[aria-label="${label}"]`).getByRole("slider");
// Independent worked sample-month expectations, not a copy of the model equations.
async function businessImpact(page, { sales, profit, salesChange, profitChange }) {
 const summaries = ["Scenario summary", "Live business impact"];
 for (const name of summaries) {
  const region = page.getByRole("region", { name, exact: true });
  for (const [metric, baseline, current, change] of [
   ["Sales", "£95,000", sales, salesChange],
   ["Operating profit", "£21,900", profit, profitChange],
  ]) {
   const card = region.getByRole("group", { name: metric, exact: true });
   const text = (await card.innerText()).replace(/−/g, "-");
   assert.ok(text.includes(baseline), `${name}: ${metric} keeps its sample starting position`);
   assert.ok(text.includes(current), `${name}: ${metric} displays the full scenario amount ${current}`);
   for (const value of change) assert.ok(text.includes(value), `${name}: ${metric} change includes ${value}`);
  }
 }
 for (const metric of ["Sales", "Operating profit"]) {
  const texts = await Promise.all(summaries.map(name => page.getByRole("region", {name, exact:true}).getByRole("group", {name:metric, exact:true}).innerText()));
  assert.equal(texts[0], texts[1], `${metric}: summary and slider impact agree`);
 }
}
const startingImpact = { sales:"£95,000", profit:"£21,900", salesChange:["£0", "0%"], profitChange:["£0", "0%"] };
async function unchangedControls(page) {
 for (const tab of ["Growth", "Costs", "Overheads"]) {
  await page.getByRole("button", {name:tab, exact:true}).click();
  for (const control of await page.getByRole("slider").all()) assert.equal(await control.getAttribute("aria-valuenow"), "0", `${tab} remains at zero`);
 }
 await page.getByRole("button", {name:"Growth", exact:true}).click();
}
async function tableAmounts(page, metric, baseline, current) {
 const row = page.getByRole("table").getByRole("row").filter({has:page.getByRole("rowheader",{name:metric,exact:true})});
 const cells = await row.getByRole("cell").allTextContents();
 assert.deepEqual(cells.slice(0,2), [baseline, current]);
 assert.equal(cells.length,3,"Supporting row includes the change as well as baseline/scenario amounts");
}
for(const viewport of Object.keys(viewports)) {
 test(`${viewport}: coherent month starts unchanged and persistence stays unavailable`,async()=>fixture({viewport},async page=>{
  await truth(page);
  await businessImpact(page, startingImpact);
  await unchangedControls(page);
  for(const b of await page.getByRole("button",{name:"Saving unavailable",exact:true}).all()) assert.equal(await b.isDisabled(),true);
  assert.equal(await page.getByRole("button",{name:"Comparison unavailable"}).isDisabled(),true);
  await page.getByRole("heading",{name:"Supporting Sample Analysis"}).click();
  await tableAmounts(page,"Sales","£95,000","£95,000");
  await tableAmounts(page,"Contribution","£40,900","£40,900");
  await tableAmounts(page,"Operating profit","£21,900","£21,900");
  await tableAmounts(page,"EBITDA","£22,900","£22,900");
  for(const tab of ["Costs","Overheads","Growth"]) await page.getByRole("button",{name:tab,exact:true}).click();
  await truth(page);
  const dir=process.env.NIGHT_SCOUT_SCENARIO_SCREENSHOT_DIR;
  if(dir){await mkdir(dir,{recursive:true});await page.screenshot({path:join(dir,viewport+".png"),fullPage:true});}
 }));
 test(`${viewport}: order volume changes sales and profit consistently and reset restores baseline`,async()=>fixture({viewport},async page=>{
  await slider(page,"Order Volume Change").focus();
  await slider(page,"Order Volume Change").press("End");
  await businessImpact(page, { sales:"£125,000", profit:"£37,200", salesChange:["+£30,000", "+31.6%"], profitChange:["+£15,300", "+69.9%"] });
  await page.getByRole("heading",{name:"Supporting Sample Analysis"}).click();
  await tableAmounts(page,"Sales","£95,000","£125,000");
  await tableAmounts(page,"Contribution","£40,900","£56,200");
  await tableAmounts(page,"Operating profit","£21,900","£37,200");
  await tableAmounts(page,"EBITDA","£22,900","£38,200");
  await page.getByRole("button",{name:"Reset",exact:true}).click();
  await businessImpact(page, startingImpact);
  assert.equal(await slider(page,"Order Volume Change").getAttribute("aria-valuenow"),"0");
 }));
 test(`${viewport}: AOV shows positive and negative business differences`,async()=>fixture({viewport},async page=>{
  await slider(page,"Average Order Value Change").focus();
  await slider(page,"Average Order Value Change").press("End");
  await businessImpact(page,{sales:"£110,000",profit:"£36,900",salesChange:["+£15,000","+15.8%"],profitChange:["+£15,000","+68.5%"]});
  await slider(page,"Average Order Value Change").press("Home");
  await businessImpact(page,{sales:"£85,000",profit:"£11,900",salesChange:["-£10,000","-10.5%"],profitChange:["-£10,000","-45.7%"]});
  await page.getByRole("heading",{name:"Supporting Sample Analysis"}).click();
  await tableAmounts(page,"Sales","£95,000","£85,000");
  await tableAmounts(page,"Operating profit","£21,900","£11,900");
 }));
 test(`${viewport}: lower marketing spend changes costs without guessing sales`,async()=>fixture({viewport},async page=>{
  await page.getByRole("button",{name:"Costs",exact:true}).click();
  await slider(page,"Marketing Spend Change").focus();
  await slider(page,"Marketing Spend Change").press("Home");
  await businessImpact(page,{sales:"£95,000",profit:"£24,900",salesChange:["£0","0%"],profitChange:["+£3,000","+13.7%"]});
  await page.getByRole("heading",{name:"Supporting Sample Analysis"}).click();
  await tableAmounts(page,"Contribution","£40,900","£43,900");
 }));
 test(`${viewport}: live impact stays in view while adjusting overheads`,async()=>fixture({viewport},async page=>{
  await page.getByRole("button",{name:"Overheads",exact:true}).click();
  const control = slider(page,"Other Overhead Cost Change");
  await control.scrollIntoViewIfNeeded();
  await control.focus();
  await control.press("End");
  const live = page.getByRole("region",{name:"Live business impact",exact:true});
  for (const metric of ["Sales", "Operating profit"]) {
   const bounds = await live.getByRole("group",{name:metric,exact:true}).boundingBox();
   assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= viewports[viewport].height, `${metric} stays fully visible while adjusting the last overhead slider`);
  }
  assert.ok(await control.isVisible(), "The slider remains available alongside the business impact");
  await truth(page);
 }));
 test(`${viewport}: free gate keeps sample status without numerical controls`,async()=>fixture({viewport,plan:"free"},async page=>{
  await truth(page);
  assert.equal(await page.getByRole("slider").count(),0);
  for (const name of ["Scenario summary", "Live business impact"]) assert.equal(await page.getByRole("region", {name, exact:true}).count(), 0, "Free plan does not expose numerical impact panels");
 }));
 for(const preset of ["reduce-discount-depth","reallocate-meta-spend","improve-fullprice-ratio"])
 test(`${viewport}: legacy ${preset} is not partially applied`,async()=>fixture({viewport,preset},async page=>{
  assert.match(await page.locator("main").innerText(),/Previous preset not applied/);
  await businessImpact(page,startingImpact);
  await unchangedControls(page);
  assert.equal(new URL(page.url()).searchParams.has("preset"),false);
  await page.reload();
  await page.getByRole("heading",{name:"Scenario Planner",exact:true}).waitFor();
  await businessImpact(page,startingImpact);
 }));
}
test("Missing source data cannot certify actual scenario outputs",async()=>fixture({state:"unavailable"},async page=>{
 await truth(page);await businessImpact(page,startingImpact);
}));
test("Unknown preset leaves the whole coherent sample unchanged",async()=>fixture({preset:"unknown-example"},async page=>{
 assert.match(await page.locator("main").innerText(),/Previous preset not applied/);
 assert.equal(new URL(page.url()).searchParams.has("preset"),false);
 await businessImpact(page,startingImpact);await truth(page);
}));
