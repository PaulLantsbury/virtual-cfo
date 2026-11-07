import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
import {activationInstallerSql} from './prepare-activation-installer.mjs';import {createXeroWriterBootstrap} from './xero-writer-bootstrap.mjs';
const owner='90000000-0000-4000-8000-000000000001',store='90000000-0000-4000-8000-000000000002',tenant='90000000-0000-4000-8000-000000000003',key='xero-staging-20261030';
const read=n=>readFileSync(new URL(n,import.meta.url),'utf8');
const proposal=()=>read('./xero-restart-proposal-2026-10-29.sql').replace(/\bnow\(\)/g,'public.fixture_clock()');
async function setup(){const db=new PGlite();await db.exec(`CREATE TABLE public.store_memberships(user_id uuid,store_id uuid);INSERT INTO public.store_memberships VALUES('${owner}','${store}'); CREATE TABLE public.fixture_time(at timestamptz);INSERT INTO public.fixture_time VALUES('2026-10-29T19:00:00Z');CREATE FUNCTION public.fixture_clock() RETURNS timestamptz LANGUAGE sql AS 'SELECT at FROM public.fixture_time';`);await db.exec(activationInstallerSql().replace(/\bnow\(\)/g,'public.fixture_clock()'));
 await db.exec("ALTER TABLE staging_test_programme.actions ALTER COLUMN created_at SET DEFAULT public.fixture_clock(); INSERT INTO staging_test_programme.programmes VALUES('xero-staging-20261012','xero','bioalckltvkhlczusdvl','90000000-0000-4000-8000-000000000003','2026-10-12T00:00:00Z','2026-10-26T00:00:00Z',6,false,false); INSERT INTO staging_test_programme.actions VALUES('xero-staging-20261012','ns-'||repeat('a',40),repeat('b',64),'confirmed','synthetic-old-source','2026-10-12T00:00:00Z','2026-10-12T00:00:00Z','2026-10-12T00:00:00Z');");return db;}
