import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,dirname,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import http from 'node:http';
import {validateHostEnvironment} from './host-boundary.mjs';
const here=dirname(fileURLToPath(import.meta.url)),api=resolve(here,'../../artifacts/api-server');
const require=createRequire(resolve(api,'package.json'));
let temp,createProviderApiHost;
before(async()=>{temp=await mkdtemp(join(tmpdir(),'provider-host-test-'));const outfile=join(temp,'app.mjs');await require('esbuild').build({entryPoints:[join(here,'host-app.ts')],outfile,bundle:true,platform:'node',format:'esm',nodePaths:[join(api,'node_modules')],external:['pg-native'],logLevel:'silent',banner:{js:"import {createRequire as __createRequire} from 'node:module'; const require=__createRequire(import.meta.url);"}});({createProviderApiHost}=await import(pathToFileURL(outfile).href));});
after(async()=>{await rm(temp,{recursive:true,force:true});});
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(`http://127.0.0.1:${server.address().port}`)));
const close=server=>new Promise(resolve=>server.close(resolve));
const origin='https://night-scout-xero-staging.onrender.com';
const owner='11111111-1111-4111-8111-111111111111',store='22222222-2222-4222-8222-222222222222';
const handle='s'.repeat(43),state='t'.repeat(43);

test('capability environments reject cross-role credentials and unreviewed retry',()=>{
 const cases=[['website-report','NIGHT_SCOUT_META_ADS_ENVELOPE_MASTER_KEY'],['website-report','NIGHT_SCOUT_GOOGLE_ADS_CLIENT_SECRET'],['private-api','NIGHT_SCOUT_META_ADS_REPORT_DATABASE_URL'],['private-api','NIGHT_SCOUT_GOOGLE_ADS_COLLECTOR_DATABASE_URL'],['meta-collector','NIGHT_SCOUT_META_ADS_API_DATABASE_URL'],['meta-collector','NIGHT_SCOUT_GOOGLE_ADS_COLLECTOR_DATABASE_URL'],['google-collector','NIGHT_SCOUT_GOOGLE_ADS_REPORT_DATABASE_URL']];
 for(const [profile,key] of cases)assert.throws(()=>validateHostEnvironment(profile,{[key]:'fictional-do-not-output'}),/unavailable/);
 for(const key of ['DATABASE_URL','SUPABASE_SERVICE_ROLE_KEY','NODE_OPTIONS','RENDER_API_KEY','GOOGLE_APPLICATION_CREDENTIALS','AWS_SECRET_ACCESS_KEY','NIGHT_SCOUT_XERO_CLIENT_SECRET'])assert.throws(()=>validateHostEnvironment('private-api',{[key]:'fictional'}));
 assert.throws(()=>validateHostEnvironment('google-collector',{NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_RETRY_ORDINAL:'1'}));
 assert.equal(validateHostEnvironment('website-report',{NIGHT_SCOUT_META_ADS_REPORT_DATABASE_URL:'fictional',NIGHT_SCOUT_META_ADS_API_RUNTIME_ENABLED:'false'}).canExecute,false);
 let getterCalled=false;assert.throws(()=>validateHostEnvironment('private-api',Object.defineProperty({},'SECRET',{get(){getterCalled=true;return 'x';}})));assert.equal(getterCalled,false);
});

test('disabled host starts no runtimes and has no report or unrelated application route',async()=>{
 const host=await createProviderApiHost({}, {meta:()=>{throw Error('must not run');},google:()=>{throw Error('must not run');}});
 const server=http.createServer(host.app),url=await listen(server);
 try{assert.equal((await(await fetch(url+'/health')).json()).status,'disabled');assert.equal((await fetch(url+'/api/google-ads/status')).status,503);for(const path of ['/api/google-ads/spend','/api/meta-ads/spend','/settings','/api/xero'])assert.equal((await fetch(url+path)).status,404);}finally{await close(server);await host.close();}
});

