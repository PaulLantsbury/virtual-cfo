// Loopback-only synthetic responses; the shared fixture blocks external writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, evidence, metrics } from './shared-sales-fixture.mjs';

test('missing exact coverage is explained and a retry can recover supported figures', async () => {
  let available = false;
  await fixture({ entry: '/dashboard', profitRespond: () => ({ data: { state: 'unavailable', reason: 'Synthetic profit evidence unavailable' } }), respond: params => ({ data: evidence(params, { state: available ? 'sale' : 'missing' }) }) }, async (page, { calls }) => {
    await page.getByText('Sales and refund coverage has not been verified for this exact reporting period.', { exact: true }).waitFor();
    const before = calls.length;
    available = true;
    await page.getByRole('button', { name: 'Retry sales evidence check' }).click();
    await metrics(page);
    assert.ok(calls.length > before);
    assert.equal(await page.getByRole('button', { name: 'Retry sales evidence check' }).count(), 0);
  });
});

for (const [status, reason] of [[401, /Sign in again/], [403, /not accessible/], [404, /not available on this website/], [503, /service is unavailable/]]) {
  test(`profit ${status} explains the failure and retains unavailable amounts`, async () => {
    await fixture({ profitRespond: () => ({ status, data: { error: 'private server details must not render' } }) }, async page => {
      const summary = page.getByRole('region', { name: 'Verified profit summary', exact: true });
      await summary.getByText(reason).waitFor();
      assert.doesNotMatch(await summary.innerText(), /private server|£0\.00/);
      await summary.getByRole('group', { name: 'Gross profit', exact: true }).getByText('Unavailable', { exact: true }).waitFor();
    });
  });
}
