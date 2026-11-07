// Run only against a loopback preview using fake Supabase configuration.
// All external traffic is mocked or blocked; no real pricing data or accounts.
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
    discount = 0,
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
      // Includes the dashboard read reached during sign-in, plus this page's existing source loader.
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
      if (state === "loading") return;
      if (state === "partial" && url.pathname.endsWith("/discount_dependency"))
        return json({ message: "Synthetic ratio unavailable" }, 503);
      if (state === "missing" && url.pathname.endsWith("/discount_dependency"))
        return json(null);
      if (state === "invalid" && url.pathname.endsWith("/discount_dependency"))
        return json("not a number");
      if (url.pathname.endsWith("/discount_dependency") && state !== "unavailable")
        return json(discount);
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
    await page.getByRole("combobox", { name: "Active store" }).waitFor();
    await page.goto(origin + "/pricing-optimisation");
    await page
      .getByRole("status")
      .filter({ hasText: statusCopy[state] })
      .waitFor();
    await run(page);
    assert.deepEqual(errors, [], "No browser page errors");
    assert.deepEqual(unexpected, [], "No unexpected API or write requests");
  } finally {
    await context.close();
    await browser.close();
  }
}
async function assertTruthful(page) {
  const status = page.getByRole("region", { name: "Pricing reporting status" });
  assert.match(await status.innerText(), /Actual pricing analysis: unavailable/);
  assert.match(await status.innerText(), /not been validated against the agreed financial definitions/);
  assert.match(await status.innerText(), /not a verified average discount per order/);
  assert.doesNotMatch(await status.innerText(), /£|GBP|18%|52,000|198,000/);
  assert.match(await page.getByRole("region", {name: "Sample pricing model notice"}).innerText(), /fixed sample inputs, not results or recommendations for your business/);
  assert.equal(await page.getByRole("button", {name: "CFO Monitoring Status"}).count(), 0);
  assert.equal(await page.getByPlaceholder("Ask a question about this page…").count(), 0);
  assert.equal(await page.getByText("CFO Pricing Verdict", {exact:true}).count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Fits viewport");
}
for (const viewport of Object.keys(viewports)) {
  for (const state of Object.keys(statusCopy)) test(`${viewport}: ${state} source ratio stays separate from sample pricing`, async () => {
    await fixture({state, viewport}, async page => {
      await assertTruthful(page);
      const status = page.getByRole("region", { name: "Pricing reporting status" });
      assert.equal(await status.getByText(state === "current" || state === "historical" ? "0.00%" : "Unavailable", {exact:true}).count(), 1);
      await page.getByRole("heading", {name:"Supporting Sample Analysis", exact:true}).click();
      for (const name of ["Sample KPI Summary", "Sample Contribution Drivers", "Sample Pricing Trend"]) assert.equal(await page.getByRole("heading", {name,exact:true}).isVisible(), true);
      assert.equal(await page.getByText("18%", {exact:true}).count(), 1);
      await page.getByRole("button", {name:"Data & benchmark assumptions"}).click();
      assert.equal(await page.getByText(/Risk thresholds, confidence labels and simulator coefficients are illustrative assumptions/).isVisible(), true);
      await assertTruthful(page);
      const dir = process.env.NIGHT_SCOUT_PRICING_SCREENSHOT_DIR;
      if (dir && state === "current") { await mkdir(dir, {recursive:true}); await page.screenshot({path:join(dir, viewport+".png"),fullPage:true}); }
    });
  });
  test(`${viewport}: source ratio and dates never replace sample simulator inputs`, async () => {
    await fixture({viewport,discount:0.255}, async page => {
      await assertTruthful(page);
      assert.equal(await page.getByRole("region", {name:"Pricing reporting status"}).getByText("25.50%", {exact:true}).count(), 1);
      const output = page.getByText("Scenario Contribution", {exact:true}).locator("..");
      assert.match(await output.innerText(), /198,000/);
      const slider=page.locator('[aria-label="Average Discount Change"]').getByRole("slider");
      await slider.focus(); await slider.press("Home");
      assert.match(await output.innerText(), /298,000/);
      await page.getByRole("button", {name:/Reset/}).click();
      assert.match(await output.innerText(), /198,000/);
      await slider.focus(); await slider.press("End");
      assert.match(await output.innerText(), /98,000/);
      assert.equal(await page.getByText(/This sample falls below the illustrative risk threshold/).count(), 1);
      await page.getByRole("button", {name:/Reset/}).click();
      await page.getByRole("button", {name:"Last Complete Week",exact:true}).click();
      await page.getByRole("status").filter({hasText:statusCopy.current}).waitFor();
      assert.match(await output.innerText(), /198,000/);
    });
  });
  test(`${viewport}: free pricing gates promise examples only`, async () => {
    await fixture({viewport,plan:"free"}, async page => {
      await assertTruthful(page);
      assert.equal(await page.getByRole("slider").count(), 0);
      assert.equal(await page.getByText(/Upgrading does not validate or connect actual pricing analysis/).count(), 1);
      await page.getByRole("heading", {name:"Supporting Sample Analysis",exact:true}).click();
      assert.equal(await page.getByText("View sample contribution drivers on Pro",{exact:true}).isVisible(),true);
    });
  });
}