test('failed second runtime startup closes first pool without leaking error text',async()=>{
 let closed=0;await assert.rejects(createProviderApiHost({NIGHT_SCOUT_PROVIDER_API_HOST_ENABLED:'true'},{meta:async()=>({close:async()=>{closed++;}}),google:async()=>{throw Error('fictional-secret');}}),/^Error: Provider API host unavailable$/);assert.equal(closed,1);
});

test('same-origin proxy composition preserves callback cookie, relative redirect and owner account selection',async()=>{
 const calls=[];
 const google={close:async()=>{},allowedOrigins:[origin],authenticate:async value=>{assert.equal(value,'Bearer fictional-session');return {userId:owner,isOwner:true};},service:{complete:async input=>{calls.push(input);return {status:'account_selection_required',selectionHandle:handle};},selectAccount:async(identity,input)=>{assert.equal(identity.userId,owner);assert.equal(input.selectionHandle,handle);assert.equal(input.storeId,store);return {status:'connected',customerId:'1234567890',loginCustomerId:null,currency:'GBP',timeZone:'Europe/London',connectedAt:'2026-11-26T12:00:00Z'};}}};
 const host=await createProviderApiHost({NIGHT_SCOUT_PROVIDER_API_HOST_ENABLED:'true'},{meta:async()=>({close:async()=>{},allowedOrigins:[origin],authenticate:google.authenticate,service:{complete:async()=>({status:'account_selection_required',selectionHandle:handle})}}),google:async()=>google});
 const upstream=http.createServer(host.app),upstreamUrl=await listen(upstream);
 // Fictional transparent proxy only. Production pages proxy must independently implement/review its allowlist.
 const proxy=http.createServer((req,res)=>{if(req.url==='/api/google-ads/spend'){res.end('website-report');return;}const request=http.request(new URL(req.url,upstreamUrl),{method:req.method,headers:req.headers},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});request.on('error',()=>res.end());req.pipe(request);});
 const publicUrl=await listen(proxy);
 try{
  const metaCallback=await fetch(`${publicUrl}/api/meta-ads/callback?state=${state}&code=fictional-code`,{redirect:'manual'});
  assert.equal(metaCallback.status,303);assert.equal(metaCallback.headers.get('location'),'/settings?metaSelection=select');assert.match(metaCallback.headers.get('set-cookie'),/Path=\/api\/meta-ads; HttpOnly; Secure; SameSite=Lax/);assert.doesNotMatch(metaCallback.headers.get('set-cookie'),/Domain=/i);
  const callback=await fetch(`${publicUrl}/api/google-ads/callback?state=${state}&code=fictional-code`,{redirect:'manual'});
  assert.equal(callback.status,303);assert.equal(callback.headers.get('location'),'/settings?googleAds=select');
  const cookie=callback.headers.get('set-cookie');assert.match(cookie,/Path=\/api\/google-ads; HttpOnly; Secure; SameSite=Lax/);assert.doesNotMatch(cookie,/Domain=/i);assert.equal(calls[0].state,state);
  const response=await fetch(publicUrl+'/api/google-ads/select-account',{method:'POST',headers:{Origin:origin,Authorization:'Bearer fictional-session',Cookie:cookie.split(';')[0],'Content-Type':'application/json'},body:JSON.stringify({storeId:store,customerId:'1234567890'})});assert.equal(response.status,200);assert.equal((await response.json()).status,'connected');
  const wrong=await fetch(publicUrl+'/api/google-ads/select-account',{method:'POST',headers:{Origin:'https://wrong.invalid',Authorization:'Bearer fictional-session','Content-Type':'application/json'},body:'{}'});assert.equal(wrong.status,403);
  assert.equal(await(await fetch(publicUrl+'/api/google-ads/spend')).text(),'website-report');assert.equal((await fetch(upstreamUrl+'/api/google-ads/spend')).status,404);
 }finally{await close(proxy);await close(upstream);await host.close();}
});
