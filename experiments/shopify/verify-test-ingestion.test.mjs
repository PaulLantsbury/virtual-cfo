import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup,sql} from './finance-fixture.mjs';
import {INTAKE_TARGET as target} from './intake-runtime.mjs';
import {verifyTestIngestion,verificationQuery} from './verify-test-ingestion.mjs';
import {prepareBoundedProgramme} from '../test-programme/run-provider-test-programme.mjs';
import {createHash} from 'node:crypto';
const programme='shopify-staging-20261029',id='gid://shopify/Order/987654321';
const plans=prepareBoundedProgramme({provider:'shopify',target:target.domain,startMonday:'2026-10-26',programmeKey:programme,scheduleProfile:'daily-20261029-v1'}).plans;

async function fixture(){
 const {db}=await setup();
 await db.exec(sql('proposals/shopify-intake-2026-09-17.sql'));
 await db.exec(sql('proposals/shopify-sync-history-2026-09-17.sql'));
 await db.exec(sql('proposals/shopify-nightly-claims-2026-09-17.sql'));
 await db.exec(readFileSync(new URL('../test-programme/provider-ledger-proposal.sql',import.meta.url),'utf8'));
 await db.exec("CREATE TABLE public.verifier_fixture_time(at timestamptz); INSERT INTO public.verifier_fixture_time VALUES('2026-10-30T12:00:00Z'); CREATE FUNCTION public.verifier_fixture_clock() RETURNS timestamptz LANGUAGE sql AS 'SELECT at FROM public.verifier_fixture_time';");
 await db.query("INSERT INTO staging_test_programme.programmes VALUES($1,'shopify','bioalckltvkhlczusdvl',$2,'2026-10-29T00:00:00Z','2026-11-05T00:00:00Z',7,false,false)",[programme,target.domain]);
 // Only this local disposable adapter substitutes a clock. The real query has no clock input.
 const client={query:(text,args)=>db.query(text===verificationQuery?text.replace(/\bnow\(\)/g,'public.verifier_fixture_clock()'):text,args)};
 const report=()=>verifyTestIngestion(client);
 async function action({key='a',source=id,state='confirmed'}={}){
  const action=plans[key==='a'?0:1],date=action.date;
  await db.query("INSERT INTO staging_test_programme.actions(programme_key,action_key,payload_digest,state,source_id,created_at,submitted_at,confirmed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[programme,action.plan.actionKey,createHash('sha256').update(JSON.stringify(action.plan)).digest('hex'),state,state==='confirmed'?source:null,date+'T18:00:01Z',date+'T18:00:02Z',state==='confirmed'?date+'T18:00:03Z':null]);
 }
 const payload=()=>({source:{settings:{domain:target.domain,shopId:target.shopId,currency:'GBP',timezone:target.timezone},scope:{storeId:target.storeId,shopId:target.shopId,from:'2026-09-29',to:'2026-10-29'},orders:[{id,test:true,privateCustomerMarker:'never-return-me'}]},mapped:{events:[],excluded:[{id,reason:'TEST_ORDER'}]}});
 async function nightly({candidate=payload(),result='recorded_requires_review',batchAt='2026-10-30T02:00:02Z'}={}){
  await db.query("INSERT INTO ingest_v1.nightly_claims(store_id,local_date,timezone,scheduled_at,date_from,date_to,state,started_at,finished_at) VALUES($1,'2026-10-30','Europe/London','2026-10-30T02:00:00Z','2026-09-29','2026-10-29','completed','2026-10-30T02:00:00Z','2026-10-30T02:00:04Z')",[target.storeId]);
  await db.query("INSERT INTO ingest_v1.sync_attempts(store_id,date_from,date_to,state,result_code,started_at,finished_at) VALUES($1,'2026-09-29','2026-10-29','completed',$2,'2026-10-30T02:00:01Z','2026-10-30T02:00:03Z')",[target.storeId,result]);
  if(candidate!==null)await db.query("INSERT INTO ingest_v1.batches(store_id,date_from,date_to,fingerprint,mapping_state,payload,created_at) VALUES($1,'2026-09-29','2026-10-29',$2,'mapped_for_review',$3,$4)",[target.storeId,'e'.repeat(64),JSON.stringify(candidate),batchAt]);
 }
 return {db,report,action,payload,nightly,close:()=>db.close()};
}

test('zero actions is pending; successful stored exclusion is private evidence, never host scheduling proof',async()=>{
 const f=await fixture();try{
  assert.equal((await f.report()).state,'awaiting_writer_actions');
  await f.action();await f.nightly();
  const result=await f.report();
  assert.equal(result.actions[0].state,'stored_test_exclusion_confirmed');
  assert.equal(result.actions[0].action_ordinal,1);
  assert.equal(result.hostReceiptCorrelation,'not_assessed');
  assert.equal(result.financialVerification,'not_assessed');
  assert.equal(result.writeAttempted,false);
  assert.doesNotMatch(JSON.stringify(result),/987654321|never-return-me|ns-aaaa|source_id|customer/i);
 }finally{await f.close();}
});

test('before the next nightly window, missing nightly and unconfirmed writer remain distinct',async()=>{
 const f=await fixture();try{
  await f.action();
  await f.db.exec("UPDATE public.verifier_fixture_time SET at='2026-10-29T19:00:00Z'");
  assert.equal((await f.report()).actions[0].state,'not_yet_due');
  await f.db.exec("UPDATE public.verifier_fixture_time SET at='2026-10-30T02:05:00Z'");
  assert.equal((await f.report()).actions[0].state,'nightly_window_open');
  await f.db.exec("UPDATE public.verifier_fixture_time SET at='2026-10-30T12:00:00Z'");
  assert.equal((await f.report()).actions[0].state,'nightly_missing');
  await f.action({key:'b',state:'submitted'});
  assert.equal((await f.report()).actions[1].state,'writer_not_confirmed');
 }finally{await f.close();}
});

test('duplicate provider IDs and wrong configured store cannot establish acceptance',async()=>{
 const f=await fixture();try{
  await f.action();await f.action({key:'b'});await f.nightly();
  await f.db.exec("UPDATE public.verifier_fixture_time SET at='2026-11-01T12:00:00Z'");
  assert.equal((await f.report()).actions.every(a=>a.state==='blocked_writer_identity'),true);
  await f.db.query("UPDATE public.stores SET currency_code='EUR' WHERE id=$1",[target.storeId]);
  const report=await f.report();assert.equal(report.state,'blocked_target');assert.deepEqual(report.actions,[]);
 }finally{await f.close();}
});

test('test flag, unique exclusion and zero mapped events are all required',async()=>{
 const f=await fixture();try{
  await f.action();await f.nightly();
  for(const modify of [p=>p.source.orders[0].test=false,p=>p.source.orders.push({...p.source.orders[0]}),p=>p.mapped.excluded=[],p=>p.mapped.excluded.push({...p.mapped.excluded[0]}),p=>p.mapped.events=[{orderId:id,type:'sale'}]]){
   const payload=f.payload();modify(payload);
   await f.db.query('UPDATE ingest_v1.batches SET payload=$1',[JSON.stringify(payload)]);
   assert.equal((await f.report()).actions[0].state,'blocked_test_exclusion');
  }
 }finally{await f.close();}
});

test('retained payload context and exact planned action digest must match',async()=>{
 const f=await fixture();try{
  await f.action();await f.nightly();
  const payload=f.payload();payload.source.scope.storeId='90000000-0000-4000-8000-000000000001';
  await f.db.query('UPDATE ingest_v1.batches SET payload=$1',[JSON.stringify(payload)]);
  assert.equal((await f.report()).actions[0].state,'blocked_candidate_context');
  await f.db.query('UPDATE ingest_v1.batches SET payload=$1',[JSON.stringify(f.payload())]);
  await f.db.query("UPDATE staging_test_programme.actions SET payload_digest=$1",['f'.repeat(64)]);
  assert.equal((await f.report()).actions[0].state,'blocked_writer_identity');
 }finally{await f.close();}
});

test('an accidental merchant order blocks acceptance even with a correct excluded candidate',async()=>{
 const f=await fixture();try{
  await f.action();await f.nightly();
  await f.db.query("INSERT INTO public.orders(store_id,shopify_order_id,order_date,currency,gross_sales,net_sales,total_sales,shipping) VALUES($1,$2,'2026-10-29T18:00:00Z','GBP',60,60,60,0)",[target.storeId,id.split('/').at(-1)]);
  assert.equal((await f.report()).actions[0].state,'blocked_merchant_finance_inclusion');
 }finally{await f.close();}
});

test('replay of an older candidate and ambiguous attempt linkage do not fabricate exact nightly receipt',async()=>{
 const f=await fixture();try{
  await f.action();await f.nightly({result:'replay',batchAt:'2026-10-29T20:00:00Z'});
  assert.equal((await f.report()).actions[0].state,'candidate_linkage_unavailable');
  await f.db.query("INSERT INTO ingest_v1.sync_attempts(store_id,date_from,date_to,state,result_code,started_at,finished_at) VALUES($1,'2026-09-29','2026-10-29','completed','replay','2026-10-30T02:00:01.5Z','2026-10-30T02:00:03.5Z')",[target.storeId]);
  assert.equal((await f.report()).actions[0].state,'blocked_attempt_linkage');
 }finally{await f.close();}
});

test('verifier is read only, always rolls back and sanitises private database failures',async()=>{
 const statements=[];
 const client={query:async sql=>{statements.push(sql);if(sql===verificationQuery)throw Error('postgresql://secret@private-host/customer');return {rows:[]};}};
 await assert.rejects(verifyTestIngestion(client),error=>!error.message.includes('secret')&&!error.message.includes('private-host')&&error.message.includes('no provider call, write or retry'));
 assert.equal(statements[0],'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 assert.equal(statements.at(-1),'ROLLBACK');
 assert.equal(statements.some(s=>/^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|GRANT|COMMIT)\b/i.test(s)),false);
});
