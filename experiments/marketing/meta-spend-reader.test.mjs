import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverMetaAdAccounts, readMetaDailySpend } from './meta-spend-reader.mjs';

const accountId = '12345';
const apiVersion = 'v27.0';
const token = 'synthetic-meta-access-token';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('account discovery requests and returns only IDs, currency, and account timezone', async () => {
  const calls = [];
  const fetchImpl = async (input, init) => {
    const url = new URL(input);
    calls.push({ url, init });
    assert.equal(init.headers.authorization, `Bearer ${token}`);
    assert.equal(url.origin, 'https://graph.facebook.com');
    assert.equal(url.searchParams.get('fields'), 'id,account_id,currency,timezone_name');
    return json({
      data: [{ id: `act_${accountId}`, account_id: accountId, currency: 'GBP', timezone_name: 'Europe/London' }],
    });
  };

  const result = await discoverMetaAdAccounts({ accessToken: token, apiVersion, fetchImpl });
  assert.deepEqual(result, {
    accounts: [{ accountId, currency: 'GBP', timeZone: 'Europe/London' }],
    pagesRead: 1,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, `/${apiVersion}/me/adaccounts`);
});

test('daily reader requests account-level spend only, paginates, and leaves missing dates explicit', async () => {
  const calls = [];
  const fetchImpl = async (input, init) => {
    const url = new URL(input);
    calls.push({ url, init });
    assert.equal(init.headers.authorization, `Bearer ${token}`);
    if (url.pathname === `/${apiVersion}/act_${accountId}`) {
      assert.equal(url.searchParams.get('fields'), 'id,currency,timezone_name');
      return json({ id: `act_${accountId}`, currency: 'GBP', timezone_name: 'Europe/London' });
    }
    assert.equal(url.pathname, `/${apiVersion}/act_${accountId}/insights`);
    assert.equal(url.searchParams.get('level'), 'account');
    assert.equal(url.searchParams.get('time_increment'), '1');
    assert.equal(url.searchParams.get('fields'), 'account_id,date_start,date_stop,spend');
    assert.deepEqual(JSON.parse(url.searchParams.get('time_range')), {
      since: '2026-11-18',
      until: '2026-11-20',
    });
    if (!url.searchParams.has('after')) {
      const next = new URL(url);
      next.searchParams.set('after', 'synthetic-cursor');
      return json({
        data: [{ account_id: accountId, date_start: '2026-11-18', date_stop: '2026-11-18', spend: '1.25' }],
        paging: { next: next.toString() },
      });
    }
    return json({
      data: [{ account_id: accountId, date_start: '2026-11-20', date_stop: '2026-11-20', spend: '0.00' }],
    });
  };

  const result = await readMetaDailySpend({
    accessToken: token,
    accountId,
    from: '2026-11-18',
    to: '2026-11-20',
    apiVersion,
    fetchImpl,
  });
  assert.equal(calls.length, 3);
  assert.deepEqual(result.rows, [
    { provider: 'meta_ads', accountId, date: '2026-11-18', currency: 'GBP', spendMinor: '125' },
    { provider: 'meta_ads', accountId, date: '2026-11-20', currency: 'GBP', spendMinor: '0' },
  ]);
  assert.deepEqual(result.missingDates, ['2026-11-19']);
  assert.equal(result.timeZone, 'Europe/London');
  assert.equal(result.pagesRead, 2);
});

test('reader refuses unrequested attribution fields and malformed provider amounts', async () => {
  for (const spend of ['1.001', '-1.00', 'NaN']) {
    let insights = false;
    const fetchImpl = async (input) => {
      const url = new URL(input);
      if (url.pathname.endsWith('/insights')) {
        insights = true;
        return json({ data: [{ account_id: accountId, date_start: '2026-11-20', date_stop: '2026-11-20', spend }] });
      }
      return json({ id: `act_${accountId}`, currency: 'GBP', timezone_name: 'Europe/London' });
    };
    await assert.rejects(readMetaDailySpend({
      accessToken: token,
      accountId,
      from: '2026-11-20',
      to: '2026-11-20',
      apiVersion,
      fetchImpl,
    }), /unavailable/);
    assert.equal(insights, true);
  }

  const fetchImpl = async (input) => {
    const url = new URL(input);
    if (url.pathname.endsWith('/insights')) {
      return json({ data: [{
        account_id: accountId,
        date_start: '2026-11-20',
        date_stop: '2026-11-20',
        spend: '1.00',
        purchase_roas: '2.0',
      }] });
    }
    return json({ id: `act_${accountId}`, currency: 'GBP', timezone_name: 'Europe/London' });
  };
  await assert.rejects(readMetaDailySpend({
    accessToken: token,
    accountId,
    from: '2026-11-20',
    to: '2026-11-20',
    apiVersion,
    fetchImpl,
  }), /unavailable/);
});

test('reader rejects unsafe ranges and provider-supplied continuation hosts', async () => {
  await assert.rejects(readMetaDailySpend({
    accessToken: token,
    accountId,
    from: '2026-11-20',
    to: '2026-11-19',
    apiVersion,
    fetchImpl: async () => assert.fail('provider call should not happen'),
  }), /unavailable/);

  const fetchImpl = async (input) => {
    const url = new URL(input);
    if (url.pathname.endsWith('/insights')) {
      return json({ data: [], paging: { next: `https://attacker.example/${apiVersion}/act_${accountId}/insights` } });
    }
    return json({ id: `act_${accountId}`, currency: 'GBP', timezone_name: 'Europe/London' });
  };
  await assert.rejects(readMetaDailySpend({
    accessToken: token,
    accountId,
    from: '2026-11-20',
    to: '2026-11-20',
    apiVersion,
    fetchImpl,
  }), /unavailable/);
});

test('reader cancels a response with an oversized declared content length', async () => {
  let canceled = false;
  const fetchImpl = async () => ({
    ok: true,
    headers: new Headers({ 'content-length': '1000001' }),
    body: { cancel: async () => { canceled = true; } },
  });
  await assert.rejects(readMetaDailySpend({
    accessToken: token,
    accountId,
    from: '2026-11-20',
    to: '2026-11-20',
    apiVersion,
    fetchImpl,
  }), /unavailable/);
  assert.equal(canceled, true);
});
