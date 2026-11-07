import {createHash} from 'node:crypto';
import {mapShopifySales} from './map-sales.mjs';
import {sourceVersions,compareSourceVersions} from './source-versions.mjs';
import {normaliseSale} from '../financial-v1/calculations.mjs';
import {pence} from '../financial-v1/source-adapter.mjs';
import {calculateMappedSales} from '../financial-v1/cloud-sales-adapter.mjs';
const canonical=v=>v instanceof Date?v.toISOString():Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const digest=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const requireValue=(ok,message)=>{if(!ok)throw new Error(message);};
const gid=(value,type)=>{
 requireValue(typeof value==='string'&&new RegExp(`^(?:gid://shopify/${type}/)?[1-9][0-9]*$`).test(value),'Missing or unsupported source identity');
 return value.startsWith('gid:')?value:`gid://shopify/${type}/${value}`;
};
/** Compares identities and financial event components, never just period totals.
 * All supplied history is compared, including refunds outside the target period.
 */
export function reconcileCandidateEvents(events,orders,refunds){
 const expected=new Map();
 const add=(map,key,value)=>{requireValue(!map.has(key),'Duplicate source identity');map.set(key,value);};
 const sale=e=>({type:'sale',orderId:e.orderId,date:e.date,currency:e.currency,eligible:e.eligible,grossProductExVat:e.grossProductExVat,discountExVat:e.discountExVat,netShipping:e.netShipping,productVat:e.productVat,shippingVat:e.shippingVat,customerCharge:e.customerCharge});
 const refund=e=>({type:'refund',orderId:e.orderId,date:e.date,currency:e.currency,productCash:e.productCash,productVat:e.productVat,shippingCash:e.shippingCash,shippingVat:e.shippingVat});
 for(const e of events){requireValue(['sale','refund'].includes(e.type),'Unsupported event');if(e.type==='sale')requireValue([e.productVat,e.shippingVat,e.customerCharge].every(v=>Number.isSafeInteger(v)&&v>=0),'Original sale tax/payment evidence missing');add(expected,e.id,e.type==='sale'?sale(e):refund(e));}
 const actual=new Map(),orderIds=new Map();
 for(const o of orders){
  requireValue(o.mapping_state==='verified','Missing or stale source evidence');
  const id=gid(o.shopify_order_id,'Order');orderIds.set(o.id,id);
  const n=normaliseSale({gross:pence(o.gross),grossVat:pence(o.gross_vat),discount:pence(o.discount),discountVat:pence(o.discount_vat),shipping:pence(o.shipping),shippingVat:pence(o.shipping_vat),basis:o.tax_basis});
  add(actual,`sale:${id}`,sale({orderId:id,date:o.day,currency:o.currency,eligible:o.original_eligible,...n}));
 }
 for(const r of refunds){
  requireValue(r.mapping_state==='verified','Missing or stale source evidence');
  requireValue(orderIds.has(r.order_id),'Refund order missing');
  add(actual,`refund:${gid(r.shopify_refund_id,'Refund')}`,refund({orderId:orderIds.get(r.order_id),date:r.day,currency:r.currency,productCash:pence(r.product_cash),productVat:pence(r.product_vat),shippingCash:pence(r.shipping_cash),shippingVat:pence(r.shipping_vat)}));
 }
 const differences=[];
 for(const [id,value] of expected){if(!actual.has(id))differences.push({id,reason:'missing_finance_event'});else if(digest(value)!==digest(actual.get(id)))differences.push({id,reason:'financial_event_mismatch'});}
 for(const id of actual.keys())if(!expected.has(id))differences.push({id,reason:'unexpected_finance_event'});
 return differences;
}

/** Privileged internal, read-only proposal. Caller must authorise store access.
 * A packet is NOT coverage certification or authorisation to publish.
 */
export async function prepareCandidateReview(db,{storeId,from,to}){
 return db.transaction(async tx=>{
  await tx.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
  return inspectCandidateReview(tx,{storeId,from,to});
 });
}

