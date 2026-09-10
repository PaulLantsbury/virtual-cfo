import {planSubsequentImport} from './plan-subsequent-import.mjs';
import {sourceVersions,compareSourceVersions} from './source-versions.mjs';
const check=(ok,message)=>{if(!ok)throw new Error(message);};
/** Read-only preparation. Returned plan is not authority to commit later:
 * the writer must repeat these checks under the dependency locks. */
export async function prepareSubsequentImport(db,{storeId,batchId,from,to}){
 return db.transaction(async tx=>{
  await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
  return (await inspectSubsequentImport(tx,{storeId,batchId,from,to})).plan;
 });
}

/** Internal checks; caller owns snapshot/locking and transaction. */
export async function inspectSubsequentImport(tx,{storeId,batchId,from,to}){
  const {rows}=await tx.query('SELECT b.payload,b.fingerprint,s.shopify_domain,s.shopify_store_id,s.currency_code,s.timezone FROM ingest_v1.heads h JOIN ingest_v1.batches b ON b.id=h.batch_id JOIN public.stores s ON s.id=h.store_id WHERE h.store_id=$1 AND h.date_from=$2 AND h.date_to=$3 AND h.batch_id=$4',[storeId,from,to,batchId]);
  check(rows.length===1,'Current candidate required');
  const row=rows[0],source=row.payload.source,settings=source.settings;
  check(source.scope.storeId===storeId&&source.scope.from===from&&source.scope.to===to,'Candidate scope mismatch');
  check(settings.domain===row.shopify_domain&&settings.currency===row.currency_code.trim()&&settings.timezone===row.timezone&&[settings.shopId,settings.shopId.split('/').at(-1)].includes(row.shopify_store_id),'Store settings changed');
  const {rows:versions}=await tx.query('SELECT source_id,source_version,fingerprint FROM ingest_v1.source_versions WHERE store_id=$1',[storeId]);
  const ordering=compareSourceVersions(versions,sourceVersions(source.orders));
  check(ordering.status==='accepted'&&!ordering.changed,'Candidate source is stale');
  const {rows:history}=await tx.query('SELECT r.source_fingerprint,b.fingerprint,b.payload FROM ingest_v1.import_receipts r JOIN ingest_v1.batches b ON b.id=r.batch_id WHERE r.store_id=$1',[storeId]);
  check(history.length>0&&history.every(r=>r.source_fingerprint===r.fingerprint),'Committed history missing or inconsistent');
  const {rows:states}=await tx.query("SELECT mapping_state FROM finance_v1.order_mapping WHERE store_id=$1 UNION ALL SELECT mapping_state FROM finance_v1.refund_mapping WHERE store_id=$1",[storeId]);
  check(states.every(r=>r.mapping_state==='verified'),'Stored financial evidence needs review');
  const plan=planSubsequentImport({priorSources:history.map(r=>r.payload.source),source,scope:source.scope});
  // This only detects missing/extra stored rows. A future writer must also compare
  // all stored values/identities to source; matching snapshots alone are insufficient.
  if(plan.status!=='blocked')check(states.length===plan.unchangedEvents,'Stored event count differs from committed history');
  return {source,plan:{...plan,batchId,sourceFingerprint:row.fingerprint}};
}
