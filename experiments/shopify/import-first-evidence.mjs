import {mapShopifySales} from './map-sales.mjs';
import {sourceVersions,compareSourceVersions} from './source-versions.mjs';
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const money=n=>{check(Number.isSafeInteger(n)&&n>=0,'Invalid money');return (n/100).toFixed(2);};
const sourceId=(id,type)=>{check(new RegExp(`^gid://shopify/${type}/[1-9][0-9]*$`).test(id),'Unsupported source identifier');return id.split('/').at(-1);};
/** Local, privileged prototype only. First import into an EMPTY store.
 * Never overwrites existing financial records or certifies period completeness.
 * Caller supplies a trusted transaction-capable administrator DB, not review credentials.
 */
export async function importFirstEvidence(db,{storeId,from,to,batchId}){
 return db.transaction(async tx=>{
  await tx.query("SET LOCAL lock_timeout='5s'");
  await tx.query('SELECT ingest_v1.lock_import_dependencies()');
  // Receipt means only that this batch committed previously, not that current
  // financial records remain unchanged or verified. Never rewrite on retry.
  const {rows:receipts}=await tx.query('SELECT r.*,b.fingerprint FROM ingest_v1.import_receipts r JOIN ingest_v1.batches b ON b.id=r.batch_id WHERE r.batch_id=$1 AND r.store_id=$2 AND r.date_from=$3 AND r.date_to=$4',[batchId,storeId,from,to]);
  if(receipts.length){
   const r=receipts[0];check(r.source_fingerprint===r.fingerprint,'Imported batch fingerprint changed');
   return {status:'already_imported',coverageCertified:false,orders:r.order_count,refunds:r.refund_count};
  }
  const {rows:stores}=await tx.query('SELECT * FROM public.stores WHERE id=$1',[storeId]);
  const {rows:heads}=await tx.query('SELECT b.payload,b.fingerprint,h.batch_id FROM ingest_v1.heads h JOIN ingest_v1.batches b ON b.id=h.batch_id WHERE h.store_id=$1 AND h.date_from=$2 AND h.date_to=$3',[storeId,from,to]);
  check(stores.length===1&&heads.length===1&&heads[0].batch_id===batchId,'Candidate changed or missing');
  const store=stores[0],source=heads[0].payload.source;
  check(source.scope.storeId===storeId&&source.scope.from===from&&source.scope.to===to,'Candidate scope mismatch');
  check(source.settings.domain===store.shopify_domain&&source.settings.currency===store.currency_code.trim()&&source.settings.timezone===store.timezone&&[source.settings.shopId,source.settings.shopId.split('/').at(-1)].includes(store.shopify_store_id),'Store settings changed');
  const {rows:versions}=await tx.query('SELECT * FROM ingest_v1.source_versions WHERE store_id=$1',[storeId]);
  const ordering=compareSourceVersions(versions,sourceVersions(source.orders));
  check(ordering.status==='accepted'&&!ordering.changed,'Candidate source is stale');
  const mapped=mapShopifySales({...source,status:'details_for_mapping'},source.scope);
  check(mapped.status==='mapped_for_review'&&mapped.excluded.length===0&&mapped.events.length>0,'Import requires supported, non-excluded events');
  const {rows:existing}=await tx.query('SELECT (SELECT count(*) FROM public.orders WHERE store_id=$1)+(SELECT count(*) FROM public.refunds WHERE store_id=$1)+(SELECT count(*) FROM finance_v1.coverage_evidence WHERE store_id=$1) AS n',[storeId]);
  check(Number(existing[0].n)===0,'First import requires an empty store');
  const ref=`candidate:${batchId}`,ids=new Map();
  for(const e of mapped.events.filter(e=>e.type==='sale')){
   const order=source.orders.find(o=>o.id===e.orderId),sale=order.transactions.find(t=>t.kind==='SALE'&&t.status==='SUCCESS');
   const {rows}=await tx.query('INSERT INTO public.orders(store_id,shopify_order_id,order_date,currency,gross_sales,discounts,shipping,tax,net_sales,total_sales,financial_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',[storeId,sourceId(e.orderId,'Order'),sale.processedAt,e.currency,money(e.grossProductExVat),money(e.discountExVat),money(e.netShipping),money(e.productVat+e.shippingVat),money(e.grossProductExVat-e.discountExVat),money(e.customerCharge),'paid']);
   const id=rows[0].id;ids.set(e.orderId,id);
   await tx.query("INSERT INTO finance_v1.order_evidence(store_id,order_id,observed_raw,event_date,currency,original_eligible,tax_basis,gross_product_vat,discount_vat,shipping_vat,evidence_ref,verified_by) SELECT $1,$2,current_snapshot,$3,$4,true,'exclusive',$5,0,$6,$7,'source-mapper-v1' FROM finance_v1.order_mapping WHERE store_id=$1 AND id=$2",[storeId,id,e.date,e.currency,money(e.productVat),money(e.shippingVat),ref]);
  }
  for(const e of mapped.events.filter(e=>e.type==='refund')){
   const order=source.orders.find(o=>o.id===e.orderId),refund=order.refunds.find(r=>`refund:${r.id}`===e.id);
   const {rows}=await tx.query('INSERT INTO public.refunds(store_id,order_id,shopify_refund_id,refund_date,amount) VALUES($1,$2,$3,$4,$5) RETURNING id',[storeId,ids.get(e.orderId),sourceId(refund.id,'Refund'),refund.transactions.nodes[0].processedAt,money(e.productCash+e.shippingCash)]);
   await tx.query("INSERT INTO finance_v1.refund_evidence(store_id,refund_id,order_id,observed_raw,event_date,currency,product_cash,product_vat,shipping_cash,shipping_vat,evidence_ref,verified_by) SELECT $1,$2,$3,current_snapshot,$4,$5,$6,$7,$8,$9,$10,'source-mapper-v1' FROM finance_v1.refund_mapping WHERE store_id=$1 AND id=$2",[storeId,rows[0].id,ids.get(e.orderId),e.date,e.currency,money(e.productCash),money(e.productVat),money(e.shippingCash),money(e.shippingVat),ref]);
  }
  await tx.query("INSERT INTO finance_v1.coverage_evidence(store_id,date_from,date_to,currency,sales_and_refunds_complete,evidence_ref,verified_by) VALUES($1,$2,$3,$4,false,$5,'source-mapper-v1')",[storeId,from,to,source.settings.currency,ref]);
  await tx.query('INSERT INTO ingest_v1.import_receipts(batch_id,store_id,date_from,date_to,source_fingerprint,order_count,refund_count) VALUES($1,$2,$3,$4,$5,$6,$7)',[batchId,storeId,from,to,heads[0].fingerprint,ids.size,mapped.events.filter(e=>e.type==='refund').length]);
  return {status:'imported_awaiting_review',coverageCertified:false,orders:ids.size,refunds:mapped.events.filter(e=>e.type==='refund').length};
 });
}
