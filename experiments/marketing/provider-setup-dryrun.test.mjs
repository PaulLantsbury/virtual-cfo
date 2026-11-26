// Offline sequence proof using actual web composition and actual report constructors.
// Explicit local source only; all pool/auth/network ports are fail-closed doubles.
import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=process.env.NIGHT_SCOUT_PROVIDER_SOURCE_ROOT ?? fileURLToPath(new URL('../../',import.meta.url));
const load=name=>import(pathToFileURL(join(root,'artifacts/api-server/src/lib',name)));
const {startMarketingProviderRuntime}=await load('marketing-provider-startup.mjs');
const {createMetaAdsRuntime}=await load('meta-ads-runtime.mjs');
const {createGoogleAdsRuntime}=await load('google-ads-runtime.mjs');
const {createMetaAdsReportRuntime}=await load('meta-ads-report-runtime.mjs');
const {createGoogleAdsReportRuntime}=await load('google-ads-report-runtime.mjs');
const project='bioalckltvkhlczusdvl';
const owner='11111111-1111-4111-8111-111111111111',store='22222222-2222-4222-8222-222222222222';
function env(){
 const v={NIGHT_SCOUT_RUNTIME_ENV:'staging',NIGHT_SCOUT_STAGING_CA_PEM:'-----BEGIN CERTIFICATE-----\nfictional-ca\n-----END CERTIFICATE-----',NIGHT_SCOUT_REVIEW_AUTH_URL:`https://${project}.supabase.co`,NIGHT_SCOUT_REVIEW_PUBLIC_KEY:'fictional-publishable-key-not-a-real-secret'};
 for(const provider of ['META','GOOGLE']){
  v[`NIGHT_SCOUT_${provider}_ADS_REPORT_RUNTIME_ENABLED`]='true';
  v[`NIGHT_SCOUT_${provider}_ADS_STAGING_PROJECT_REF`]=project;
  v[`NIGHT_SCOUT_${provider}_ADS_STAGING_OWNER_ID`]=owner;
  v[`NIGHT_SCOUT_${provider}_ADS_STAGING_STORE_ID`]=store;
  v[`NIGHT_SCOUT_${provider}_ADS_REPORT_DATABASE_URL`]=`postgresql://night_scout_${provider.toLowerCase()}_ads_report_login:fictional-password@db.${project}.supabase.co:5432/postgres`;
 }
 return new Proxy(v,{get(target,key){assert.doesNotMatch(String(key),/APP_SECRET|CLIENT_SECRET|ENVELOPE|PKCE/,'report-only process must not read OAuth/envelope secrets');return target[key];}});
}
function harness(wrongGoogleRole=false){
 const events=[];
 const deps=provider=>({
  createPool(options){
   assert.equal(options.ssl.rejectUnauthorized,true);assert.equal(options.max,1);
   assert.match(options.connectionString,new RegExp(`night_scout_${provider}_ads_report_login:`));
   events.push(`${provider}:open`);
   return {query:async sql=>{
    assert.equal(sql,'SELECT session_user::text AS session_user, current_user::text AS current_user','setup may only attest role identity');
    events.push(`${provider}:identity`);
    const role=wrongGoogleRole&&provider==='google'?'night_scout_google_ads_api_login':`night_scout_${provider}_ads_report_login`;
    return {rows:[{session_user:role,current_user:role}]};
   },end:async()=>events.push(`${provider}:close`)};
  },
  createAuthClient(){return {auth:{getUser:async()=>assert.fail('setup must not authenticate an operator')}};},
  fetchImpl:async()=>assert.fail('setup must not contact Auth or providers'),
 });
 return {events,factories:{meta:e=>createMetaAdsRuntime(e,deps('meta')),metaReport:e=>createMetaAdsReportRuntime(e,deps('meta')),google:e=>createGoogleAdsRuntime(e,deps('google')),googleReport:e=>createGoogleAdsReportRuntime(e,deps('google'))}};
}
test('report-only setup uses distinct attested roles, no OAuth secrets/actions, then closes once',async()=>{
 const h=harness();const runtime=await startMarketingProviderRuntime(env(),h.factories);
 assert.deepEqual(Object.keys(runtime.routes),['metaReport','googleReport']);
 assert.deepEqual(h.events,['meta:open','meta:identity','google:open','google:identity']);
 await runtime.close();await runtime.close();
 assert.deepEqual(h.events.slice(4).sort(),['google:close','meta:close']);
});
test('wrong later role aborts whole setup and closes both current and prior pools',async()=>{
 const h=harness(true);
 await assert.rejects(startMarketingProviderRuntime(env(),h.factories),{message:'Marketing provider configuration unavailable'});
 assert.deepEqual(h.events,['meta:open','meta:identity','google:open','google:identity','google:close','meta:close']);
});
test('cross-provider report URL refuses before opening wrong pool and cleans earlier provider',async()=>{
 const h=harness();const config=env();config.NIGHT_SCOUT_GOOGLE_ADS_REPORT_DATABASE_URL=config.NIGHT_SCOUT_META_ADS_REPORT_DATABASE_URL;
 await assert.rejects(startMarketingProviderRuntime(config,h.factories),/configuration unavailable/);
 assert.deepEqual(h.events,['meta:open','meta:identity','meta:close']);
});
test('disable and restart remains inert even if legacy collector flags are present',async()=>{
 const h=harness();const first=await startMarketingProviderRuntime(env(),h.factories);await first.close();
 h.events.length=0;
 const disabled=new Proxy({NIGHT_SCOUT_META_ADS_COLLECTOR_RUNTIME_ENABLED:'true',NIGHT_SCOUT_GOOGLE_ADS_COLLECTOR_RUNTIME_ENABLED:'true'},{get(target,key){assert.match(String(key),/^NIGHT_SCOUT_(META|GOOGLE)_ADS_(API|REPORT)_RUNTIME_ENABLED$/);return target[key];}});
 const restarted=await startMarketingProviderRuntime(disabled,h.factories);
 assert.deepEqual(restarted.routes,{});assert.deepEqual(h.events,[]);await restarted.close();
});