/** Internal transaction helper: caller owns isolation/locking and authorisation. */
export async function inspectCandidateReview(tx,{storeId,from,to},{includeSnapshot=false}={}){
  const read=async(sql,params=[storeId])=>(await tx.query(sql,params)).rows;
  const stores=await read('SELECT id,shopify_domain,shopify_store_id,currency_code,timezone FROM public.stores WHERE id=$1');
  const heads=await read('SELECT h.*,b.fingerprint,b.mapping_state,b.payload FROM ingest_v1.heads h JOIN ingest_v1.batches b ON b.id=h.batch_id WHERE h.store_id=$1 AND h.date_from=$2 AND h.date_to=$3',[storeId,from,to]);
  requireValue(stores.length===1&&heads.length===1,'Store or candidate period missing');
  const versions=await read('SELECT * FROM ingest_v1.source_versions WHERE store_id=$1 ORDER BY source_id');
  const orders=await read('SELECT m.*,o.shopify_order_id,to_jsonb(e) AS review_evidence FROM finance_v1.order_mapping m JOIN public.orders o ON o.id=m.id AND o.store_id=m.store_id LEFT JOIN finance_v1.order_evidence e ON e.store_id=m.store_id AND e.order_id=m.id WHERE m.store_id=$1 ORDER BY m.id');
  const refunds=await read('SELECT m.*,r.shopify_refund_id,to_jsonb(e) AS review_evidence FROM finance_v1.refund_mapping m JOIN public.refunds r ON r.id=m.id AND r.store_id=m.store_id LEFT JOIN finance_v1.refund_evidence e ON e.store_id=m.store_id AND e.refund_id=m.id WHERE m.store_id=$1 ORDER BY m.id');
  const coverage=await read('SELECT * FROM finance_v1.coverage_evidence WHERE store_id=$1 AND date_from=$2 AND date_to=$3',[storeId,from,to]);
  const snapshot={scope:{storeId,from,to},stores,heads,versions,orders,refunds,coverage};
  let transactionEvidence=null;
  const issues=[],head=heads[0],store=stores[0],source=head.payload.source;
  try{
   requireValue(source.scope.storeId===storeId&&source.scope.from===from&&source.scope.to===to,'Candidate scope mismatch');
   requireValue(source.settings.currency===store.currency_code.trim()&&source.settings.timezone===store.timezone&&source.settings.domain===store.shopify_domain&&gid(store.shopify_store_id,'Shop')===source.settings.shopId,'Store settings changed');
   const ordering=compareSourceVersions(versions,sourceVersions(source.orders));
   requireValue(ordering.status==='accepted'&&!ordering.changed,'Candidate source versions are no longer current');
   const mapped=mapShopifySales({...source,status:'details_for_mapping'},source.scope);
   requireValue(mapped.status==='mapped_for_review','Candidate mapping blocked');
   issues.push(...reconcileCandidateEvents(mapped.events,orders,refunds));
   // Validate authoritative evidence arithmetic in memory only. This temporary
   // coverage assertion never reaches the database or the returned packet.
   requireValue(coverage.length===1,'Coverage evidence missing');
   calculateMappedSales({orders,refunds,coverage:[{...coverage[0],sales_and_refunds_complete:true}]},{storeId,from,to,currency:source.settings.currency});
   if(issues.length===0){
    const rows=mapped.events.map(e=>({id:e.id,orderId:e.orderId,type:e.type,date:e.date,currency:e.currency,
     productExVat:e.type==='sale'?e.grossProductExVat-e.discountExVat:-(e.productCash-e.productVat),
     shippingExVat:e.type==='sale'?e.netShipping:-(e.shippingCash-e.shippingVat),
     vat:e.type==='sale'?e.productVat+e.shippingVat:-(e.productVat+e.shippingVat),
     cash:e.type==='sale'?e.customerCharge:-(e.productCash+e.shippingCash)})).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
    transactionEvidence={rows:rows.slice(0,200),totalEvents:rows.length,timezone:source.settings.timezone,periodSummary:{currency:source.settings.currency,netProductSales:mapped.candidate.netProductSales,originalOrders:mapped.candidate.originalOrders,hasActivity:mapped.candidate.hasActivity}};
   }
  }catch(error){issues.push({reason:error.message});}
  return {...(includeSnapshot?{snapshot}:{}),status:issues.length?'blocked':'awaiting_independent_coverage_review',batchId:head.batch_id,scope:{storeId,from,to},snapshotDigest:digest(snapshot),issues,transactionEvidence,coverageCertified:false,figures:null};
}
