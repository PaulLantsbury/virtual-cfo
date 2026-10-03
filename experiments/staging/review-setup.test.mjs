import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,sql,A,B} from '../shopify/finance-fixture.mjs';
import {buildReviewSetup} from './build-review-setup.mjs';
const bundle=sql('staging/20260910_review_setup.sql');
test('review package exactly matches sources and preserves existing verified staging figures',async()=>{
 assert.equal(bundle,buildReviewSetup());const {db,read}=await setup(undefined,{installIntake:false});try{
 const before=(await db.query('SELECT * FROM finance_v1.coverage_evidence ORDER BY store_id,date_from')).rows;
 await db.exec(bundle);
 assert.deepEqual((await db.query('SELECT * FROM finance_v1.coverage_evidence ORDER BY store_id,date_from')).rows,before);
 assert.equal((await read(A)).netProductSales,12300);assert.equal((await read(B)).netProductSales,98700);
 assert.equal((await db.query("SELECT count(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='ingest_v1' AND c.relkind='r' AND c.relrowsecurity")).rows[0].n,5);
 assert.equal((await db.query('SELECT count(*)::int n FROM ingest_v1.review_authorizations')).rows[0].n,0);
 assert.equal((await db.query("SELECT count(*)::int n FROM pg_roles WHERE rolname='night_scout_review_login'")).rows[0].n,0);
 await db.exec(sql('staging/verify-review-setup.sql'));
 await assert.rejects(db.exec(bundle),/already exists/);await db.exec('ROLLBACK');
 }finally{await db.close();}
});
test('late package failure rolls back schema and role without changing prior coverage',async()=>{
 const {db,read}=await setup(undefined,{installIntake:false});try{
 await assert.rejects(db.exec(bundle.replace(/COMMIT;\s*$/,"SELECT 1/0;\nCOMMIT;")),/division by zero/);await db.exec('ROLLBACK');
 assert.equal((await db.query("SELECT to_regnamespace('ingest_v1') AS schema")).rows[0].schema,null);
 assert.equal((await db.query("SELECT count(*)::int n FROM pg_roles WHERE rolname='night_scout_review_service'")).rows[0].n,0);
 assert.equal((await read()).netProductSales,12300);
 }finally{await db.close();}
});
test('unexpected baseline and existing roles stop package before changes',async()=>{
 for(const change of ["INSERT INTO public.stores(id,shopify_domain,shopify_store_id) VALUES('90000000-0000-4000-8000-000000000003','unexpected.myshopify.com','3')","CREATE ROLE night_scout_review_service"]){
 const {db}=await setup(undefined,{installIntake:false});try{
 await db.exec(change);await assert.rejects(db.exec(bundle),/synthetic staging|roles already/);await db.exec('ROLLBACK');
 assert.equal((await db.query("SELECT to_regnamespace('ingest_v1') AS schema")).rows[0].schema,null);
 }finally{await db.close();}
 }
});
