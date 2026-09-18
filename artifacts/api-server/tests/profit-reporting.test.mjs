// Independent HTTP/service tests against disposable real mapped fixtures only.
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import {createProfitReportingRouter} from '../src/routes/profit-reporting.ts';
import {createProfitReportingService} from '../../../experiments/financial-v1/profit-reporting-service.mjs';
import {setup as financeSetup,sql,U,A} from '../../../experiments/shopify/finance-fixture.mjs';
import {setupProfitStagingFixture,PROFIT_STAGING_IDS as ids} from '../../../experiments/financial-v1/profit-staging-fixture.mjs';
import {createProfitSalesReader} from '../../../experiments/financial-v1/profit-sales-reader.mjs';
const scope={storeId:ids.store,from:'2026-02-01',to:'2026-02-28',currency:'GBP'};
const outsider='96000000-0000-4000-8000-000000000001';
async function fixture({role=false}={}){
 const {db}=await financeSetup(undefined,{installIntake:role});
 if(role){await db.exec(sql('proposed/ingest_v1_review_restoration.sql'));await db.exec(sql('proposed/ingest_v1_review_service.sql'));}
 await db.exec(sql('proposals/20260913_profit_evidence.sql'));
 await setupProfitStagingFixture(db,{userId:U,readSales:createProfitSalesReader({userId:U})});
 await db.query('INSERT INTO auth.users(id) VALUES($1)',[outsider]);
 const tokens=[];
 const auth={auth:{getUser:async token=>{tokens.push(token);return token==='valid'?{data:{user:{id:U,is_anonymous:false}},error:null}:token==='outsider'?{data:{user:{id:outsider,is_anonymous:false}},error:null}:token==='anonymous'?{data:{user:{id:U,is_anonymous:true}},error:null}:{data:{user:null},error:new Error('invalid token private detail')};}}};
 return {db,service:createProfitReportingService(db,auth),tokens};
}
async function server(service,run){
 const app=express();app.use('/api/profit-reporting',createProfitReportingRouter(service));
 const instance=http.createServer(app);
 await new Promise((resolve,reject)=>{instance.once('error',reject);instance.listen(0,'127.0.0.1',resolve);});
 const request=async(query=scope,{authorization='Bearer valid',method='GET',suffix=''}={})=>{
  const url=`http://127.0.0.1:${instance.address().port}/api/profit-reporting?${new URLSearchParams(query)}${suffix}`;
  const response=await fetch(url,{method,headers:authorization?{authorization}:{},signal:AbortSignal.timeout(10000)});
  const text=await response.text();return {status:response.status,cache:response.headers.get('cache-control'),text,body:(()=>{try{return JSON.parse(text);}catch{return null;}})()};
 };
 try{await run(request);}finally{await new Promise(resolve=>instance.close(resolve));}
}
function metric(report,key,value){assert.equal(report[key].state,'ready',key);assert.equal(report[key].value,value,key);}

