import test from 'node:test';import assert from 'node:assert/strict';
import {importFixture} from './import-fixture.mjs';import {sql} from './finance-fixture.mjs';
import {importFirstEvidence} from './import-first-evidence.mjs';import {importSubsequentEvidence} from './import-subsequent-evidence.mjs';import {subsequentCandidate} from './subsequent-fixture.mjs';import {prepareCandidateReview} from './review-candidate.mjs';
test('review returns reconciled February sale and later March/April refunds without certifying coverage',async()=>{
 const{db,input}=await importFixture();try{await importFirstEvidence(db,input);await db.exec(sql('proposed/ingest_v1_incremental_receipts.sql'));const next=await subsequentCandidate(db,input,'refund');await importSubsequentEvidence(db,next);
 const p=await prepareCandidateReview(db,input);assert.equal(p.status,'awaiting_independent_coverage_review');assert.equal(p.coverageCertified,false);assert.equal(p.figures,null);
 assert.deepEqual(p.transactionEvidence.rows.map(r=>[r.date,r.productExVat,r.vat,r.cash]),[['2026-02-15',9000,1800,10800],['2026-03-05',-2000,-400,-2400],['2026-04-06',-2000,-400,-2400]]);
 assert.equal(new Set(p.transactionEvidence.rows.map(r=>r.orderId)).size,1);
 await db.query('UPDATE orders SET gross_sales=999 WHERE store_id=$1',[input.storeId]);const blocked=await prepareCandidateReview(db,input);assert.equal(blocked.status,'blocked');assert.equal(blocked.transactionEvidence,null);
 }finally{await db.close();}
});
