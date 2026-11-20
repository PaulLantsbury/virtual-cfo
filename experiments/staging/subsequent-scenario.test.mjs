import test from 'node:test';import assert from 'node:assert/strict';
import {restorationFixture} from '../shopify/restoration-fixture.mjs';
import {sql} from '../shopify/finance-fixture.mjs';
import {importFirstEvidence} from '../shopify/import-first-evidence.mjs';
import {importSubsequentEvidence} from '../shopify/import-subsequent-evidence.mjs';
import {buildSubsequentScenario} from './build-subsequent-scenario.mjs';
const C='90000000-0000-4000-8000-000000000003',scope={storeId:C,batchId:'93000000-0000-4000-8000-000000000003',from:'2026-02-01',to:'2026-02-28'},next={...scope,batchId:'93000000-0000-4000-8000-000000000004'};
async function fixture(){const{db}=await restorationFixture();await db.exec(sql('staging/20260910_import_setup.sql'));await db.exec(sql('staging/20260910_import_scenario.sql'));await importFirstEvidence(db,scope);return db;}
const restricted=db=>({transaction:fn=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE night_scout_import_service');return fn(tx);})});
test('exact package adds only a candidate, restricted runtime writer adds one later refund and retry preserves A/B',async()=>{
 const db=await fixture();try{
 const before=(await db.query('SELECT * FROM finance_v1.coverage_evidence ORDER BY store_id,date_from')).rows;
 const orders=(await db.query('SELECT * FROM orders ORDER BY id')).rows;
 const script=await buildSubsequentScenario();assert.equal(script,sql('staging/20260910_subsequent_scenario.sql'));await db.exec(script);
 assert.deepEqual((await db.query('SELECT * FROM orders ORDER BY id')).rows,orders);
 assert.equal((await db.query('SELECT count(*)::int n FROM refunds WHERE store_id=$1',[C])).rows[0].n,1);
 assert.deepEqual(await importSubsequentEvidence(restricted(db),next),{status:'imported_awaiting_review',coverageCertified:false,orders:0,refunds:1});
 assert.equal((await importSubsequentEvidence(restricted(db),next)).status,'already_imported');
 assert.equal((await db.query('SELECT count(*)::int n FROM refunds WHERE store_id=$1',[C])).rows[0].n,2);
 assert.equal((await db.query('SELECT count(*)::int n FROM ingest_v1.import_receipts WHERE store_id=$1',[C])).rows[0].n,2);
 assert.deepEqual((await db.query('SELECT * FROM finance_v1.coverage_evidence WHERE store_id<>$1 ORDER BY store_id,date_from',[C])).rows,before.filter(r=>r.store_id!==C));
 assert.deepEqual((await db.query('SELECT * FROM orders ORDER BY id')).rows,orders);
 await assert.rejects(db.exec(script),/head/);await db.exec('ROLLBACK');
 }finally{await db.close();}
});
test('package rejects changed source and rolls back late failure including constraint update',async()=>{
 const db=await fixture();try{
 const script=sql('staging/20260910_subsequent_scenario.sql');await assert.rejects(db.exec(script.replace(/COMMIT;\s*$/,'SELECT 1/0; COMMIT;')),/division/);await db.exec('ROLLBACK');
 assert.equal((await db.query('SELECT batch_id FROM ingest_v1.heads WHERE store_id=$1',[C])).rows[0].batch_id,scope.batchId);
 const def=(await db.query("SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='import_receipts_order_count_check'")).rows[0].def;assert.match(def,/> 0/);
 await db.query("UPDATE ingest_v1.source_versions SET source_version=source_version+interval '1 day' WHERE store_id=$1",[C]);
 await assert.rejects(db.exec(script),/Source versions changed/);await db.exec('ROLLBACK');
 }finally{await db.close();}
});
