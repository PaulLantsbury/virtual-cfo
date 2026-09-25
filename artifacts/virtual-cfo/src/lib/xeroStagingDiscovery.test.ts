import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchXeroStagingDiscovery, parseXeroDiscovery, parseXeroDiscoveryStart, startXeroStagingBootstrap, startXeroStagingDiscovery, validateXeroBootstrapSelection } from './xeroStagingDiscovery.ts';

const handle = 'abcdefghijklmnopqrstuvwxyz012345';
const selectionHandle = 'selection_abcdefghijklmnopqrstuvwxyz';
const tenant = { id: '11111111-1111-4111-8111-111111111111', name: 'Demo company' };
const account = { id: '22222222-2222-4222-8222-222222222222', code: '200', name: 'Sales', type: 'REVENUE', status: 'ACTIVE' };

test('discovery start accepts only the bounded Xero authorisation URL', () => {
  assert.deepEqual(parseXeroDiscoveryStart({ url: 'https://login.xero.com/identity/connect/authorize?a=b' }), { url: 'https://login.xero.com/identity/connect/authorize?a=b' });
  assert.equal(parseXeroDiscoveryStart({ url: 'https://example.com/steal' }), null);
  assert.equal(parseXeroDiscoveryStart({ url: 'https://login.xero.com/', token: 'secret' }), null);
});

test('discovery response accepts bounded metadata and rejects financial or secret fields', () => {
  const ready = parseXeroDiscovery({ handle, selectionHandle, status: 'ready', tenant, accounts: [account] }, handle);
  assert.deepEqual(ready, { handle, selectionHandle, status: 'ready', tenant, accounts: [account] });
  assert.equal(Object.isFrozen(ready?.accounts), true);
  assert.deepEqual(parseXeroDiscovery({ handle, status: 'pending' }, handle), { handle, status: 'pending' });
  for (const invalid of [
    { handle, selectionHandle, status: 'ready', tenant, accounts: [{ ...account, balance: 12 }] },
    { handle, selectionHandle, status: 'ready', tenant, accounts: [account], refreshToken: 'secret' },
    { handle: `${handle}x`, selectionHandle, status: 'ready', tenant, accounts: [account] },
    { handle, selectionHandle, status: 'ready', tenant, accounts: Array.from({ length: 501 }, () => account) },
    { handle, status: 'ready', tenant, accounts: [account] },
  ]) assert.equal(parseXeroDiscovery(invalid, handle), null);
});

test('discovery calls authenticate without putting the access token in URLs', async () => {
  const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push([input, init]);
    const body = calls.length === 1
      ? { url: 'https://login.xero.com/identity/connect/authorize?a=b' }
      : { handle, selectionHandle, status: 'ready', tenant, accounts: [account] };
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

test('bootstrap selection requires every category, compatible active accounts and a unique assignment', () => {
  const accounts = [
    account,
    { id: '33333333-3333-4333-8333-333333333333', code: '300', name: 'Fees', type: 'EXPENSE', status: 'ACTIVE' },
    { id: '44444444-4444-4444-8444-444444444444', code: '301', name: 'Ads', type: 'OVERHEADS', status: 'ACTIVE' },
    { id: '55555555-5555-4555-8555-555555555555', code: '302', name: 'Software', type: 'EXPENSE', status: 'ACTIVE' },
    { id: '66666666-6666-4666-8666-666666666666', code: '090', name: 'Bank', type: 'BANK', status: 'ACTIVE' },
    { id: '77777777-7777-4777-8777-777777777777', code: null, name: 'Old bank', type: 'BANK', status: 'ARCHIVED' },
  ];
  const discovery = parseXeroDiscovery({ handle, selectionHandle, status: 'ready', tenant, accounts }, handle)!;
  const mapping = { revenue: [accounts[0].id], processingFee: [accounts[1].id], advertising: [accounts[2].id], software: [accounts[3].id], includedCash: [accounts[4].id] };
  assert.deepEqual(validateXeroBootstrapSelection(discovery, '2026-09-25', mapping), { selectionHandle, effectiveFrom: '2026-09-25', mapping });
  assert.equal(validateXeroBootstrapSelection(discovery, '2026-02-30', mapping), null);
  assert.equal(validateXeroBootstrapSelection(discovery, '2026-09-25', { ...mapping, includedCash: [accounts[5].id] }), null);
  assert.equal(validateXeroBootstrapSelection(discovery, '2026-09-25', { ...mapping, advertising: [accounts[1].id] }), null);
  assert.equal(validateXeroBootstrapSelection(discovery, '2026-09-25', { ...mapping, revenue: [] }), null);
  assert.equal(validateXeroBootstrapSelection(discovery, '2026-09-25', { ...mapping, includedCash: [accounts[0].id] }), null);
});

test('retained bootstrap posts only the reviewed mapping and redirects only to Xero', async () => {
  const selection = { selectionHandle, effectiveFrom: '2026-09-25', mapping: { revenue: [account.id], processingFee: ['33333333-3333-4333-8333-333333333333'], advertising: ['44444444-4444-4444-8444-444444444444'], software: ['55555555-5555-4555-8555-555555555555'], includedCash: ['66666666-6666-4666-8666-666666666666'] } };
  let request: RequestInit | undefined;
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(input, '/api/xero/staging/connect'); request=init;
    return new Response(JSON.stringify({url:'https://login.xero.com/identity/connect/authorize?retained=1'}),{status:200,headers:{'content-type':'application/json'}});
  };
  assert.deepEqual(await startXeroStagingBootstrap(selection,'signed-token',fetcher),{url:'https://login.xero.com/identity/connect/authorize?retained=1'});
  assert.equal(request?.method,'POST');
  assert.equal((request?.headers as Record<string,string>).authorization,'Bearer signed-token');
  assert.equal((request?.headers as Record<string,string>)['content-type'],'application/json');
  assert.deepEqual(JSON.parse(String(request?.body)),selection);
});
