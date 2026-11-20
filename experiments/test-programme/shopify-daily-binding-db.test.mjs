import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const read=n=>readFileSync(new URL(n,import.meta.url),'utf8');
const config={provider:'shopify',target:'pocketlaunchpad1.myshopify.com',startMonday:'2026-10-12',programmeKey:'shopify-staging-20261012',scheduleProfile:'daily-20261015-v1'};
const receipt={domain:config.target,currency:'GBP',partnerDevelopment:true,separateWriterApp:true,sameOrganisation:true,grantedScopes:['read_orders','write_orders'],observedAt:'2026-10-15T16:55:00Z'};
const proposal=()=>read('./shopify-daily-binding-proposal-2026-10-15.sql').replace(/\bnow\(\)/g,'public.fixture_clock()');
async function fixture({bound=false,proof=true}={}){
 const db=new PGlite();await db.exec("CREATE TABLE public.fixture_time(at timestamptz); INSERT INTO public.fixture_time VALUES('2026-10-15T17:00:00Z'); CREATE FUNCTION public.fixture_clock() RETURNS timestamptz LANGUAGE sql AS 'SELECT at FROM public.fixture_time';");
 await db.exec(read('./provider-ledger-proposal.sql'));await db.exec(read('./provider-access-proposal.sql'));
 if(bound)await db.query("INSERT INTO staging_test_programme.programmes VALUES($1,'shopify','bioalckltvkhlczusdvl',$2,'2026-10-12T00:00:00Z','2026-10-26T00:00:00Z',6,false,false)",[config.programmeKey,config.target]);
 if(proof)await evidence(db);
 return db;
}
async function evidence(db,c=config,r=receipt){await db.query("SELECT set_config('night_scout.shopify_writer_config',$1,false),set_config('night_scout.shopify_writer_receipt',$2,false)",[JSON.stringify(c),JSON.stringify(r)]);}
async function apply(db){await db.exec(proposal());}
async function rollback(db){await db.exec('ROLLBACK');}
test('verified Shopify-only binding works without any Xero row/envelope; remains disabled',async()=>{
 for(const bound of [false,true]){const db=await fixture({bound});try{
 await apply(db);
 const rows=(await db.query('SELECT * FROM staging_test_programme.programmes')).rows;
 assert.equal(rows.length,1);assert.equal(rows[0].programme_key,config.programmeKey);assert.equal(rows[0].provider,'shopify');assert.equal(rows[0].action_cap,4);assert.equal(rows[0].schedule_profile,config.scheduleProfile);assert.equal(rows[0].enabled,false);assert.equal(rows[0].stopped,false);assert.equal(new Date(rows[0].ends_at).toISOString(),'2026-10-26T00:00:00.000Z');
 assert.equal((await db.query('SELECT count(*)::int AS n FROM staging_test_programme.writer_envelopes')).rows[0].n,0);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM staging_test_programme.actions')).rows[0].n,0);
 await db.exec('SET ROLE night_scout_test_writer_service');await assert.rejects(db.query('SELECT * FROM staging_test_programme.programmes'));
 assert.equal((await db.query('SELECT staging_test_programme.daily_profile_ready($1,$2,$3,4) AS ready',[config.programmeKey,'shopify',config.target])).rows[0].ready,false);await db.exec('RESET ROLE');
 await assert.rejects(apply(db));await rollback(db);
 }finally{await db.close();}}
});
test('missing, stale, wrong target, excessive scopes or wrong private config rolls back completely',async()=>{
 const cases=[{proof:false},{r:{...receipt,unexpectedField:'refuse_unknown_metadata'}},{r:{...receipt,domain:'other.myshopify.com'}},{r:{...receipt,partnerDevelopment:false}},{r:{...receipt,observedAt:'2026-10-15T14:00:00Z'}},{r:{...receipt,observedAt:'2026-10-15T18:00:00Z'}},{r:{...receipt,grantedScopes:['read_orders','write_orders','write_products']}},{r:{...receipt,grantedScopes:['read_orders','write_orders','read_orders']}},{c:{...config,target:'other.myshopify.com'}}];
 for(const item of cases){const db=await fixture({proof:false});try{
 if(item.proof!==false)await evidence(db,item.c??config,item.r??receipt);
 await assert.rejects(apply(db));await rollback(db);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM staging_test_programme.programmes')).rows[0].n,0);
 assert.equal((await db.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='staging_test_programme' AND column_name='schedule_profile'")).rows[0].n,0);
 }finally{await db.close();}}
});
test('used, stopped, enabled or mismatched existing row is never reset; unrelated Xero unchanged',async()=>{
 for(const mutation of ["UPDATE staging_test_programme.programmes SET stopped=true","UPDATE staging_test_programme.programmes SET enabled=true","UPDATE staging_test_programme.programmes SET target='other.myshopify.com'","INSERT INTO staging_test_programme.actions(programme_key,action_key,payload_digest,state) VALUES('shopify-staging-20261012','ns-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',repeat('b',64),'uncertain')"]){
 const db=await fixture({bound:true});try{
 await db.exec(mutation);await assert.rejects(apply(db));await rollback(db);
 assert.equal((await db.query('SELECT action_cap FROM staging_test_programme.programmes')).rows[0].action_cap,6);
 }finally{await db.close();}}
 const db=await fixture();try{
 await db.exec("INSERT INTO staging_test_programme.programmes VALUES('xero-staging-20261012','xero','bioalckltvkhlczusdvl','90000000-0000-4000-8000-000000000002','2026-10-12T00:00:00Z','2026-10-26T00:00:00Z',6,false,false)");await apply(db);
 const x=(await db.query("SELECT action_cap,enabled,schedule_profile FROM staging_test_programme.programmes WHERE provider='xero'")).rows[0];assert.deepEqual(x,{action_cap:6,enabled:false,schedule_profile:'original'});
 }finally{await db.close();}
});
test('durable daily guard rejects old dates, late windows, stale caps and second same-day actions',async()=>{
 const db=await fixture();try{
 await apply(db);await db.exec("UPDATE staging_test_programme.programmes SET enabled=true; ALTER TABLE staging_test_programme.actions ALTER COLUMN created_at SET DEFAULT public.fixture_clock()");
 const claim=async(letter='a',cap=4)=>(await db.query('SELECT staging_test_programme.claim_action($1,$2,$3,$4,$5,$6) AS state',[config.programmeKey,'ns-'+letter.repeat(40),'b'.repeat(64),'shopify',config.target,cap])).rows[0].state;
 assert.equal(await claim('a',6),'blocked');assert.equal(await claim('a',null),'blocked');assert.equal(await claim(),'claimed');assert.equal(await claim(),'existing');
 await db.exec("UPDATE staging_test_programme.actions SET state='confirmed',source_id='synthetic',confirmed_at=public.fixture_clock()");assert.equal(await claim('c'),'blocked');
 for(const at of ['2026-10-15T17:15:00Z','2026-10-19T17:00:00Z','2026-10-26T17:00:00Z']){await db.query('UPDATE public.fixture_time SET at=$1',[at]);assert.equal(await claim('d'),'blocked');}
 }finally{await db.close();}
});
