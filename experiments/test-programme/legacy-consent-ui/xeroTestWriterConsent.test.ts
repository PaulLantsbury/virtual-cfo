import test from 'node:test';
import assert from 'node:assert/strict';
import { startXeroTestWriterConsent, writerConsentVisible } from './xeroTestWriterConsent.ts';
const owner='90000000-0000-4000-8000-000000000001',store='90000000-0000-4000-8000-000000000002';
const gate={enabled:'true',ownerId:owner,configuredStoreId:store,userId:owner,storeId:store,origin:'https://night-scout-xero-staging.onrender.com'};
test('consent UI defaults off and requires exact staging owner and selected store',()=>{
  assert.equal(writerConsentVisible(gate),true);
  for(const change of [{enabled:undefined},{ownerId:undefined},{configuredStoreId:undefined},{userId:store},{storeId:owner},{origin:'https://example.com'}])assert.equal(writerConsentVisible({...gate,...change}),false);
});
test('same-origin authenticated consent carries an empty body and only accepts pinned Xero authorize/callback',async()=>{
  const url=new URL('https://login.xero.com/identity/connect/authorize');url.searchParams.set('response_type','code');url.searchParams.set('redirect_uri',`${gate.origin}/api/xero/test-writer/callback`);
  const fetcher:typeof fetch=async(input,init)=>{assert.equal(input,'/api/xero/test-writer/connect');assert.equal(init?.body,'{}');assert.equal(init?.redirect,'error');assert.equal(init?.cache,'no-store');assert.equal((init?.headers as Record<string,string>).authorization,'Bearer opaque-session');return Response.json({url:url.toString()});};
  assert.equal(await startXeroTestWriterConsent('opaque-session',fetcher),url.toString());
  const wrongCallback=new URL(url);wrongCallback.searchParams.set('redirect_uri',`${gate.origin}/api/xero/staging/callback`);
  for(const bad of ['https://evil.example/','https://login.xero.com.evil.example/identity/connect/authorize',wrongCallback.toString(),url.toString().replace('login.xero.com','user:pass@login.xero.com')])await assert.rejects(startXeroTestWriterConsent('opaque-session',async()=>Response.json({url:bad})));
  await assert.rejects(startXeroTestWriterConsent('bad token',fetcher));
});
test('disabled/error responses never surface provider text or secrets',async()=>{
  await assert.rejects(startXeroTestWriterConsent('opaque-session',async()=>new Response('secret-provider-error',{status:503})),error=>error instanceof Error&&!error.message.includes('secret-provider-error'));
});
