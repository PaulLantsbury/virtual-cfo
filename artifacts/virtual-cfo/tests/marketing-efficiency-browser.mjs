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
    (plan) => sessionStorage.setItem("userPlan", plan),
    plan,
  );
  const page = await context.newPage();
  let releaseOld;
  const oldResponse = new Promise(resolve => { releaseOld = resolve; });
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
      // Includes the dashboard read reached during sign-in, plus this page's existing source loader.
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
      if (state === "invalid" && url.pathname.endsWith("/gross_revenue"))
        return json("not a number");
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
    await page.goto(origin + "/marketing-efficiency");
    if (delayedStore) await page.getByRole("button", {name:"Synthetic Store", exact:true}).click();
    await page
      .getByRole("status")
      .filter({ hasText: new RegExp("^" + statusCopy[state] + "$") })
      .waitFor();
    await run(page, releaseOld);
    const directory = process.env.NIGHT_SCOUT_GROWTH_SCREENSHOT_DIR;
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
  const source = page.getByRole("region", {name: "Growth reporting status"});
  assert.match(await source.innerText(), /Actual growth analysis and recovery: unavailable/);
  assert.match(await source.innerText(), /Source currency has not been verified/);
  assert.doesNotMatch(await source.innerText(), /£|GBP|18,200/);
  assert.match(await page.getByRole("region", {name: "Sample growth model notice"}).innerText(), /fixed sample inputs/);
  assert.equal(await page.getByRole("button", {name: "CFO Monitoring Status"}).count(), 0);
  assert.equal(await page.getByPlaceholder("Ask a question about this page…").count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Fits viewport");
  return source;
}
for (const viewport of Object.keys(viewports)) {
  for (const state of Object.keys(statusCopy)) test(`${viewport}: source ${state} never becomes example data`, async () => {
    await fixture({viewport, state}, async page => {
      const source = await truthful(page);
      if (["current", "historical"].includes(state)) assert.equal(await source.getByText("0.00%", {exact:true}).count(), 2);
      else assert.ok(await source.getByText("Unavailable", {exact:true}).count() >= 2);
    });
  });
  for (const marketing of ["zero", "nonzero", "missing", "invalid", "partial", "error", "empty"]) test(`${viewport}: marketing ${marketing} is separate from fixed scenarios`, async () => {
    await fixture({viewport, marketing}, async page => {
      const expected = ["partial", "error"].includes(marketing) ? "Some marketing source figures unavailable" : marketing === "empty" ? "No marketing source rows returned" : "Unverified marketing source figures";
      await page.getByRole("status").filter({hasText: new RegExp("^" + expected + "$")}).waitFor();
      const source = await truthful(page);
      if (marketing === "zero") assert.equal(await source.getByText("0.00", {exact:true}).count(), 2);
      if (marketing === "nonzero") assert.equal(await source.getByText("27.50", {exact:true}).count(), 2);
      if (["missing", "invalid", "error", "empty"].includes(marketing)) assert.equal(await source.getByText("Unavailable", {exact:true}).count(), 2);
      if (marketing === "partial") assert.equal(await source.getByText("0.00", {exact:true}).count(), 2);
      assert.ok(await page.getByText("£18,200", {exact:true}).count() >= 1);
      await page.getByRole("heading", {name:"Supporting Sample Analysis", exact:true}).click();
      await truthful(page);
    });
  });
  test(`${viewport}: simulator retains cap and reset independently of source`, async () => {
    await fixture({viewport, marketing:"nonzero"}, async page => {
      const output = page.getByText("Projected contribution uplift", {exact:true}).locator("..");
      assert.equal(await output.getByText("£0", {exact:true}).count(), 1);
      const slider = page.locator('[aria-label="Shift Meta budget to Email"]').getByRole("slider");
      await slider.focus(); await slider.press("End");
      assert.equal(await slider.getAttribute("aria-valuenow"), "25");
      const second = page.locator('[aria-label="Shift Meta budget to Organic"]').getByRole("slider");
      await second.focus(); await second.press("End");
      assert.equal(await page.getByText("Combined shift capped at 30%", {exact:true}).isVisible(), true);
      assert.equal(await output.getByText("£18,200", {exact:true}).count(), 1);
      assert.match(await output.innerText(), /\+3pp/);
      await page.getByRole("button", {name:"Reset sample scenario"}).click();
      assert.equal(await output.getByText("£0", {exact:true}).count(), 1);
      assert.equal(await slider.getAttribute("aria-valuenow"), "0");
      assert.equal(await second.getAttribute("aria-valuenow"), "0");
      await page.getByRole("button", {name:"Last Complete Week", exact:true}).click();
      assert.ok(await page.getByText("£18,200", {exact:true}).count() >= 1);
      await truthful(page);
    });
  });
  test(`${viewport}: free plan remains a truthful sample preview`, async () => {
    await fixture({viewport, plan:"free"}, async page => {
      await truthful(page);
      assert.equal(await page.getByRole("heading", {name:"Supporting Sample Analysis", exact:true}).count(), 0);
      assert.equal(await page.getByText("Sample Marketing Recovery Plan", {exact:true}).isVisible(), true);
      assert.match(await page.locator("main").innerText(), /actual analysis remains unavailable/);
    });
  });
}

test("delayed prior-store marketing responses never replace current-store readings", async () => {
  await fixture({delayedStore:true}, async (page, releaseOld) => {
    await page.getByRole("status").filter({hasText: /^Marketing source figures loading$/}).waitFor();
    await page.getByRole("combobox", {name:"Active store"}).selectOption(storeId.replace(/1$/, "2"));
    const source = page.getByRole("region", {name:"Growth reporting status"});
    await source.getByText("35.00", {exact:true}).first().waitFor();
    releaseOld();
    await page.waitForTimeout(150);
    assert.equal(await source.getByText("35.00", {exact:true}).count(), 2);
    assert.doesNotMatch(await source.innerText(), /999/);
  });
});
