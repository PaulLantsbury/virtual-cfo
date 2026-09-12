import test from 'node:test';
import assert from 'node:assert/strict';
import {restorationFixture,identity,scope} from './restoration-fixture.mjs';
import {restoreReviewedPeriod} from './restore-reviewed-period.mjs';
import {prepareCandidateReview} from './review-candidate.mjs';
import {prepareReviewWithReviewerToken} from './reviewer-auth.mjs';
import {A,B,U} from './finance-fixture.mjs';
test('restricted service can read a review and restore with existing authorisation',async()=>{
 const {db,read,request}=await restorationFixture();try{
 await db.exec('SET ROLE night_scout_review_service');
 assert.equal((await prepareCandidateReview(db,scope)).status,'awaiting_independent_coverage_review');
 assert.equal((await restoreReviewedPeriod(db,request,identity)).status,'restored');
 await db.exec('RESET ROLE');assert.equal((await read()).netProductSales,12300);
 }finally{await db.close();}
});
test('review service cannot alter sources, permissions, scope or audit history',async()=>{
 const {db}=await restorationFixture();try{
 await db.exec('SET ROLE night_scout_review_service');
 for(const query of [
  'TRUNCATE public.orders CASCADE',"UPDATE public.orders SET gross_sales=0",
  'DELETE FROM public.refunds','UPDATE finance_v1.order_evidence SET gross_product_vat=0',
  'DELETE FROM ingest_v1.review_authorizations','INSERT INTO ingest_v1.review_authorizations SELECT * FROM ingest_v1.review_authorizations',
  'UPDATE ingest_v1.heads SET batch_id=batch_id','UPDATE finance_v1.coverage_evidence SET date_to=date_to',
  'UPDATE ingest_v1.review_audit SET evidence_ref=\'tampered\'','DELETE FROM ingest_v1.review_audit','TRUNCATE ingest_v1.review_audit',
  'DELETE FROM public.store_memberships','UPDATE ingest_v1.source_versions SET fingerprint=fingerprint',
  'CREATE TABLE ingest_v1.unwanted(id int)'])await assert.rejects(db.exec(query),e=>e.code==='42501',query);
 await db.exec('RESET ROLE');
 for(const role of ['anon','authenticated']){
  await db.exec(`SET SESSION AUTHORIZATION ${role}`);
  await assert.rejects(db.exec('SELECT ingest_v1.lock_review_dependencies()'),e=>e.code==='42501');
  await assert.rejects(db.exec('SET ROLE night_scout_review_service'),e=>e.code==='42501');
  await db.exec('RESET SESSION AUTHORIZATION');
 }
 }finally{await db.close();}
});
test('restricted service still rejects absent reviewer grant',async()=>{
 const {db,request}=await restorationFixture();try{
 await db.query('DELETE FROM ingest_v1.review_authorizations WHERE store_id=$1 AND reviewer_id=$2',[A,U]);
 await db.exec('SET ROLE night_scout_review_service');
 await assert.rejects(restoreReviewedPeriod(db,request,identity),/not authorised/);
 assert.equal((await db.query('SELECT count(*)::int n FROM ingest_v1.review_audit')).rows[0].n,0);
 }finally{await db.close();}
});

test('authenticated preparation checks reviewer permission before exposing a packet',async()=>{
 const {db}=await restorationFixture();try{
 const context={authorization:'Bearer synthetic-token',supabase:{auth:{getUser:async()=>({data:{user:{id:U,is_anonymous:false}},error:null})}}};
 await db.exec('SET ROLE night_scout_review_service');
 const packet=await prepareReviewWithReviewerToken(db,scope,context);
 assert.equal(packet.status,'awaiting_independent_coverage_review');assert.equal(packet.snapshot,undefined);
 // The user belongs to B too, but is only authorised to review A.
 await assert.rejects(prepareReviewWithReviewerToken(db,{...scope,storeId:B},context),/not authorised/);
 }finally{await db.close();}
});
