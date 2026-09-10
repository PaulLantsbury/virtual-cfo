import {inspectSubsequentImport} from './prepare-subsequent-import.mjs';
import {mapShopifySales} from './map-sales.mjs';
import {pence} from '../financial-v1/source-adapter.mjs';
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const money=n=>{check(Number.isSafeInteger(n)&&n>=0,'Invalid money');return (n/100).toFixed(2);};
const sourceId=(id,type)=>{check(new RegExp(`^gid://shopify/${type}/[1-9][0-9]*$`).test(id),'Unsupported source identifier');return id.split('/').at(-1);};
const sameMoney=(value,expected)=>value!==null&&pence(String(value))===expected;
const sameTime=(a,b)=>Number.isFinite(new Date(a).getTime())&&new Date(a).getTime()===new Date(b).getTime();
/** Internal append-only writer; no runtime or HTTP integration. Rechecks under locks. */
export async function importSubsequentEvidence(db,{storeId,from,to,batchId}){
 return db.transaction(async tx=>{
  await tx.query("SET LOCAL lock_timeout='5s'");
  await tx.query('SELECT ingest_v1.lock_import_dependencies()');
  const {rows:receipts}=await tx.query('SELECT r.*,b.fingerprint FROM ingest_v1.import_receipts r JOIN ingest_v1.batches b ON b.id=r.batch_id WHERE r.batch_id=$1 AND r.store_id=$2 AND r.date_from=$3 AND r.date_to=$4',[batchId,storeId,from,to]);
  if(receipts.length){const r=receipts[0];check(r.source_fingerprint===r.fingerprint,'Imported batch fingerprint changed');return {status:'already_imported',coverageCertified:false,orders:r.order_count,refunds:r.refund_count};}
  const {source,plan}=await inspectSubsequentImport(tx,{storeId,from,to,batchId});
  check(plan.status==='planned_awaiting_database_checks','Source requires review');
  const events=mapShopifySales({...source,status:'details_for_mapping'},source.scope).events;
  const added=new Set(plan.additions.map(e=>e.id));
  const previous=events.filter(e=>!added.has(e.id));
  const {rows:orders}=await tx.query('SELECT o.*,e.event_date::text AS day,e.currency AS evidence_currency,e.original_eligible,e.tax_basis,e.gross_product_vat,e.discount_vat,e.shipping_vat FROM public.orders o JOIN finance_v1.order_evidence e ON e.store_id=o.store_id AND e.order_id=o.id WHERE o.store_id=$1',[storeId]);
  const {rows:refunds}=await tx.query('SELECT r.*,e.event_date::text AS day,e.currency AS evidence_currency,e.product_cash,e.product_vat,e.shipping_cash,e.shipping_vat FROM public.refunds r JOIN finance_v1.refund_evidence e ON e.store_id=r.store_id AND e.refund_id=r.id WHERE r.store_id=$1',[storeId]);
  check(orders.length===previous.filter(e=>e.type==='sale').length&&refunds.length===previous.filter(e=>e.type==='refund').length,'Stored event counts changed');
  const ids=new Map(),seenOrders=new Set(),seenRefunds=new Set();
  for(const e of previous.filter(e=>e.type==='sale')){
   const matches=orders.filter(o=>String(o.shopify_order_id)===sourceId(e.orderId,'Order'));
   check(matches.length===1,'Stored order identity differs from source');const o=matches[0];seenOrders.add(o.id);
   const sale=source.orders.find(o=>o.id===e.orderId).transactions.find(t=>t.kind==='SALE'&&t.status==='SUCCESS');
   check(o.day===e.date&&o.evidence_currency===e.currency&&o.currency===e.currency&&o.original_eligible===true&&o.tax_basis==='exclusive'&&o.financial_status==='paid'&&sameTime(o.order_date,sale.processedAt)&&
    sameMoney(o.gross_sales,e.grossProductExVat)&&sameMoney(o.discounts,e.discountExVat)&&sameMoney(o.shipping,e.netShipping)&&sameMoney(o.tax,e.productVat+e.shippingVat)&&sameMoney(o.net_sales,e.grossProductExVat-e.discountExVat)&&sameMoney(o.total_sales,e.customerCharge)&&sameMoney(o.refunds,0)&&sameMoney(o.gross_product_vat,e.productVat)&&sameMoney(o.discount_vat,0)&&sameMoney(o.shipping_vat,e.shippingVat),'Stored order values differ from source');
   ids.set(e.orderId,o.id);
  }
  for(const e of previous.filter(e=>e.type==='refund')){
   const matches=refunds.filter(r=>String(r.shopify_refund_id)===sourceId(e.id.slice('refund:'.length),'Refund'));
   check(matches.length===1,'Stored refund identity differs from source');const r=matches[0];seenRefunds.add(r.id);
   const refund=source.orders.find(o=>o.id===e.orderId).refunds.find(r=>`refund:${r.id}`===e.id);
   check(r.order_id===ids.get(e.orderId)&&r.day===e.date&&r.evidence_currency===e.currency&&sameTime(r.refund_date,refund.transactions.nodes[0].processedAt)&&sameMoney(r.amount,e.productCash+e.shippingCash)&&sameMoney(r.product_cash,e.productCash)&&sameMoney(r.product_vat,e.productVat)&&sameMoney(r.shipping_cash,e.shippingCash)&&sameMoney(r.shipping_vat,e.shippingVat),'Stored refund values differ from source');
  }
  check(seenOrders.size===orders.length&&seenRefunds.size===refunds.length,'Stored identities are not unique');
  const ref=`candidate:${batchId}`;
  for(const e of plan.additions.filter(e=>e.type==='sale')){
   const order=source.orders.find(o=>o.id===e.orderId),sale=order.transactions.find(t=>t.kind==='SALE'&&t.status==='SUCCESS');
   const {rows}=await tx.query('INSERT INTO public.orders(store_id,shopify_order_id,order_date,currency,gross_sales,discounts,shipping,tax,net_sales,total_sales,financial_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',[storeId,sourceId(e.orderId,'Order'),sale.processedAt,e.currency,money(e.grossProductExVat),money(e.discountExVat),money(e.netShipping),money(e.productVat+e.shippingVat),money(e.grossProductExVat-e.discountExVat),money(e.customerCharge),'paid']);
   const id=rows[0].id;ids.set(e.orderId,id);
   await tx.query("INSERT INTO finance_v1.order_evidence(store_id,order_id,observed_raw,event_date,currency,original_eligible,tax_basis,gross_product_vat,discount_vat,shipping_vat,evidence_ref,verified_by) SELECT $1,$2,current_snapshot,$3,$4,true,'exclusive',$5,0,$6,$7,'source-mapper-v1' FROM finance_v1.order_mapping WHERE store_id=$1 AND id=$2",[storeId,id,e.date,e.currency,money(e.productVat),money(e.shippingVat),ref]);
  }
  for(const e of plan.additions.filter(e=>e.type==='refund')){
   const order=source.orders.find(o=>o.id===e.orderId),refund=order.refunds.find(r=>`refund:${r.id}`===e.id);
   const {rows}=await tx.query('INSERT INTO public.refunds(store_id,order_id,shopify_refund_id,refund_date,amount) VALUES($1,$2,$3,$4,$5) RETURNING id',[storeId,ids.get(e.orderId),sourceId(refund.id,'Refund'),refund.transactions.nodes[0].processedAt,money(e.productCash+e.shippingCash)]);
   await tx.query("INSERT INTO finance_v1.refund_evidence(store_id,refund_id,order_id,observed_raw,event_date,currency,product_cash,product_vat,shipping_cash,shipping_vat,evidence_ref,verified_by) SELECT $1,$2,$3,current_snapshot,$4,$5,$6,$7,$8,$9,$10,'source-mapper-v1' FROM finance_v1.refund_mapping WHERE store_id=$1 AND id=$2",[storeId,rows[0].id,ids.get(e.orderId),e.date,e.currency,money(e.productCash),money(e.productVat),money(e.shippingCash),money(e.shippingVat),ref]);
  }
  // Existing invalidation triggers conservatively clear all store coverage on inserts.
  // Never change an existing coverage row or its audit reference merely for a no-op.
  await tx.query("INSERT INTO finance_v1.coverage_evidence(store_id,date_from,date_to,currency,sales_and_refunds_complete,evidence_ref,verified_by) VALUES($1,$2,$3,$4,false,$5,'source-mapper-v1') ON CONFLICT(store_id,date_from,date_to) DO NOTHING",[storeId,from,to,source.settings.currency,ref]);
  await tx.query('INSERT INTO ingest_v1.import_receipts(batch_id,store_id,date_from,date_to,source_fingerprint,order_count,refund_count) VALUES($1,$2,$3,$4,$5,$6,$7)',[batchId,storeId,from,to,plan.sourceFingerprint,plan.newOrders,plan.newRefunds]);
  return {status:'imported_awaiting_review',coverageCertified:false,orders:plan.newOrders,refunds:plan.newRefunds};
 });
}
