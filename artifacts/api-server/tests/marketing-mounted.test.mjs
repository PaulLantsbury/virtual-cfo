import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';

// Bundle actual application composition; requests remain on loopback and all
// provider report ports below are fictional. Never load a local .env file.
const root=fileURLToPath(new URL('../',import.meta.url));
const scratch=await mkdtemp(join(root,'.mounted-test-'));
const outfile=join(scratch,'app.mjs');
await build({entryPoints:[join(root,'src/app.ts')],outfile,bundle:true,platform:'node',format:'esm',packages:'external',alias:{zod:createRequire(join(root,'../../lib/api-zod/package.json')).resolve('zod'),'@workspace/api-zod':join(root,'../../lib/api-zod/src/index.ts')},logLevel:'silent'});
const {createApp}=await import(pathToFileURL(outfile));
const storeId='11111111-1111-4111-8111-111111111111';
const userId='22222222-2222-4222-8222-222222222222';
await writeFile(join(scratch,'index.html'),'<html>fictional SPA marker</html>');
async function serve(marketing,run){
 const app=createApp(undefined,undefined,scratch,undefined,undefined,undefined,undefined,undefined,undefined,marketing);
 const server=await new Promise((resolve,reject)=>{const s=app.listen(0,'127.0.0.1',error=>error?reject(error):resolve(s));});
 try{await run(`http://127.0.0.1:${server.address().port}`);}finally{await new Promise(resolve=>server.close(resolve));}
}
test('actual mounted disabled provider routes never fall through to SPA',async()=>{
 await serve({},async base=>{
  for(const provider of ['meta','google'])for(const [path,method] of [['connect','POST'],['callback','GET'],['spend','GET']]){
   const response=await fetch(`${base}/api/${provider}-ads/${path}`,{method});
   assert.equal(response.status,503);assert.match(response.headers.get('content-type'),/json/);
   assert.equal(response.headers.get('cache-control'),'no-store');
   assert.doesNotMatch(await response.text(),/fictional SPA marker/);
  }
 });
});
test('report-only Google composition authenticates and binds input without enabling OAuth',async()=>{
 const calls=[];
 const googleReport={authenticate:async auth=>{assert.equal(auth,'Bearer fictional');return {userId};},service:{readSpend:async(identity,input)=>{calls.push({identity,input});return {status:'not_connected',...input,account:null,days:[]};}}};
 await serve({googleReport},async base=>{
  const path=`${base}/api/google-ads/spend?storeId=${storeId}&from=2026-10-01&to=2026-10-14`;
  assert.equal((await fetch(path)).status,401);assert.equal(calls.length,0);
  const response=await fetch(path,{headers:{authorization:'Bearer fictional'}});
  assert.equal(response.status,200);assert.equal((await response.json()).status,'not_connected');
  assert.deepEqual(calls,[{identity:{userId},input:{storeId,from:'2026-10-01',to:'2026-10-14'}}]);
  assert.equal((await fetch(path.replace(storeId,'11111111-1111-4111-8111111111111'),{headers:{authorization:'Bearer fictional'}})).status,400);
  assert.equal(calls.length,1);
  assert.equal((await fetch(`${base}/api/google-ads/connect`,{method:'POST'})).status,503);
 });
});
test('actual production application logger strips callback query and credential headers',async()=>{
 const childFile=join(scratch,'logger-canary.mjs');
 await writeFile(childFile,`
  import {createApp} from './app.mjs';
  const app=createApp();
  const server=await new Promise((resolve,reject)=>{const s=app.listen(0,'127.0.0.1',error=>error?reject(error):resolve(s));});
  try {
   const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/meta-ads/callback?code=CANARY_CODE_PRIVATE&state=CANARY_STATE_PRIVATE&access_token=CANARY_TOKEN_PRIVATE',{
    headers:{authorization:'Bearer CANARY_AUTH_PRIVATE',cookie:'session=CANARY_COOKIE_PRIVATE'}});
   if(response.status!==503)throw Error('unexpected response');
   await response.text();
  } finally {await new Promise(resolve=>server.close(resolve));}
 `);
 const result=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[childFile],{env:{PATH:process.env.PATH??'',NODE_ENV:'production',LOG_LEVEL:'info'},stdio:['ignore','pipe','pipe']});
  let output='',errors='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>errors+=chunk);
  child.on('error',reject);child.on('close',code=>resolve({code,output,errors}));
 });
 assert.equal(result.code,0,result.errors);
 assert.doesNotMatch(result.output+result.errors,/CANARY_(?:CODE|STATE|TOKEN|AUTH|COOKIE)_PRIVATE/);
 const records=result.output.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
 assert.ok(records.some(record=>record.req?.url==='/api/meta-ads/callback'&&record.res?.statusCode===503));
});
test('mounted Meta report preserves expired saved facts and unknown days but rejects poisoned lineage',async()=>{
 const from='2026-10-01',to='2026-10-02';
 const saved={status:'available',storeId,from,to,account:{providerAccountId:'123456789',currency:'GBP',timeZone:'Europe/London'},
  days:[{date:from,coverageState:'provider_row',spendMinor:'1200',observedAt:'2026-10-03T00:00:00Z',runId:userId,runStatus:'complete',runStartedAt:'2026-10-03T00:00:00Z'},
   {date:to,coverageState:'not_collected',spendMinor:null,observedAt:null,runId:null,runStatus:null,runStartedAt:null}],
  lineage:{storeId,accountId:'123456789',connectionId:userId,from,to,version:'sha256:'+'a'.repeat(64)},
  connectionState:'expired',reauthorizationRequired:true,evidenceAvailability:'available',observationFreshness:'unknown'};
 let output=saved;
 const metaReport={authenticate:async()=>({userId,isOwner:true}),service:{readSpend:async(identity,input)=>{
  assert.deepEqual(input,{storeId,from,to});assert.equal(identity.userId,userId);return output;
 }}};
 await serve({metaReport},async base=>{
  const read=()=>fetch(`${base}/api/meta-ads/spend?storeId=${storeId}&from=${from}&to=${to}`,{headers:{authorization:'Bearer fictional'}});
  let response=await read();assert.equal(response.status,200);const value=await response.json();
  assert.deepEqual(value,saved);assert.equal(value.days[1].spendMinor,null);
  for(const poison of [{...saved,storeId:userId},{...saved,lineage:{...saved.lineage,accountId:'999999999'}},{...saved,accessToken:'PRIVATE_RESPONSE_CANARY'}]){
   output=poison;response=await read();assert.equal(response.status,404);assert.doesNotMatch(await response.text(),/PRIVATE_RESPONSE_CANARY|1200/);
  }
 });
});
test.after(async()=>rm(scratch,{recursive:true,force:true}));

