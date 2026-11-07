import test from 'node:test';import assert from 'node:assert/strict';
import {importFixture} from './import-fixture.mjs';
import {importFirstEvidence} from './import-first-evidence.mjs';
import {prepareSubsequentImport} from './prepare-subsequent-import.mjs';
import {recordShopifyCandidate} from './record-candidate.mjs';
import {orderFixture,detailsFixture} from './fixtures.mjs';
async function next(db,input){
 const {rows}=await db.query('SELECT payload FROM ingest_v1.batches WHERE id=$1',[input.batchId]);const source=rows[0].payload.source;
 const o=orderFixture(2),d=detailsFixture(2).order;source.orders.push({...o,...d,refunds:o.refunds.map((r,i)=>({...r,...d.refunds[i]}))});
 const r=await recordShopifyCandidate(db,{...source,status:'details_for_mapping'},source.scope);return {...input,batchId:r.batchId};
}
test('database preparation reads committed history and creates a plan without writing financial rows',async()=>{
 const {db,input}=await importFixture();try{await importFirstEvidence(db,input);const scope=await next(db,input);
 const before=(await db.query('SELECT * FROM public.orders ORDER BY id')).rows;
 const plan=await prepareSubsequentImport(db,scope);assert.equal(plan.newOrders,1);assert.equal(plan.newRefunds,1);assert.equal(plan.unchangedEvents,2);
 assert.deepEqual((await db.query('SELECT * FROM public.orders ORDER BY id')).rows,before);
 assert.equal((await db.query('SELECT count(*)::int n FROM ingest_v1.import_receipts')).rows[0].n,1);
 await assert.rejects(prepareSubsequentImport(db,input),/Current candidate/);
 }finally{await db.close();}
});
test('database preparation refuses stale raw evidence and missing committed history',async()=>{
 const {db,input}=await importFixture();try{
 await assert.rejects(prepareSubsequentImport(db,input),/history/);await importFirstEvidence(db,input);const scope=await next(db,input);
 await db.query('UPDATE public.orders SET gross_sales=gross_sales+1 WHERE store_id=$1',[input.storeId]);
 await assert.rejects(prepareSubsequentImport(db,scope),/evidence/);
 }finally{await db.close();}
});
