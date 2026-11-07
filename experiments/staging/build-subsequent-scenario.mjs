import {importFixture} from '../shopify/import-fixture.mjs';
import {subsequentCandidate} from '../shopify/subsequent-fixture.mjs';
import {sql} from '../shopify/finance-fixture.mjs';
import {writeFile} from 'node:fs/promises';
const C='90000000-0000-4000-8000-000000000003',old='93000000-0000-4000-8000-000000000003',next='93000000-0000-4000-8000-000000000004';
const literal=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::json`;
export async function buildSubsequentScenario(){
 const {db,input}=await importFixture();try{
 const previous=(await db.query('SELECT fingerprint FROM ingest_v1.batches WHERE id=$1',[input.batchId])).rows[0].fingerprint;
 const oldVersions=(await db.query('SELECT * FROM ingest_v1.source_versions WHERE store_id=$1 ORDER BY source_id',[C])).rows;
 const nextInput=await subsequentCandidate(db,input,'refund');
 const batch=(await db.query('SELECT * FROM ingest_v1.batches WHERE id=$1',[nextInput.batchId])).rows[0];batch.id=next;batch.created_at='2026-09-10T00:00:00Z';
 const versions=(await db.query('SELECT * FROM ingest_v1.source_versions WHERE store_id=$1 ORDER BY source_id',[C])).rows;
 return `-- STAGING ONLY: verify project bioalckltvkhlczusdvl before running.
-- One later synthetic refund candidate; financial rows are written separately.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT ingest_v1.lock_import_dependencies();
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.stores WHERE id='${C}' AND shopify_domain='new-fixture.myshopify.com' AND shopify_store_id='3' AND currency_code='GBP' AND timezone='Europe/London') THEN RAISE EXCEPTION 'Unexpected store C'; END IF;
 IF NOT EXISTS(SELECT 1 FROM ingest_v1.heads WHERE store_id='${C}' AND date_from='2026-02-01' AND date_to='2026-02-28' AND batch_id='${old}') THEN RAISE EXCEPTION 'Unexpected candidate head; do not replay'; END IF;
 IF (SELECT count(*) FROM ingest_v1.import_receipts WHERE store_id='${C}')<>1 OR NOT EXISTS(SELECT 1 FROM ingest_v1.import_receipts r JOIN ingest_v1.batches b ON b.id=r.batch_id WHERE r.batch_id='${old}' AND r.store_id='${C}' AND r.order_count=1 AND r.refund_count=1 AND r.source_fingerprint='${previous}' AND b.fingerprint=r.source_fingerprint) THEN RAISE EXCEPTION 'Original import receipt missing or changed'; END IF;
 IF (SELECT count(*) FROM public.orders WHERE store_id='${C}')<>1 OR (SELECT count(*) FROM public.refunds WHERE store_id='${C}')<>1 THEN RAISE EXCEPTION 'Unexpected financial row counts'; END IF;
 IF (SELECT count(*) FROM ingest_v1.source_versions WHERE store_id='${C}')<>${oldVersions.length} OR ${oldVersions.map(r=>`NOT EXISTS(SELECT 1 FROM ingest_v1.source_versions WHERE store_id='${C}' AND source_id='${r.source_id}' AND source_version='${new Date(r.source_version).toISOString()}'::timestamptz AND fingerprint='${r.fingerprint}')`).join(' OR ')} THEN RAISE EXCEPTION 'Source versions changed'; END IF;
 IF EXISTS(SELECT 1 FROM ingest_v1.batches WHERE id='${next}') THEN RAISE EXCEPTION 'Candidate already exists'; END IF;
END $guard$;
${sql('proposed/ingest_v1_incremental_receipts.sql').replace(/BEGIN;|COMMIT;/g,'')}
${versions.map(row=>`INSERT INTO ingest_v1.source_versions SELECT * FROM json_populate_record(NULL::ingest_v1.source_versions,${literal(row)}) ON CONFLICT(store_id,source_id) DO UPDATE SET source_version=EXCLUDED.source_version,fingerprint=EXCLUDED.fingerprint;`).join('\n')}
INSERT INTO ingest_v1.batches SELECT * FROM json_populate_record(NULL::ingest_v1.batches,${literal(batch)});
UPDATE ingest_v1.batches SET superseded_at=clock_timestamp() WHERE id='${old}';
UPDATE ingest_v1.heads SET batch_id='${next}',needs_recheck=true WHERE store_id='${C}' AND date_from='2026-02-01' AND date_to='2026-02-28';
COMMIT;
`;
 }finally{await db.close();}
}
if(process.argv[1]?.endsWith('build-subsequent-scenario.mjs'))await writeFile(new URL('../../db-migrations/staging/20260910_subsequent_scenario.sql',import.meta.url),await buildSubsequentScenario());
