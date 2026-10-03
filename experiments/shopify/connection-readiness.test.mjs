import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {createConnectionReadiness} from './connection-readiness.mjs';
import {expected,contextFixture,orderFixture,pageFixture,detailsFixture} from './fixtures.mjs';
import {candidatePeriodState} from './record-candidate.mjs';
import {API_VERSION,QUERIES} from './queries.mjs';
const scope={storeId:'90000000-0000-4000-8000-000000000001',shopId:expected.shopId,from:'2026-02-01',to:'2026-02-28'};
async function fixture(){
 const db=new PGlite();
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE TABLE public.stores(id uuid PRIMARY KEY,shopify_domain text,shopify_store_id text,currency_code text,timezone text);');
 await db.exec(readFileSync(new URL('../../db-migrations/proposed/ingest_v1_candidate_batches.sql',import.meta.url),'utf8'));
 await db.query('INSERT INTO stores VALUES($1,$2,$3,$4,$5)',[scope.storeId,expected.domain,'1','GBP','Europe/London']);
 let order=orderFixture(),detail=detailsFixture(),throttle=false,secretCalls=0;
 const fetchImpl=async(url,options)=>{
  assert.equal(url,`https://${expected.domain}/admin/api/${API_VERSION}/graphql.json`);
  assert.equal(options.headers['X-Shopify-Access-Token'],'synthetic-token');
  assert.equal(options.redirect,'error');
  if(throttle){throttle=false;return new Response('',{status:429,headers:{'retry-after':'1'}});}
  const {query}=JSON.parse(options.body);assert.ok(Object.values(QUERIES).includes(query));
  const data=query===QUERIES.context?contextFixture():query===QUERIES.orders?pageFixture([order]):detail;
  return new Response(JSON.stringify({data}),{headers:{'x-shopify-api-version':API_VERSION}});
 };
 const make=(period=scope)=>createConnectionReadiness({connection:expected,scope:period,db,resolveCredential:async()=>{secretCalls++;return 'synthetic-token';},fetchImpl,sleep:async()=>{}});
 return {db,make,changed:()=>{order.updatedAt=detail.order.updatedAt='2026-03-06T12:00:00Z';order.edited=true;},testOrder:()=>{order.test=true;},throttle:()=>{throttle=true;},secretCalls:()=>secretCalls};
}
test('transport retry, detailed sale/refund candidate and replay use existing persistent protocol',async()=>{
 const f=await fixture();try{
 f.throttle();const runner=f.make();const first=await runner.run();const replay=await runner.run();
 assert.equal(first.status,'recorded_requires_review');assert.equal(replay.status,'replay');assert.equal(first.batchId,replay.batchId);assert.equal(first.coverageCertified,false);
 const rows=(await f.db.query('SELECT payload FROM ingest_v1.batches')).rows;
 assert.equal(rows.length,1);assert.equal(rows[0].payload.mapped.candidate.aov.value,9000);
 await f.make({...scope,from:'2026-03-01',to:'2026-03-31'}).run();
 const march=(await f.db.query("SELECT payload FROM ingest_v1.batches WHERE date_from='2026-03-01'")).rows[0].payload.mapped;
 assert.equal(march.status,'mapped_for_review');assert.equal(march.candidate.netProductSales,-2000);
 assert.equal(f.secretCalls(),3);assert.ok(!JSON.stringify(rows).includes('synthetic-token'));
 }finally{await f.db.close();}
});
test('changed unsupported source invalidates prior period and is visible for review',async()=>{
 const f=await fixture();try{
 await f.make().run();f.changed();const result=await f.make().run();
 assert.equal(result.status,'changed_requires_review');assert.equal(result.mappingState,'blocked');
 assert.equal((await candidatePeriodState(f.db,scope)).status,'needs_recheck');
 assert.equal((await candidatePeriodState(f.db,scope)).figures,null);
 }finally{await f.db.close();}
});
test('development test orders remain excluded; never override approved eligibility',async()=>{
 const f=await fixture();try{
 f.testOrder();await f.make().run();const mapped=(await f.db.query('SELECT payload FROM ingest_v1.batches')).rows[0].payload.mapped;
 assert.equal(mapped.candidate.originalOrders,0);assert.equal(mapped.excluded[0].reason,'TEST_ORDER');
 }finally{await f.db.close();}
});
test('credential errors are sanitised; invalid configuration never resolves a credential',async()=>{
 const f=await fixture();try{
 let called=0;const resolveCredential=async()=>{called++;throw Error('do-not-expose-secret');};
 assert.throws(()=>createConnectionReadiness({connection:expected,scope:{...scope,shopId:'wrong'},db:f.db,resolveCredential}),/Invalid/);assert.equal(called,0);
 const runner=createConnectionReadiness({connection:expected,scope,db:f.db,resolveCredential});
 await assert.rejects(runner.run(),e=>!e.message.includes('do-not-expose-secret')&&e.message.includes('unconfirmed'));
 assert.equal((await f.db.query('SELECT count(*)::int n FROM ingest_v1.batches')).rows[0].n,0);
 }finally{await f.db.close();}
});
