import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchXeroAccountingPeriod} from './xeroAccountingApi.ts';
const scope = {storeId:'11111111-1111-4111-8111-111111111111',from:'2026-10-01',to:'2026-10-08',currency:'GBP'};
const accounting = {basis:'accrual_p_and_l',currency:'GBP',asOf:scope.to,retrievedAt:'2026-10-09T12:00:00Z',mappingVersionId:'22222222-2222-4222-8222-222222222222',closedPeriod:false,bookedRevenueMinor:'12345',processingFeesMinor:'100',advertisingMinor:'200',softwareMinor:'300'};
const value = {storeId:scope.storeId,scope:{from:scope.from,to:scope.to,currency:'GBP'},state:'available',reason:null,accounting,cash:null,shopifyComparison:'not_requested'};
const token = async () => 'synthetic-token';
test('exact partial accounting period uses member bearer and no-store same-origin request',async () => {
  let request;
  assert.deepEqual(await fetchXeroAccountingPeriod(scope,undefined,{accessToken:token,fetcher:async(url,options)=>{request={url,options};return new Response(JSON.stringify(value));}}),value);
  assert.equal(request.url,`/api/xero/accounting-period?storeId=${scope.storeId}&from=2026-10-01&to=2026-10-08&currency=GBP`);
  assert.equal(request.options.headers.authorization,'Bearer synthetic-token');
  assert.equal(request.options.cache,'no-store');
});
test('cross-store, cross-period, currency, expanded, malformed and open stale replies are rejected',async () => {
  for (const payload of [ {...value,storeId:'33333333-3333-4333-8333-333333333333'}, {...value,scope:{...value.scope,to:'2026-10-09'}}, {...value,accounting:{...accounting,currency:'USD'}}, {...value,secret:'hidden'}, {...value,accounting:{...accounting,bookedRevenueMinor:'1.1'}}, {...value,state:'stale',reason:'source_refresh_failed'}]) {
    await assert.rejects(fetchXeroAccountingPeriod(scope,undefined,{accessToken:token,fetcher:async()=>new Response(JSON.stringify(payload))}));
  }
});
test('review required cannot carry amounts; safe unavailable and retained closed snapshot are supported',async () => {
  const unavailable = {...value,state:'review_required',reason:'account_mapping_review_required',accounting:null};
  assert.deepEqual(await fetchXeroAccountingPeriod(scope,undefined,{accessToken:token,fetcher:async()=>new Response(JSON.stringify(unavailable))}),unavailable);
  await assert.rejects(fetchXeroAccountingPeriod(scope,undefined,{accessToken:token,fetcher:async()=>new Response(JSON.stringify({...unavailable,accounting}))}));
  const stale={...value,state:'stale',reason:'source_refresh_failed',accounting:{...accounting,closedPeriod:true}};
  assert.deepEqual(await fetchXeroAccountingPeriod(scope,undefined,{accessToken:token,fetcher:async()=>new Response(JSON.stringify(stale))}),stale);
});
test('failed and aborted requests never return an accounting result',async () => {
  await assert.rejects(fetchXeroAccountingPeriod(scope,undefined,{accessToken:token,fetcher:async()=>new Response('{}',{status:503})}));
  const controller = new AbortController();controller.abort();
  await assert.rejects(fetchXeroAccountingPeriod(scope,controller.signal,{accessToken:token,fetcher:async()=>{assert.fail('aborted request fetched');}}));
});
