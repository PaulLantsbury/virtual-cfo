import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchXeroStagingDiscovery, parseXeroDiscovery, parseXeroDiscoveryStart, startXeroStagingDiscovery } from './xeroStagingDiscovery.ts';

const handle = 'abcdefghijklmnopqrstuvwxyz012345';
const tenant = { id: '11111111-1111-4111-8111-111111111111', name: 'Demo company' };
const account = { id: '22222222-2222-4222-8222-222222222222', code: '200', name: 'Sales', type: 'REVENUE', status: 'ACTIVE' };

test('discovery start accepts only the bounded Xero authorisation URL', () => {
  assert.deepEqual(parseXeroDiscoveryStart({ url: 'https://login.xero.com/identity/connect/authorize?a=b' }), { url: 'https://login.xero.com/identity/connect/authorize?a=b' });
  assert.equal(parseXeroDiscoveryStart({ url: 'https://example.com/steal' }), null);
  assert.equal(parseXeroDiscoveryStart({ url: 'https://login.xero.com/', token: 'secret' }), null);
});

test('discovery response accepts bounded metadata and rejects financial or secret fields', () => {
  const ready = parseXeroDiscovery({ handle, status: 'ready', tenant, accounts: [account] }, handle);
  assert.deepEqual(ready, { handle, status: 'ready', tenant, accounts: [account] });
  assert.equal(Object.isFrozen(ready?.accounts), true);
  assert.deepEqual(parseXeroDiscovery({ handle, status: 'pending' }, handle), { handle, status: 'pending' });
  for (const invalid of [
    { handle, status: 'ready', tenant, accounts: [{ ...account, balance: 12 }] },
    { handle, status: 'ready', tenant, accounts: [account], refreshToken: 'secret' },
    { handle: `${handle}x`, status: 'ready', tenant, accounts: [account] },
    { handle, status: 'ready', tenant, accounts: Array.from({ length: 501 }, () => account) },
  ]) assert.equal(parseXeroDiscovery(invalid, handle), null);
});

test('discovery calls authenticate without putting the access token in URLs', async () => {
  const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push([input, init]);
    const body = calls.length === 1
      ? { url: 'https://login.xero.com/identity/connect/authorize?a=b' }
      : { handle, status: 'ready', tenant, accounts: [account] };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  await startXeroStagingDiscovery('signed-token', fetcher);
  await fetchXeroStagingDiscovery(handle, 'signed-token', undefined, fetcher);
  assert.equal(calls[0][0], '/api/xero/staging/discover');
  assert.equal(calls[0][1]?.method, 'POST');
  assert.equal(calls[1][0], `/api/xero/staging/discovery/${handle}`);
  for (const [url, init] of calls) {
    assert.equal(String(url).includes('signed-token'), false);
    assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer signed-token');
    assert.equal(init?.cache, 'no-store');
  }
});
