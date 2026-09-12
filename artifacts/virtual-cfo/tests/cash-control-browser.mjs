// Run only against a loopback preview using fake Supabase configuration.
// All external traffic is mocked or blocked; no real cash data or accounts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const { chromium } = await import(process.env.NIGHT_SCOUT_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.NIGHT_SCOUT_TEST_URL || 'http://127.0.0.1:5187';
if (new URL(origin).hostname !== '127.0.0.1') throw new Error('Loopback preview required');
const storeId = '50000000-0000-0000-0000-000000000001';
const user = { id: '60000000-0000-0000-0000-000000000001', email: 'test@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: {}, identities: [], created_at: '2026-09-08T00:00:00Z' };
const token = [{ alg: 'HS256', typ: 'JWT' }, { sub: user.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }, 'signature'].map(x => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url')).join('.');
const session = { access_token: token, refresh_token: 'test-refresh', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user };
const viewports = { desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } };
const statusCopy = { current: 'Sales context: latest completed period', historical: 'Sales context: historical period', unavailable: 'Sales context: trading data unavailable', empty: 'Sales context: no trading data found' };
async function fixture({ state = 'current', plan = 'pro', viewport = 'desktop' }, run) {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.NIGHT_SCOUT_CHROME_PATH });
  const context = await browser.newContext({ viewport: viewports[viewport], serviceWorkers: 'block' });
  await context.addInitScript(plan => sessionStorage.setItem('userPlan', plan), plan);
  const page = await context.newPage();
  const errors = [], unexpected = [];
  page.on('pageerror', error => errors.push(error.message));
  const currentMonth = new Date(); currentMonth.setMonth(currentMonth.getMonth() - 1, 1);
  const latestFrom = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`;
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.origin === origin) {
      if (url.pathname.startsWith('/api/')) { unexpected.push(url.pathname); return json({ error: 'Unexpected API request' }, 503); }
      return route.continue();
    }
    if (url.hostname !== 'night-scout-test.invalid') return route.abort();
    if (url.pathname === '/auth/v1/token') return json(session);
    if (url.pathname === '/auth/v1/user') return json(user);
    if (url.pathname === '/rest/v1/store_memberships') return json([{ store_id: storeId, stores: { id: storeId, name: 'Synthetic Store' } }]);
    if (request.method() === 'GET' && url.pathname === '/rest/v1/stores' && url.searchParams.get('select') === 'id,currency_code,timezone' && url.searchParams.get('id') === `eq.${storeId}`) return json({ id: storeId, currency_code: 'GBP', timezone: 'Europe/London' });
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      if (state === 'unavailable') return json({ message: 'Synthetic unavailable' }, 503);
      if (url.pathname.endsWith('/order_count')) return json(state === 'empty' || (state === 'historical' && request.postDataJSON().p_date_from === latestFrom) ? 0 : 1);
      if (url.pathname.endsWith('/recoverable_contribution_range')) return json([{ recoverable_low: 0, recoverable_high: 0 }]);
      return json(0);
    }
    unexpected.push(url.pathname); return json({ message: 'Unexpected request' }, 400);
  });
  try {
    await page.goto(origin + '/login');
    await page.getByLabel('Email address').fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('combobox', { name: 'Active store' }).waitFor();
    await page.goto(origin + '/cash-control');
    await page.getByRole('status').filter({ hasText: statusCopy[state] }).waitFor();
    await run(page);
    assert.deepEqual(errors, [], 'No browser page errors');
    assert.deepEqual(unexpected, [], 'No unexpected API or write requests');
  } finally { await context.close(); await browser.close(); }
}
async function screenshot(page, name) {
  const directory = process.env.NIGHT_SCOUT_CASH_SCREENSHOT_DIR;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: join(directory, name + '.png'), fullPage: true });
}
async function assertSampleNotice(page) {
  await page.getByRole('heading', { name: 'Cash Control — sample model', exact: true }).waitFor();
  const notice = page.getByRole('region', { name: 'Sample cash model notice' });
  assert.equal(await notice.isVisible(), true);
  assert.match(await notice.innerText(), /Actual cash reporting is not connected/);
  assert.match(await notice.innerText(), /not results or recommendations for your business/);
  assert.match(await notice.innerText(), /not a cash runway estimate based on your actual cash flows/);
  assert.equal(await page.getByRole('button', { name: 'CFO Monitoring Status' }).count(), 0);
  assert.equal(await page.getByText('Monitoring not active', { exact: true }).count(), 1);
  assert.equal(await page.getByText('CFO Cash Verdict', { exact: true }).count(), 0);
  assert.equal(await page.getByPlaceholder('Ask a question about this page…').count(), 0);
  assert.equal(await page.getByText('Cash available today', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Using latest completed period', { exact: true }).count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Page fits viewport without horizontal scroll');
}
for (const viewport of Object.keys(viewports)) {
  for (const state of Object.keys(statusCopy)) test(`${viewport}: ${state} reporting context keeps cash figures explicitly illustrative`, async () => {
    await fixture({ state, viewport }, async page => {
      await assertSampleNotice(page);
      if (state === 'current') {
        await page.getByRole('heading', { name: 'Cash Control — sample model', exact: true }).scrollIntoViewIfNeeded();
        await screenshot(page, viewport + '-overview');
      }
      await page.getByRole('heading', { name: 'Supporting Sample Analysis', exact: true }).click();
      for (const name of ['Sample Cash Movement Detail', 'Sample Cash Movement by Driver', 'Sample Cash Bridge', 'Sample Sensitivity Ranking']) assert.equal(await page.getByRole('heading', { name, exact: true }).isVisible(), true);
      await page.getByRole('button', { name: 'Data & benchmark assumptions' }).click();
      assert.equal(await page.getByText('Confidence labels are part of the example only; no business-specific cash assessment has been performed.', { exact: true }).isVisible(), true);
      await assertSampleNotice(page);
      if (state === 'current') await screenshot(page, viewport + '-expanded');
    });
  });
  test(`${viewport}: sample simulator remains interactive with honest positive, moderate and danger explanations`, async () => {
    await fixture({ viewport }, async page => {
      const model = page.getByRole('heading', { name: 'Sample Cash Runway Model', exact: true }).locator('..').locator('..');
      const balance = model.getByText('Sample Cash Balance', { exact: true }).locator('..');
      const baseline = await balance.innerText();
      const inventory = page.locator('[aria-label="Inventory Days Change"]').getByRole('slider');
      await inventory.focus(); await inventory.press('Home');
      assert.notEqual(await balance.innerText(), baseline);
      assert.match(await model.innerText(), /This sample scenario maintains or increases modelled cash headroom/);
      await page.getByRole('button', { name: 'Reset sample scenario' }).click();
      assert.equal(await balance.innerText(), baseline);
      const revenue = page.locator('[aria-label="Revenue Change"]').getByRole('slider');
      await revenue.focus(); await revenue.press('Home');
      await inventory.focus(); await inventory.press('End');
      assert.match(await model.innerText(), /moderate risk label/);
      await page.locator('[aria-label="Fixed Cost Change"]').getByRole('slider').focus();
      await page.locator('[aria-label="Fixed Cost Change"]').getByRole('slider').press('End');
      assert.match(await model.innerText(), /illustrative two-month threshold/);
      assert.match(await model.innerText(), /high risk label at this level; it does not assess your business/);
      await screenshot(page, viewport + '-scenario');
      await page.getByRole('button', { name: 'Reset sample scenario' }).click();
      assert.equal(await balance.innerText(), baseline);
      await page.getByRole('button', { name: 'Last Complete Week', exact: true }).click();
      await page.getByRole('status').filter({ hasText: statusCopy.current }).waitFor();
      await assertSampleNotice(page);
      assert.equal(await balance.innerText(), baseline, 'Changing timeline does not replace sample data');
    });
  });
  test(`${viewport}: free plan retains gates without promising actual cash reporting`, async () => {
    await fixture({ viewport, plan: 'free' }, async page => {
      await assertSampleNotice(page);
      assert.equal(await page.getByRole('slider').count(), 0);
      assert.equal(await page.getByText('Sample cash runway model available on Pro', { exact: true }).isVisible(), true);
      assert.equal(await page.getByText('Your Cash Recovery Plan', { exact: true }).count(), 0);
      await page.getByRole('heading', { name: 'Supporting Sample Analysis', exact: true }).click();
      assert.equal(await page.getByText('Detailed sample cash diagnostics are available on Pro', { exact: true }).isVisible(), true);
      assert.equal(await page.getByRole('heading', { name: 'Sample Cash Bridge', exact: true }).count(), 0);
      assert.equal(await page.getByRole('link', { name: 'Upgrade to Pro →', exact: true }).count(), 2);
      await screenshot(page, viewport + '-free');
    });
  });
}
