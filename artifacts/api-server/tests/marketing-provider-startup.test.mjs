import test from 'node:test';
import assert from 'node:assert/strict';
import {startMarketingProviderRuntime} from '../src/lib/marketing-provider-startup.mjs';

test('all provider web runtimes default off without reading private configuration', async () => {
  const env = new Proxy({}, {get(_target, key) {
    assert.match(String(key), /^NIGHT_SCOUT_(META|GOOGLE)_ADS_(API|REPORT)_RUNTIME_ENABLED$/);
    return undefined;
  }});
  const runtime = await startMarketingProviderRuntime(env);
  assert.deepEqual(runtime.routes, {});
  await runtime.close();
});

test('partial startup failure closes every opened provider and hides upstream secrets', async () => {
  const closed = [];
  const factories = {
    meta: async () => ({service: {}, close: async () => {closed.push('meta'); throw Error('private cleanup');}}),
    metaReport: async () => ({service: {}, close: async () => {closed.push('report');}}),
    google: async () => {throw Error('secret=fictional-canary');},
    googleReport: async () => {assert.fail('must not continue after failed startup');},
  };
  await assert.rejects(startMarketingProviderRuntime({}, factories), {message:'Marketing provider configuration unavailable'});
  assert.deepEqual(closed.sort(), ['meta','report']);
});

test('composition exposes only route ports and closes each runtime once', async () => {
  const closed = [];
  const factories = Object.fromEntries(['meta','metaReport','google','googleReport'].map(name => [name, async () => ({
    service: {name}, authenticate: () => {}, allowedOrigins: ['https://example.invalid'],
    privateCredential: 'fictional-canary', close: async () => {closed.push(name);},
  })]));
  const runtime = await startMarketingProviderRuntime({}, factories);
  assert.equal(Object.keys(runtime.routes).length,4);
  assert.doesNotMatch(JSON.stringify(runtime.routes), /privateCredential|fictional-canary/);
  await runtime.close();
  await runtime.close();
  assert.equal(closed.length,4);
});

test('report-only mode never constructs API runtimes and refuses misplaced capability secrets',async()=>{
 const called=[];
 const factories=Object.fromEntries(['meta','google','metaReport','googleReport'].map(name=>[name,async()=>{called.push(name);return undefined;}]));
 await startMarketingProviderRuntime({},factories,{reportOnly:true});
 assert.deepEqual(called,['metaReport','googleReport']);
 for(const suffix of ['API_DATABASE_URL','API_RUNTIME_ENABLED','COLLECTOR_DATABASE_URL','APP_SECRET','CLIENT_SECRET','PKCE_KEY','ENVELOPE_MASTER_KEY']){
  called.length=0;
  await assert.rejects(startMarketingProviderRuntime({['NIGHT_SCOUT_META_ADS_'+suffix]:suffix.endsWith('ENABLED')?'true':'fictional'},factories,{reportOnly:true}));
  assert.deepEqual(called,[]);
 }
});
test('website proxy explicit flag cannot activate without fixed approved target',async()=>{
 const {createWebsiteOwnerProxy}=await import('../src/lib/provider-proxy-startup.mjs');
 assert.equal(createWebsiteOwnerProxy({}),undefined);
 assert.equal(createWebsiteOwnerProxy({NIGHT_SCOUT_PROVIDER_OWNER_PROXY_ENABLED:'false'}),undefined);
 assert.throws(()=>createWebsiteOwnerProxy({NIGHT_SCOUT_PROVIDER_OWNER_PROXY_ENABLED:'true'}));
 assert.throws(()=>createWebsiteOwnerProxy({NIGHT_SCOUT_PROVIDER_OWNER_PROXY_ENABLED:'yes'}));
});
