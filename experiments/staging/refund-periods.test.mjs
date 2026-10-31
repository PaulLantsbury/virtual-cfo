import test from 'node:test';import assert from 'node:assert/strict';
import {restorationFixture} from '../shopify/restoration-fixture.mjs';import {sql} from '../shopify/finance-fixture.mjs';
import {importFirstEvidence} from '../shopify/import-first-evidence.mjs';import {importSubsequentEvidence} from '../shopify/import-subsequent-evidence.mjs';import {prepareCandidateReview} from '../shopify/review-candidate.mjs';import {buildRefundPeriods} from './build-refund-periods.mjs';
const C='90000000-0000-4000-8000-000000000003',scope={storeId:C,batchId:'93000000-0000-4000-8000-000000000003',from:'2026-02-01',to:'2026-02-28'};
async function fixture(){const{db}=await restorationFixture();await db.exec(sql('staging/20260910_import_setup.sql'));await db.exec(sql('staging/20260910_import_scenario.sql'));await importFirstEvidence(db,scope);await db.exec(sql('staging/20260910_subsequent_scenario.sql'));await importSubsequentEvidence(db,{...scope,batchId:'93000000-0000-4000-8000-000000000004'});return db;}
const financial=['public.orders','public.refunds','finance_v1.order_evidence','finance_v1.refund_evidence','ingest_v1.import_receipts','ingest_v1.review_audit','public.store_memberships','ingest_v1.review_authorizations','ingest_v1.source_versions'];
async function snapshot(db){const r={};for(const table of financial)r[table]=(await db.query(`SELECT * FROM ${table} ORDER BY 1,2`)).rows;return r;}
test('exact March/April package creates separate unverified refund-only reviews without importing again',async()=>{
 const db=await fixture();try{const before=await snapshot(db),coverage=(await db.query('SELECT * FROM finance_v1.coverage_evidence ORDER BY store_id,date_from')).rows;
 const script=await buildRefundPeriods();assert.equal(script,sql('staging/20260910_refund_periods.sql'));await db.exec(script);
 for(const [month,to]of [['03','31'],['04','30']]){const p=await prepareCandidateReview(db,{storeId:C,from:`2026-${month}-01`,to:`2026-${month}-${to}`});assert.equal(p.status,'awaiting_independent_coverage_review',JSON.stringify(p.issues));assert.deepEqual(p.transactionEvidence.periodSummary,{currency:'GBP',netProductSales:-2000,originalOrders:0,hasActivity:true});assert.equal(p.coverageCertified,false);assert.equal(p.figures,null);}
 const feb=await prepareCandidateReview(db,scope);assert.equal(feb.transactionEvidence.periodSummary.netProductSales,9000);assert.equal(feb.transactionEvidence.periodSummary.originalOrders,1);
 assert.deepEqual(await snapshot(db),before);const after=(await db.query('SELECT * FROM finance_v1.coverage_evidence ORDER BY store_id,date_from')).rows;for(const old of coverage)assert.deepEqual(after.find(r=>r.store_id===old.store_id&&String(r.date_from)===String(old.date_from)),old);assert.equal(after.length,coverage.length+2);assert.ok(after.filter(r=>r.store_id===C).every(r=>r.sales_and_refunds_complete===false));
 await assert.rejects(db.exec(script),/already exist/);await db.exec('ROLLBACK');
 }finally{await db.close();}
});
test('late failure rolls back both periods; changed baseline is refused',async()=>{
 const db=await fixture();try{const script=sql('staging/20260910_refund_periods.sql');await assert.rejects(db.exec(script.replace(/COMMIT;\s*$/,'SELECT 1/0; COMMIT;')),/division/);await db.exec('ROLLBACK');assert.equal((await db.query('SELECT count(*)::int n FROM ingest_v1.heads WHERE store_id=$1',[C])).rows[0].n,1);
 await db.query("UPDATE ingest_v1.source_versions SET source_version=source_version+interval '1 day' WHERE store_id=$1",[C]);await assert.rejects(db.exec(script),/Source versions changed/);await db.exec('ROLLBACK');
 }finally{await db.close();}
});
