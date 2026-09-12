import test from 'node:test';
import assert from 'node:assert/strict';
import {restorationFixture,identity} from '../shopify/restoration-fixture.mjs';
import {restoreReviewedPeriod} from '../shopify/restore-reviewed-period.mjs';
import {sql} from '../shopify/finance-fixture.mjs';
import {buildImportSetup} from './build-import-setup.mjs';
const bundle=sql('staging/20260910_import_setup.sql');
test('exact importer package preserves prior review, figures and coverage; replay refused',async()=>{
 const f=await restorationFixture();try{
 await restoreReviewedPeriod(f.db,f.request,identity);
 const snapshot=async()=>{const result={};for(const table of ['public.orders','public.refunds','finance_v1.coverage_evidence','ingest_v1.review_audit'])result[table]=(await f.db.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;return result;};
 const before=await snapshot();assert.equal(bundle,buildImportSetup());await f.db.exec(bundle);assert.deepEqual(await snapshot(),before);
 assert.equal((await f.db.query('SELECT count(*)::int n FROM ingest_v1.import_receipts')).rows[0].n,0);
 assert.equal((await f.db.query("SELECT rolcanlogin FROM pg_roles WHERE rolname='night_scout_import_service'")).rows[0].rolcanlogin,false);
 assert.equal((await f.db.query("SELECT count(*)::int n FROM pg_roles WHERE rolname='night_scout_import_login'")).rows[0].n,0);
 await assert.rejects(f.db.exec(bundle),/already exist/);await f.db.exec('ROLLBACK');
 }finally{await f.db.close();}
});
test('late installation failure leaves no importer capability or receipt table',async()=>{
 const {db}=await restorationFixture();try{
 await assert.rejects(db.exec(bundle.replace(/COMMIT;\s*$/,'SELECT 1/0; COMMIT;')),/division by zero/);await db.exec('ROLLBACK');
 assert.equal((await db.query("SELECT to_regclass('ingest_v1.import_receipts') AS r")).rows[0].r,null);
 assert.equal((await db.query("SELECT count(*)::int n FROM pg_roles WHERE rolname='night_scout_import_service'")).rows[0].n,0);
 }finally{await db.close();}
});
