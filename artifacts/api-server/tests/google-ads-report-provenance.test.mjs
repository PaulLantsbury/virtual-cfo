import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
const expressStub=`export function Router(){return {gets:new Map(),use(){return this},get(path,handler){this.gets.set(path,handler);return this}}}`;
registerHooks({resolve(specifier,context,next){if(specifier==='express')return {url:`data:text/javascript,${encodeURIComponent(expressStub)}`,shortCircuit:true};return next(specifier,context);}});
const root=process.env.NIGHT_SCOUT_GOOGLE_BOUNDARY_BASE?pathToFileURL(process.env.NIGHT_SCOUT_GOOGLE_BOUNDARY_BASE+'/'):new URL('../../../',import.meta.url);
const {createGoogleAdsSpendReportRepository}=await import(new URL('experiments/marketing/google-ads-report-repository.mjs',root));
const {createGoogleAdsSpendReportRouter}=await import(new URL('artifacts/api-server/src/routes/google-ads-spend-report.ts',root));
const userId='11111111-1111-4111-8111-111111111111',storeId='22222222-2222-4222-8222-222222222222',runId='33333333-3333-4333-8333-333333333333';
const from='2026-11-20',to=from;
const invalid=['2026-02-30T09:00:00Z','2026-11-20T24:00:00Z','2026-11-20','2026-11-20T09:60:00Z','2026-11-20T09:00:00+14:01','2026-11-20T09:00:00+15:00'];
const row=()=>({customer_id:'1234567890',login_customer_id:null,currency:'GBP',timezone_name:'Europe/London',spend_date:from,coverage_state:'provider_row',spend_micros:'1200',observed_at:'2026-11-21T09:00:00.123456Z',run_id:runId,run_status:'complete',run_started_at:'2026-11-21T08:59:00Z'});
test('Google report repository refuses timestamp repair before public provenance normalization',async()=>{
 let current=row();const repository=createGoogleAdsSpendReportRepository({rpc:{call:async()=>[current]},now:()=>new Date('2026-11-21T12:00:00Z')});
 const read=()=>repository.readSpend({userId},{storeId,from,to});
 assert.equal((await read()).days[0].spendMicros,'1200');
 for(const field of ['observed_at','run_started_at'])for(const value of invalid){current=row();current[field]=value;await assert.rejects(read(),/unavailable/,field+value);}
 for(const observed of ['2024-02-29T12:00:00.123456+01:00','2026-11-21T09:00:00-14:00',new Date('2026-11-21T09:00:00Z')]){current=row();current.observed_at=observed;assert.equal((await read()).days[0].observedAt,new Date(observed).toISOString());}
});
test('Google report route denies malformed service timestamps without serializing them',async()=>{
 const fixture=()=>({status:'available',storeId,from,to,account:{customerId:'1234567890',currency:'GBP',timeZone:'Europe/London'},days:[{date:from,coverageState:'provider_row',spendMicros:'1200',observedAt:'2026-11-21T09:00:00Z',runId,runStatus:'complete',runStartedAt:'2026-11-21T08:59:00Z'}]});
 let result=fixture();const router=createGoogleAdsSpendReportRouter({authenticate:async()=>({userId}),service:{readSpend:async()=>result}});
 const call=async()=>{const res={code:200,body:null,status(n){this.code=n;return this},json(v){this.body=v;return this}};await router.gets.get('/spend')({query:{storeId,from,to},headers:{authorization:'Bearer fictional'}},res);return res;};
 assert.equal((await call()).code,200);
 for(const field of ['observedAt','runStartedAt'])for(const value of invalid){result=fixture();result.days[0][field]=value;const response=await call();assert.equal(response.code,503,field+value);assert.deepEqual(response.body,{error:'Google Ads spend reporting unavailable'});}
 result=fixture();result.days[0].observedAt='2024-02-29T12:00:00.123456+01:00';assert.equal((await call()).code,200);
});
