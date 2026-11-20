import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {prepareBoundedProgramme,verifyDailyProfile} from './run-provider-test-programme.mjs';
const config={provider:'shopify',target:'pocketlaunchpad1.myshopify.com',startMonday:'2026-10-12',programmeKey:'shopify-staging-20261012'};
const tenant='90000000-0000-4000-8000-000000000002';
const daily={...config,scheduleProfile:'daily-20261015-v1'};
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
test('opt-in profile preserves original default and strictly pins four future actions',()=>{
 const original=prepareBoundedProgramme(config),p=prepareBoundedProgramme(daily);
 assert.equal(original.cap,6);assert.deepEqual(original.plans.map(x=>x.date),['2026-10-12','2026-10-13','2026-10-17','2026-10-19','2026-10-20','2026-10-24']);
 assert.equal(p.cap,4);assert.equal(p.endsAt,original.endsAt);assert.deepEqual(p.plans.map(x=>x.date),['2026-10-15','2026-10-16','2026-10-17','2026-10-18']);
 assert.equal(p.plans.every(x=>x.plan.variables.order.test===true && !x.plan.variables.order.transactions && x.plan.variables.order.lineItems[0].priceSet.shopMoney.amount==='60.00'),true);
 assert.equal(new Set(p.plans.map(x=>x.plan.actionKey)).size,4);
 for(const change of [{scheduleProfile:'daily'},{programmeKey:'new-key'},{startMonday:'2026-10-19'},{target:'other.myshopify.com'}])assert.throws(()=>prepareBoundedProgramme({...daily,...change}));
 const x=prepareBoundedProgramme({...daily,provider:'xero',programmeKey:'xero-staging-20261012',target:tenant,financialMode:'posted_demo_only',contactId:'90000000-0000-4000-8000-000000000001',accountCode:'200'});
 assert.equal(x.plans.every(x=>x.plan.body.Invoices[0].Status==='AUTHORISED' && x.plan.body.Invoices[0].LineItems[0].UnitAmount===10),true);
 assert.throws(()=>prepareBoundedProgramme({...daily,provider:'xero',programmeKey:'xero-staging-20261012',target:tenant,financialMode:'draft_only'}));
});
test('daily metadata gate accepts only exact true; absent RPC and mismatched cap fail closed',async()=>{
 const programme=prepareBoundedProgramme(daily);let observed;
 await verifyDailyProfile({programme,pool:{query:async(sql,args)=>{observed={sql,args};return {rows:[{ready:true}]};}}});
 assert.deepEqual(observed.args,[config.programmeKey,'shopify',config.target,4]);assert.match(observed.sql,/daily_profile_ready/);
 for(const rows of [[],[{ready:false}],[{ready:1}],[{ready:true},{ready:true}]])await assert.rejects(verifyDailyProfile({programme,pool:{query:async()=>({rows})}}));
 await assert.rejects(verifyDailyProfile({programme,pool:{query:async()=>{throw Error('missing RPC');}}}));
 await assert.rejects(verifyDailyProfile({programme:{...programme,cap:6},pool:{query:async()=>{throw Error('must not query');}}}));
 const source=read('./run-provider-test-programme.mjs');assert.ok(source.indexOf('await verifyDailyProfile({pool:scopedPool,programme})')<source.indexOf("const result=programme.provider==='xero'"));
});
async function dbFixture(){
 const db=new PGlite();await db.exec("CREATE TABLE public.fixture_time(at timestamptz); INSERT INTO public.fixture_time VALUES('2026-10-15T17:00:00Z'); CREATE FUNCTION public.fixture_clock() RETURNS timestamptz LANGUAGE sql AS 'SELECT at FROM public.fixture_time';");await db.exec(read('./provider-ledger-proposal.sql'));await db.exec(read('./provider-access-proposal.sql'));
 await db.query("INSERT INTO staging_test_programme.programmes VALUES($1,'shopify','bioalckltvkhlczusdvl',$2,'2026-10-12T00:00:00Z','2026-10-26T00:00:00Z',6,false,false)",[config.programmeKey,config.target]);
 await db.query("INSERT INTO staging_test_programme.programmes VALUES('xero-staging-20261012','xero','bioalckltvkhlczusdvl',$1,'2026-10-12T00:00:00Z','2026-10-26T00:00:00Z',6,false,false)",[tenant]);
 await db.query("INSERT INTO staging_test_programme.writer_envelopes(programme_key,connection_id,tenant_id,ciphertext,encrypted_dek,key_version,algorithm,version) VALUES('xero-staging-20261012',$1,$1,$2,$2,'v1','AES-256-GCM',1)",[tenant,new Uint8Array(32)]);
 return db;
}
test('proposal installs atomically into exact pristine disabled targets without enabling',async()=>{
 const db=await dbFixture();try{
 await db.exec(read('./daily-amendment-proposal-2026-10-15.sql').replace(/\bnow\(\)/g,'public.fixture_clock()'));
 const rows=(await db.query('SELECT action_cap,enabled,schedule_profile FROM staging_test_programme.programmes')).rows;
 assert.equal(rows.length,2);assert.equal(rows.every(r=>r.action_cap===4 && !r.enabled && r.schedule_profile==='daily-20261015-v1'),true);
 assert.deepEqual((await db.query("SELECT staging_test_programme.daily_profile_ready($1,'shopify',$2,4) AS ready",[config.programmeKey,config.target])).rows,[{ready:false}]);
 const grants=(await db.query("SELECT has_function_privilege('night_scout_test_writer_service','staging_test_programme.daily_profile_ready(text,text,text,integer)','EXECUTE') AS allowed")).rows;assert.equal(grants[0].allowed,true);
 await db.exec("SET ROLE night_scout_test_writer_service");await assert.rejects(db.query('SELECT * FROM staging_test_programme.programmes'));await db.exec('RESET ROLE');
 }finally{await db.close();}
});
test('used row refuses amendment and rolls back profile DDL and cap changes',async()=>{
 const db=await dbFixture();try{
 await db.query("INSERT INTO staging_test_programme.actions(programme_key,action_key,payload_digest,state) VALUES($1,$2,$3,'uncertain')",[config.programmeKey,'ns-'+'a'.repeat(40),'b'.repeat(64)]);
 await assert.rejects(db.exec(read('./daily-amendment-proposal-2026-10-15.sql').replace(/\bnow\(\)/g,'public.fixture_clock()')));await db.exec('ROLLBACK');
 assert.equal((await db.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='staging_test_programme' AND table_name='programmes' AND column_name='schedule_profile'")).rows[0].n,0);
 assert.equal((await db.query('SELECT action_cap FROM staging_test_programme.programmes LIMIT 1')).rows[0].action_cap,6);
 }finally{await db.close();}
});

test('controlled database clock proves window, daily exclusivity, cap and NULL rejection',async()=>{
 const db=await dbFixture();try{
 await db.exec(read('./daily-amendment-proposal-2026-10-15.sql').replace(/\bnow\(\)/g,'public.fixture_clock()'));
 await db.exec("UPDATE staging_test_programme.programmes SET enabled=true; ALTER TABLE staging_test_programme.actions ALTER COLUMN created_at SET DEFAULT public.fixture_clock()");
 const ready=async(cap=4)=> (await db.query("SELECT staging_test_programme.daily_profile_ready($1,'shopify',$2,$3) AS ok",[config.programmeKey,config.target,cap])).rows[0].ok;
 const claim=async(letter='a',digest='b')=> (await db.query("SELECT staging_test_programme.claim_action($1,$2,$3,'shopify',$4,4) AS state",[config.programmeKey,'ns-'+letter.repeat(40),digest.repeat(64),config.target])).rows[0].state;
 assert.equal(await ready(),true);assert.equal(await ready(null),false);
 assert.equal(await claim(),'claimed');assert.equal(await claim(),'existing');assert.equal(await claim('a','c'),'blocked');
 await db.exec("UPDATE staging_test_programme.actions SET state='confirmed',source_id='synthetic',confirmed_at=public.fixture_clock()");
 assert.equal(await claim('c'),'blocked');
 for(const t of ['2026-10-15T16:59:59Z','2026-10-15T17:15:00Z','2026-10-19T17:00:00Z']){
 await db.query('UPDATE public.fixture_time SET at=$1',[t]);assert.equal(await ready(),false);assert.equal(await claim('d'),'blocked');}
 await db.exec("UPDATE public.fixture_time SET at='2026-10-16T17:00:00Z'");assert.equal(await claim('d'),'claimed');
 await db.exec("UPDATE staging_test_programme.actions SET state='confirmed',source_id='synthetic',confirmed_at=public.fixture_clock() WHERE state='claimed'");
 await db.exec("UPDATE public.fixture_time SET at='2026-10-17T17:00:00Z'");assert.equal(await claim('e'),'claimed');
 await db.exec("UPDATE staging_test_programme.actions SET state='confirmed',source_id='synthetic',confirmed_at=public.fixture_clock() WHERE state='claimed'");
 await db.exec("UPDATE public.fixture_time SET at='2026-10-18T17:00:00Z'");assert.equal(await claim('f'),'claimed');
 await db.exec("UPDATE staging_test_programme.actions SET state='confirmed',source_id='synthetic',confirmed_at=public.fixture_clock() WHERE state='claimed'; UPDATE public.fixture_time SET at='2026-10-15T17:00:00Z'");assert.equal(await claim('0'),'blocked');
 await db.exec("UPDATE staging_test_programme.programmes SET stopped=true");assert.equal(await ready(),false);
 for(const args of [[null,'shopify',config.target,4],[config.programmeKey,null,config.target,4],[config.programmeKey,'shopify',null,4]])assert.equal((await db.query('SELECT staging_test_programme.daily_profile_ready($1,$2,$3,$4) AS ok',args)).rows[0].ok,false);
 }finally{await db.close();}
});
