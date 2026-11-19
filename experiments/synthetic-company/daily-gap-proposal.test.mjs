/** Disposable native PostgreSQL only; no hosted URL, credentials or clock replacement. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {prepareDailyGapProposal,validateGapApproval,GAP_CAPABILITY_SOURCE_SHA256} from './daily-gap-proposal.mjs';
import {RESERVED_SYNTHETIC_IDENTITY as identity,stableId} from './staging-payload.mjs';
import {historySourceAsOf} from './history-context.mjs';
import {dailyTestPostgres,mkdtempTest} from './daily-test-runtime.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const source=await readFile(new URL('./daily-capability.sql',import.meta.url),'utf8');
const days=['2024-11-05','2024-11-06'];
const basic=()=>({storeId:identity.storeId,initialThrough:'2024-11-04',firstDay:days[0],lastDay:days[1],expiresAt:new Date(Date.now()+86400000).toISOString(),reviewRef:'disposable gap review',days:days.map(day=>({day,materialSha256:'a'.repeat(64),sourceHash:'b'.repeat(64),reviewRef:'disposable material review'}))});
test('gap generator pins original bytes and makes only explicit private authority',()=>{
 assert.equal(hash(source),GAP_CAPABILITY_SOURCE_SHA256);const p=prepareDailyGapProposal({capabilitySql:source,approval:basic()});
 assert.equal(p.status,'private-fixed-gap-proposal-only');assert.equal(p.remoteApplied,false);assert.equal(p.activationAllowed,false);
 assert.ok(!p.sql.includes('CREATE OR REPLACE FUNCTION'));assert.ok(!p.sql.includes('CREATE FUNCTION finance_daily_v1.append_completed_day'));
 assert.match(p.sql,/publish_approved_gap\(\)/);assert.match(p.sql,/serializable/);assert.match(p.sql,/pg_catalog\.clock_timestamp\(\)/);
 assert.match(p.sql,/review_ref/);assert.match(p.sql,/materialSha256/);assert.match(p.sql,/false\);/);
 assert.match(p.retirementSql,/DROP SCHEMA finance_daily_gap_v1 RESTRICT/);assert.ok(!p.retirementSql.includes('CASCADE'));assert.ok(!p.retirementSql.includes('DROP SCHEMA finance_daily_v1'));
 assert.throws(()=>prepareDailyGapProposal({capabilitySql:source+'\n',approval:basic()}),/pinned/);
 for(const edit of [a=>a.storeId='10000000-0000-4000-8000-000000000099',a=>a.firstDay='2024-11-06',a=>a.days.reverse(),a=>a.days[0].materialSha256='bad',a=>a.extra=true,a=>a.expiresAt='forever']){const a=basic();edit(a);assert.throws(()=>validateGapApproval(a));}
});
test('fixed two-day gap uses actual restricted PostgreSQL logins and real clock',{timeout:120000},async t=>{
 const {bin,share}=dailyTestPostgres(),dir=await mkdtempTest('gap-pg-'),clients=[];let started=false;
 const {Client}=createRequire(new URL('../../artifacts/api-server/package.json',import.meta.url))('pg');
 try{
  execFileSync(bin+'initdb',['-D',dir+'/data','-L',share,'-U','gap_test_admin','--auth=trust','--no-locale','--encoding=UTF8'],{stdio:'pipe'});
  execFileSync(bin+'pg_ctl',['-D',dir+'/data','-l',dir+'/postgres.log','-o',`-h '' -k ${dir}`,'-w','start'],{stdio:'pipe'});started=true;
  const connect=async(user='gap_test_admin')=>{const c=new Client({host:dir,user,database:'postgres'});await c.connect();clients.push(c);return c;};
  const admin=await connect(),observer=await connect();
  await admin.query('CREATE TABLE public.stores(id uuid PRIMARY KEY,currency_code text,timezone text);CREATE SCHEMA finance_v1;CREATE TABLE finance_v1.original_january(body jsonb);INSERT INTO finance_v1.original_january VALUES(\'{"protected":"original January empty-protocol sentinel"}\')');
  await admin.query("INSERT INTO public.stores VALUES($1,'GBP','Europe/London')",[identity.storeId]);
  await admin.query(await readFile(new URL('./history-schema.sql',import.meta.url),'utf8'));
  await admin.query("INSERT INTO finance_history_v2.contracts VALUES($1,'uk-gifts-v2','synthetic-history-v2-2026-11','2024-11-01','2024-11-04','GBP','Europe/London')",[identity.storeId]);
  const base=(await admin.query('SELECT to_jsonb(t)-\'through_day\' body FROM finance_history_v2.contracts t')).rows[0].body;
  await admin.query(source);
  await admin.query("INSERT INTO finance_daily_v1.programme(singleton,store_id,contract_base,initial_through,ceiling,protected_seals) VALUES(true,$1,$2,'2024-11-04','2024-11-07','[]')",[identity.storeId,JSON.stringify(base)]);
  const emptyProof=(await admin.query("SELECT jsonb_build_object('rowCount',0,'sha256',encode(sha256(convert_to('[]','UTF8')),'hex')) p")).rows[0].p;
  const a=basic();
  for(const [index,day] of days.entries()){
   const next=day==='2024-11-05'?'2024-11-06':'2024-11-07',sourceHash=hash('empty-protocol:'+day),coverageId=stableId('gap-empty-coverage',day),runId=stableId('history-daily-run','2024-11-01:'+day);
   const manifest={scope:{storeId:identity.storeId,currency:'GBP',from:day,to:day},edition:'synthetic-history-v2-2026-11',anchor:'2024-11-01',profile:'uk-gifts-v2',timezone:'Europe/London',formulaVersion:'night-scout-v11-2026-10-30',sourceAsOf:historySourceAsOf(day),observedAt:next+'T00:00:00.000Z'};
   const receipt={contract:'synthetic-daily-preparation-v1',runId,day,anchor:'2024-11-01',profile:'uk-gifts-v2',edition:'synthetic-history-v2-2026-11',sourceHash,sourceAsOf:historySourceAsOf(day),inserted:0};
   const material={contract:'reviewed-synthetic-daily-material-v1',storeId:identity.storeId,day,expectedThrough:index?'2024-11-05':'2024-11-04',edition:receipt.edition,profile:receipt.profile,anchor:receipt.anchor,sourceHash,sources:{events:[],orders:[],refunds:[],lines:[],returns:[]},validationSets:Object.fromEntries(['events','orders','refunds','lines','returns'].map(name=>[name,emptyProof])),coverage:[{coverage_id:coverageId,store_id:identity.storeId,date_from:day,date_to:day,kind:'day',source_manifest:manifest,source_hash:hash(JSON.stringify(manifest))}],seals:[],run:{run_id:runId,store_id:identity.storeId,date_from:day,date_to:day,source_hash:sourceHash,receipt}};
   const materialHash=(await admin.query("SELECT encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') h",[JSON.stringify(material)])).rows[0].h;
   await admin.query('INSERT INTO finance_daily_v1.reviewed_days VALUES($1,$2,$3,$4)',[day,JSON.stringify(material),materialHash,'disposable material review']);
   a.days[index]={day,materialSha256:materialHash,sourceHash,reviewRef:'disposable material review'};
  }
  const financialFingerprint=async()=>{const rows={};for(const name of ['contracts','events','orders','refunds','lines','returns','coverage','seals','invalidations','runs'])rows[name]=(await observer.query(`SELECT to_jsonb(t) row FROM finance_history_v2.${name} t ORDER BY to_jsonb(t)::text`)).rows;rows.publications=(await observer.query('SELECT to_jsonb(t) row FROM finance_daily_v1.publication_receipts t ORDER BY day')).rows;rows.january=(await observer.query('SELECT * FROM finance_v1.original_january')).rows;return hash(JSON.stringify(rows));};
  const before=await financialFingerprint();
  const ordinaryBefore=(await admin.query("SELECT pg_get_functiondef('finance_daily_v1.append_completed_day(date,date)'::regprocedure) d")).rows[0].d;
  const p=prepareDailyGapProposal({capabilitySql:source,approval:a});await admin.query(p.sql);
  await admin.query('CREATE ROLE gap_test_login LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;GRANT daily_gap_invoker TO gap_test_login WITH INHERIT FALSE,SET TRUE');
  let caller=await connect('gap_test_login');await caller.query('SET ROLE daily_gap_invoker');
  const publish=async({commit=true}={})=>{await caller.query('BEGIN ISOLATION LEVEL SERIALIZABLE');try{const result=(await caller.query('SELECT finance_daily_gap_v1.publish_approved_gap() result')).rows[0].result;await caller.query(commit?'COMMIT':'ROLLBACK');return result;}catch(error){await caller.query('ROLLBACK');throw error;}};
  await t.test('disabled, nonserializable and direct helper/table access refuse',async()=>{
   await assert.rejects(publish(),/approval/);assert.equal(await financialFingerprint(),before);
   for(const sql of ['SELECT * FROM finance_daily_gap_v1.approval',"SELECT finance_daily_gap_v1.assert_approved_day('2024-11-04','2024-11-05')","SELECT finance_daily_gap_v1.append_reviewed_gap_day('2024-11-04','2024-11-05')",'UPDATE finance_daily_gap_v1.approval SET enabled=true','SET ROLE daily_capability_owner'])await assert.rejects(caller.query(sql),/permission denied/);
   await admin.query('UPDATE finance_daily_gap_v1.approval SET enabled=true');await assert.rejects(caller.query('SELECT finance_daily_gap_v1.publish_approved_gap()'),/approval/);assert.equal(await financialFingerprint(),before);
   await assert.rejects(admin.query("UPDATE finance_daily_gap_v1.approval SET last_day='2024-11-07'"),/immutable/);
  });
  await t.test('expired approval and changed manifest refuse before financial mutation',async()=>{
   await admin.query('BEGIN ISOLATION LEVEL SERIALIZABLE');try{await admin.query('ALTER TABLE finance_daily_gap_v1.approval DISABLE TRIGGER gap_fixed');await admin.query("UPDATE finance_daily_gap_v1.approval SET expires_at='2024-11-07T00:00:00Z'");await admin.query('ALTER TABLE finance_daily_gap_v1.approval ENABLE TRIGGER gap_fixed');await admin.query('SET LOCAL ROLE daily_gap_invoker');await assert.rejects(admin.query('SELECT finance_daily_gap_v1.publish_approved_gap()'),/approval/);}finally{await admin.query('ROLLBACK');}
   await admin.query('BEGIN ISOLATION LEVEL SERIALIZABLE');try{await admin.query('ALTER TABLE finance_daily_gap_v1.approval DISABLE TRIGGER gap_fixed');await admin.query("UPDATE finance_daily_gap_v1.approval SET days=jsonb_set(days,'{1,materialSha256}',to_jsonb(repeat('f',64)))");await admin.query('ALTER TABLE finance_daily_gap_v1.approval ENABLE TRIGGER gap_fixed');await admin.query('SET LOCAL ROLE daily_gap_invoker');await assert.rejects(admin.query('SELECT finance_daily_gap_v1.publish_approved_gap()'),/material\/hash\/reference/);}finally{await admin.query('ROLLBACK');}
   assert.equal(await financialFingerprint(),before);
  });
  await t.test('changed scope, active ordinary programme and partial horizon require review',async()=>{
   await admin.query('BEGIN ISOLATION LEVEL SERIALIZABLE');try{await admin.query('ALTER TABLE finance_daily_gap_v1.approval DISABLE TRIGGER gap_fixed');await admin.query("UPDATE finance_daily_gap_v1.approval SET store_id='10000000-0000-4000-8000-000000000099'");await admin.query('ALTER TABLE finance_daily_gap_v1.approval ENABLE TRIGGER gap_fixed');await admin.query('SET LOCAL ROLE daily_gap_invoker');await assert.rejects(admin.query('SELECT finance_daily_gap_v1.publish_approved_gap()'),/approval/);}finally{await admin.query('ROLLBACK');}
   await admin.query('UPDATE finance_daily_v1.programme SET enabled=true');try{await assert.rejects(publish(),/approval/);}finally{await admin.query('UPDATE finance_daily_v1.programme SET enabled=false');}
   await admin.query('BEGIN ISOLATION LEVEL SERIALIZABLE');try{await admin.query("UPDATE finance_history_v2.contracts SET through_day='2024-11-05'");await admin.query('SET LOCAL ROLE daily_gap_invoker');await assert.rejects(admin.query('SELECT finance_daily_gap_v1.publish_approved_gap()'),/initial horizon/);}finally{await admin.query('ROLLBACK');}
   assert.equal(await financialFingerprint(),before);
  });
  await t.test('one transaction covers two days and caller rollback preserves everything',async()=>{const result=await publish({commit:false});assert.equal(result.state,'gap-verified-in-transaction');assert.equal(result.days.length,2);assert.equal(result.replay,false);assert.equal(await financialFingerprint(),before);});
  await t.test('actual COMMIT acknowledgement loss reconciles from independent backend',async()=>{
   await caller.query('BEGIN ISOLATION LEVEL SERIALIZABLE');const result=(await caller.query('SELECT finance_daily_gap_v1.publish_approved_gap() result')).rows[0].result;assert.equal(result.days.length,2);
   caller.on('error',()=>{});let committed=false;caller.connection.on('commandComplete',message=>{if(message.text==='COMMIT')committed=true;});const emit=caller.connection.emit.bind(caller.connection);caller.connection.emit=(event,...args)=>{if(event==='readyForQuery'&&committed){caller.connection.stream.destroy(new Error('Injected gap COMMIT acknowledgement loss'));return true;}return emit(event,...args);};await assert.rejects(caller.query('COMMIT'),/acknowledgement|terminated/);
   caller=await connect('gap_test_login');await caller.query('SET ROLE daily_gap_invoker');const replay=await publish();assert.equal(replay.replay,true);assert.equal(replay.days.length,2);for(const row of replay.days){assert.equal(row.state,'committed-reconciled');assert.equal(row.inserted,0);assert.ok(Date.parse(row.publication.publishedAt)<=Date.now());}
   assert.equal((await observer.query('SELECT count(*)::int n FROM finance_daily_v1.publication_receipts')).rows[0].n,2);
   assert.equal((await observer.query('SELECT through_day::text d FROM finance_history_v2.contracts')).rows[0].d,days[1]);
   assert.equal((await observer.query('SELECT enabled FROM finance_daily_v1.programme')).rows[0].enabled,false);
   assert.equal((await admin.query("SELECT pg_get_functiondef('finance_daily_v1.append_completed_day(date,date)'::regprocedure) d")).rows[0].d,ordinaryBefore);
   assert.deepEqual((await observer.query('SELECT body FROM finance_v1.original_january')).rows,[{body:{protected:'original January empty-protocol sentinel'}}]);
  });
  await t.test('external retirement dependency refuses atomically without cascading deletion',async()=>{const accepted=await financialFingerprint();await admin.query('REVOKE daily_gap_invoker FROM gap_test_login');await caller.end();await admin.query('CREATE VIEW public.gap_external_dependency AS SELECT * FROM finance_daily_gap_v1.approval');await assert.rejects(admin.query(p.retirementSql),/depend/);await admin.query('ROLLBACK');assert.equal(await financialFingerprint(),accepted);assert.equal((await observer.query("SELECT to_regclass('public.gap_external_dependency') IS NOT NULL kept,to_regprocedure('finance_daily_gap_v1.publish_approved_gap()') IS NOT NULL restored")).rows[0].kept,true);assert.equal((await observer.query("SELECT to_regprocedure('finance_daily_gap_v1.publish_approved_gap()') IS NOT NULL restored")).rows[0].restored,true);await admin.query('DROP VIEW public.gap_external_dependency RESTRICT');});
  await t.test('temporary authority retirement retains financial and publication receipts',async()=>{const accepted=await financialFingerprint();await admin.query(p.retirementSql);assert.equal(await financialFingerprint(),accepted);assert.equal((await observer.query("SELECT to_regnamespace('finance_daily_gap_v1') IS NULL gone")).rows[0].gone,true);assert.equal((await admin.query("SELECT pg_get_functiondef('finance_daily_v1.append_completed_day(date,date)'::regprocedure) d")).rows[0].d,ordinaryBefore);});
 }finally{await Promise.allSettled(clients.map(c=>c.end()));if(started)execFileSync(bin+'pg_ctl',['-D',dir+'/data','-m','fast','-w','stop'],{stdio:'pipe'});}
});
