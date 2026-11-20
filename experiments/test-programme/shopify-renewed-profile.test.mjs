import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {prepareBoundedProgramme,verifyDailyProfile,main} from './run-provider-test-programme.mjs';
const read=n=>readFileSync(new URL(n,import.meta.url),'utf8');
const config={provider:'shopify',target:'pocketlaunchpad1.myshopify.com',startMonday:'2026-10-26',programmeKey:'shopify-staging-20261029',scheduleProfile:'daily-20261029-v1'};
const receipt={domain:config.target,currency:'GBP',partnerDevelopment:true,separateWriterApp:true,sameOrganisation:true,grantedScopes:['read_orders','write_orders'],observedAt:'2026-10-29T17:55:00Z'};
const proposal=()=>read('./shopify-daily-binding-proposal-2026-10-29.sql').replace(/\bnow\(\)/g,'public.fixture_clock()');
async function fixture({proof=true}={}){
 const db=new PGlite();
 await db.exec("CREATE TABLE public.fixture_time(at timestamptz); INSERT INTO public.fixture_time VALUES('2026-10-29T18:00:00Z'); CREATE FUNCTION public.fixture_clock() RETURNS timestamptz LANGUAGE sql AS 'SELECT at FROM public.fixture_time';");
 await db.exec(read('./provider-ledger-proposal.sql'));await db.exec(read('./provider-access-proposal.sql'));
 await db.exec('CREATE ROLE night_scout_test_writer LOGIN NOINHERIT; ALTER TABLE staging_test_programme.actions ALTER COLUMN created_at SET DEFAULT public.fixture_clock()');
 // Historical confirmed actions must survive. No cap/date/key reset or clearing.
 await db.exec("INSERT INTO staging_test_programme.programmes VALUES('shopify-staging-20261012','shopify','bioalckltvkhlczusdvl','pocketlaunchpad1.myshopify.com','2026-10-12','2026-10-26',6,false,false); INSERT INTO staging_test_programme.actions VALUES('shopify-staging-20261012','ns-'||repeat('a',40),repeat('b',64),'confirmed','old-synthetic','2026-10-12','2026-10-12','2026-10-12');");
 if(proof)await evidence(db);
 return db;
}
async function evidence(db,c=config,r=receipt){await db.query("SELECT set_config('night_scout.shopify_writer_config',$1,false),set_config('night_scout.shopify_writer_receipt',$2,false)",[JSON.stringify(c),JSON.stringify(r)]);}
const apply=db=>db.exec(proposal());
const ready=async(db)=>(await db.query('SELECT staging_test_programme.shopify_daily_20261029_ready($1,$2,$3,7) AS ok',[config.programmeKey,'shopify',config.target])).rows[0].ok;
const claim=async(db,letter='c',cap=7)=>(await db.query('SELECT staging_test_programme.claim_action($1,$2,$3,$4,$5,$6) AS state',[config.programmeKey,'ns-'+letter.repeat(40),'d'.repeat(64),'shopify',config.target,cap])).rows[0].state;
test('fresh profile is exact Shopify-only seven dates, disabled by default, old profile unchanged',async()=>{
 const p=prepareBoundedProgramme(config);
 assert.equal(p.startsAt,'2026-10-29T00:00:00.000Z');assert.equal(p.endsAt,'2026-11-05T00:00:00.000Z');assert.equal(p.cap,7);
 assert.deepEqual(p.plans.map(p=>p.date),['2026-10-29','2026-10-30','2026-10-31','2026-11-01','2026-11-02','2026-11-03','2026-11-04']);
 assert.equal(new Set(p.plans.map(p=>p.plan.actionKey)).size,7);
 assert.equal(p.plans.every(p=>p.plan.variables.order.test===true&&p.plan.variables.order.lineItems[0].priceSet.shopMoney.amount==='60.00'&&!p.plan.variables.order.transactions),true);
 for(const change of [{provider:'xero'},{programmeKey:'shopify-staging-20261012'},{startMonday:'2026-11-02'},{target:'other.myshopify.com'}])assert.throws(()=>prepareBoundedProgramme({...config,...change}));
 const dir=mkdtempSync(join(tmpdir(),'ns-renewed-'));try{
 const path=join(dir,'config.json');writeFileSync(path,JSON.stringify(config));
 assert.equal((await main({env:{NIGHT_SCOUT_TEST_PROGRAMME_CONFIG_FILE:path}})).state,'prepared-disabled');
 const env={NIGHT_SCOUT_TEST_PROGRAMME_CONFIG_FILE:path,NIGHT_SCOUT_TEST_PROGRAMME_ENABLED:'true',NIGHT_SCOUT_TEST_PROGRAMME_PROJECT_REF:'bioalckltvkhlczusdvl',NIGHT_SCOUT_TEST_PROGRAMME_TARGET:config.target,NIGHT_SCOUT_TEST_PROGRAMME_VERIFIED_TEST_TARGET:'true'};
 for(const at of ['2026-10-28T18:00:00Z','2026-11-05T18:00:00Z','2026-10-29T18:15:00Z'])assert.equal((await main({env,now:new Date(at)})).state,'outside-generation-window');
 }finally{rmSync(dir,{recursive:true,force:true});}
 let query;await verifyDailyProfile({programme:p,pool:{query:async(sql)=>{query=sql;return {rows:[{ready:true}]};}}});assert.match(query,/shopify_daily_20261029_ready/);
 await assert.rejects(verifyDailyProfile({programme:p,pool:{query:async()=>({rows:[{ready:false}]})}}));
});
test('disabled new binding retains historic confirmed ledger and old cap/date',async()=>{
 const db=await fixture();try{
 const before=(await db.query("SELECT * FROM staging_test_programme.programmes WHERE programme_key='shopify-staging-20261012'")).rows;
 await apply(db);assert.equal(await ready(db),false);
 assert.deepEqual((await db.query("SELECT * FROM staging_test_programme.programmes WHERE programme_key='shopify-staging-20261012'")).rows,before);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM staging_test_programme.actions')).rows[0].n,1);
 assert.equal((await db.query("SELECT enabled,action_cap FROM staging_test_programme.programmes WHERE programme_key=$1",[config.programmeKey])).rows[0].enabled,false);
 await db.exec('SET ROLE night_scout_test_writer_service');await assert.rejects(db.query('SELECT * FROM staging_test_programme.programmes'));
 await assert.rejects(db.query("SELECT staging_test_programme.claim_action_before_20261029($1,'ns-'||repeat('c',40),repeat('d',64),'shopify',$2,7)",[config.programmeKey,config.target]));await db.exec('RESET ROLE');
 await assert.rejects(apply(db));await db.exec('ROLLBACK');
 }finally{await db.close();}
});
test('database enforces exact daily windows, cap, replays and unresolved stop',async()=>{
 const db=await fixture();try{
 await apply(db);await db.query('UPDATE staging_test_programme.programmes SET enabled=true WHERE programme_key=$1',[config.programmeKey]);
 assert.equal(await ready(db),true);assert.equal(await claim(db,'c',null),'blocked');assert.equal(await claim(db,'c',6),'blocked');
 assert.equal(await claim(db),'claimed');assert.equal(await claim(db),'existing');assert.equal(await claim(db,'e'),'blocked');
 await db.query("UPDATE staging_test_programme.actions SET state='confirmed',source_id='synthetic',confirmed_at=public.fixture_clock() WHERE programme_key=$1",[config.programmeKey]);assert.equal(await claim(db,'e'),'blocked');
 for(const at of ['2026-10-29T17:59:59Z','2026-10-29T18:15:00Z','2026-11-05T18:00:00Z']){await db.query('UPDATE public.fixture_time SET at=$1',[at]);assert.equal(await ready(db),false);assert.equal(await claim(db,'e'),'blocked');}
 for(const [i,date] of ['2026-10-30','2026-10-31','2026-11-01','2026-11-02','2026-11-03','2026-11-04'].entries()){
 await db.query('UPDATE public.fixture_time SET at=$1',[date+'T18:00:00Z']);assert.equal(await claim(db,'ef0123'[i]),'claimed');
 await db.query("UPDATE staging_test_programme.actions SET state='confirmed',source_id='synthetic',confirmed_at=public.fixture_clock() WHERE programme_key=$1 AND state='claimed'",[config.programmeKey]);}
 assert.equal((await db.query('SELECT count(*)::int AS n FROM staging_test_programme.actions WHERE programme_key=$1',[config.programmeKey])).rows[0].n,7);
 assert.equal(await claim(db,'9'),'blocked');await db.query('UPDATE staging_test_programme.programmes SET stopped=true WHERE programme_key=$1',[config.programmeKey]);assert.equal(await ready(db),false);
 }finally{await db.close();}
});
test('missing/stale evidence, unresolved prior action or elapsed programme rolls back fully',async()=>{
 for(const change of ['missing','stale','unresolved','expired','wrongconfig']){
 const db=await fixture({proof:false});try{
 if(change!=='missing')await evidence(db,change==='wrongconfig'?{...config,programmeKey:'shopify-staging-20261012'}:config,change==='stale'?{...receipt,observedAt:'2026-10-29T15:00:00Z'}:receipt);
 if(change==='unresolved')await db.exec("INSERT INTO staging_test_programme.actions(programme_key,action_key,payload_digest,state) VALUES('shopify-staging-20261012','ns-'||repeat('f',40),repeat('b',64),'uncertain')");
 if(change==='expired'){await db.exec("UPDATE public.fixture_time SET at='2026-11-05T18:00:00Z'");await evidence(db,config,{...receipt,observedAt:'2026-11-05T17:55:00Z'});}
 await assert.rejects(apply(db));await db.exec('ROLLBACK');assert.equal((await db.query('SELECT count(*)::int AS n FROM staging_test_programme.programmes')).rows[0].n,1);
 }finally{await db.close();}}
});

