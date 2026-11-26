import test from 'node:test';
import assert from 'node:assert/strict';
import {cancelMetaAdSelection,fetchMetaAdSelection,selectMetaAdAccount} from './metaAdsApi.ts';

const storeId='22222222-2222-4222-8222-222222222222';
const token=async()=> 'synthetic-session-token';

test('Meta account choices use the protected cookie and never put the selection handle in the query',async()=>{
  let request: {url: string|URL; options?: RequestInit}|undefined;
  const result={status:'selection_required',accounts:[{accountId:'123456789',currency:'GBP',timeZone:'Europe/London'}],expiresAt:'2026-11-21T15:15:00.000Z'};
  assert.deepEqual(await fetchMetaAdSelection(storeId,undefined,{accessToken:token,fetcher:async(url,options)=>{request={url,options};return new Response(JSON.stringify(result));}}),{accounts:result.accounts,expiresAt:result.expiresAt});
  assert.equal(String(request?.url),`/api/meta-ads/selection?storeId=${storeId}`);
  assert.equal(request?.options?.credentials,'include');
  assert.equal(request?.options?.cache,'no-store');
  assert.equal(request?.options?.headers && (request.options.headers as Record<string,string>).authorization,'Bearer synthetic-session-token');
});

test('Meta account selection posts only store and account while relying on the HttpOnly cookie',async()=>{
  let request: {url: string|URL; options?: RequestInit}|undefined;
  const connected={status:'connected',accountId:'123456789',currency:'GBP',timeZone:'Europe/London',connectedAt:'2026-11-21T15:00:00.000Z'};
  await selectMetaAdAccount(storeId,'123456789',{accessToken:token,fetcher:async(url,options)=>{request={url,options};return new Response(JSON.stringify(connected));}});
  assert.equal(String(request?.url),'/api/meta-ads/select-account');
  assert.equal(request?.options?.credentials,'include');
  assert.deepEqual(JSON.parse(String(request?.options?.body)),{storeId,accountId:'123456789'});
  assert.equal(JSON.stringify(request?.options?.body).includes('selectionHandle'),false);
});

test('Meta cancellation clears the short-lived cookie through an authenticated same-origin request',async()=>{
  let request: {url: string|URL; options?: RequestInit}|undefined;
  await cancelMetaAdSelection(storeId,{accessToken:token,fetcher:async(url,options)=>{request={url,options};return new Response(JSON.stringify({status:'cancelled'}));}});
  assert.equal(String(request?.url),'/api/meta-ads/selection/cancel');
  assert.equal(request?.options?.credentials,'include');
  assert.deepEqual(JSON.parse(String(request?.options?.body)),{storeId});
});
