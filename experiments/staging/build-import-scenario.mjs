import {importFixture} from '../shopify/import-fixture.mjs';
import {writeFile} from 'node:fs/promises';
export async function buildImportScenario(){
 const {db}=await importFixture();try{
 const inserts=[];
 for(const table of ['source_versions','batches','heads'])for(const row of (await db.query(`SELECT * FROM ingest_v1.${table} WHERE store_id='90000000-0000-4000-8000-000000000003'`)).rows){
  if(table==='batches'){row.id='93000000-0000-4000-8000-000000000003';row.created_at='2026-09-10T00:00:00Z';}
  if(table==='heads')row.batch_id='93000000-0000-4000-8000-000000000003';
  inserts.push(`INSERT INTO ingest_v1.${table} SELECT * FROM json_populate_record(NULL::ingest_v1.${table},'${JSON.stringify(row).replaceAll("'","''")}'::json);`);
 }
 return `-- STAGING ONLY: confirm actual project bioalckltvkhlczusdvl.
-- Adds synthetic store C and candidate history; no financial rows or user grants.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
LOCK TABLE public.stores,ingest_v1.batches,ingest_v1.heads,ingest_v1.source_versions IN SHARE ROW EXCLUSIVE MODE;
DO $guard$ BEGIN
 IF to_regclass('ingest_v1.import_receipts') IS NULL THEN RAISE EXCEPTION 'Importer installation missing'; END IF;
 IF (SELECT count(*) FROM public.stores)<>2 OR (SELECT count(*) FROM public.stores WHERE id IN ('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002'))<>2 THEN RAISE EXCEPTION 'Unexpected stores; do not replay'; END IF;
END $guard$;
INSERT INTO public.stores(id,shopify_domain,shopify_store_id,name,currency_code,timezone) VALUES('90000000-0000-4000-8000-000000000003','new-fixture.myshopify.com','3','Staging Import Test Store C','GBP','Europe/London');
${inserts.join('\n')}
COMMIT;
`;
 }finally{await db.close();}
}
if(process.argv[1]?.endsWith('build-import-scenario.mjs'))await writeFile(new URL('../../db-migrations/staging/20260910_import_scenario.sql',import.meta.url),await buildImportScenario());
