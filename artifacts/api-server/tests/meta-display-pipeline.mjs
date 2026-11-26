// Explicit offline combined-boundary test. Requires the pages owner's frozen
// source path; no UI copy/edit, live provider, auth service or database is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import express from 'express';
import {PGlite} from '@electric-sql/pglite';
import {createMetaAdsReportRuntime} from '../src/lib/meta-ads-report-runtime.mjs';
import {createMetaAdsSpendReportRouter} from '../src/routes/meta-ads-spend-report.ts';
const pagesRoot=process.env.NIGHT_SCOUT_META_DISPLAY_ROOT;
if(!pagesRoot)throw Error('Supply pinned pages display checkout through NIGHT_SCOUT_META_DISPLAY_ROOT');
const pins=JSON.parse(await readFile(new URL('./meta-display-pipeline-pins.json',import.meta.url),'utf8'));
for(const [name,sha] of Object.entries(pins.files))assert.equal(createHash('sha256').update(await readFile(join(pagesRoot,name))).digest('hex'),sha,'Frozen pages source '+name);
const {createMetaSpendDisplayController,fetchSavedMetaSpend}=await import(pathToFileURL(join(pagesRoot,'artifacts/virtual-cfo/src/lib/metaSpendDisplay.ts')));
const user='11111111-1111-4111-8111-111111111111',other='11111111-1111-4111-8111-111111111112';
const store='22222222-2222-4222-8222-222222222222',otherStore='22222222-2222-4222-8222-222222222223';
const connection='33333333-3333-4333-8333-333333333333',newConnection='33333333-3333-4333-8333-333333333334';
const account='44444444-4444-4444-8444-444444444444',newAccount='44444444-4444-4444-8444-444444444445',run='55555555-5555-4555-8555-555555555555';
const scope={userId:user,storeId:store,revision:1,from:'2026-10-01',to:'2026-10-02'};
const role='night_scout_meta_ads_report_login';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function harness(){
 const db=await PGlite.create();let server,runtime;const calls=[];let hold=null;
 try{
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE TABLE public.stores(id uuid PRIMARY KEY); CREATE TABLE public.store_memberships(user_id uuid,store_id uuid,PRIMARY KEY(user_id,store_id));');
  for(const cap of ['api','report','collector'])await db.exec(`CREATE ROLE night_scout_meta_ads_${cap}_group NOLOGIN; CREATE ROLE night_scout_meta_ads_${cap}_login LOGIN INHERIT; GRANT night_scout_meta_ads_${cap}_group TO night_scout_meta_ads_${cap}_login;`);
  for(const kind of ['store','rpcs','read-rpc'])await db.exec(await readFile(new URL(`../../../db-migrations/proposals/meta-ads-spend-${kind}-2026-11-20.sql`,import.meta.url),'utf8'));
  await db.query('INSERT INTO auth.users VALUES($1),($2)',[user,other]);await db.query('INSERT INTO public.stores VALUES($1),($2)',[store,otherStore]);await db.query('INSERT INTO public.store_memberships VALUES($1,$2)',[user,store]);
  await db.query(`INSERT INTO meta_ads_v1.connections(id,store_id,created_by,status,granted_scope,token_expires_at,connected_at) VALUES($1,$2,$3,'connected',ARRAY['ads_read'],clock_timestamp()+interval '1 day',clock_timestamp()-interval '2 days')`,[connection,store,user]);
  await db.query(`INSERT INTO meta_ads_v1.ad_accounts(id,connection_id,store_id,provider_account_id,currency,timezone_name,selected_at,active) VALUES($1,$2,$3,'123456789','GBP','Europe/London',clock_timestamp()-interval '2 days',true)`,[account,connection,store]);
  await db.query(`INSERT INTO meta_ads_v1.collection_runs(id,account_id,connection_id,store_id,requested_from,requested_to,idempotency_key,api_version,status,pages_read,started_at,finished_at) VALUES($1,$2,$3,$4,'2026-10-01','2026-10-02','fictional-combined-run','v25.0','partial',1,clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour')`,[run,account,connection,store]);
  await db.query(`INSERT INTO meta_ads_v1.daily_spend_observations VALUES($1,$2,'2026-10-01','provider_row',12345,clock_timestamp()-interval '1 hour')`,[run,account]);
  const admin=(await db.query('SELECT session_user')).rows[0].session_user;
  // Real SQL and effective session identity; no neighboring repository stub.
  const query=async(sql,values)=>{
   await db.exec(`SET SESSION AUTHORIZATION ${role}`);let result;
   try{result=await db.query(sql,values);}finally{await db.exec(`SET SESSION AUTHORIZATION ${admin}`);}
   if(sql.includes('worker_read_daily_spend')&&hold){const pending=hold;hold=null;pending.captured.resolve();await pending.release.promise;}
   return result;
  };
  const env={NIGHT_SCOUT_META_ADS_REPORT_RUNTIME_ENABLED:'true',NIGHT_SCOUT_RUNTIME_ENV:'staging',NIGHT_SCOUT_META_ADS_STAGING_PROJECT_REF:'bioalckltvkhlczusdvl',NIGHT_SCOUT_STAGING_CA_PEM:'-----BEGIN CERTIFICATE-----\nfictional\n-----END CERTIFICATE-----',NIGHT_SCOUT_REVIEW_AUTH_URL:'https://bioalckltvkhlczusdvl.supabase.co',NIGHT_SCOUT_REVIEW_PUBLIC_KEY:'fictional-publishable-key-for-mock-only',NIGHT_SCOUT_META_ADS_STAGING_OWNER_ID:user,NIGHT_SCOUT_META_ADS_STAGING_STORE_ID:store,NIGHT_SCOUT_META_ADS_REPORT_DATABASE_URL:'postgresql://night_scout_meta_ads_report_login:mock-password@db.bioalckltvkhlczusdvl.supabase.co:5432/postgres'};
  runtime=await createMetaAdsReportRuntime(env,{createPool:()=>({query,end:async()=>{}}),createAuthClient:()=>({auth:{getUser:async token=>({data:{user:{id:token==='fictional-owner'?user:other}},error:null})}}),fetchImpl:async()=>assert.fail('No external runtime request')});
  const app=express();app.use('/api/meta-ads',createMetaAdsSpendReportRouter(runtime));
  server=await new Promise((resolve,reject)=>{const instance=app.listen(0,'127.0.0.1',error=>error?reject(error):resolve(instance));});
  const base=`http://127.0.0.1:${server.address().port}`;
  const controller=createMetaSpendDisplayController((input,signal)=>fetchSavedMetaSpend(input,signal,{accessToken:async id=>id===user?'fictional-owner':'fictional-outsider',fetcher:async(path,init)=>{
   assert.equal(init.method,'GET');assert.equal(init.cache,'no-store');assert.equal(init.redirect,'error');const url=new URL(path,base);assert.equal(url.origin,base);calls.push(url.pathname+url.search);
   // Deliberately ignore transport cancellation to prove sequencing protection.
   return fetch(url,{...init,signal:undefined});
  }}));
  return {db,controller,calls,holdNext(){const result={captured:deferred(),release:deferred()};hold=result;return result;},async close(){controller.clear();await new Promise(resolve=>server.close(resolve));await runtime.close();await db.close();}};
 }catch(error){if(server)await new Promise(resolve=>server.close(resolve));await runtime?.close();await db.close();throw error;}
}
test('actual HTTP/runtime/SQL/controller preserve expired exact evidence and unknown days',async()=>{
 const h=await harness();try{
  assert.equal(h.calls.length,0);await h.controller.load(scope);const current=h.controller.getSnapshot().view;
  assert.equal(current.subtotalMinor,'12345');assert.equal(current.sourceDays[1].spendMinor,null);assert.equal(current.sourceDays[1].coverageState,'not_collected');
  await h.db.query("UPDATE meta_ads_v1.connections SET token_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[connection]);
  await h.controller.load(scope);const expired=h.controller.getSnapshot().view;assert.deepEqual(expired.sourceDays,current.sourceDays);assert.deepEqual(expired.lineage,current.lineage);assert.match(expired.connectionLabel,/expired/);assert.equal(expired.evidenceLabel,'Observation freshness unknown');
  await h.controller.load({...scope,from:'2026-09-01',to:'2026-09-02'});const empty=h.controller.getSnapshot().view;assert.equal(empty.state,'unavailable');assert.equal(empty.subtotalMinor,null);assert.notEqual(empty.lineage.version,current.lineage.version);
 }finally{await h.close();}
});
test('actual server Auth/store/member denial clears earlier saved values without provider calls',async()=>{
 const h=await harness();try{
  await h.controller.load(scope);assert.equal(h.controller.getSnapshot().status,'ready');
  for(const bad of [{...scope,userId:other},{...scope,storeId:otherStore}]){await h.controller.load(bad);assert.equal(h.controller.getSnapshot().status,'unavailable');assert.equal(h.controller.getSnapshot().view,undefined);}
  await h.db.query('DELETE FROM public.store_memberships WHERE user_id=$1',[user]);await h.controller.load(scope);assert.equal(h.controller.getSnapshot().status,'unavailable');assert.equal(h.controller.getSnapshot().view,undefined);
 }finally{await h.close();}
});
test('new authoritative selection and explicit disconnect never fall back to old account history',async()=>{
 const h=await harness();try{
  await h.controller.load(scope);const old=h.controller.getSnapshot().view;
  await h.db.query('UPDATE meta_ads_v1.ad_accounts SET active=false WHERE id=$1',[account]);
  await h.db.query(`INSERT INTO meta_ads_v1.connections(id,store_id,created_by,status,token_expires_at,connected_at) VALUES($1,$2,$3,'connected',clock_timestamp()+interval '1 day',clock_timestamp())`,[newConnection,store,user]);
  await h.db.query(`INSERT INTO meta_ads_v1.ad_accounts(id,connection_id,store_id,provider_account_id,currency,timezone_name,selected_at,active) VALUES($1,$2,$3,'987654321','USD','America/New_York',clock_timestamp(),true)`,[newAccount,newConnection,store]);
  await h.controller.load(scope);const next=h.controller.getSnapshot().view;assert.equal(next.state,'unavailable');assert.equal(next.lineage.accountId,'987654321');assert.equal(next.currency,'USD');assert.notEqual(next.lineage.version,old.lineage.version);assert.equal(next.subtotalMinor,null);
  for(const status of ['disconnected','revoked']){await h.db.query('UPDATE meta_ads_v1.connections SET status=$1,disconnected_at=clock_timestamp() WHERE id=$2',[status,newConnection]);await h.controller.load(scope);assert.equal(h.controller.getSnapshot().status,'unavailable');assert.equal(h.controller.getSnapshot().view,undefined);}
 }finally{await h.close();}
});
test('late actual HTTP result cannot restore evidence after newer membership denial',async()=>{
 const h=await harness();let pending;try{
  pending=h.holdNext();const old=h.controller.load(scope);await pending.captured.promise;
  await h.db.query('DELETE FROM public.store_memberships WHERE user_id=$1',[user]);
  await h.controller.load({...scope,revision:2});assert.equal(h.controller.getSnapshot().status,'unavailable');
  pending.release.resolve();await old;assert.equal(h.controller.getSnapshot().status,'unavailable');assert.equal(h.controller.getSnapshot().view,undefined);assert.match(h.controller.getSnapshot().scopeKey,/,2,/);
 }finally{pending?.release.resolve();await h.close();}
});
test('late actual HTTP result cannot replace a new requested period',async()=>{
 const h=await harness();let pending;try{
  pending=h.holdNext();const old=h.controller.load(scope);await pending.captured.promise;
  await h.controller.load({...scope,from:'2026-09-01',to:'2026-09-02'});const current=h.controller.getSnapshot();assert.equal(current.view.state,'unavailable');
  pending.release.resolve();await old;assert.deepEqual(h.controller.getSnapshot(),current);
 }finally{pending?.release.resolve();await h.close();}
});
