import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {recordShopifyCandidate} from './record-candidate.mjs';
import {collectShopifyOrders} from './collect.mjs';
import {loadShopifyDetails} from './map-sales.mjs';
import {expected,contextFixture,orderFixture,pageFixture,detailsFixture} from './fixtures.mjs';
const store='90000000-0000-4000-8000-000000000001';
const scope={storeId:store,shopId:expected.shopId,from:'2026-02-01',to:'2026-02-28'};
async function setup(path){
 const db=new PGlite(path);await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE TABLE public.stores(id uuid PRIMARY KEY,shopify_domain text,shopify_store_id text,currency_code text,timezone text);ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon,authenticated;`);
 await db.exec(readFileSync(new URL('../../db-migrations/proposed/ingest_v1_candidate_batches.sql',import.meta.url),'utf8'));
 await db.query('INSERT INTO stores VALUES($1,$2,$3,$4,$5)',[store,expected.domain,'1','GBP','Europe/London']);
 const read=async op=>op==='context'?contextFixture():op==='orders'?pageFixture([orderFixture()]):detailsFixture();
 const data=await loadShopifyDetails(read,await collectShopifyOrders(read,expected));return {db,data};
}
test('records candidate once; repeats retain the same batch and never certify coverage',async()=>{
 const {db,data}=await setup();try{
 const a=await recordShopifyCandidate(db,data,scope);const b=await recordShopifyCandidate(db,data,scope);
 assert.equal(a.status,'recorded_requires_review');assert.equal(b.status,'replay');assert.equal(a.batchId,b.batchId);
 const rows=(await db.query('SELECT * FROM ingest_v1.batches')).rows;assert.equal(rows.length,1);assert.equal(rows[0].coverage_certified,false);assert.equal(rows[0].payload.mapped.candidate.aov.value,9000);
 }finally{await db.close();}
});
test('changed and blocked source supersedes candidate; old replay cannot restore it',async()=>{
 const {db,data}=await setup();try{
 const old=await recordShopifyCandidate(db,data,scope);const changed=structuredClone(data);changed.orders[0].edited=true;
 const next=await recordShopifyCandidate(db,changed,scope);assert.equal(next.status,'changed_requires_review');assert.equal(next.mappingState,'blocked');
 assert.equal((await recordShopifyCandidate(db,data,scope)).status,'historical_replay');
 assert.equal((await db.query('SELECT batch_id FROM ingest_v1.heads')).rows[0].batch_id,next.batchId);
 assert.ok((await db.query('SELECT superseded_at FROM ingest_v1.batches WHERE id=$1',[old.batchId])).rows[0].superseded_at);
 }finally{await db.close();}
});
test('store identity and settings mismatch reject without writing',async()=>{
 const {db,data}=await setup();try{
 await db.query("UPDATE stores SET timezone='UTC'");await assert.rejects(()=>recordShopifyCandidate(db,data,scope),/settings changed/);
 await db.query("UPDATE stores SET timezone='Europe/London',shopify_store_id='2'");await assert.rejects(()=>recordShopifyCandidate(db,data,scope),/does not match/);
 assert.equal((await db.query('SELECT count(*)::int n FROM ingest_v1.batches')).rows[0].n,0);
 }finally{await db.close();}
});
test('failure after batch insertion rolls back supersession and head atomically',async()=>{
 const {db,data}=await setup();try{
 const first=await recordShopifyCandidate(db,data,scope);const changed=structuredClone(data);changed.orders[0].edited=true;
 const failing={transaction:fn=>db.transaction(tx=>fn({query:(sql,params)=>{if(sql.startsWith('INSERT INTO ingest_v1.heads'))throw new Error('simulated late failure');return tx.query(sql,params);}}))};
 await assert.rejects(()=>recordShopifyCandidate(failing,changed,scope),/simulated/);
 assert.equal((await db.query('SELECT count(*)::int n FROM ingest_v1.batches')).rows[0].n,1);
 assert.equal((await db.query('SELECT batch_id FROM ingest_v1.heads')).rows[0].batch_id,first.batchId);
 assert.equal((await db.query('SELECT superseded_at FROM ingest_v1.batches')).rows[0].superseded_at,null);
 }finally{await db.close();}
});
test('public roles cannot read or write intake even with permissive default grants',async()=>{
 const {db,data}=await setup();try{
 await recordShopifyCandidate(db,data,scope);
 for(const role of ['anon','authenticated']){await db.exec(`SET ROLE ${role}`);await assert.rejects(db.query('SELECT * FROM ingest_v1.batches'),e=>e.code==='42501');await assert.rejects(db.query('DELETE FROM ingest_v1.heads'),e=>e.code==='42501');await db.exec('RESET ROLE');}
 await assert.rejects(db.exec('UPDATE ingest_v1.batches SET coverage_certified=true'),e=>e.code==='23514');
 }finally{await db.close();}
});
test('batch identity survives database close and reopen',async()=>{
 const path=mkdtempSync(join(tmpdir(),'night-scout-intake-'));let db;
 try{const initial=await setup(path);db=initial.db;const first=await recordShopifyCandidate(db,initial.data,scope);await db.close();db=new PGlite(path);
 const replay=await recordShopifyCandidate(db,initial.data,scope);assert.equal(replay.status,'replay');assert.equal(replay.batchId,first.batchId);
 }finally{if(db)await db.close();rmSync(path,{recursive:true,force:true});}
});
