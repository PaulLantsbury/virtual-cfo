import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchXeroMerchantReadiness, parseCashControlReadiness } from './xeroMerchantApi.ts';

const id = '11111111-1111-4111-8111-111111111111';
const ready = { storeId: id, state: 'ready', asOf: '2026-09-18T18:00:00.000Z' };

test('cash readiness accepts a bounded, value-free same-store status shape', () => {
  const parsed = parseCashControlReadiness(ready);
  assert.deepEqual(parsed, ready);
  assert.equal(Object.isFrozen(parsed), true);
});

test('cash readiness rejects amounts, cross-store retention and invalid ready evidence', () => {
  for (const invalid of [
    { ...ready, balance: 10320 },
    { ...ready, state: 'ready', asOf: null },
    { ...ready, retainedStoreId: 'not-a-store-id' },
    { ...ready, detail: 'x'.repeat(501) },
    { ...ready, state: 'unknown' },
  ]) assert.equal(parseCashControlReadiness(invalid), null);
});

test('merchant readiness uses a fresh bearer token and validates the requested store',async()=>{
 const connection={status:'active',scopeVersion:'read-only-v1',createdAt:'2026-09-18T12:00:00.000Z',lastSuccessAt:null,lastFailureAt:null,mappingReviewRequired:false};
 let input:RequestInfo|URL|undefined,request:RequestInit|undefined;
 const fetcher=async(value:RequestInfo|URL,init?:RequestInit)=>{input=value;request=init;return new Response(JSON.stringify({storeId:id,connection,evidenceState:'unavailable',evidenceRetrievedAt:null}),{status:200,headers:{'content-type':'application/json'}});};
 const value=await fetchXeroMerchantReadiness(id,undefined,{fetcher,accessToken:async()=> 'fresh-token'});
 assert.equal(value.connection?.status,'active');assert.equal(input,`/api/xero/merchant-readiness?storeId=${id}`);
 assert.equal((request?.headers as Record<string,string>).authorization,'Bearer fresh-token');assert.equal(request?.cache,'no-store');
});
