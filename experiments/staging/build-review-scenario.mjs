import {restorationFixture} from '../shopify/restoration-fixture.mjs';
import {writeFile} from 'node:fs/promises';
export async function buildReviewScenario(){
 const {db}=await restorationFixture();
 try{
 const inserts=[];
 for(const table of ['source_versions','batches','heads']){
  const {rows}=await db.query(`SELECT * FROM ingest_v1.${table}`);
  for(const row of rows){
   if(table==='batches'){row.id='93000000-0000-4000-8000-000000000001';row.created_at='2026-09-10T00:00:00Z';}
   if(table==='heads')row.batch_id='93000000-0000-4000-8000-000000000001';
   inserts.push(`INSERT INTO ingest_v1.${table} SELECT * FROM json_populate_record(NULL::ingest_v1.${table},'${JSON.stringify(row).replaceAll("'","''")}'::json);`);
  }
 }
 return `-- Synthetic test scenario ONLY for staging bioalckltvkhlczusdvl.
-- Confirm dashboard project. Existing amounts/evidence are preserved; store A coverage is revoked.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
LOCK TABLE public.stores,public.orders,public.refunds,finance_v1.coverage_evidence,ingest_v1.source_versions,ingest_v1.batches,ingest_v1.heads IN SHARE ROW EXCLUSIVE MODE;
DO $guard$ BEGIN
 IF (SELECT count(*) FROM public.stores)<>2 OR
 NOT EXISTS(SELECT 1 FROM public.stores WHERE id='90000000-0000-4000-8000-000000000001' AND shopify_domain='night-scout-staging-a.invalid' AND shopify_store_id='staging-test-a' AND currency_code='GBP' AND timezone='Europe/London') OR
 (SELECT count(*) FROM public.orders WHERE store_id='90000000-0000-4000-8000-000000000001')<>1 OR
 NOT EXISTS(SELECT 1 FROM public.orders WHERE id='91000000-0000-4000-8000-000000000001' AND store_id='90000000-0000-4000-8000-000000000001' AND shopify_order_id='staging-isolation-a' AND net_sales=123) OR
 (SELECT count(*) FROM public.refunds WHERE store_id='90000000-0000-4000-8000-000000000001')<>1 OR
 NOT EXISTS(SELECT 1 FROM public.refunds WHERE id='92000000-0000-4000-8000-000000000001' AND store_id='90000000-0000-4000-8000-000000000001' AND shopify_refund_id='staging-finance-refund-a' AND amount=23) OR
 EXISTS(SELECT 1 FROM ingest_v1.batches) OR EXISTS(SELECT 1 FROM ingest_v1.source_versions) OR EXISTS(SELECT 1 FROM ingest_v1.heads)
 THEN RAISE EXCEPTION 'Unexpected synthetic scenario baseline; do not apply'; END IF;
END $guard$;
UPDATE public.stores SET shopify_domain='night-scout-fixture.myshopify.com',shopify_store_id='1' WHERE id='90000000-0000-4000-8000-000000000001';
UPDATE public.orders SET shopify_order_id='1' WHERE id='91000000-0000-4000-8000-000000000001';
UPDATE public.refunds SET shopify_refund_id='1' WHERE id='92000000-0000-4000-8000-000000000001';
${inserts.join('\n')}
COMMIT;
`;
 }finally{await db.close();}
}
if(process.argv[1]?.endsWith('build-review-scenario.mjs'))await writeFile(new URL('../../db-migrations/staging/20260910_review_scenario.sql',import.meta.url),await buildReviewScenario());
