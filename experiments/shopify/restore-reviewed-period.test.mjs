import test from 'node:test';
import assert from 'node:assert/strict';
import {A,B,U,setup,sql} from './finance-fixture.mjs';
import {restoreReviewedPeriod} from './restore-reviewed-period.mjs';
import {restoreWithReviewerToken} from './reviewer-auth.mjs';
import {prepareCandidateReview} from './review-candidate.mjs';
import {recordShopifyCandidate} from './record-candidate.mjs';
import {collectShopifyOrders} from './collect.mjs';
import {loadShopifyDetails} from './map-sales.mjs';
import {expected,contextFixture,orderFixture,pageFixture,detailsFixture} from './fixtures.mjs';
const scope={storeId:A,from:'2026-08-01',to:'2026-08-31'};
const identity={authenticateReviewer:async()=>({id:U})};
async function fixture(){
 const f=await setup(),{db}=f;
 await db.exec(sql('proposed/ingest_v1_review_restoration.sql'));
 const request=async op=>op==='context'?contextFixture():op==='orders'?pageFixture([orderFixture()]):detailsFixture();
 const data=await loadShopifyDetails(request,await collectShopifyOrders(request,expected));
 // Align synthetic source with the established August £123 / September £23 records.
 const o=data.orders[0],money=amount=>({shopMoney:{amount,currencyCode:'GBP'}});
 o.originalTotalPriceSet=money('123');o.totalDiscountsSet=money('0');o.totalTaxSet=money('0');
 o.transactions[0].amountSet=money('123');o.transactions[0].processedAt='2026-08-15T12:00:00Z';
 o.transactions[1].amountSet=money('23');o.transactions[1].processedAt='2026-09-05T12:00:00Z';
 o.lineItems.nodes[0].originalTotalSet=money('123');o.lineItems.nodes[0].discountAllocations=[];o.lineItems.nodes[0].taxLines=[];
 o.refunds[0].totalRefundedSet=money('23');o.refunds[0].refundLineItems.nodes[0].subtotalSet=money('23');o.refunds[0].refundLineItems.nodes[0].totalTaxSet=money('0');
 o.refunds[0].transactions.nodes[0]=structuredClone(o.transactions[1]);
 await db.query("UPDATE public.orders SET shopify_order_id='1' WHERE store_id=$1",[A]);
 await db.query("UPDATE public.refunds SET shopify_refund_id='1' WHERE store_id=$1",[A]);
 await recordShopifyCandidate(db,data,{...scope,shopId:expected.shopId});
 await db.query('INSERT INTO ingest_v1.review_authorizations VALUES($1,$2)',[A,U]);
 const packet=await prepareCandidateReview(db,scope);
 assert.equal(packet.status,'awaiting_independent_coverage_review',JSON.stringify(packet.issues));
 return {...f,packet,request:{scope,batchId:packet.batchId,snapshotDigest:packet.snapshotDigest,coverageConfirmed:true,evidenceRef:'synthetic-completeness-review',completenessStatement:'Synthetic fixture contains the single original order and later refund; exclusions checked.'}};
}
test('authorised review restores only exact period and records immutable audit',async()=>{
 const {db,read,request}=await fixture();try{
 await assert.rejects(read(),/coverage/);
 const result=await restoreWithReviewerToken(db,{...request,reviewerId:'forged-body-id'},{authorization:'Bearer synthetic-token',supabase:{auth:{getUser:async token=>{assert.equal(token,'synthetic-token');return {data:{user:{id:U,is_anonymous:false}},error:null};}}}});assert.equal(result.status,'restored');
 assert.equal((await read()).netProductSales,12300);assert.equal((await read(B)).netProductSales,98700);
 const {rows}=await db.query('SELECT * FROM ingest_v1.review_audit');assert.equal(rows.length,1);assert.equal(rows[0].reviewer_id,U);assert.equal(rows[0].snapshot_digest,request.snapshotDigest);assert.equal(rows[0].review_snapshot.scope.storeId,A);assert.equal(rows[0].review_snapshot.orders.length,1);
 assert.equal((await db.query('SELECT count(*)::int n FROM finance_v1.coverage_evidence WHERE store_id=$1 AND sales_and_refunds_complete',[A])).rows[0].n,1);
 assert.equal((await db.query('SELECT needs_recheck FROM ingest_v1.heads WHERE store_id=$1',[A])).rows[0].needs_recheck,false);
 assert.equal((await db.query('SELECT coverage_certified FROM ingest_v1.batches WHERE store_id=$1',[A])).rows[0].coverage_certified,false);
 await assert.rejects(restoreReviewedPeriod(db,request,identity),/snapshot changed/);
 await assert.rejects(db.exec('DELETE FROM ingest_v1.review_audit'),/append-only/);
 await assert.rejects(db.exec('TRUNCATE ingest_v1.review_audit'),/append-only/);
 }finally{await db.close();}
});
test('missing attestation and unauthorised reviewer cannot restore',async()=>{
 const {db,read,request}=await fixture();try{
 await assert.rejects(restoreReviewedPeriod(db,{...request,coverageConfirmed:false},identity),/attestation/);
 await db.query('DELETE FROM ingest_v1.review_authorizations WHERE store_id=$1',[A]);
 await assert.rejects(restoreReviewedPeriod(db,request,identity),/not authorised/);
 await assert.rejects(read(),/coverage/);assert.equal((await db.query('SELECT count(*)::int n FROM ingest_v1.review_audit')).rows[0].n,0);
 await db.exec('SET ROLE authenticated');await assert.rejects(db.exec('SELECT * FROM ingest_v1.review_audit'),e=>e.code==='42501');await db.exec('RESET ROLE');
 }finally{await db.close();}
});
test('changed evidence rejects old snapshot and invalidates a restored period',async()=>{
 const {db,read,request}=await fixture();try{
 await db.query("UPDATE finance_v1.order_evidence SET evidence_ref='changed-review' WHERE store_id=$1",[A]);
 await assert.rejects(restoreReviewedPeriod(db,request,identity),/snapshot changed/);
 const packet=await prepareCandidateReview(db,scope);
 await restoreReviewedPeriod(db,{...request,snapshotDigest:packet.snapshotDigest},identity);
 assert.equal((await read()).netProductSales,12300);
 await db.query("UPDATE finance_v1.refund_evidence SET evidence_ref='later-review' WHERE store_id=$1",[A]);
 await assert.rejects(read(),/coverage/);
 }finally{await db.close();}
});
test('late failure rolls audit and coverage restoration back together',async()=>{
 const {db,read,request}=await fixture();try{
 const failing={transaction:fn=>db.transaction(async tx=>{
  await fn(tx);throw new Error('simulated failure before commit');
 })};
 await assert.rejects(restoreReviewedPeriod(failing,request,identity),/simulated failure/);
 await assert.rejects(read(),/coverage/);assert.equal((await db.query('SELECT count(*)::int n FROM ingest_v1.review_audit')).rows[0].n,0);
 }finally{await db.close();}
});

test('fresh but financially mismatched review cannot restore; evidence metadata changes stale approvals',async()=>{
 const {db,read,request}=await fixture();try{
 await db.query("UPDATE finance_v1.order_evidence SET verified_by='different-synthetic-reviewer' WHERE store_id=$1",[A]);
 await assert.rejects(restoreReviewedPeriod(db,request,identity),/snapshot changed/);
 await db.query('UPDATE finance_v1.order_evidence SET gross_product_vat=1 WHERE store_id=$1',[A]);
 const packet=await prepareCandidateReview(db,scope);assert.equal(packet.status,'blocked');
 await assert.rejects(restoreReviewedPeriod(db,{...request,snapshotDigest:packet.snapshotDigest},identity),/reconciliation/);
 await assert.rejects(read(),/coverage/);
 }finally{await db.close();}
});
