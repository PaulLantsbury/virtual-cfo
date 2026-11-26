import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const member='11111111-1111-4111-8111-111111111111',other='11111111-1111-4111-8111-111111111112',store='22222222-2222-4222-8222-222222222222';
const oldConnection='33333333-3333-4333-8333-333333333333',newConnection='33333333-3333-4333-8333-333333333334';
const oldAccount='44444444-4444-4444-8444-444444444444',newAccount='44444444-4444-4444-8444-444444444445',run='55555555-5555-4555-8555-555555555555';
async function setup(){
 const db=await PGlite.create();
 try{
  await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE TABLE public.stores(id uuid PRIMARY KEY);CREATE TABLE public.store_memberships(user_id uuid,store_id uuid,PRIMARY KEY(user_id,store_id));');
  for(const capability of ['api','collector','report'])await db.exec(`CREATE ROLE night_scout_google_ads_${capability}_group NOLOGIN;CREATE ROLE night_scout_google_ads_${capability}_login LOGIN INHERIT;GRANT night_scout_google_ads_${capability}_group TO night_scout_google_ads_${capability}_login;`);
  for(const suffix of ['store','rpcs','read-rpc'])await db.exec(await readFile(new URL(`../../db-migrations/proposals/google-ads-spend-${suffix}-2026-11-21.sql`,import.meta.url),'utf8'));
  await db.query('INSERT INTO auth.users VALUES($1),($2)',[member,other]);await db.query('INSERT INTO public.stores VALUES($1)',[store]);await db.query('INSERT INTO public.store_memberships VALUES($1,$2)',[member,store]);
  await db.query("INSERT INTO google_ads_v1.connections(id,store_id,created_by,status,connected_at) VALUES($1,$3,$4,'connected',clock_timestamp()-interval '2 days'),($2,$3,$4,'disconnected',clock_timestamp()-interval '1 day')",[oldConnection,newConnection,store,member]);
  await db.query("INSERT INTO google_ads_v1.ad_accounts(id,connection_id,store_id,customer_id,currency,timezone_name,selected_at,active) VALUES($1,$3,$5,'1234567890','GBP','Europe/London',clock_timestamp()-interval '2 days',false),($2,$4,$5,'9876543210','USD','America/New_York',clock_timestamp()-interval '1 day',false)",[oldAccount,newAccount,oldConnection,newConnection,store]);
  await db.query("INSERT INTO google_ads_v1.collection_runs(id,account_id,connection_id,store_id,requested_from,requested_to,idempotency_key,api_version,status,pages_read,started_at,finished_at) VALUES($1,$2,$3,$4,current_date-1,current_date-1,'fictional-old-observation','v22','complete',1,clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour')",[run,oldAccount,oldConnection,store]);
  await db.query("INSERT INTO google_ads_v1.daily_spend_observations(run_id,account_id,spend_date,coverage_state,spend_micros,observed_at) VALUES($1,$2,current_date-1,'provider_row',12345000,clock_timestamp()-interval '1 hour')",[run,oldAccount]);
  return db;
 }catch(e){await db.close();throw e;}
}
async function report(db,who=member,offset=1){
 const original=(await db.query('SELECT session_user')).rows[0].session_user;
 await db.exec('SET SESSION AUTHORIZATION night_scout_google_ads_report_login');
 try{return(await db.query('SELECT * FROM google_ads_v1.worker_read_daily_spend($1,$2,current_date-$3::integer,current_date-$3::integer,clock_timestamp())',[who,store,offset])).rows[0];}
 finally{await db.exec(`SET SESSION AUTHORIZATION ${original}`);}
}
test('Google exact newest selected lineage precedes eligibility and never exposes older retained history',async()=>{
 const db=await setup();
 try{
  for(const status of ['disconnected','revoked']){
   await db.query('UPDATE google_ads_v1.connections SET status=$1 WHERE id=$2',[status,newConnection]);
   assert.equal((await report(db)).customer_id,null,`${status} newest cannot expose old selected account`);
  }
  await db.query("UPDATE google_ads_v1.connections SET status='reauthorization_required' WHERE id=$1",[newConnection]);
  let value=await report(db);assert.equal(value.customer_id,'9876543210');assert.equal(value.spend_micros,null);
  await db.query('UPDATE google_ads_v1.connections SET created_by=$1 WHERE id=$2',[other,newConnection]);
  assert.equal((await report(db)).customer_id,null,'new owner cannot reveal prior owner selection');
  await db.query('UPDATE google_ads_v1.connections SET created_by=$1 WHERE id=$2',[member,newConnection]);
  await db.query('UPDATE google_ads_v1.ad_accounts SET selected_at=(SELECT selected_at FROM google_ads_v1.ad_accounts WHERE id=$1) WHERE id=$2',[newAccount,oldAccount]);
  assert.equal((await report(db)).customer_id,null,'tied newest selections are ambiguous');
  await db.query("UPDATE google_ads_v1.ad_accounts SET selected_at=clock_timestamp() WHERE id=$1",[oldAccount]);
  await db.query("UPDATE google_ads_v1.connections SET status='reauthorization_required' WHERE id=$1",[oldConnection]);
  value=await report(db);assert.equal(value.customer_id,'1234567890');assert.equal(String(value.spend_micros),'12345000','exact selected expired account preserves history');
  assert.equal((await report(db,member,2)).spend_micros,null,'different period does not borrow facts');
  await assert.rejects(report(db,other),/unavailable/);
  await db.query('DELETE FROM public.store_memberships WHERE user_id=$1',[member]);await assert.rejects(report(db),/unavailable/);
 }finally{await db.close();}
});
