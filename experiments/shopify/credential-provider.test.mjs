import test from 'node:test';
import assert from 'node:assert/strict';
import {createShopifyCredentialProvider} from './credential-provider.mjs';
const domain='night-scout-test.myshopify.com';
const credentials={clientId:'synthetic-client',clientSecret:'synthetic-secret'};
const result=(extra={})=>({ok:true,redirected:false,json:async()=>({access_token:'synthetic-token',expires_in:86400,...extra})});
const provider=overrides=>createShopifyCredentialProvider({domain,loadCredentials:async()=>credentials,fetchImpl:async()=>result(),...overrides});

test('fixed HTTPS token endpoint, encoded private POST body, no redirect, cached token',async()=>{
 let requests=0,loads=0;
 const p=provider({loadCredentials:async()=>{loads++;return {...credentials,clientSecret:'synthetic+&=secret'};},fetchImpl:async(url,options)=>{
  requests++;assert.equal(url,`https://${domain}/admin/oauth/access_token`);assert.equal(options.method,'POST');assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);
  assert.deepEqual(Object.fromEntries(new URLSearchParams(options.body)),{grant_type:'client_credentials',client_id:credentials.clientId,client_secret:'synthetic+&=secret'});
  assert.equal(options.headers['Content-Type'],'application/x-www-form-urlencoded');return result();
 }});
 assert.equal(await p.resolveCredential({domain}),'synthetic-token');assert.equal(await p.resolveCredential(),'synthetic-token');assert.equal(requests,1);assert.equal(loads,1);
 assert.deepEqual(Object.keys(p).sort(),['invalidate','resolveCredential']);assert.equal(JSON.stringify(p),'{}');
});

test('rejects URL injection, noncanonical stores and mismatched lookup before reading secrets',async()=>{
 for(const bad of ['https://test.myshopify.com','test.myshopify.com.evil.test','test.myshopify.com/x','test.myshopify.com:443','TEST.myshopify.com','test-.myshopify.com','a'.repeat(64)+'.myshopify.com'])assert.throws(()=>provider({domain:bad}),/configuration/);
 let loads=0;const p=provider({loadCredentials:async()=>{loads++;return credentials;}});
 await assert.rejects(p.resolveCredential({domain:'other.myshopify.com'}),/store mismatch/);assert.equal(loads,0);
});

test('refreshes at expiry margin and reloads rotated credentials; invalidation forces refresh',async()=>{
 let clock=100000,loads=0;
 const p=provider({now:()=>clock,loadCredentials:async()=>({...credentials,clientSecret:`rotated-${++loads}`}),fetchImpl:async(_url,options)=>result({access_token:new URLSearchParams(options.body).get('client_secret')})});
 assert.equal(await p.resolveCredential(),'rotated-1');clock+=86339*1000;assert.equal(await p.resolveCredential(),'rotated-1');clock+=1000;assert.equal(await p.resolveCredential(),'rotated-2');
 p.invalidate();assert.equal(await p.resolveCredential(),'rotated-3');assert.equal(loads,3);
});

test('concurrent callers share one token exchange; caller cancellation is isolated',async()=>{
 let finish,calls=0;const waiting=new Promise(resolve=>{finish=resolve;});
 const p=provider({fetchImpl:async()=>{calls++;await waiting;return result();}});
 const controller=new AbortController();const first=p.resolveCredential({domain},{signal:controller.signal});const second=p.resolveCredential();controller.abort('private cancellation detail');
 await assert.rejects(first,{message:'Shopify authentication cancelled'});finish();assert.equal(await second,'synthetic-token');assert.equal(calls,1);
});

test('invalidated in-flight exchange cannot republish revoked token or clear newer cache',async()=>{
 let finish,calls=0;const waiting=new Promise(resolve=>{finish=resolve;});
 const p=provider({fetchImpl:async()=>{if(++calls===1){await waiting;return result({access_token:'old-token'});}return result({access_token:'new-token'});}});
 const old=p.resolveCredential();await Promise.resolve();p.invalidate();assert.equal(await p.resolveCredential(),'new-token');finish();await assert.rejects(old,/authentication unavailable/);assert.equal(await p.resolveCredential(),'new-token');assert.equal(calls,2);
});

test('rejects malformed token/lifetime, denied access, redirects and invalid JSON without echoing secrets',async()=>{
 for(const fetchImpl of [async()=>({ok:false,json:async()=>{throw Error('synthetic-secret');}}),async()=>({...result(),redirected:true}),async()=>{throw Error('synthetic-secret');},async()=>({...result(),json:async()=>{throw Error('synthetic-secret');}}),...[
  {access_token:''},{access_token:'bad\ntoken'},{expires_in:'86400'},{expires_in:0},{expires_in:60},{expires_in:86401},{expires_in:NaN},
 ].map(extra=>async()=>result(extra))]){
  const p=provider({fetchImpl});await assert.rejects(p.resolveCredential(),{message:'Shopify authentication unavailable; check private credentials and app installation'});
 }
 const p=provider({loadCredentials:async()=>{throw Error('synthetic-secret');}});await assert.rejects(p.resolveCredential(),/authentication unavailable/);
});

test('timeout bounds credential loading and response body; timed-out work cannot populate cache',async()=>{
 for(const phase of ['load','body']){
  let finish,calls=0;const waiting=new Promise(resolve=>{finish=resolve;});
  const p=provider({timeoutMs:100,loadCredentials:async()=>{if(phase==='load'&&++calls===1)await waiting;return credentials;},fetchImpl:async()=>({...result(),json:async()=>{if(phase==='body'&&++calls===1)await waiting;return {access_token:'synthetic-token',expires_in:86400};}})});
  await assert.rejects(p.resolveCredential(),/authentication unavailable/);finish();await new Promise(resolve=>setImmediate(resolve));assert.equal(await p.resolveCredential(),'synthetic-token');assert.equal(calls,2);
 }
});

test('pre-aborted calls do not load secrets; failed refresh never returns stale token',async()=>{
 let clock=0,calls=0;const p=provider({now:()=>clock,fetchImpl:async()=>{if(++calls>1)throw Error('private');return result();}});
 const controller=new AbortController();controller.abort();await assert.rejects(p.resolveCredential({domain},{signal:controller.signal}),/cancelled/);assert.equal(calls,0);
 assert.equal(await p.resolveCredential(),'synthetic-token');clock=86400000;await assert.rejects(p.resolveCredential(),/unavailable/);await assert.rejects(p.resolveCredential(),/unavailable/);assert.equal(calls,3);
});