test('actual app replaces native owner routers with bounded proxy while reports remain local',async()=>{
 const {createProviderProxyAdapter}=await import('../../../experiments/provider-proxy/adapter.mjs');
 const calls=[];let localReads=0;
 const ownerProxy=createProviderProxyAdapter({enabled:true,upstreamOrigin:'http://provider.invalid',approvedOrigins:['http://provider.invalid'],transport:async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify({error:'unavailable'}),{status:503});}});
 const googleReport={authenticate:async()=>({userId}),service:{readSpend:async(_identity,input)=>{localReads++;return {status:'not_connected',...input,account:null,days:[]};}}};
 await serve({ownerProxy,googleReport,google:{authenticate:()=>assert.fail('native owner router must not execute')}},async base=>{
  const owner=await fetch(`${base}/api/google-ads/status?storeId=${storeId}`,{headers:{authorization:'Bearer fictional'}});
  assert.equal(owner.status,503);assert.equal(calls.length,1);assert.equal(calls[0].url,`http://provider.invalid/api/google-ads/status?storeId=${storeId}`);
  assert.equal(calls[0].init.redirect,'manual');
  const report=await fetch(`${base}/api/google-ads/spend?storeId=${storeId}&from=2026-10-01&to=2026-10-14`,{headers:{authorization:'Bearer fictional'}});
  assert.equal(report.status,200);assert.equal(localReads,1);assert.equal(calls.length,1);
  assert.equal((await fetch(`${base}/api/meta-ads/spend`)).status,503);assert.equal(calls.length,1);
 });
});

