/** Managed ownership/transaction protocol fixtures only, not a financial-model oracle or live baseline. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {prepareManagedDailyGapProposal} from './daily-managed-gap-proposal.mjs';
import {prepareDailyGapProposal,GAP_CAPABILITY_SOURCE_SHA256} from './daily-gap-proposal.mjs';
import {prepareHostedDailyProposal} from './daily-hosted-proposal.mjs';
import {dailyTestPostgres,mkdtempTest} from './daily-test-runtime.mjs';
import {addDays} from './generator.mjs';
const source=await readFile(new URL('./daily-capability.sql',import.meta.url),'utf8');
const sha=value=>createHash('sha256').update(value).digest('hex');
const target='d7500000-0000-4000-8000-000000000009';
const manager={name:'postgres',login:true,superuser:false,bypassRls:true,replication:true,createRole:true,createDb:true,inherit:true};
const initial='2026-11-04',first='2026-11-05',last='2026-11-19',expiresAt='2026-11-21T01:45:00.000Z',reviewRef='Nov20 offline managed fifteen-day bridge fixture';
const approvalFor=days=>({storeId:target,initialThrough:initial,firstDay:first,lastDay:last,expiresAt,reviewRef,days});
const dummyDays=Array.from({length:15},(_,i)=>({day:addDays(first,i),materialSha256:'a'.repeat(64),sourceHash:'b'.repeat(64),reviewRef}));
function functions(sql){const found=[];for(const match of sql.matchAll(/CREATE FUNCTION finance_daily_gap_v1\./g)){const start=match.index,end=sql.indexOf('END$$;',start);assert.ok(end>start);found.push(sql.slice(start,end+7));}return found;}
test('managed bridge preserves the pinned ordinary source and every derived financial function body',()=>{
 assert.equal(sha(source),GAP_CAPABILITY_SOURCE_SHA256);
 const approval=approvalFor(dummyDays),base=prepareDailyGapProposal({capabilitySql:source,approval}),candidate=prepareManagedDailyGapProposal({capabilitySql:source,approval,managementRole:manager,managementReadAllData:true});
 assert.deepEqual(functions(candidate.sql),functions(base.sql));assert.equal(candidate.remoteApplied,false);assert.equal(candidate.activationAllowed,false);
 assert.match(candidate.sql,/SET LOCAL createrole_self_grant='set'/);assert.match(candidate.retirementSql,/Retirement requires only exact bootstrap/);
 assert.ok(candidate.retirementSql.indexOf('SET LOCAL ROLE daily_capability_owner')<candidate.retirementSql.indexOf('DROP FUNCTION'));
 assert.ok(candidate.retirementSql.indexOf('SET LOCAL ROLE daily_capability_reviewer')<candidate.retirementSql.indexOf('DROP TRIGGER'));
 for(const patch of [{managementRole:undefined},{managementRole:{...manager,superuser:true}},{capabilitySql:source+'\n'}])assert.throws(()=>prepareManagedDailyGapProposal({capabilitySql:source,approval,managementRole:manager,...patch}));
});
test('native managed bridge installs, rolls back, reconciles and retires with only declared bootstrap administration',{timeout:180000},async t=>{
 const {bin,share}=dailyTestPostgres(),dir=await mkdtempTest('managed-bridge-');
 const {Client}=createRequire(new URL('../../artifacts/api-server/package.json',import.meta.url))('pg');
 let admin,installer,runtime,observer,started=false;
 try{
  execFileSync(bin+'initdb',['-D',dir+'/data','-L',share,'-U','supabase_admin','--auth=trust','--no-locale','--encoding=UTF8'],{stdio:'pipe'});
  execFileSync(bin+'pg_ctl',['-D',dir+'/data','-l',dir+'/server.log','-o',`-h '' -k ${dir}`,'-w','start'],{stdio:'pipe'});started=true;
  const connect=async user=>{const c=new Client({host:dir,user,database:'postgres',password:async()=>'',ssl:false});await c.connect();return c;};
  admin=await connect('supabase_admin');await admin.query('CREATE ROLE postgres LOGIN CREATEROLE CREATEDB INHERIT NOSUPERUSER BYPASSRLS REPLICATION;ALTER DATABASE postgres OWNER TO postgres');
  await admin.query('GRANT pg_read_all_data TO postgres');installer=await connect('postgres');observer=await connect('supabase_admin');
  await installer.query('CREATE TABLE public.stores(id uuid PRIMARY KEY,currency_code text,timezone text);CREATE SCHEMA finance_v1;CREATE TABLE finance_v1.original_january(body jsonb);INSERT INTO finance_v1.original_january VALUES(\'{"protected":"original January protocol sentinel"}\')');
  await installer.query("INSERT INTO public.stores VALUES($1,'GBP','Europe/London'),('10000000-0000-4000-8000-000000000099','GBP','Europe/London')",[target]);
  await installer.query(await readFile(new URL('./history-schema.sql',import.meta.url),'utf8'));
  await installer.query("INSERT INTO finance_history_v2.contracts VALUES($1,'uk-gifts-v2','synthetic-history-v2-2026-11','2024-11-01',$2,'GBP','Europe/London')",[target,initial]);
  await installer.query("INSERT INTO finance_history_v2.orders VALUES('10000000-0000-4000-8000-000000000099','unrelated-retained-order','2026-11-04','{\"unrelated\":true}','retained-unrelated-fixture')");
  await installer.query(prepareHostedDailyProposal({capabilitySql:source,expectedThrough:initial,expectedSeals:0,managementRole:manager,managementReadAllData:true}).sql);
  const ordinaryDefinition=(await admin.query("SELECT pg_get_functiondef('finance_daily_v1.append_completed_day(date,date)'::regprocedure) body")).rows[0].body;
  const setClock=async iso=>admin.query(`CREATE OR REPLACE FUNCTION pg_catalog.clock_timestamp() RETURNS timestamptz LANGUAGE sql VOLATILE AS $$SELECT '${iso}'::timestamptz$$`);
  // Only this brand-new disposable cluster substitutes its server clock. Source functions are unchanged.
  await setClock('2026-11-20T10:00:00Z');
  const emptyHash=(await admin.query("SELECT encode(sha256(convert_to('[]','UTF8')),'hex') hash")).rows[0].hash;
  const base=(await admin.query("SELECT to_jsonb(t)-'through_day' body FROM finance_history_v2.contracts t WHERE store_id=$1",[target])).rows[0].body;
  const materials=[];
  for(let i=0;i<15;i++){
   const day=addDays(first,i),boundary=addDays(day,1)+'T00:00:00.000Z',runId=`10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,coverageId=`20000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,sourceHash='b'.repeat(64);
   const receipt={contract:'synthetic-daily-preparation-v1',runId,day,anchor:'2024-11-01',edition:'synthetic-history-v2-2026-11',profile:'uk-gifts-v2',sourceHash,sourceAsOf:boundary,inserted:0};
   const manifest={edition:receipt.edition,anchor:receipt.anchor,profile:receipt.profile,timezone:'Europe/London',formulaVersion:'night-scout-v11-2026-10-30',sourceAsOf:boundary,observedAt:boundary,scope:{storeId:target,currency:'GBP',from:day,to:day}};
   const material={contract:'reviewed-synthetic-daily-material-v1',storeId:target,day,expectedThrough:addDays(day,-1),edition:receipt.edition,profile:receipt.profile,anchor:receipt.anchor,sourceHash,
    sources:Object.fromEntries(['events','orders','refunds','lines','returns'].map(name=>[name,[]])),validationSets:Object.fromEntries(['events','orders','refunds','lines','returns'].map(name=>[name,{rowCount:0,sha256:emptyHash}])),
    coverage:[{coverage_id:coverageId,store_id:target,date_from:day,date_to:day,kind:'day',source_manifest:manifest,source_hash:sourceHash}],seals:[],run:{run_id:runId,store_id:target,date_from:day,date_to:day,source_hash:sourceHash,receipt}};
   const materialSha256=(await admin.query("SELECT encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') hash",[JSON.stringify(material)])).rows[0].hash;
   materials.push({day,material,materialSha256,sourceHash,reviewRef});
  }
  await installer.query('BEGIN;GRANT daily_capability_reviewer TO CURRENT_USER WITH ADMIN FALSE,INHERIT FALSE,SET TRUE GRANTED BY CURRENT_USER;SET LOCAL ROLE daily_capability_reviewer');
  await installer.query("INSERT INTO finance_daily_v1.programme(singleton,store_id,contract_base,initial_through,ceiling,protected_seals,enabled) VALUES(true,$1,$2,$3,$4,'[]',false)",[target,base,initial,last]);
  for(const m of materials)await installer.query('INSERT INTO finance_daily_v1.reviewed_days VALUES($1,$2,$3,$4)',[m.day,JSON.stringify(m.material),m.materialSha256,m.reviewRef]);
  await installer.query('RESET ROLE;REVOKE daily_capability_reviewer FROM CURRENT_USER GRANTED BY CURRENT_USER;COMMIT');
  const approval=approvalFor(materials.map(({day,materialSha256,sourceHash,reviewRef})=>({day,materialSha256,sourceHash,reviewRef}))),proposal=prepareManagedDailyGapProposal({capabilitySql:source,approval,managementRole:manager,managementReadAllData:true});
  const before=(await admin.query("SELECT jsonb_build_object('contract',(SELECT to_jsonb(t) FROM finance_history_v2.contracts t WHERE store_id=$1),'january',(SELECT jsonb_agg(body) FROM finance_v1.original_january),'other',(SELECT jsonb_agg(to_jsonb(t)) FROM finance_history_v2.orders t WHERE store_id<>$1)) body",[target])).rows[0].body;
  await t.test('late installation failure atomically restores role, namespace, permanent authority and settings',async()=>{
   await assert.rejects(installer.query(proposal.sql.replace('COMMIT;','SELECT 1/0;\nCOMMIT;')),/division by zero/);await installer.query('ROLLBACK');
   assert.equal((await admin.query("SELECT to_regnamespace('finance_daily_gap_v1') IS NULL absent")).rows[0].absent,true);
   assert.equal((await admin.query("SELECT count(*)::int n FROM pg_roles WHERE rolname='daily_gap_invoker'")).rows[0].n,0);
   assert.equal((await installer.query("SELECT current_setting('createrole_self_grant') value")).rows[0].value,'');
   assert.equal((await admin.query("SELECT pg_get_functiondef('finance_daily_v1.append_completed_day(date,date)'::regprocedure) body")).rows[0].body,ordinaryDefinition);
  });
  await t.test('legacy guard refuses implicit usage and forged direct schema grant is not accepted',async()=>{
   const legacy=prepareManagedDailyGapProposal({capabilitySql:source,approval,managementRole:manager});await assert.rejects(installer.query(legacy.sql),/Unexpected existing managed bridge installation access/);await installer.query('ROLLBACK');
   await admin.query('GRANT USAGE ON SCHEMA finance_daily_v1 TO postgres');await assert.rejects(installer.query(proposal.sql),/Exact inherited read-all baseline/);await installer.query('ROLLBACK');await admin.query('REVOKE USAGE ON SCHEMA finance_daily_v1 FROM postgres');
  });
  await installer.query(proposal.sql);
  await t.test('installation leaves exact bootstrap-only management and no selectable, inherited or CREATE authority',async()=>{
   const rows=(await admin.query("SELECT m.rolname member,g.oid grantor,a.admin_option,a.set_option,a.inherit_option FROM pg_auth_members a JOIN pg_roles p ON p.oid=a.roleid JOIN pg_roles m ON m.oid=a.member JOIN pg_roles g ON g.oid=a.grantor WHERE p.rolname='daily_gap_invoker'")).rows;
   assert.deepEqual(rows,[{member:'postgres',grantor:10,admin_option:true,set_option:false,inherit_option:false}]);
   for(const role of ['daily_capability_owner','daily_capability_reviewer','daily_gap_invoker'])assert.equal((await installer.query("SELECT pg_has_role(current_user,$1,'SET') v",[role])).rows[0].v,false);
   assert.equal((await admin.query("SELECT has_schema_privilege('daily_capability_owner','finance_daily_gap_v1','CREATE') v")).rows[0].v,false);
   assert.equal((await admin.query("SELECT has_database_privilege('daily_capability_reviewer',current_database(),'CREATE') v")).rows[0].v,false);
   assert.equal((await installer.query("SELECT pg_has_role(current_user,'pg_read_all_data','USAGE') v")).rows[0].v,true);
   assert.equal((await installer.query("SELECT has_schema_privilege(current_user,'finance_daily_v1','USAGE') v")).rows[0].v,true);
   assert.equal((await admin.query("SELECT count(*)::int n FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a WHERE n.nspname='finance_daily_v1' AND a.grantee=(SELECT oid FROM pg_roles WHERE rolname='postgres')")).rows[0].n,0);
  });
  await admin.query('CREATE ROLE bridge_fixture_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION');
  await installer.query('GRANT daily_gap_invoker TO bridge_fixture_runtime WITH ADMIN FALSE,INHERIT FALSE,SET TRUE');runtime=await connect('bridge_fixture_runtime');await runtime.query('SET ROLE daily_gap_invoker');
  await installer.query('BEGIN;GRANT daily_capability_reviewer TO CURRENT_USER WITH ADMIN FALSE,INHERIT FALSE,SET TRUE GRANTED BY CURRENT_USER;SET LOCAL ROLE daily_capability_reviewer;UPDATE finance_daily_gap_v1.approval SET enabled=true;RESET ROLE;REVOKE daily_capability_reviewer FROM CURRENT_USER GRANTED BY CURRENT_USER;COMMIT');
  await t.test('expired finite approval refuses every write',async()=>{
   // A separate expiry backend prevents cached test-only SQL clock substitution leaking
   // between scenarios. Production always uses PostgreSQL's stock server clock.
   await setClock(expiresAt);const expired=await connect('bridge_fixture_runtime');
   try{await expired.query('SET ROLE daily_gap_invoker');await expired.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await assert.rejects(expired.query('SELECT finance_daily_gap_v1.publish_approved_gap()'),/unexpired/);await expired.query('ROLLBACK');}finally{await expired.end();}
   await setClock('2026-11-20T10:00:00Z');
   assert.equal((await observer.query('SELECT count(*)::int n FROM finance_daily_v1.publication_receipts')).rows[0].n,0);
  });
  await t.test('a fifteen-day publication can be rolled back without advancing horizon or original data',async()=>{
   await runtime.query('BEGIN ISOLATION LEVEL SERIALIZABLE');const result=(await runtime.query('SELECT finance_daily_gap_v1.publish_approved_gap() result')).rows[0].result;assert.equal(result.days.length,15);await runtime.query('ROLLBACK');
   assert.equal((await observer.query('SELECT through_day::text AS result_day FROM finance_history_v2.contracts WHERE store_id=$1',[target])).rows[0].result_day,initial);assert.equal((await observer.query('SELECT count(*)::int n FROM finance_daily_v1.publication_receipts')).rows[0].n,0);
  });
  await t.test('retirement before committed publication and unprivileged retirement are refused',async()=>{
   await assert.rejects(installer.query(proposal.retirementSql),/Committed gap horizon/);await installer.query('ROLLBACK');await assert.rejects(runtime.query('DROP SCHEMA finance_daily_gap_v1'),/must be owner|permission denied/);
  });
  await runtime.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await runtime.query('SELECT finance_daily_gap_v1.publish_approved_gap()');await runtime.query('COMMIT');
  await t.test('independent receipt inspection reconciles all committed days while ordinary programme stays disabled',async()=>{
   assert.equal((await observer.query('SELECT count(*)::int n FROM finance_daily_v1.publication_receipts')).rows[0].n,15);
   for(const day of materials.map(m=>m.day)){const result=(await observer.query('SELECT finance_daily_v1.inspect_daily_receipt($1) result',[day])).rows[0].result;assert.equal(result.state,'committed-reconciled');}
   assert.equal((await observer.query('SELECT enabled FROM finance_daily_v1.programme')).rows[0].enabled,false);
  });
  await t.test('separate gap membership blocks retirement; declared bootstrap-only edge permits complete authority retirement',async()=>{
   await assert.rejects(installer.query(proposal.retirementSql),/only exact bootstrap/);await installer.query('ROLLBACK');
   await runtime.query('RESET ROLE');await installer.query('REVOKE daily_gap_invoker FROM bridge_fixture_runtime GRANTED BY CURRENT_USER');
   await installer.query(proposal.retirementSql);
   assert.equal((await observer.query("SELECT to_regnamespace('finance_daily_gap_v1') IS NULL absent")).rows[0].absent,true);assert.equal((await observer.query("SELECT count(*)::int n FROM pg_roles WHERE rolname='daily_gap_invoker'")).rows[0].n,0);
   assert.equal((await observer.query('SELECT count(*)::int n FROM finance_daily_v1.publication_receipts')).rows[0].n,15);
   assert.equal((await observer.query("SELECT pg_get_functiondef('finance_daily_v1.append_completed_day(date,date)'::regprocedure) body")).rows[0].body,ordinaryDefinition);
   const after=(await observer.query("SELECT jsonb_build_object('contract',(SELECT to_jsonb(t) FROM finance_history_v2.contracts t WHERE store_id=$1),'january',(SELECT jsonb_agg(body) FROM finance_v1.original_january),'other',(SELECT jsonb_agg(to_jsonb(t)) FROM finance_history_v2.orders t WHERE store_id<>$1)) body",[target])).rows[0].body;
   assert.deepEqual(after,{...before,contract:{...before.contract,through_day:last}});
   assert.equal((await installer.query("SELECT pg_has_role(current_user,'pg_read_all_data','USAGE') v")).rows[0].v,true);
   for(const role of ['daily_capability_owner','daily_capability_reviewer'])assert.equal((await installer.query("SELECT pg_has_role(current_user,$1,'SET') v",[role])).rows[0].v,false);
  });
 }finally{if(runtime)await runtime.end();if(observer)await observer.end();if(installer)await installer.end();if(admin)await admin.end();if(started)execFileSync(bin+'pg_ctl',['-D',dir+'/data','-m','fast','-w','stop'],{stdio:'pipe'});}
});
