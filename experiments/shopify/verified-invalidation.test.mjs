import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareCandidateReview} from './review-candidate.mjs';
import {recordShopifyCandidate} from './record-candidate.mjs';
import {collectShopifyOrders} from './collect.mjs';
import {loadShopifyDetails} from './map-sales.mjs';
import {expected,contextFixture,orderFixture,pageFixture,detailsFixture} from './fixtures.mjs';
import {A,B,U,O,setup} from './finance-fixture.mjs';
test('source-version intake blocks previously verified RPC figures for only that store',async()=>{
 const {db,read}=await setup();try{
 assert.equal((await read()).aov.value,12300);
 await db.query("INSERT INTO ingest_v1.source_versions VALUES($1,'source-order','2026-08-15',repeat('a',64))",[A]);
 await assert.rejects(read(),/coverage/);assert.equal((await read(B)).aov.value,98700);
 assert.equal((await db.query('SELECT count(*)::int n FROM finance_v1.coverage_evidence WHERE store_id=$1 AND sales_and_refunds_complete',[A])).rows[0].n,0);
 }finally{await db.close();}
});
test('raw order/refund changes and store settings invalidate even without an import batch',async()=>{
 for(const query of ["UPDATE orders SET gross_sales=gross_sales+1 WHERE store_id=$1","UPDATE refunds SET amount=amount+1 WHERE store_id=$1","UPDATE stores SET timezone='UTC' WHERE id=$1"]){
 const {db,read}=await setup();try{await db.query(query,[A]);await assert.rejects(read(),/coverage/);assert.equal((await read(B)).netProductSales,98700);}finally{await db.close();}
 }
});
test('same-value writes leave coverage; rolled-back source changes restore it',async()=>{
 const {db,read}=await setup();try{
 await db.query('UPDATE orders SET gross_sales=gross_sales WHERE store_id=$1',[A]);assert.equal((await read()).netProductSales,12300);
 await assert.rejects(db.transaction(async tx=>{await tx.query("INSERT INTO ingest_v1.source_versions VALUES($1,'source','2026-08-15',repeat('b',64))",[A]);throw new Error('late failure');}),/late failure/);
 assert.equal((await read()).netProductSales,12300);assert.equal((await db.query('SELECT count(*)::int n FROM ingest_v1.source_versions')).rows[0].n,0);
 }finally{await db.close();}
});
test('conflicting import invalidates finance even without advancing source version',async()=>{
 const {db,read}=await setup();try{
 const request=async op=>op==='context'?contextFixture():op==='orders'?pageFixture([orderFixture()]):detailsFixture();
 const data=await loadShopifyDetails(request,await collectShopifyOrders(request,expected));
 const scope={storeId:A,shopId:expected.shopId,from:'2026-08-01',to:'2026-08-31'};
 await recordShopifyCandidate(db,data,scope);
 // Test-only restoration simulates prior independent verification, not an implemented publication workflow.
 await db.query('UPDATE finance_v1.coverage_evidence SET sales_and_refunds_complete=true WHERE store_id=$1',[A]);
 assert.equal((await read()).netProductSales,12300);
 const changed=structuredClone(data);changed.orders[0].edited=true;
 assert.equal((await recordShopifyCandidate(db,changed,scope)).status,'conflicting_source');await assert.rejects(read(),/coverage/);
 await recordShopifyCandidate(db,data,scope);await assert.rejects(read(),/coverage/);
 }finally{await db.close();}
});
test('members cannot invoke invalidation or restore verified coverage',async()=>{
 const {db}=await setup();try{
 await db.exec('SET ROLE authenticated');
 await assert.rejects(db.query('SELECT ingest_v1.invalidate_verified_store($1)',[A]),e=>e.code==='42501');
 await assert.rejects(db.query('UPDATE finance_v1.coverage_evidence SET sales_and_refunds_complete=true'),e=>e.code==='42501');
 await db.exec('RESET ROLE');
 assert.equal((await db.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='ingest_v1' AND p.prosecdef")).rows[0].n,0);
 }finally{await db.close();}
});
test('deleted raw refund also invalidates coverage rather than presenting higher net sales',async()=>{
 const {db,read}=await setup();try{
 await db.query('DELETE FROM finance_v1.refund_evidence WHERE store_id=$1',[A]);
 await db.query('DELETE FROM public.refunds WHERE store_id=$1',[A]);
 await assert.rejects(read(),/coverage/);assert.equal((await read(B)).netProductSales,98700);
 }finally{await db.close();}
});

test('review packet reads actual database snapshots without restoring mismatched evidence',async()=>{
 const {db,read}=await setup();try{
 const request=async op=>op==='context'?contextFixture():op==='orders'?pageFixture([orderFixture()]):detailsFixture();
 const data=await loadShopifyDetails(request,await collectShopifyOrders(request,expected));
 const scope={storeId:A,shopId:expected.shopId,from:'2026-08-01',to:'2026-08-31'};
 await recordShopifyCandidate(db,data,scope);
 const first=await prepareCandidateReview(db,scope);
 assert.equal(first.status,'blocked');assert.equal(first.coverageCertified,false);
 assert.equal((await prepareCandidateReview(db,scope)).snapshotDigest,first.snapshotDigest);
 await assert.rejects(read(),/coverage/);assert.equal((await read(B)).netProductSales,98700);
 await db.query('UPDATE orders SET gross_sales=gross_sales+1 WHERE store_id=$1',[A]);
 assert.notEqual((await prepareCandidateReview(db,scope)).snapshotDigest,first.snapshotDigest);
 }finally{await db.close();}
});