test('actual backend two-step probe passes through website canary then closes on expiry',async()=>{
 const {createCanaryProxy}=await import('../../../experiments/provider-proxy/canary.mjs');
 const {existsSync}=await import('node:fs');
 const local=join(root,'../../deployments/provider-activation/logging-canary.mjs');
 const backend=existsSync(local)?local:join(root,'../../../night-scout-provider-activation-20261126/deployments/provider-activation/logging-canary.mjs');
 const {startLoggingCanary,probeLoggingCanary}=await import(pathToFileURL(backend));
 const expiresAt=new Date(Date.now()+60000).toISOString();let clock=Date.now(),calls=0;
 const upstream=await startLoggingCanary({enabled:true,expiresAt});
 const canaryProxy=createCanaryProxy({enabled:true,expiresAt,now:()=>clock,upstreamOrigin:upstream.targetOrigin,approvedOrigins:[upstream.targetOrigin],transport:(...args)=>{calls++;return fetch(...args);}});
 try{await serve({canaryProxy},async base=>{
  const receipt=await probeLoggingCanary({enabled:true,expiresAt,targetOrigin:base});
  assert.deepEqual(receipt,{sink:'transport',fieldCount:5,pass:true});assert.equal(calls,2);
  clock=Date.parse(expiresAt);
  assert.equal((await fetch(base+'/__night_scout_fictional_logging_canary__/capture',{method:'POST'})).status,503);assert.equal(calls,2);
 });}finally{await upstream.close();}
});
test('canary off and nonfictional input never forward or reach SPA',async()=>{
 const {createCanaryProxy}=await import('../../../experiments/provider-proxy/canary.mjs');
 const {createWebsiteCanaryProxy}=await import('../src/lib/provider-proxy-startup.mjs');
 assert.throws(()=>createWebsiteCanaryProxy({NIGHT_SCOUT_FICTIONAL_CANARY_PROXY_ENABLED:'true',NIGHT_SCOUT_PROVIDER_OWNER_PROXY_ENABLED:'true'}));
 assert.throws(()=>createWebsiteCanaryProxy({NIGHT_SCOUT_FICTIONAL_CANARY_PROXY_ENABLED:'true'}));
 assert.throws(()=>createCanaryProxy({enabled:true,upstreamOrigin:'http://unapproved.invalid',expiresAt:new Date(Date.now()+60000).toISOString()}));
 assert.throws(()=>createCanaryProxy({enabled:true,upstreamOrigin:'http://fixture.invalid',approvedOrigins:['http://fixture.invalid'],expiresAt:new Date(Date.now()+9000010).toISOString()}));
 const canaryProxy=createCanaryProxy({enabled:true,upstreamOrigin:'http://fixture.invalid',approvedOrigins:['http://fixture.invalid'],expiresAt:new Date(Date.now()+60000).toISOString(),transport:()=>assert.fail('nonfictional request forwarded')});
 for(const marketing of [{},{canaryProxy}])await serve(marketing,async base=>{
  for(const step of ['capture','failure']){
   const r=await fetch(base+'/__night_scout_fictional_logging_canary__/'+step+'?code=actual-secret',{method:'POST',headers:{authorization:'Bearer actual-secret','content-type':'application/json'},body:'{"client_secret":"actual-secret"}'});
   assert.equal(r.status,503);assert.deepEqual(await r.json(),{unavailable:true});
  }
 });
});
