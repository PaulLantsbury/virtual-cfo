import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {setup,sql,U} from '../shopify/finance-fixture.mjs';
import {checkDemoReaderForWriter} from './demo-reader-activation-check.mjs';
const proposal=readFileSync(new URL('../../db-migrations/proposals/xero-demo-isolation-2026-10-30.sql',import.meta.url),'utf8');
const original='56d92f8a-746e-4b4f-b408-81fc98c4aa17',demo='f59e3a44-7106-4df8-9c08-52da30c9de30',legacyConnection='30000000-0000-4000-8000-000000000001',connection='30000000-0000-4000-8000-000000000002',tenant='40000000-0000-4000-8000-000000000002';
const accounts=['Revenue','Fees','Ads','Software','Cash','Revenue'].map((accountName,i)=>({accountId:`70000000-0000-4000-8000-00000000000${i+1}`,accountName,accountType:i===0||i===5?'REVENUE':i===4?'BANK':'EXPENSE',accountStatus:'ACTIVE'}));
const mapping=['revenue','processingFee','advertising','software','includedCash'].map((category,i)=>({category,accountId:accounts[i].accountId}));
const migrate=name=>sql('staging/'+name);
// PGlite RESET SESSION AUTHORIZATION retains its last simulated user; explicitly
// restore this disposable database's initial administrator between role exercises.
async function admin(db){await db.exec('SET SESSION AUTHORIZATION postgres;RESET ROLE');}
async function as(db,login,service){await admin(db);await db.exec(`SET SESSION AUTHORIZATION ${login}`);if(service)await db.exec(`SET ROLE ${service}`);}
async function fixture({apply=true,proposalSql=proposal,fixtureClock=false}={}){
 const {db}=await setup();
 await db.exec(sql('proposals/shopify-intake-2026-09-17.sql'));await db.query('INSERT INTO public.store_memberships VALUES($1,$2)',[U,original]);
 await db.exec('CREATE ROLE night_scout_import_login LOGIN NOINHERIT CONNECTION LIMIT 1 PASSWORD NULL;CREATE ROLE night_scout_test_writer LOGIN NOINHERIT;CREATE ROLE night_scout_test_writer_service NOLOGIN NOINHERIT;');
 for(const name of ['20260918_apply_xero_staging.sql','20260918_grant_xero_worker_access.sql','20260918_grant_xero_bootstrap_access.sql','20260924_bind_xero_bootstrap_connection_id.sql','20260925_xero_single_refresh_job.sql','20261003_xero_connection_preflight_evidence.sql','20261003_xero_connection_preflight_job.sql'])await db.exec(migrate(name));
 await as(db,'night_scout_xero_bootstrap_login');
 const oldReceipt=(await db.query('SELECT * FROM xero_v1.bootstrap_create_initial_connection($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[legacyConnection,original,'legacy-real-reader-tenant',U,'2026-09-01',new Date().toISOString(),JSON.stringify(accounts),JSON.stringify(mapping),Buffer.alloc(32,1),Buffer.alloc(32,2),'legacy-key','AES-256-GCM'])).rows[0];
 await admin(db);
 if(fixtureClock)await db.exec("CREATE TABLE public.demo_fixture_time(at timestamptz);INSERT INTO public.demo_fixture_time VALUES(clock_timestamp());CREATE FUNCTION public.demo_fixture_clock() RETURNS timestamptz LANGUAGE sql AS $$SELECT at FROM public.demo_fixture_time$$;");
 if(apply)await db.exec(proposalSql);
 async function bootstrap({receiptOverride={},paramsOverride={},source=true}={}){
  const observedAt=fixtureClock?(await db.query('SELECT at FROM public.demo_fixture_time')).rows[0].at.toISOString():new Date().toISOString();
  const p={connectionId:connection,storeId:demo,tenantId:tenant,ownerId:U,effectiveFrom:'2026-10-01',retrievedAt:observedAt,accounts,mapping,...paramsOverride};
  await as(db,'night_scout_demo_bootstrap_login','night_scout_demo_bootstrap_service');await db.exec('BEGIN');
  try{
   if(source)await db.query("SELECT set_config('night_scout.demo_reader_source_receipt',$1,true)",[JSON.stringify({connectionId:p.connectionId,storeId:p.storeId,ownerId:p.ownerId,tenantId:p.tenantId,isDemoCompany:true,baseCurrency:'GBP',observedAt,...receiptOverride})]);
   const result=(await db.query('SELECT * FROM xero_demo_v1.bootstrap_create_initial_connection($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[p.connectionId,p.storeId,p.tenantId,p.ownerId,p.effectiveFrom,p.retrievedAt,JSON.stringify(p.accounts),JSON.stringify(p.mapping),Buffer.alloc(32,3),Buffer.alloc(32,4),'demo-key','AES-256-GCM'])).rows[0];await db.exec('COMMIT');return result;
  }catch(e){await db.exec('ROLLBACK');throw e;}finally{await admin(db);}
 }
 async function reader(){await as(db,'night_scout_demo_import_login','night_scout_demo_import_service');}
 async function status({user=U,scope=demo}={}){await admin(db);await db.exec('BEGIN');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user??'']);await db.exec('SET LOCAL ROLE authenticated');return (await db.query('SELECT public.xero_demo_reader_status_v1($1) result',[scope])).rows[0].result;}finally{await db.exec('ROLLBACK');}}
 async function oldSnapshot(){await admin(db);const rows={};for(const table of ['connections','account_directories','mapping_versions','mapping_selections','mapping_audit','credential_envelopes','credential_audit','accounting_evidence','accounting_evidence_audit','connection_preflight_evidence'])rows[table]=(await db.query(`SELECT to_jsonb(t) row FROM xero_v1.${table} t ORDER BY to_jsonb(t)::text`)).rows;rows.functions=(await db.query("SELECT proname,pg_get_functiondef(oid) definition FROM pg_proc WHERE pronamespace='xero_v1'::regnamespace ORDER BY proname")).rows;return rows;}
 return {db,bootstrap,reader,status,oldReceipt,oldSnapshot,close:async()=>{await admin(db);await db.close();}};
}

test('one-shot installs only isolated store/schema/roles; old global reader selection and contents stay unchanged',async()=>{
 const f=await fixture({apply:false});try{
  const before=await f.oldSnapshot();await f.db.exec(proposal);const receipt=await f.bootstrap();
  assert.deepEqual(await f.oldSnapshot(),before);
  await as(f.db,'night_scout_import_login');
  assert.deepEqual((await f.db.query('SELECT * FROM xero_v1.worker_get_single_connection_preflight_job()')).rows,[f.oldReceipt]);
  assert.deepEqual((await f.db.query("SELECT * FROM xero_v1.worker_get_single_refresh_job('2026-10-01','2026-10-29','GBP',false)")).rows,[f.oldReceipt]);
  await f.reader();assert.deepEqual((await f.db.query('SELECT * FROM xero_demo_v1.worker_get_single_connection_preflight_job()')).rows,[receipt]);
  await assert.rejects(f.db.query('SELECT * FROM xero_v1.worker_get_single_connection_preflight_job()'),/permission|capability/);
  assert.deepEqual((await f.db.query('SELECT * FROM xero_demo_v1.worker_get_refresh_context($1,$2)',[legacyConnection,f.oldReceipt.mapping_version_id])).rows,[]);
  await admin(f.db);assert.equal((await f.db.query('SELECT count(*)::int n FROM public.store_memberships WHERE store_id=$1',[demo])).rows[0].n,1);
  await assert.rejects(f.db.exec(proposal),/occupied/);await f.db.exec('ROLLBACK');assert.deepEqual(await f.oldSnapshot(),before);
 }finally{await f.close();}
});

test('bootstrap demands fresh actual-source metadata binding, sole owner and exact demo scope; failure creates no partial connection',async()=>{
 const f=await fixture();try{
  for(const input of [{source:false},{receiptOverride:{isDemoCompany:false}},{receiptOverride:{baseCurrency:'USD'}},{receiptOverride:{tenantId:'40000000-0000-4000-8000-000000000009'}},{receiptOverride:{observedAt:new Date(Date.now()-3600000).toISOString()}},{receiptOverride:{observedAt:new Date(Date.now()+60000).toISOString()}},{paramsOverride:{storeId:original}},{paramsOverride:{ownerId:'80000000-0000-4000-8000-000000000009'}},{paramsOverride:{mapping:mapping.slice(0,4)}},{paramsOverride:{retrievedAt:new Date(Date.now()-3600000).toISOString()}},{paramsOverride:{accounts:accounts.map((a,i)=>i===0?{...a,accountType:'EXPENSE'}:a)}},{paramsOverride:{accounts:accounts.map(a=>({...a,accountStatus:'ARCHIVED'}))}}]){
   await assert.rejects(f.bootstrap(input));assert.equal((await f.db.query('SELECT count(*)::int n FROM xero_demo_v1.connections')).rows[0].n,0);
  }
  await f.bootstrap();await assert.rejects(f.bootstrap(),/already exists/);assert.equal((await f.db.query('SELECT count(*)::int n FROM xero_demo_v1.connections')).rows[0].n,1);
 }finally{await f.close();}
});

test('independent reader gate requires exact current revenue account ID and fresh health; mapping failures also remove member binding eligibility',async()=>{
 const f=await fixture();try{
  const r=await f.bootstrap();
  await f.db.query("INSERT INTO xero_demo_v1.connection_preflight_evidence(connection_id,credential_version,outcome,phase,reason,tenant_visible) VALUES($1,1,'connected','organisation','ok',true)",[connection]);
  await f.db.query("INSERT INTO xero_demo_v1.accounting_evidence(connection_id,mapping_version_id,scope_from,scope_to,currency,state,report_as_of,retrieved_at,source_fingerprint,booked_revenue_minor,processing_fee_minor,advertising_minor,software_minor,included_cash_minor) VALUES($1,$2,'2026-10-01','2026-10-29','GBP','supported','2026-10-29',now(),$3,0,0,0,0,0)",[connection,r.mapping_version_id,'c'.repeat(64)]);
  const check=patch=>checkDemoReaderForWriter(f.db,{storeId:demo,tenantId:tenant,accountId:accounts[0].accountId,scopeFrom:'2026-10-01',scopeTo:'2026-10-29',...patch});
  const good=await check();assert.equal(good.reader_gate_passed,true);assert.equal(good.activationAuthorized,false);assert.equal(good.exactInvoiceLinkageVerified,false);
  assert.equal((await check({accountId:accounts[1].accountId})).reader_gate_passed,false,'expense category cannot stand in for revenue');
  assert.equal((await check({accountId:accounts[5].accountId})).reader_gate_passed,false,'same Revenue name/type with a different unmapped ID is refused');
  assert.equal((await check({tenantId:'40000000-0000-4000-8000-000000000099'})).reader_gate_passed,false);
  assert.equal((await check({scopeFrom:'2026-10-02'})).supported_scope_matches,false);
  await f.db.query("INSERT INTO xero_demo_v1.accounting_evidence(connection_id,mapping_version_id,scope_from,scope_to,currency,state,report_as_of,retrieved_at,source_fingerprint,booked_revenue_minor,processing_fee_minor,advertising_minor,software_minor,included_cash_minor) VALUES($1,$2,'2026-10-01','2026-10-28','GBP','supported','2026-10-28',now(),$3,0,0,0,0,0)",[connection,r.mapping_version_id,'d'.repeat(64)]);
  assert.equal((await check({scopeTo:'2026-10-28'})).scope_current,false,'historic success cannot stand in for the actual completed London period');
  await f.db.query("UPDATE xero_demo_v1.connection_preflight_evidence SET checked_at=now()-interval '2 hours' WHERE connection_id=$1",[connection]);assert.equal((await check()).reader_gate_passed,false);assert.equal((await f.status()).readerHealth.state,'stale');
  await f.db.query("UPDATE xero_demo_v1.connection_preflight_evidence SET checked_at=now() WHERE connection_id=$1",[connection]);
  await f.db.query("INSERT INTO xero_demo_v1.accounting_evidence(connection_id,mapping_version_id,scope_from,scope_to,currency,state,reason,retrieved_at) VALUES($1,$2,'2026-10-01','2026-10-29','GBP','failed','source_refresh_failed',now())",[connection,r.mapping_version_id]);
  assert.equal((await check()).supported_scope_matches,false,'newer failed actual period supersedes older success for activation');
  await f.db.query("INSERT INTO xero_demo_v1.accounting_evidence(connection_id,mapping_version_id,scope_from,scope_to,currency,state,reason,retrieved_at) VALUES($1,$2,'2026-10-01','2026-10-29','GBP','review_required','account_mapping_review_required',now())",[connection,r.mapping_version_id]);
  assert.equal((await check()).reader_gate_passed,false);const status=await f.status();assert.equal(status.mappingState,'review_required');assert.deepEqual(status.revenueAccountIds,[]);assert.equal(status.latestSupportedPeriod,null);
  await assert.rejects(check({storeId:original}));
 }finally{await f.close();}
});

test('reader leases rotate once, preserve fence, persist bounded evidence and reject stale/replay/expired context',async()=>{
 const f=await fixture();try{
  const r=await f.bootstrap();await f.reader();
  const ctx=(await f.db.query('SELECT * FROM xero_demo_v1.worker_get_refresh_context($1,$2)',[connection,r.mapping_version_id])).rows[0];assert.equal(ctx.store_id,demo);assert.equal(ctx.version,1);
  const lease=(await f.db.query('SELECT xero_demo_v1.worker_acquire_refresh_lease($1,1,300) lease',[connection])).rows[0].lease;assert.ok(lease);
  assert.equal((await f.db.query('SELECT xero_demo_v1.worker_acquire_refresh_lease($1,1,300) lease',[connection])).rows[0].lease,null);
  assert.equal((await f.db.query("SELECT xero_demo_v1.worker_store_refresh_envelope_leased($1,$2,$3,'demo-key','AES-256-GCM',1,2,$4) ok",[connection,Buffer.alloc(32,5),Buffer.alloc(32,6),lease])).rows[0].ok,true);
  assert.equal((await f.db.query("SELECT xero_demo_v1.worker_store_refresh_envelope_leased($1,$2,$3,'demo-key','AES-256-GCM',1,2,$4) ok",[connection,Buffer.alloc(32,5),Buffer.alloc(32,6),lease])).rows[0].ok,false);
  const args=[connection,r.mapping_version_id,'a'.repeat(64),lease];
  const write="SELECT xero_demo_v1.worker_record_accounting_evidence_leased($1,$2,'2026-10-01','2026-10-29','GBP',false,'supported',NULL,'2026-10-29',now(),$3,100,2,3,4,5,2,$4) evidence_id";
  await f.db.query(write,args);await assert.rejects(f.db.query(write,args),/fence unavailable/);
  await admin(f.db);const status=await f.status();assert.equal(status.mappingState,'current');assert.deepEqual(status.revenueAccountIds,[accounts[0].accountId]);assert.equal(status.latestSupportedPeriod.values.bookedRevenueMinor,100);
  await assert.rejects(f.db.query('DELETE FROM xero_demo_v1.accounting_evidence'),/append-only/);
  await f.reader();const next=(await f.db.query('SELECT xero_demo_v1.worker_acquire_refresh_lease($1,2,30) lease',[connection])).rows[0].lease;assert.ok(next);await admin(f.db);await f.db.query("UPDATE xero_demo_v1.credential_envelopes SET lease_expires_at=now()-interval '1 second' WHERE connection_id=$1",[connection]);await f.reader();
  await assert.rejects(f.db.query("SELECT xero_demo_v1.worker_record_connection_preflight($1,2,'connected','organisation','ok',NULL,true,$2)",[connection,next]),/lease unavailable/);
 }finally{await f.close();}
});

test('private demo capabilities exclude browser/old-reader/writer roles; member metadata has exact scope and no credentials',async()=>{
 const f=await fixture();try{
  await f.bootstrap();
  for(const role of ['anon','authenticated','night_scout_import_login','night_scout_xero_bootstrap_login','night_scout_test_writer','night_scout_test_writer_service']){await as(f.db,role);await assert.rejects(f.db.query('SELECT * FROM xero_demo_v1.credential_envelopes'),/permission/);await assert.rejects(f.db.query('SELECT * FROM xero_demo_v1.worker_get_single_connection_preflight_job()'),/permission|capability/);}
  await f.reader();await assert.rejects(f.db.query('SELECT * FROM xero_demo_v1.credential_envelopes'),/permission/);await assert.rejects(f.db.query('SELECT * FROM xero_v1.credential_envelopes'),/permission/);
  const status=await f.status();assert.equal(status.storeId,demo);assert.equal(status.tenantId,tenant);assert.equal(status.readerHealth.state,'unavailable');assert.equal(status.latestSupportedPeriod,null);assert.doesNotMatch(JSON.stringify(status),/ciphertext|encrypted_dek|demo-key|credential_version|connection_id/);
  await assert.rejects(f.status({scope:original}));await assert.rejects(f.status({user:null}));await admin(f.db);await f.db.query('DELETE FROM public.store_memberships WHERE store_id=$1',[demo]);await assert.rejects(f.status());
 }finally{await f.close();}
});

test('current mapping must cover the whole requested period; selector and direct evidence RPC cannot fall back to older mapping',async()=>{
 const f=await fixture();try{
  const first=await f.bootstrap();
  const next=(await f.db.query("INSERT INTO xero_demo_v1.mapping_versions(connection_id,version,effective_from,confirmed_by,confirmed_at,directory_retrieved_at,supersedes_id) SELECT connection_id,2,current_date,confirmed_by,now(),directory_retrieved_at,id FROM xero_demo_v1.mapping_versions WHERE id=$1 RETURNING id",[first.mapping_version_id])).rows[0].id;
  await f.db.query('INSERT INTO xero_demo_v1.mapping_selections SELECT $1,category,account_id FROM xero_demo_v1.mapping_selections WHERE mapping_version_id=$2',[next,first.mapping_version_id]);
  await f.reader();await assert.rejects(f.db.query("SELECT * FROM xero_demo_v1.worker_get_single_refresh_job('2026-10-01','2026-10-29','GBP',false)"),/unavailable/);
  const lease=(await f.db.query('SELECT xero_demo_v1.worker_acquire_refresh_lease($1,1,300) lease',[connection])).rows[0].lease;
  const write="SELECT xero_demo_v1.worker_record_accounting_evidence_leased($1,$2,$3,$4,$5,$6,'failed','source_refresh_failed',NULL,now(),NULL,NULL,NULL,NULL,NULL,NULL,1,$7)";
  const args=[connection,next,'2026-10-01','2026-10-29','GBP',false,lease];
  await assert.rejects(f.db.query(write,args),/fence unavailable/);
  await assert.rejects(f.db.query(write,[...args.slice(0,1),first.mapping_version_id,...args.slice(2)]),/fence unavailable/);
  for(const patch of [{index:4,value:'EUR'},{index:5,value:true},{index:2,value:'2026-08-01'},{index:3,value:'2099-01-01'}]){const bad=[...args];bad[patch.index]=patch.value;await assert.rejects(f.db.query(write,bad),/bounded demo accounting scope/);}
  await admin(f.db);assert.equal((await f.db.query('SELECT count(*)::int n FROM xero_demo_v1.accounting_evidence')).rows[0].n,0);
  await f.db.query("UPDATE xero_demo_v1.mapping_versions SET effective_from='2026-10-01' WHERE id=$1",[next]);await f.reader();
  assert.deepEqual((await f.db.query("SELECT * FROM xero_demo_v1.worker_get_single_refresh_job('2026-10-01','2026-10-29','GBP',false)")).rows,[{connection_id:connection,mapping_version_id:next}]);
 }finally{await f.close();}
});

test('new-store prerequisites/occupied targets fail atomically without old reader or membership changes',async()=>{
 for(const tamper of ["INSERT INTO public.store_memberships SELECT '80000000-0000-4000-8000-000000000001',id FROM public.stores WHERE id='90000000-0000-4000-8000-000000000002'",'CREATE SCHEMA xero_demo_v1']){
  const f=await fixture({apply:false});try{
   if(tamper.startsWith('INSERT'))await f.db.query('DELETE FROM public.store_memberships WHERE store_id=$1',[original]);else await f.db.exec(tamper);
   const before=await f.oldSnapshot();await assert.rejects(f.db.exec(proposal));await f.db.exec('ROLLBACK');assert.deepEqual(await f.oldSnapshot(),before);assert.equal((await f.db.query('SELECT count(*)::int n FROM public.stores WHERE id=$1',[demo])).rows[0].n,0);assert.equal((await f.db.query("SELECT count(*)::int n FROM pg_roles WHERE rolname='night_scout_demo_import_login'")).rows[0].n,0);
  }finally{await f.close();}
 }
});

test('bounded intake refuses expired jobs/setup but preserves historical reads and exact leased credential cleanup',async()=>{
 // Clock substitution is isolated to this disposable SQL clone, never an env
 // override or operational option in the proposal/runtime.
 const f=await fixture({fixtureClock:true,proposalSql:proposal.replace(/clock_timestamp\(\)/g,'public.demo_fixture_clock()')});try{
  const r=await f.bootstrap();
  await f.db.exec("UPDATE public.demo_fixture_time SET at='2026-11-06T02:59:00Z'");await f.reader();
  const lease=(await f.db.query('SELECT xero_demo_v1.worker_acquire_refresh_lease($1,1,300) lease',[connection])).rows[0].lease;assert.ok(lease);
  await admin(f.db);await f.db.exec("UPDATE public.demo_fixture_time SET at='2026-11-06T03:00:00Z'");await f.reader();
  await assert.rejects(f.db.query('SELECT * FROM xero_demo_v1.worker_get_single_connection_preflight_job()'),/outside approved window/);
  await assert.rejects(f.db.query("SELECT * FROM xero_demo_v1.worker_get_single_refresh_job('2026-11-01','2026-11-05','GBP',false)"),/outside approved window/);
  await assert.rejects(f.db.query('SELECT * FROM xero_demo_v1.worker_get_refresh_context($1,$2)',[connection,r.mapping_version_id]),/outside approved window/);
  assert.equal((await f.db.query('SELECT xero_demo_v1.worker_acquire_refresh_lease($1,1,300) lease',[connection])).rows[0].lease,null);
  assert.equal((await f.db.query("SELECT xero_demo_v1.worker_store_refresh_envelope_leased($1,$2,$3,'demo-key','AES-256-GCM',1,2,$4) ok",[connection,Buffer.alloc(32,7),Buffer.alloc(32,8),lease])).rows[0].ok,true,'save an already-rotated provider credential under its still-live exact lease');
  assert.equal((await f.db.query("SELECT xero_demo_v1.worker_record_connection_preflight($1,2,'failed','organisation','non_demo_organisation',NULL,true,$2) ok",[connection,lease])).rows[0].ok,true);
  await assert.rejects(f.db.query("SELECT xero_demo_v1.worker_record_accounting_evidence_leased($1,$2,'2026-11-01','2026-11-05','GBP',false,'failed','source_refresh_failed',NULL,now(),NULL,NULL,NULL,NULL,NULL,NULL,2,$3)",[connection,r.mapping_version_id,lease]),/outside approved window/);
  assert.equal((await f.db.query('SELECT xero_demo_v1.worker_release_refresh_lease($1,2,$2) ok',[connection,lease])).rows[0].ok,true);
  assert.deepEqual((await f.db.query("SELECT * FROM xero_demo_v1.worker_get_latest_supported_evidence($1,$2,'2026-11-01','2026-11-05','GBP',false)",[connection,r.mapping_version_id])).rows,[]);
  assert.equal((await f.status()).storeId,demo);
  await assert.rejects(f.bootstrap(),/outside approved window/);
  await admin(f.db);await assert.rejects(f.db.exec(proposal.replace(/clock_timestamp\(\)/g,'public.demo_fixture_clock()')),/proposal expired/);await f.db.exec('ROLLBACK');
 }finally{await f.close();}
});
