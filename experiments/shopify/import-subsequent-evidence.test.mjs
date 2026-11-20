import test from 'node:test';import assert from 'node:assert/strict';
import {importFixture} from './import-fixture.mjs';import {sql} from './finance-fixture.mjs';
import {importFirstEvidence} from './import-first-evidence.mjs';import {importSubsequentEvidence} from './import-subsequent-evidence.mjs';
import {subsequentCandidate as candidate} from './subsequent-fixture.mjs';
async function fixture(){const f=await importFixture();await f.db.exec(sql('proposed/ingest_v1_incremental_receipts.sql'));await importFirstEvidence(f.db,f.input);return f;}
const restricted=db=>({transaction:fn=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE night_scout_import_service');return fn(tx);})});
const counts=async(db,id)=>(await db.query('SELECT (SELECT count(*)::int FROM orders WHERE store_id=$1) orders,(SELECT count(*)::int FROM refunds WHERE store_id=$1) refunds,(SELECT count(*)::int FROM ingest_v1.import_receipts WHERE store_id=$1) receipts',[id])).rows[0];
test('restricted append writes only new order/refund, preserves old rows and retries once',async()=>{
 const{db,input}=await fixture();try{const before=(await db.query('SELECT * FROM orders ORDER BY id')).rows;const next=await candidate(db,input);
 assert.deepEqual(await importSubsequentEvidence(restricted(db),next),{status:'imported_awaiting_review',coverageCertified:false,orders:1,refunds:1});
 assert.deepEqual(await counts(db,input.storeId),{orders:2,refunds:2,receipts:2});
 for(const row of before)assert.deepEqual((await db.query('SELECT * FROM orders WHERE id=$1',[row.id])).rows[0],row);
 assert.equal((await importSubsequentEvidence(restricted(db),next)).status,'already_imported');assert.deepEqual(await counts(db,input.storeId),{orders:2,refunds:2,receipts:2});
 assert.equal((await db.query('SELECT bool_or(sales_and_refunds_complete) complete FROM finance_v1.coverage_evidence WHERE store_id=$1',[input.storeId])).rows[0].complete,false);
 }finally{await db.close();}
});
test('refund-only batch links to existing sale without rewriting it and records zero new orders',async()=>{
 const{db,input}=await fixture();try{const before=(await db.query('SELECT * FROM orders WHERE store_id=$1',[input.storeId])).rows;const next=await candidate(db,input,'refund');
 const r=await importSubsequentEvidence(restricted(db),next);assert.equal(r.orders,0);assert.equal(r.refunds,1);
 assert.deepEqual((await db.query('SELECT * FROM orders WHERE store_id=$1',[input.storeId])).rows,before);
 const refund=(await db.query("SELECT r.order_id,e.event_date::text AS day,e.product_cash,e.product_vat FROM refunds r JOIN finance_v1.refund_evidence e ON e.refund_id=r.id WHERE r.shopify_refund_id='22'")).rows[0];
 assert.equal(refund.order_id,before[0].id);assert.equal(refund.day,'2026-04-06');assert.equal(Number(refund.product_cash)-Number(refund.product_vat),20);
 assert.equal((await importSubsequentEvidence(restricted(db),next)).refunds,1);
 }finally{await db.close();}
});
test('no-new-event batch records zero counts without restoring coverage',async()=>{
 const{db,input}=await fixture();try{const next=await candidate(db,input,'noop');await db.query('UPDATE finance_v1.coverage_evidence SET sales_and_refunds_complete=true WHERE store_id=$1',[input.storeId]);assert.deepEqual(await importSubsequentEvidence(restricted(db),next),{status:'imported_awaiting_review',coverageCertified:false,orders:0,refunds:0});assert.deepEqual(await counts(db,input.storeId),{orders:1,refunds:1,receipts:2});assert.equal((await db.query('SELECT sales_and_refunds_complete complete FROM finance_v1.coverage_evidence WHERE store_id=$1',[input.storeId])).rows[0].complete,true);}finally{await db.close();}
});
test('late receipt failure rolls back added records and retry succeeds',async()=>{
 const{db,input}=await fixture();try{const next=await candidate(db,input);await db.query('UPDATE finance_v1.coverage_evidence SET sales_and_refunds_complete=true WHERE store_id=$1',[input.storeId]);const bad={transaction:fn=>db.transaction(tx=>fn({query:(q,a)=>{if(q.startsWith('INSERT INTO ingest_v1.import_receipts'))throw Error('late failure');return tx.query(q,a);}}))};
 await assert.rejects(importSubsequentEvidence(bad,next),/late failure/);assert.equal((await db.query('SELECT sales_and_refunds_complete complete FROM finance_v1.coverage_evidence WHERE store_id=$1',[input.storeId])).rows[0].complete,true);assert.deepEqual(await counts(db,input.storeId),{orders:1,refunds:1,receipts:1});await importSubsequentEvidence(restricted(db),next);assert.deepEqual(await counts(db,input.storeId),{orders:2,refunds:2,receipts:2});}finally{await db.close();}
});
test('stored identities, legacy totals and evidence tampering block all inserts',async()=>{
 for(const mutation of ["UPDATE orders SET shopify_order_id='999' WHERE store_id=$1","UPDATE orders SET net_sales=999 WHERE store_id=$1","UPDATE finance_v1.refund_evidence SET product_vat=3 WHERE store_id=$1"]){
 const{db,input}=await fixture();try{const next=await candidate(db,input);await db.query(mutation,[input.storeId]);await assert.rejects(importSubsequentEvidence(restricted(db),next),/differs|differ/);assert.deepEqual(await counts(db,input.storeId),{orders:1,refunds:1,receipts:1});}finally{await db.close();}}
});
