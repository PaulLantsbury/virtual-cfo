import test from 'node:test';
import assert from 'node:assert/strict';
import {restorationFixture} from '../shopify/restoration-fixture.mjs';
import {sql} from '../shopify/finance-fixture.mjs';
import {buildImportScenario} from './build-import-scenario.mjs';
import {buildImporterLoginSql} from './provision-importer.mjs';
import {importFirstEvidence} from '../shopify/import-first-evidence.mjs';
const C='90000000-0000-4000-8000-000000000003',scope={storeId:C,batchId:'93000000-0000-4000-8000-000000000003',from:'2026-02-01',to:'2026-02-28'};
async function baseline(){const {db}=await restorationFixture();await db.exec(sql('staging/20260910_import_setup.sql'));return db;}
const login=()=>buildImporterLoginSql({projectRef:'bioalckltvkhlczusdvl',password:'synthetic_'.repeat(6)});
test('exact store C package starts empty, preserves A/B and supports restricted import/retry',async()=>{
 const db=await baseline();try{
 const before=(await db.query('SELECT * FROM finance_v1.coverage_evidence ORDER BY store_id,date_from')).rows;
 const script=await buildImportScenario();assert.equal(script,sql('staging/20260910_import_scenario.sql'));await db.exec(script);await db.exec(login());
 assert.deepEqual((await db.query('SELECT * FROM finance_v1.coverage_evidence ORDER BY store_id,date_from')).rows,before);
 assert.equal((await db.query('SELECT count(*)::int n FROM public.orders WHERE store_id=$1',[C])).rows[0].n,0);
 assert.equal((await db.query('SELECT count(*)::int n FROM public.store_memberships WHERE store_id=$1',[C])).rows[0].n,0);
 const restricted={transaction:fn=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE night_scout_import_service');return fn(tx);})};
 assert.equal((await importFirstEvidence(restricted,scope)).status,'imported_awaiting_review');
 assert.equal((await importFirstEvidence(restricted,scope)).status,'already_imported');
 assert.equal((await db.query('SELECT count(*)::int n FROM ingest_v1.import_receipts')).rows[0].n,1);
 assert.deepEqual((await db.query('SELECT * FROM finance_v1.coverage_evidence WHERE store_id<>$1 ORDER BY store_id,date_from',[C])).rows,before);
 const r=(await db.query("SELECT rolcanlogin,rolinherit,rolconnlimit FROM pg_roles WHERE rolname='night_scout_import_login'")).rows[0];assert.deepEqual(r,{rolcanlogin:true,rolinherit:false,rolconnlimit:1});
 await assert.rejects(db.exec(script),/Unexpected stores/);await db.exec('ROLLBACK');
 await assert.rejects(db.exec(login()),/Unexpected importer/);await db.exec('ROLLBACK');
 }finally{await db.close();}
});
test('late seed/login failures roll back and private password is not in SQL',async()=>{
 const db=await baseline();try{
 for(const script of [sql('staging/20260910_import_scenario.sql'),login()]){
 await assert.rejects(db.exec(script.replace(/COMMIT;\s*$/,'SELECT 1/0; COMMIT;')),/division by zero/);await db.exec('ROLLBACK');
 }
 assert.equal((await db.query('SELECT count(*)::int n FROM stores WHERE id=$1',[C])).rows[0].n,0);
 assert.equal((await db.query("SELECT count(*)::int n FROM pg_roles WHERE rolname='night_scout_import_login'")).rows[0].n,0);
 assert.ok(!login().includes('synthetic_'.repeat(6)));
 assert.throws(()=>buildImporterLoginSql({projectRef:'wrong',password:'synthetic_'.repeat(6)}),/Invalid/);
 }finally{await db.close();}
});
