import {importFixture} from '../shopify/import-fixture.mjs';
import {subsequentCandidate} from '../shopify/subsequent-fixture.mjs';
import {recordShopifyCandidate} from '../shopify/record-candidate.mjs';
import {writeFile} from 'node:fs/promises';
const C='90000000-0000-4000-8000-000000000003';
export async function buildRefundPeriods(){
 const {db,input}=await importFixture();try{
 const next=await subsequentCandidate(db,input,'refund');
 const original=(await db.query('SELECT * FROM ingest_v1.batches WHERE id=$1',[next.batchId])).rows[0];
 const versions=(await db.query('SELECT * FROM ingest_v1.source_versions WHERE store_id=$1 ORDER BY source_id',[C])).rows;
 const inserts=[];
 for(const [month,to,suffix] of [['03','31','5'],['04','30','6']]){
  const scope={...original.payload.source.scope,from:`2026-${month}-01`,to:`2026-${month}-${to}`};
  const recorded=await recordShopifyCandidate(db,{...original.payload.source,status:'details_for_mapping'},scope);
  const row=(await db.query('SELECT * FROM ingest_v1.batches WHERE id=$1',[recorded.batchId])).rows[0];
  row.id=`93000000-0000-4000-8000-00000000000${suffix}`;row.created_at='2026-09-10T00:00:00Z';
  inserts.push(`INSERT INTO ingest_v1.batches SELECT * FROM json_populate_record(NULL::ingest_v1.batches,'${JSON.stringify(row).replaceAll("'","''")}'::json);
INSERT INTO ingest_v1.heads(store_id,date_from,date_to,batch_id,needs_recheck) VALUES('${C}','${scope.from}','${scope.to}','${row.id}',true);
INSERT INTO finance_v1.coverage_evidence(store_id,date_from,date_to,currency,sales_and_refunds_complete,evidence_ref,verified_by) VALUES('${C}','${scope.from}','${scope.to}','GBP',false,'candidate:${row.id}','synthetic-period-setup');`);
 }
 return `-- STAGING ONLY: confirm project bioalckltvkhlczusdvl before execution.
-- Separate March/April review candidates, no financial imports or certification.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT ingest_v1.lock_import_dependencies();
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.stores WHERE id='${C}' AND shopify_domain='new-fixture.myshopify.com' AND shopify_store_id='3' AND currency_code='GBP' AND timezone='Europe/London') THEN RAISE EXCEPTION 'Unexpected store'; END IF;
 IF NOT EXISTS(SELECT 1 FROM ingest_v1.heads h JOIN ingest_v1.batches b ON b.id=h.batch_id JOIN ingest_v1.import_receipts r ON r.batch_id=b.id WHERE h.store_id='${C}' AND h.date_from='2026-02-01' AND h.date_to='2026-02-28' AND h.batch_id='93000000-0000-4000-8000-000000000004' AND b.fingerprint='${original.fingerprint}' AND r.source_fingerprint=b.fingerprint AND r.order_count=0 AND r.refund_count=1) THEN RAISE EXCEPTION 'Subsequent import baseline changed'; END IF;
 IF (SELECT count(*) FROM public.orders WHERE store_id='${C}')<>1 OR (SELECT count(*) FROM public.refunds WHERE store_id='${C}')<>2 OR (SELECT count(*) FROM ingest_v1.import_receipts WHERE store_id='${C}')<>2 THEN RAISE EXCEPTION 'Unexpected imported counts'; END IF;
 IF EXISTS(SELECT 1 FROM ingest_v1.heads WHERE store_id='${C}' AND date_from<='2026-04-30' AND date_to>='2026-03-01') OR EXISTS(SELECT 1 FROM finance_v1.coverage_evidence WHERE store_id='${C}' AND date_from<='2026-04-30' AND date_to>='2026-03-01') THEN RAISE EXCEPTION 'Review periods already exist; do not replay'; END IF;
 IF (SELECT count(*) FROM ingest_v1.source_versions WHERE store_id='${C}')<>${versions.length} OR ${versions.map(r=>`NOT EXISTS(SELECT 1 FROM ingest_v1.source_versions WHERE store_id='${C}' AND source_id='${r.source_id}' AND source_version='${new Date(r.source_version).toISOString()}'::timestamptz AND fingerprint='${r.fingerprint}')`).join(' OR ')} THEN RAISE EXCEPTION 'Source versions changed'; END IF;
END $guard$;
${inserts.join('\n')}
COMMIT;
`;
 }finally{await db.close();}
}
if(process.argv[1]?.endsWith('build-refund-periods.mjs'))await writeFile(new URL('../../db-migrations/staging/20260910_refund_periods.sql',import.meta.url),await buildRefundPeriods());
