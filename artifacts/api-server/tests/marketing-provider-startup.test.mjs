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
test('website proxy requires explicit true despite fixed verified target',async()=>{
 const {createWebsiteOwnerProxy}=await import('../src/lib/provider-proxy-startup.mjs');
 assert.equal(createWebsiteOwnerProxy({}),undefined);
 assert.equal(createWebsiteOwnerProxy({NIGHT_SCOUT_PROVIDER_OWNER_PROXY_ENABLED:'false'}),undefined);
 assert.equal(typeof createWebsiteOwnerProxy({NIGHT_SCOUT_PROVIDER_OWNER_PROXY_ENABLED:'true'}),'function');
 assert.throws(()=>createWebsiteOwnerProxy({NIGHT_SCOUT_PROVIDER_OWNER_PROXY_ENABLED:'yes'}));
});

test('owner forwarding stays fixed despite environment target overrides, without real network',async()=>{
 const {Readable}=await import('node:stream');const {EventEmitter}=await import('node:events');
 const {createWebsiteOwnerProxy,WEBSITE_PRIVATE_PROVIDER_ORIGIN}=await import('../src/lib/provider-proxy-startup.mjs');
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,init)=>{calls.push({url,init});return new Response('{"status":"available","connections":[]}',{headers:{'content-type':'application/json'}});};
 try{
  const proxy=createWebsiteOwnerProxy({NIGHT_SCOUT_PROVIDER_OWNER_PROXY_ENABLED:'true',NIGHT_SCOUT_PROVIDER_PRIVATE_ORIGIN:'https://evil.invalid',WEBSITE_PRIVATE_PROVIDER_ORIGIN:'https://evil.invalid'});
  assert.equal(calls.length,0,'constructing the explicitly enabled adapter does not call the host');
  const path='/api/meta-ads/status?storeId=11111111-1111-4111-8111-111111111111';
  const req=Readable.from([]);Object.assign(req,{method:'GET',originalUrl:path,headers:{authorization:'Bearer fictional'},rawHeaders:[]});
  const res=new EventEmitter();Object.assign(res,{destroyed:false,writableEnded:false,writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=body;this.writableEnded=true;}});
  await proxy(req,res);assert.equal(res.status,200);assert.equal(calls.length,1);assert.equal(calls[0].url,WEBSITE_PRIVATE_PROVIDER_ORIGIN+path);assert.equal(calls[0].init.redirect,'manual');
 }finally{globalThis.fetch=original;}
});

test('verified host does not bypass finite canary mode or provider-secret separation',async()=>{
 const {createWebsiteCanaryProxy,createWebsiteOwnerProxy}=await import('../src/lib/provider-proxy-startup.mjs');
 assert.equal(createWebsiteCanaryProxy({}),undefined);
 const enabled={NIGHT_SCOUT_FICTIONAL_CANARY_PROXY_ENABLED:'true',NIGHT_SCOUT_FICTIONAL_CANARY_EXPIRES_AT:new Date(Date.now()+60000).toISOString()};
 assert.equal(typeof createWebsiteCanaryProxy(enabled),'function');
 assert.throws(()=>createWebsiteCanaryProxy({...enabled,NIGHT_SCOUT_PROVIDER_OWNER_PROXY_ENABLED:'true'}));
 assert.throws(()=>createWebsiteCanaryProxy({...enabled,NIGHT_SCOUT_FICTIONAL_CANARY_EXPIRES_AT:new Date(Date.now()-1000).toISOString()}));
 assert.throws(()=>createWebsiteCanaryProxy({...enabled,NIGHT_SCOUT_GOOGLE_ADS_CLIENT_SECRET:'fictional'}));
 assert.throws(()=>createWebsiteOwnerProxy({NIGHT_SCOUT_PROVIDER_OWNER_PROXY_ENABLED:'true',NIGHT_SCOUT_META_ADS_API_DATABASE_URL:'fictional'}));
});
