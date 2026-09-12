// Run only against a loopback preview using fake Supabase configuration.
// All external traffic is mocked or blocked; no real margin data or accounts.
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
    await page.getByRole("combobox", { name: "Active store" }).waitFor();
    await page.goto(origin + "/margin-analysis");
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
  const status = page.getByRole("region", { name: "Margin reporting status" });
  assert.match(
    await status.innerText(),
    /Actual margin and recovery: unavailable/,
  );
  assert.match(
    await status.innerText(),
    /have not been validated against the agreed financial definitions/,
  );
  assert.match(
    await status.innerText(),
    /Source currency has not been verified/,
  );
  assert.doesNotMatch(await status.innerText(), /£|GBP/);
  const sample = page.getByRole("region", {
    name: "Sample margin model notice",
  });
  assert.match(
    await sample.innerText(),
    /fixed sample inputs, not results or recommendations for your business/,
  );
  assert.equal(
    await page.getByRole("button", { name: "CFO Monitoring Status" }).count(),
    0,
  );
  assert.equal(
    await page.getByText("Monitoring not active", { exact: true }).count(),
    1,
  );
  assert.equal(
    await page.getByPlaceholder("Ask a question about this page…").count(),
    0,
  );
  assert.equal(
    await page.getByText("CFO Margin Verdict", { exact: true }).count(),
    0,
  );
  assert.doesNotMatch(await status.innerText(), /124,500|68\.40|52,913|42\.3%/);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    "Page fits viewport",
  );
}
for (const viewport of Object.keys(viewports)) {
  for (const state of Object.keys(statusCopy))
    test(`${viewport}: ${state} keeps source and illustrative margin reporting separate`, async () => {
      await fixture({ state, viewport }, async (page) => {
        await assertTruthful(page);
        const overviewDirectory = process.env.NIGHT_SCOUT_MARGIN_SCREENSHOT_DIR;
        if (overviewDirectory && state === "current") {
          await mkdir(overviewDirectory, { recursive: true });
          await page.screenshot({
            path: join(overviewDirectory, viewport + "-overview.png"),
            fullPage: true,
          });
        }
        const status = page.getByRole("region", {
          name: "Margin reporting status",
        });
        if (state === "current" || state === "historical")
          assert.equal(
            await status.getByText("0.00", { exact: true }).count(),
            2,
            "Actual returned zeros preserved",
          );
        else
          assert.equal(
            await status.getByText("Unavailable", { exact: true }).count(),
            2,
            "Missing/partial/loading values never become zero or samples",
          );
        await page
          .getByRole("heading", {
            name: "Supporting Sample Analysis",
            exact: true,
          })
          .click();
        for (const name of [
          "Sample Margin Drivers",
          "Sample Contribution Bridge",
          "Sample Margin by Channel",
          "Sample Margin Trend",
          "Sample Unit Economics",
        ])
          assert.equal(
            await page.getByRole("heading", { name, exact: true }).isVisible(),
            true,
          );
        await page
          .getByRole("button", { name: "Data & benchmark assumptions" })
          .click();
        assert.equal(
          await page
            .getByText(
              "Thresholds and confidence labels are illustrative assumptions, not verified benchmarks for your business.",
              { exact: true },
            )
            .isVisible(),
          true,
        );
        await assertTruthful(page);
        const directory = process.env.NIGHT_SCOUT_MARGIN_SCREENSHOT_DIR;
        if (directory && state === "current") {
          await mkdir(directory, { recursive: true });
          await page.screenshot({
            path: join(directory, viewport + ".png"),
            fullPage: true,
          });
        }
      });
    });
  test(`${viewport}: nonzero source values do not become verified margins or simulator inputs`, async () => {
    await fixture({ viewport, revenue: 250, aov: 12.5 }, async (page) => {
      await assertTruthful(page);
      const status = page.getByRole("region", {
        name: "Margin reporting status",
      });
      assert.equal(
        await status.getByText("250.00", { exact: true }).count(),
        1,
      );
      assert.equal(await status.getByText("12.50", { exact: true }).count(), 1);
      const output = page
        .getByText("Sample contribution", { exact: true })
        .locator("..");
      const base = await output.innerText();
      assert.match(base, /52,913/);
      const slider = page
        .locator('[aria-label="Meta CAC change"]')
        .getByRole("slider");
      await slider.focus();
      await slider.press("Home");
      assert.notEqual(await output.innerText(), base);
      assert.equal(
        await page.getByText(/this is not a recommendation/).count(),
        1,
      );
      await page.getByRole("button", { name: "Reset sample scenario" }).click();
      assert.equal(await output.innerText(), base);
      await slider.focus();
      await slider.press("End");
      assert.match(
        await page.locator("main").innerText(),
        /Below the illustrative threshold/,
      );
      await page.getByRole("button", { name: "Reset sample scenario" }).click();
      await page
        .getByRole("button", { name: "Last Complete Week", exact: true })
        .click();
      await page
        .getByRole("status")
        .filter({ hasText: statusCopy.current })
        .waitFor();
      assert.equal(
        await output.innerText(),
        base,
        "Timeline never replaces sample inputs",
      );
    });
  });
  test(`${viewport}: free plan keeps illustrative gates honest`, async () => {
    await fixture({ viewport, plan: "free" }, async (page) => {
      await assertTruthful(page);
      assert.equal(await page.getByRole("slider").count(), 0);
      assert.equal(
        await page
          .getByText(
            /Upgrading does not validate or connect actual margin reporting/,
          )
          .count(),
        1,
      );
      await page
        .getByRole("heading", {
          name: "Supporting Sample Analysis",
          exact: true,
        })
        .click();
      assert.equal(
        await page
          .getByText("Supporting sample analysis available on Pro", {
            exact: true,
          })
          .isVisible(),
        true,
      );
    });
  });
}