test('unconfigured profit endpoint stays unavailable and private',async()=>{
 await server(undefined,async request=>{const response=await request();assert.equal(response.status,503);assert.equal(response.cache,'no-store');assert.doesNotMatch(response.text,/password|connectionString|postgres:\/\//);});
});
test('HTTP rejects missing bearer, invalid scope and identity/version override before invoking service',async()=>{
 let calls=0;
 await server({read:async()=>{calls++;return {state:'ready'};}},async request=>{
  assert.equal((await request(scope,{authorization:''})).status,401);
  assert.equal((await request(scope,{authorization:'Basic valid'})).status,401);
  for(const query of [
   {...scope,storeId:'not-a-uuid'}, {...scope,from:'2026-02-30'}, {...scope,from:'2026-02-02'},
   {...scope,to:'2026-03-31'}, {...scope,currency:'XXX'}, {...scope,userId:U}, {...scope,versionId:ids.versions[0]},
  ])assert.equal((await request(query)).status,400,JSON.stringify(query));
  assert.equal((await request(scope,{suffix:'&storeId='+ids.store})).status,400);
 });assert.equal(calls,0);
});
test('real service verifies token, rejects anonymous identities and cross-store membership',async()=>{
 const {db,service,tokens}=await fixture();try{
  await server(service,async request=>{
   for(const token of ['forged','anonymous'])assert.equal((await request(scope,{authorization:`Bearer ${token}`})).status,401);
   const forbidden=await request(scope,{authorization:'Bearer outsider'});assert.equal(forbidden.status,403);assert.equal(forbidden.body?.report,undefined);
   const okay=await request();assert.equal(okay.status,200);assert.equal(okay.cache,'no-store');assert.equal(okay.body.state,'ready');assert.equal(okay.body.versionId,ids.versions[0]);
  });assert.deepEqual(tokens,['forged','anonymous','outsider','valid']);
 }finally{await db.close();}
});
test('real HTTP output reconciles February sales, March refund-only and April stock recovery',async()=>{
 const {db,service}=await fixture();try{
  const before=(await db.query('SELECT count(*)::int n FROM finance_v1.profit_evidence_versions')).rows[0].n;
  await server(service,async request=>{
   for(const [month,to,sales,cogs,contribution,operating,ebitda] of [
    ['02','28',14000,6000,6000,3500,4000],['03','31',-7000,0,-7500,-7500,-7500],['04','30',0,-4000,4000,4000,4000],
   ]){
    const response=await request({...scope,from:`2026-${month}-01`,to:`2026-${month}-${to}`});
    assert.equal(response.status,200);assert.equal(response.body.state,'ready');
    const report=response.body.report;
    assert.equal(report.sales.netProductSales,sales);metric(report,'cogs',cogs);metric(report,'contribution',contribution);metric(report,'operatingProfit',operating);metric(report,'ebitda',ebitda);
    assert.equal(response.body.input,undefined);assert.equal(response.body.readError,undefined);
   }
  });assert.equal((await db.query('SELECT count(*)::int n FROM finance_v1.profit_evidence_versions')).rows[0].n,before);
 }finally{await db.close();}
});
test('zero versions and multiple sealed versions are unavailable without choosing newest or a supplied version',async()=>{
 const {db,service}=await fixture();try{
  await server(service,async request=>{
   const absent=await request({...scope,storeId:A});assert.equal(absent.status,200);assert.equal(absent.body.state,'unavailable');assert.equal(absent.body.report,undefined);
   const second='96000000-0000-4000-8000-000000000002';
   await db.query(`INSERT INTO finance_v1.profit_evidence_versions(id,store_id,date_from,date_to,currency,source_manifest,evidence_ref,verified_by) SELECT $1,store_id,date_from,date_to,currency,source_manifest,'synthetic ambiguous version','test' FROM finance_v1.profit_evidence_versions WHERE id=$2`,[second,ids.versions[0]]);
   await db.query(`INSERT INTO finance_v1.profit_component_coverage(version_id,source_manifest,evidence_ref) VALUES($1,'{}','synthetic sealed but incomplete')`,[second]);
   const ambiguous=await request();assert.equal(ambiguous.status,200);assert.equal(ambiguous.body.state,'unavailable');assert.equal(ambiguous.body.report,undefined);assert.equal(ambiguous.body.versionId,undefined);
  });
 }finally{await db.close();}
});
test('stale actual overhead withholds profit while retaining independently evidenced gross profit',async()=>{
 const {db,service}=await fixture();try{
  await db.query('UPDATE public.overhead_entries SET amount=21 WHERE id=$1',[ids.expenses[1]]);
  await server(service,async request=>{
   const response=await request();assert.equal(response.status,200);assert.equal(response.body.state,'ready');
   metric(response.body.report,'grossProfit',8000);metric(response.body.report,'contribution',6000);assert.equal(response.body.report.operatingProfit.value,null);assert.equal(response.body.report.sales.netProductSales,14000);
  });
 }finally{await db.close();}
});
test('unexpected service errors do not disclose database or token diagnostics',async()=>{
 await server({read:async()=>{throw new Error('postgres://private-password bearer-private-token');}},async request=>{
  const response=await request();assert.equal(response.status,503);assert.equal(response.cache,'no-store');assert.doesNotMatch(response.text,/private-password|bearer-private-token|postgres:/);
 });
});

test('proposed restricted-role policies require member claims, permit real reads and add no writes',async()=>{
 const {db,service}=await fixture({role:true});try{
  await db.exec(sql('proposals/20260913_profit_reporting_read_access.sql'));
  await db.exec('SET ROLE night_scout_review_service');
  const tables=['public.order_line_items','public.overhead_entries','public.overhead_categories','public.marketing_channel_daily_metrics','finance_v1.profit_evidence_versions','finance_v1.line_cost_evidence','finance_v1.stock_return_evidence','finance_v1.expense_evidence','finance_v1.profit_component_coverage'];
  for(const table of tables)assert.equal((await db.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,0,`${table} hidden without claims`);
  await db.query("SELECT set_config('night_scout.profit_user_id',$1,false)",[outsider]);
  for(const table of tables)assert.equal((await db.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,0,`${table} hidden for nonmember`);
  await db.query("SELECT set_config('night_scout.profit_user_id',$1,false)",[U]);
  assert.equal((await db.query('SELECT count(*)::int n FROM finance_v1.profit_evidence_versions')).rows[0].n,3);
  assert.equal((await db.query('SELECT count(*)::int n FROM public.order_line_items WHERE store_id=$1',[ids.store])).rows[0].n,2);
  for(const table of tables){
   assert.equal((await db.query("SELECT has_table_privilege(current_user,$1,'INSERT,UPDATE,DELETE,TRUNCATE') writable",[table])).rows[0].writable,false,`${table} no write privilege`);
   await assert.rejects(db.exec(`DELETE FROM ${table}`),e=>e.code==='42501',`${table} no delete`);
   await assert.rejects(db.exec(`INSERT INTO ${table} SELECT * FROM ${table} WHERE false`),e=>e.code==='42501',`${table} no insert`);
  }
  await db.query("SELECT set_config('night_scout.profit_user_id',$1,false)",[outsider]);
  const reply=await service.read(scope,'Bearer valid');assert.equal(reply.state,'ready');metric(reply.report,'operatingProfit',3500);
  assert.equal((await db.query('SELECT count(*)::int n FROM finance_v1.profit_evidence_versions')).rows[0].n,0,'LOCAL verified identity does not leak after request');
  await assert.rejects(service.read(scope,'Bearer outsider'),/membership/);
  await db.exec('RESET ROLE');
  for(const role of ['anon','authenticated']){
   await db.exec(`SET ROLE ${role}`);await assert.rejects(db.exec('SELECT * FROM finance_v1.profit_evidence_versions'),e=>e.code==='42501');await db.exec('RESET ROLE');
  }
 }finally{await db.close();}
});
test('read-access proposal fails atomically when any required RLS protection is absent',async()=>{
 const {db}=await fixture({role:true});try{
  await db.exec('ALTER TABLE public.overhead_entries DISABLE ROW LEVEL SECURITY');
  await assert.rejects(db.exec(sql('proposals/20260913_profit_reporting_read_access.sql')),/RLS must already/);
  await db.exec('ROLLBACK');
  assert.equal((await db.query("SELECT has_table_privilege('night_scout_review_service','finance_v1.profit_evidence_versions','SELECT') allowed")).rows[0].allowed,false);
  assert.equal((await db.query("SELECT count(*)::int n FROM pg_policies WHERE policyname='profit_member_read'")).rows[0].n,0);
 }finally{await db.close();}
});