test('new claim wrapper retains an already-installed old daily profile unchanged',async()=>{
 const db=await fixture({proof:false});try{
 // Install historical profile at its controlled historical fixture time, only in disposable DB.
 await db.exec("DELETE FROM staging_test_programme.actions; UPDATE staging_test_programme.programmes SET starts_at='2026-10-12T00:00:00Z',ends_at='2026-10-26T00:00:00Z'; UPDATE public.fixture_time SET at='2026-10-15T17:00:00Z'");
 const old={provider:'shopify',target:config.target,startMonday:'2026-10-12',programmeKey:'shopify-staging-20261012',scheduleProfile:'daily-20261015-v1'};
 await evidence(db,old,{...receipt,observedAt:'2026-10-15T16:55:00Z'});
 await db.exec(read('./shopify-daily-binding-proposal-2026-10-15.sql').replace(/\bnow\(\)/g,'public.fixture_clock()'));
 await db.exec("UPDATE public.fixture_time SET at='2026-10-29T18:00:00Z'");await evidence(db);await apply(db);
 const oldRow=(await db.query("SELECT action_cap,schedule_profile,ends_at,enabled FROM staging_test_programme.programmes WHERE programme_key='shopify-staging-20261012'")).rows[0];
 assert.equal(oldRow.action_cap,4);assert.equal(oldRow.schedule_profile,'daily-20261015-v1');assert.equal(oldRow.enabled,false);assert.equal(new Date(oldRow.ends_at).toISOString(),'2026-10-26T00:00:00.000Z');
 await db.query('UPDATE staging_test_programme.programmes SET enabled=true WHERE programme_key=$1',[config.programmeKey]);assert.equal(await claim(db),'claimed');
 await db.exec("UPDATE public.fixture_time SET at='2026-10-30T18:00:00Z'");assert.equal(await claim(db,'e'),'blocked');
 await db.query('UPDATE staging_test_programme.programmes SET stopped=true WHERE programme_key=$1',[config.programmeKey]);assert.equal(await ready(db),false);
 }finally{await db.close();}
});
