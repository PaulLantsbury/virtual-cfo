import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,sql,A,B} from '../shopify/finance-fixture.mjs';
import {buildReviewScenario} from './build-review-scenario.mjs';
import {prepareCandidateReview} from '../shopify/review-candidate.mjs';
async function baseline(){const {db}=await setup(undefined,{installIntake:false});await db.query("UPDATE stores SET shopify_domain='night-scout-staging-a.invalid',shopify_store_id='staging-test-a' WHERE id=$1",[A]);await db.exec(sql('staging/20260910_review_setup.sql'));return db;}
test('exact scenario preserves amounts and store B, revokes store A, and prepares a passing candidate',async()=>{
 const db=await baseline();try{
 const b=await db.query('SELECT * FROM finance_v1.coverage_evidence WHERE store_id=$1 ORDER BY date_from',[B]);
 const script=await buildReviewScenario();assert.equal(script,sql('staging/20260910_review_scenario.sql'));
 await db.exec(script);
 assert.deepEqual((await db.query('SELECT * FROM finance_v1.coverage_evidence WHERE store_id=$1 ORDER BY date_from',[B])).rows,b.rows);
 assert.equal((await db.query('SELECT bool_or(sales_and_refunds_complete) v FROM finance_v1.coverage_evidence WHERE store_id=$1',[A])).rows[0].v,false);
 assert.equal(Number((await db.query('SELECT net_sales FROM orders WHERE store_id=$1',[A])).rows[0].net_sales),123);
 assert.equal(Number((await db.query('SELECT amount FROM refunds WHERE store_id=$1',[A])).rows[0].amount),23);
 const packet=await prepareCandidateReview(db,{storeId:A,from:'2026-08-01',to:'2026-08-31'});
 assert.equal(packet.status,'awaiting_independent_coverage_review',JSON.stringify(packet.issues));
 await assert.rejects(db.exec(script),/Unexpected synthetic/);await db.exec('ROLLBACK');
 }finally{await db.close();}
});
test('a late scenario failure rolls back identifiers, candidates and coverage',async()=>{
 const db=await baseline();try{
 const before=(await db.query('SELECT * FROM finance_v1.coverage_evidence ORDER BY store_id,date_from')).rows;
 const script=sql('staging/20260910_review_scenario.sql').replace(/COMMIT;\s*$/,'SELECT 1/0; COMMIT;');
 await assert.rejects(db.exec(script),/division by zero/);await db.exec('ROLLBACK');
 assert.deepEqual((await db.query('SELECT * FROM finance_v1.coverage_evidence ORDER BY store_id,date_from')).rows,before);
 assert.equal((await db.query('SELECT shopify_store_id FROM stores WHERE id=$1',[A])).rows[0].shopify_store_id,'staging-test-a');
 assert.equal((await db.query('SELECT count(*)::int n FROM ingest_v1.batches')).rows[0].n,0);
 }finally{await db.close();}
});