function service(db,extra={}){return createXeroWriterBootstrap({enabled:true,consentProfile:'daily-xero-20261030-v1',projectRef:'bioalckltvkhlczusdvl',ownerId:owner,storeId:store,clientId:'synthetic-writer',clientSecret:'synthetic-secret',operatorOrigin:'https://operator.example.test',redirectUri:'https://operator.example.test/api/xero/test-writer/callback',masterKey:'synthetic-master-key-at-least-32-bytes',keyVersion:'writer-v1',pool:db,authenticate:async()=>({userId:owner,isOwner:true}),fetchImpl:async url=>new Response(JSON.stringify(url.endsWith('/token')?{access_token:'synthetic-access-token',refresh_token:'synthetic-refresh-token',scope:'offline_access accounting.invoices accounting.settings.read accounting.contacts.read'}:url.endsWith('/connections')?[{tenantId:tenant,tenantType:'ORGANISATION'}]:{Organisations:[{IsDemoCompany:true,BaseCurrency:'GBP'}]})),...extra});}
async function consent(s){const state=new URL((await s.start('Bearer synthetic-owner-token')).url).searchParams.get('state');return {state,result:await s.complete({state,code:'synthetic-code'})};}
const ready=async(db)=>(await db.query('SELECT staging_test_programme.xero_daily_20261030_ready($1,$2,$3,7) AS ok',[key,'xero',tenant])).rows[0].ok;
const claim=async(db,letter='c',cap=7)=>(await db.query('SELECT staging_test_programme.claim_action($1,$2,$3,$4,$5,$6) AS state',[key,'ns-'+letter.repeat(40),'d'.repeat(64),'xero',tenant,cap])).rows[0].state;
test('fresh profile consent seeds only separate disabled row/encrypted envelope, preserving old ledger',async()=>{
 const db=await setup();try{
 const before=(await db.query('SELECT * FROM staging_test_programme.programmes')).rows;await db.exec(proposal());
 assert.equal((await db.query('SELECT count(*)::int AS n FROM staging_test_programme.programmes')).rows[0].n,1);
 const s=service(db),{state,result}=await consent(s);assert.deepEqual(result,{state:'writer_connected_programme_disabled'});
 const row=(await db.query('SELECT * FROM staging_test_programme.programmes WHERE programme_key=$1',[key])).rows[0];assert.equal(row.enabled,false);assert.equal(row.action_cap,7);assert.equal(row.target,tenant);assert.equal(new Date(row.ends_at).toISOString(),'2026-11-06T00:00:00.000Z');assert.equal(await ready(db),false);
 assert.deepEqual((await db.query("SELECT * FROM staging_test_programme.programmes WHERE programme_key='xero-staging-20261012'")).rows,before);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM staging_test_programme.actions')).rows[0].n,1);
 const envelope=(await db.query('SELECT ciphertext,encrypted_dek,tenant_id FROM staging_test_programme.writer_envelopes WHERE programme_key=$1',[key])).rows[0];assert.equal(envelope.tenant_id,tenant);assert.notEqual(Buffer.from(envelope.ciphertext).toString(),'synthetic-refresh-token');
 await assert.rejects(s.complete({state,code:'synthetic-code'}));await assert.rejects(s.start('Bearer synthetic-owner-token'));
 await db.exec('SET ROLE night_scout_test_writer_service');await assert.rejects(db.query('SELECT * FROM staging_test_programme.xero_restart_20261030_oauth_states'));await assert.rejects(db.query('SELECT * FROM staging_test_programme.writer_envelopes'));
 await assert.rejects(db.query("SELECT staging_test_programme.claim_action_before_xero_20261030($1,'ns-'||repeat('c',40),repeat('d',64),'xero',$2,7)",[key,tenant]));await db.exec('RESET ROLE');
 }finally{await db.close();}
});
test('daily gate requires idle matching envelope and rejects replay, second same-day action and expired dates',async()=>{
 const db=await setup();try{await db.exec(proposal());await consent(service(db));await db.query('UPDATE staging_test_programme.programmes SET enabled=true WHERE programme_key=$1',[key]);await db.exec("UPDATE public.fixture_time SET at='2026-10-30T18:00:00Z'");
 assert.equal(await ready(db),true);assert.equal(await claim(db,'c',6),'blocked');assert.equal(await claim(db,'c',null),'blocked');assert.equal(await claim(db),'claimed');assert.equal(await claim(db),'existing');
 await db.query("UPDATE staging_test_programme.actions SET state='confirmed',source_id='synthetic-new',confirmed_at=public.fixture_clock() WHERE programme_key=$1",[key]);assert.equal(await claim(db,'e'),'blocked');
 for(const at of ['2026-10-30T17:59:59Z','2026-10-30T18:15:00Z','2026-11-06T18:00:00Z']){await db.query('UPDATE public.fixture_time SET at=$1',[at]);assert.equal(await ready(db),false);assert.equal(await claim(db,'e'),'blocked');}
 await db.exec("UPDATE public.fixture_time SET at='2026-10-31T18:00:00Z'");await db.query('UPDATE staging_test_programme.writer_envelopes SET refresh_claim=$2 WHERE programme_key=$1',[key,owner]);assert.equal(await ready(db),false);assert.equal(await claim(db,'e'),'blocked');
 await db.query('UPDATE staging_test_programme.writer_envelopes SET refresh_claim=NULL WHERE programme_key=$1',[key]);assert.equal(await claim(db,'e'),'claimed');
 await db.query("UPDATE staging_test_programme.actions SET state='confirmed',source_id='synthetic-new',confirmed_at=public.fixture_clock() WHERE programme_key=$1 AND state='claimed'",[key]);
 for(const [i,date] of ['2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05'].entries()){await db.query('UPDATE public.fixture_time SET at=$1',[date+'T18:00:00Z']);assert.equal(await claim(db,'f0123'[i]),'claimed');await db.query("UPDATE staging_test_programme.actions SET state='confirmed',source_id='synthetic-new',confirmed_at=public.fixture_clock() WHERE programme_key=$1 AND state='claimed'",[key]);}
 assert.equal((await db.query('SELECT count(*)::int AS n FROM staging_test_programme.actions WHERE programme_key=$1',[key])).rows[0].n,7);assert.equal(await claim(db,'9'),'blocked');
 await db.query('UPDATE staging_test_programme.programmes SET stopped=true WHERE programme_key=$1',[key]);assert.equal(await ready(db),false);
 }finally{await db.close();}
});
test('wrong owner, non-demo, missing contact scope and removed membership cannot seed',async()=>{
 const db=await setup();try{await db.exec(proposal());await assert.rejects(service(db,{authenticate:async()=>({userId:tenant,isOwner:true})}).start('Bearer synthetic-owner-token'));
 for(const scenario of ['non-demo','missing-contact-scope','ambiguous-tenant']){
 const s=service(db,{fetchImpl:async url=>new Response(JSON.stringify(url.endsWith('/token')?{access_token:'synthetic-access-token',refresh_token:'synthetic-refresh-token',scope:'offline_access accounting.invoices accounting.settings.read'+(scenario==='missing-contact-scope'?'':' accounting.contacts.read')}:url.endsWith('/connections')?[{tenantId:tenant,tenantType:'ORGANISATION'},...(scenario==='ambiguous-tenant'?[{tenantId:store,tenantType:'ORGANISATION'}]:[])]:{Organisations:[{IsDemoCompany:scenario!=='non-demo',BaseCurrency:'GBP'}]}))});
 const state=new URL((await s.start('Bearer synthetic-owner-token')).url).searchParams.get('state');await assert.rejects(s.complete({state,code:'synthetic-code'}));}
 const s=service(db),state=new URL((await s.start('Bearer synthetic-owner-token')).url).searchParams.get('state');await db.exec('DELETE FROM public.store_memberships');await assert.rejects(s.complete({state,code:'synthetic-code'}));assert.equal((await db.query('SELECT count(*)::int AS n FROM staging_test_programme.writer_envelopes')).rows[0].n,0);
 assert.throws(()=>service(db,{consentProfile:'unbounded'}));
 }finally{await db.close();}
});
test('unresolved old action and expired proposal refuse installation atomically',async()=>{
 for(const scenario of ['uncertain','expired']){const db=await setup();try{
 if(scenario==='uncertain')await db.exec("INSERT INTO staging_test_programme.actions(programme_key,action_key,payload_digest,state) VALUES('xero-staging-20261012','ns-'||repeat('e',40),repeat('d',64),'uncertain')");else await db.exec("UPDATE public.fixture_time SET at='2026-11-06T00:00:00Z'");
 await assert.rejects(db.exec(proposal()));await db.exec('ROLLBACK');assert.equal((await db.query("SELECT to_regclass('staging_test_programme.xero_restart_20261030_oauth_states') AS name")).rows[0].name,null);assert.equal((await db.query('SELECT count(*)::int AS n FROM staging_test_programme.programmes')).rows[0].n,1);
 }finally{await db.close();}}
});
test('new Xero wrapper preserves already-installed Shopify profile and its daily guard',async()=>{
 const db=await setup();try{
 const c={provider:'shopify',target:'pocketlaunchpad1.myshopify.com',startMonday:'2026-10-26',programmeKey:'shopify-staging-20261029',scheduleProfile:'daily-20261029-v1'},r={domain:c.target,currency:'GBP',partnerDevelopment:true,separateWriterApp:true,sameOrganisation:true,grantedScopes:['read_orders','write_orders'],observedAt:'2026-10-29T18:55:00Z'};
 await db.query("SELECT set_config('night_scout.shopify_writer_config',$1,false),set_config('night_scout.shopify_writer_receipt',$2,false)",[JSON.stringify(c),JSON.stringify(r)]);await db.exec(read('./shopify-daily-binding-proposal-2026-10-29.sql').replace(/\bnow\(\)/g,'public.fixture_clock()'));
 await db.exec(proposal());await consent(service(db));await db.query("UPDATE staging_test_programme.programmes SET enabled=true WHERE programme_key=$1",[c.programmeKey]);await db.exec("UPDATE public.fixture_time SET at='2026-10-30T18:00:00Z'");
 const shopClaim=async letter=>(await db.query('SELECT staging_test_programme.claim_action($1,$2,$3,$4,$5,7) AS state',[c.programmeKey,'ns-'+letter.repeat(40),'d'.repeat(64),'shopify',c.target])).rows[0].state;
 assert.equal(await shopClaim('c'),'claimed');await db.query("UPDATE staging_test_programme.actions SET state='confirmed',source_id='synthetic-shop',confirmed_at=public.fixture_clock() WHERE programme_key=$1",[c.programmeKey]);assert.equal(await shopClaim('e'),'blocked');
 assert.equal((await db.query('SELECT enabled FROM staging_test_programme.programmes WHERE programme_key=$1',[key])).rows[0].enabled,false);
 }finally{await db.close();}
});
