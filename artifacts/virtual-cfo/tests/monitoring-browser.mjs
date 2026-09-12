// Run only against a loopback preview using fake Supabase configuration.
// All external traffic is mocked or blocked; no real monitoring, notifications or accounts.
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
async function fixture({ plan = 'pro', viewport = 'desktop' }, run) {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.NIGHT_SCOUT_CHROME_PATH });
  const context = await browser.newContext({ viewport: viewports[viewport], serviceWorkers: 'block' });
  await context.addInitScript(plan => sessionStorage.setItem('userPlan', plan), plan);
  const page = await context.newPage();
  const errors = [], unexpected = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.origin === origin) {
      if (url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) { unexpected.push(url.pathname); return json({ error: 'Unexpected API request' }, 503); }
      return route.continue();
    }
    if (url.hostname !== 'night-scout-test.invalid') {
      if (!['GET', 'HEAD'].includes(request.method())) unexpected.push(request.method() + ' ' + url.hostname + url.pathname);
      return route.abort();
    }
    if (request.method() === 'POST' && url.pathname === '/auth/v1/token') return json(session);
    if (request.method() === 'GET' && url.pathname === '/auth/v1/user') return json(user);
    if (request.method() === 'GET' && url.pathname === '/rest/v1/store_memberships') return json([{ store_id: storeId, stores: { id: storeId, name: 'Synthetic Store' } }]);
    if (request.method() === 'GET' && url.pathname === '/rest/v1/stores' && url.searchParams.get('select') === 'id,currency_code,timezone' && url.searchParams.get('id') === `eq.${storeId}`) return json({ id: storeId, currency_code: 'GBP', timezone: 'Europe/London' });
    // Read-only dashboard queries may start during the sign-in redirect.
    const readRpcs = ['order_count', 'gross_revenue', 'net_sales', 'average_order_value', 'repeat_purchase_rate', 'discount_dependency', 'refund_rate', 'verified_sales_source'];
    if (request.method() === 'POST' && readRpcs.some(name => url.pathname === '/rest/v1/rpc/' + name)) {
      if (url.pathname.endsWith('/verified_sales_source')) return json({ message: 'Synthetic reporting unavailable' }, 503);
      return json(url.pathname.endsWith('/order_count') ? 1 : 0);
    }
    unexpected.push(url.pathname); return json({ message: 'Unexpected request' }, 400);
  });
  try {
    await page.goto(origin + '/login');
    await page.getByLabel('Email address').fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('combobox', { name: 'Active store' }).waitFor();
    await page.goto(origin + '/cfo-alerts');
    await page.getByRole('heading', { name: 'Night Scout Monitoring — prototype', exact: true }).waitFor();
    await run(page);
    assert.deepEqual(errors, [], 'No browser page errors');
    assert.deepEqual(unexpected, [], 'No unexpected API or write requests');
  } finally { await context.close(); await browser.close(); }
}
async function screenshot(page, name) {
  const directory = process.env.NIGHT_SCOUT_MONITORING_SCREENSHOT_DIR;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: join(directory, name + '.png'), fullPage: true });
}
async function assertPrototype(page) {
  const notice = page.getByRole('region', { name: 'Monitoring prototype notice' });
  assert.equal(await notice.isVisible(), true);
  assert.match(await notice.innerText(), /Monitoring is not active/);
  assert.match(await notice.innerText(), /has not checked your business/);
  assert.match(await notice.innerText(), /fixed examples, not findings from your connected data/);
  assert.match(await notice.innerText(), /No monitoring checks are scheduled/);
  assert.match(await notice.innerText(), /no email or in-app notifications are sent/);
  assert.match(await notice.innerText(), /Pro access does not activate monitoring/);
  assert.equal(await page.getByRole('button', { name: 'CFO Monitoring Status' }).count(), 0);
  assert.equal(await page.getByText('Monitoring not active', { exact: true }).count(), 1);
  assert.equal(await page.getByPlaceholder('Ask a question about this page…').count(), 0);
  assert.equal(await page.getByRole('region', { name: 'Monitoring explanation' }).isVisible(), true);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'No horizontal page overflow');
}
for (const viewport of Object.keys(viewports)) {
  for (const plan of ['free', 'pro']) test(`${viewport}: ${plan} monitoring examples cannot imply active checks`, async () => {
    await fixture({ viewport, plan }, async page => {
      await assertPrototype(page);
      await screenshot(page, `${viewport}-${plan}-overview`);
      if (plan === 'free') {
        assert.equal(await page.getByRole('heading', { name: 'Example Monitoring Status', exact: true }).isVisible(), true);
        assert.equal(await page.getByText('Example: Improving', { exact: true }).count(), 2);
        assert.equal(await page.getByRole('link', { name: 'View Pro options', exact: true }).getAttribute('href'), '/upgrade');
        assert.equal(await page.getByRole('heading', { name: 'Preview Monitoring Settings', exact: true }).count(), 0);
        assert.equal(await page.getByRole('heading', { name: 'Example Monitoring History', exact: true }).count(), 0);
        assert.match(await page.locator('main').innerText(), /notification delivery are not implemented on either plan/);
      } else {
        for (const name of ['Example Actions Requiring Attention', 'Example Plan Progress', 'Example Monitoring Insights', 'Example Monitoring History']) {
          assert.equal(await page.getByRole('heading', { name, exact: true }).isVisible(), true);
        }
        assert.equal(await page.getByText('Example: Contribution margin has improved', { exact: true }).isVisible(), true);
        assert.equal(await page.getByText('Fictional events only; no monitoring checks have been completed by this prototype.', { exact: true }).isVisible(), true);
        assert.equal(await page.getByRole('link', { name: 'Review Cash Control', exact: true }).getAttribute('href'), '/cash-control');
      }
      await page.getByRole('button', { name: 'Data & benchmark assumptions' }).click();
      assert.equal(await page.getByText('These examples do not use connected business data.', { exact: true }).isVisible(), true);
      assert.equal(await page.getByText('Example trends and priorities are illustrative, not verified business findings.', { exact: true }).isVisible(), true);
      await assertPrototype(page);
    });
  });
  test(`${viewport}: settings are local previews with no persistence or scheduling`, async () => {
    await fixture({ viewport }, async page => {
      const settings = page.locator('details').filter({ has: page.getByRole('heading', { name: 'Preview Monitoring Settings', exact: true }) });
      await settings.locator('summary').click();
      const storageBefore = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
      for (const frequency of ['Daily', 'Monthly', 'Weekly']) {
        await settings.getByRole('button', { name: frequency, exact: true }).click();
        assert.equal(await settings.getByRole('button', { name: frequency, exact: true }).getAttribute('aria-pressed'), 'true');
        for (const delivery of ['Email', 'Both', 'In-app']) {
          await settings.getByRole('button', { name: delivery, exact: true }).click();
          assert.equal(await settings.getByRole('button', { name: delivery, exact: true }).getAttribute('aria-pressed'), 'true');
          assert.equal(await settings.getByRole('status').innerText(), `Preview selection: ${frequency} · ${delivery}. Nothing is saved, scheduled or sent.`);
        }
      }
      await settings.getByRole('button', { name: 'Daily', exact: true }).click();
      await settings.getByRole('button', { name: 'Email', exact: true }).click();
      assert.deepEqual(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })), storageBefore, 'Selections do not write browser storage');
      await assertPrototype(page);
      await settings.scrollIntoViewIfNeeded();
      await screenshot(page, viewport + '-settings');
      await page.reload();
      await settings.locator('summary').click();
      assert.equal(await settings.getByRole('button', { name: 'Weekly', exact: true }).getAttribute('aria-pressed'), 'true');
      assert.equal(await settings.getByRole('button', { name: 'In-app', exact: true }).getAttribute('aria-pressed'), 'true');
      await assertPrototype(page);
    });
  });
}
