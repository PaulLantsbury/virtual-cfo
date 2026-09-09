import {sourceVersions,compareSourceVersions} from './source-versions.mjs';
import {createHash} from 'node:crypto';
import {mapShopifySales} from './map-sales.mjs';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const requireValue=(ok,message)=>{if(!ok)throw new Error(message);};
/** Privileged internal caller only. No auth endpoint or live write integration.
 * Store row lock serialises candidate heads. Replay of a superseded batch cannot restore it.
 */
export async function recordShopifyCandidate(db,extraction,scope){
 requireValue(extraction?.status==='details_for_mapping'&&Array.isArray(extraction.orders),'Detailed extraction required');
 const settings=extraction.settings;
 requireValue(settings&&settings.shopId===scope.shopId,'Source identity mismatch');
 const content={apiVersion:extraction.apiVersion,settings,orders:extraction.orders,scope};
 const fingerprint=createHash('sha256').update(JSON.stringify(canonical(content))).digest('hex');
 // Recompute: never accept caller-supplied mapped results or a claimed verified flag.
 const mapped=mapShopifySales(extraction,scope);
 const versions=sourceVersions(extraction.orders);
 requireValue(['mapped_for_review','blocked'].includes(mapped.status),'Invalid candidate result');
 return db.transaction(async tx=>{
  const {rows}=await tx.query('SELECT id,shopify_domain,shopify_store_id,currency_code,timezone FROM public.stores WHERE id=$1 FOR UPDATE',[scope.storeId]);
  const store=rows[0];
  requireValue(store&&store.shopify_domain===settings.domain&&[settings.shopId,settings.shopId.split('/').at(-1)].includes(store.shopify_store_id),'Configured store does not match Shopify source');
  requireValue(store.currency_code.trim()===settings.currency&&store.timezone===settings.timezone,'Store settings changed; recollect before intake');
  const {rows:previous}=await tx.query('SELECT source_id,source_version,fingerprint FROM ingest_v1.source_versions WHERE store_id=$1',[scope.storeId]);
  const ordering=compareSourceVersions(previous,versions);
  if(ordering.status!=='accepted'){
   // Missing/conflicting source history makes every known period suspect. An
   // older snapshot is refused without invalidating newer accepted content.
   if(ordering.status!=='stale_source')await tx.query('UPDATE ingest_v1.heads SET needs_recheck=true WHERE store_id=$1',[scope.storeId]);
   return {status:ordering.status,coverageCertified:false};
  }
  const {rows:old}=await tx.query('SELECT b.id,h.batch_id FROM ingest_v1.batches b LEFT JOIN ingest_v1.heads h ON h.store_id=b.store_id AND h.date_from=b.date_from AND h.date_to=b.date_to WHERE b.store_id=$1 AND b.date_from=$2 AND b.date_to=$3 AND b.fingerprint=$4',[scope.storeId,scope.from,scope.to,fingerprint]);
  if(old.length)return {status:old[0].id===old[0].batch_id?'replay':'historical_replay',batchId:old[0].id,coverageCertified:false};
  if(ordering.changed){
   await tx.query('UPDATE ingest_v1.heads SET needs_recheck=true WHERE store_id=$1',[scope.storeId]);
   for(const row of versions)await tx.query('INSERT INTO ingest_v1.source_versions(store_id,source_id,source_version,fingerprint) VALUES($1,$2,$3,$4) ON CONFLICT(store_id,source_id) DO UPDATE SET source_version=EXCLUDED.source_version,fingerprint=EXCLUDED.fingerprint',[scope.storeId,row.id,row.version,row.fingerprint]);
  }
  const {rows:heads}=await tx.query('SELECT batch_id FROM ingest_v1.heads WHERE store_id=$1 AND date_from=$2 AND date_to=$3',[scope.storeId,scope.from,scope.to]);
  const {rows:inserted}=await tx.query('INSERT INTO ingest_v1.batches(store_id,date_from,date_to,fingerprint,mapping_state,payload) VALUES($1,$2,$3,$4,$5,$6::jsonb) RETURNING id',[scope.storeId,scope.from,scope.to,fingerprint,mapped.status,JSON.stringify({source:content,mapped})]);
  if(heads.length)await tx.query('UPDATE ingest_v1.batches SET superseded_at=now() WHERE id=$1',[heads[0].batch_id]);
  await tx.query('INSERT INTO ingest_v1.heads(store_id,date_from,date_to,batch_id,needs_recheck) VALUES($1,$2,$3,$4,$5) ON CONFLICT(store_id,date_from,date_to) DO UPDATE SET batch_id=EXCLUDED.batch_id,needs_recheck=ingest_v1.heads.needs_recheck OR EXCLUDED.needs_recheck',[scope.storeId,scope.from,scope.to,inserted[0].id,ordering.changed&&previous.length>0]);
  return {status:heads.length?'changed_requires_review':'recorded_requires_review',mappingState:mapped.status,batchId:inserted[0].id,coverageCertified:false};
 });
}

/** No publication path exists yet: even clean candidates remain awaiting review. */
export async function candidatePeriodState(db,{storeId,from,to}){
 const {rows}=await db.query('SELECT h.needs_recheck,b.payload,s.currency_code,s.timezone,s.shopify_domain,s.shopify_store_id FROM ingest_v1.heads h JOIN ingest_v1.batches b ON b.id=h.batch_id JOIN public.stores s ON s.id=h.store_id WHERE h.store_id=$1 AND h.date_from=$2 AND h.date_to=$3',[storeId,from,to]);
 if(!rows.length)return {status:'unavailable',figures:null};
 const r=rows[0],settings=r.payload.source.settings;
 const changed=settings.currency!==r.currency_code.trim()||settings.timezone!==r.timezone||settings.domain!==r.shopify_domain||![settings.shopId,settings.shopId.split('/').at(-1)].includes(r.shopify_store_id);
 return {status:r.needs_recheck||changed?'needs_recheck':'awaiting_review',figures:null};
}
