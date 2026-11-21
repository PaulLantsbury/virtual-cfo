// Synthetic transport and disposable PostgreSQL only. No live credentials or writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,sql} from './finance-fixture.mjs';
import {createConnectionReadiness} from './connection-readiness.mjs';
import {contextFixture,orderFixture,pageFixture,detailsFixture} from './fixtures.mjs';
import {API_VERSION,QUERIES} from './queries.mjs';
const S='56d92f8a-746e-4b4f-b408-81fc98c4aa17';
const connection={shopId:'gid://shopify/Shop/95601983836',domain:'pocketlaunchpad1.myshopify.com'};
const scope={storeId:S,shopId:connection.shopId,from:'2026-02-01',to:'2026-02-28'};
const tables=['ingest_v1.batches','ingest_v1.heads','ingest_v1.source_versions','finance_v1.coverage_evidence','public.orders','public.refunds'];
async function snapshot(db,other=false){
 const out={};for(const table of tables)out[table]=(await db.query(`SELECT to_jsonb(t) AS row FROM ${table} t WHERE store_id ${other?'<>':'='} $1 ORDER BY to_jsonb(t)::text`,[S])).rows;
 return out;
}
async function fixture(){
 const {db}=await setup();await db.exec(sql('proposals/shopify-intake-2026-09-17.sql'));
 let order=orderFixture(),detail=detailsFixture(),missingOrder=false,missingRefund=false,afterDetails=()=>{};
 order.test=true;
 const restricted={transaction:fn=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE night_scout_intake_service');return fn(tx);}),lockCandidateStore:(tx,id)=>tx.query('SELECT ingest_v1.lock_intake_store($1)',[id])};
 const fetchImpl=async(url,options)=>{
  assert.equal(url,`https://${connection.domain}/admin/api/${API_VERSION}/graphql.json`);
  const {query}=JSON.parse(options.body);let data;
  if(query===QUERIES.context){data=contextFixture();data.shop.id=connection.shopId;data.shop.myshopifyDomain=connection.domain;}
  else if(query===QUERIES.orders){const copy=structuredClone(order);if(missingRefund)copy.refunds=[];data=pageFixture(missingOrder?[]:[copy]);}
  else{assert.equal(query,QUERIES.details);data=structuredClone(detail);if(missingRefund)data.order.refunds=[];afterDetails();}
  return new Response(JSON.stringify({data}),{headers:{'x-shopify-api-version':API_VERSION}});
 };
 const make=(adapter=restricted)=>createConnectionReadiness({connection,scope,db:adapter,fetchImpl,resolveCredential:async()=> 'synthetic-only-token',sleep:async()=>{}});
 const changeRefund=()=>{order.refunds[0].updatedAt=detail.order.refunds[0].updatedAt='2026-03-06T12:00:00Z';order.refunds[0].totalRefundedSet.shopMoney.amount='30.00';detail.order.refunds[0].refundLineItems.nodes[0].subtotalSet.shopMoney.amount='25.00';};
 const seedCoverage=()=>db.query("INSERT INTO finance_v1.coverage_evidence(store_id,date_from,date_to,currency,sales_and_refunds_complete,evidence_ref,verified_by) VALUES($1,'2026-02-01','2026-02-28','GBP',true,'synthetic-recovery-only','test')",[S]);
 return {db,restricted,make,changeRefund,seedCoverage,missingOrder:()=>{missingOrder=true;},missingRefund:()=>{missingRefund=true;},restore:()=>{order=orderFixture();order.test=true;detail=detailsFixture();missingOrder=missingRefund=false;},conflict:()=>{order.refunds[0].totalRefundedSet.shopMoney.amount='31.00';},afterDetails:fn=>{afterDetails=fn;}};
}
async function assertExcluded(db,count){
 const batches=(await db.query('SELECT coverage_certified,payload FROM ingest_v1.batches WHERE store_id=$1',[S])).rows;
 assert.equal(batches.length,count);
 for(const b of batches){assert.equal(b.coverage_certified,false);assert.deepEqual(b.payload.mapped.events,[]);assert.equal(b.payload.mapped.excluded[0].reason,'TEST_ORDER');assert.equal(b.payload.mapped.candidate.originalOrders,0);}
 for(const table of ['public.orders','public.refunds'])assert.equal((await db.query(`SELECT count(*)::int n FROM ${table} WHERE store_id=$1`,[S])).rows[0].n,0);
}
test('restricted pipeline accepts refund-only version change, supersedes once and replays without restoring coverage',async()=>{
 const f=await fixture();try{
 const other=await snapshot(f.db,true);const first=await f.make().run();await f.seedCoverage();f.changeRefund();
 const changed=await f.make().run();assert.equal(changed.status,'changed_requires_review');assert.notEqual(changed.batchId,first.batchId);
 const stable=await snapshot(f.db);const repeat=await f.make().run();assert.equal(repeat.status,'replay');assert.equal(repeat.batchId,changed.batchId);assert.deepEqual(await snapshot(f.db),stable);
 const heads=stable['ingest_v1.heads'];assert.equal(heads.length,1);assert.equal(heads[0].row.batch_id,changed.batchId);assert.equal(heads[0].row.needs_recheck,true);
 assert.equal(stable['ingest_v1.batches'].filter(b=>b.row.superseded_at!==null).length,1);
 assert.equal(stable['finance_v1.coverage_evidence'][0].row.sales_and_refunds_complete,false);
 await assertExcluded(f.db,2);assert.deepEqual(await snapshot(f.db,true),other);
 }finally{await f.db.close();}
});
test('stale, conflicting and missing retained order/refund history cannot replace the accepted head',async()=>{
 const f=await fixture();try{
 await f.make().run();f.changeRefund();const accepted=await f.make().run();const before=await snapshot(f.db);
 f.restore();assert.equal((await f.make().run()).status,'stale_source');assert.deepEqual(await snapshot(f.db),before);
 f.changeRefund();f.conflict();assert.equal((await f.make().run()).status,'conflicting_source');
 f.missingRefund();assert.equal((await f.make().run()).status,'missing_source');
 f.missingOrder();assert.equal((await f.make().run()).status,'missing_source');
 const after=await snapshot(f.db);assert.equal(after['ingest_v1.heads'][0].row.batch_id,accepted.batchId);assert.equal(after['ingest_v1.heads'][0].row.needs_recheck,true);
 assert.deepEqual(after,before);await assertExcluded(f.db,2);
 }finally{await f.db.close();}
});
test('late failure after head write rolls back changed versions, supersession and coverage withdrawal; explicit recovery succeeds',async()=>{
 const f=await fixture();try{
 await f.make().run();await f.seedCoverage();const before=await snapshot(f.db),other=await snapshot(f.db,true);f.changeRefund();
 const failing={...f.restricted,transaction:fn=>f.restricted.transaction(async tx=>{const result=await fn(tx);throw Error('synthetic failure after final write');})};
 await assert.rejects(f.make(failing).run(),/outcome unconfirmed; inspect/);assert.deepEqual(await snapshot(f.db),before);assert.deepEqual(await snapshot(f.db,true),other);
 const retry=await f.make().run();assert.equal(retry.status,'changed_requires_review');await assertExcluded(f.db,2);
 assert.equal((await snapshot(f.db))['finance_v1.coverage_evidence'][0].row.sales_and_refunds_complete,false);
 }finally{await f.db.close();}
});
test('lost success acknowledgement is reported uncertain; inspection then replay retains exactly one committed candidate',async()=>{
 const f=await fixture();try{
 const other=await snapshot(f.db,true);let commits=0;
 const uncertain={...f.restricted,transaction:async fn=>{await f.restricted.transaction(fn);commits++;throw Error('synthetic lost success acknowledgement');}};
 await assert.rejects(f.make(uncertain).run(),/outcome unconfirmed; inspect/);assert.equal(commits,1);
 const inspected=await snapshot(f.db);assert.equal(inspected['ingest_v1.batches'].length,1);assert.equal(inspected['ingest_v1.heads'].length,1);
 const replay=await f.make().run();assert.equal(replay.status,'replay');assert.equal(replay.batchId,inspected['ingest_v1.heads'][0].row.batch_id);assert.deepEqual(await snapshot(f.db),inspected);
 await assertExcluded(f.db,1);assert.deepEqual(await snapshot(f.db,true),other);
 }finally{await f.db.close();}
});
test('cancellation before collection or after details writes nothing; subsequent explicit run succeeds',async()=>{
 const f=await fixture();try{
 const before=await snapshot(f.db),controller=new AbortController();controller.abort();
 await assert.rejects(f.make().run({signal:controller.signal}),/outcome unconfirmed/);assert.deepEqual(await snapshot(f.db),before);
 const during=new AbortController();f.afterDetails(()=>during.abort());await assert.rejects(f.make().run({signal:during.signal}),/outcome unconfirmed/);assert.deepEqual(await snapshot(f.db),before);
 f.afterDetails(()=>{});assert.equal((await f.make().run()).status,'recorded_requires_review');await assertExcluded(f.db,1);
 }finally{await f.db.close();}
});
for(const [label,mutate,status] of [
 ['refund omitted',f=>f.missingRefund(),'missing_source'],
 ['order omitted',f=>f.missingOrder(),'missing_source'],
 ['same-version content conflict',f=>f.conflict(),'conflicting_source'],
])test(`${label} withdraws existing synthetic coverage without inserting or replacing a candidate`,async()=>{
 const f=await fixture();try{
 const first=await f.make().run();await f.seedCoverage();const other=await snapshot(f.db,true),before=await snapshot(f.db);
 assert.equal(before['ingest_v1.heads'][0].row.needs_recheck,false);mutate(f);
 const result=await f.make().run();assert.equal(result.status,status);const after=await snapshot(f.db);
 assert.deepEqual(after['ingest_v1.batches'],before['ingest_v1.batches']);assert.deepEqual(after['ingest_v1.source_versions'],before['ingest_v1.source_versions']);
 assert.equal(after['ingest_v1.heads'][0].row.batch_id,first.batchId);assert.equal(after['ingest_v1.heads'][0].row.needs_recheck,true);
 assert.equal(after['finance_v1.coverage_evidence'][0].row.sales_and_refunds_complete,false);
 await assertExcluded(f.db,1);assert.deepEqual(await snapshot(f.db,true),other);
 }finally{await f.db.close();}
});
