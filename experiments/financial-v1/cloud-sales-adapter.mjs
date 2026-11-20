import {pence} from './source-adapter.mjs';
import {normaliseSale,tradingPeriod} from './calculations.mjs';

/** Reads proposed evidence views over EXISTING raw orders/refunds. Does not
 * write/import/backfill evidence. Until event eligibility is certified this
 * conservatively blocks on any unverified store record (not just a guessed date).
 * Service caller must authorise the store; DB roles are not configured here.
 */
export async function readMappedSales(db,{storeId,currency,from,to}) {
  return db.transaction(async tx=>{
    await tx.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    const {rows:coverage}=await tx.query('SELECT * FROM finance_v1.coverage_evidence WHERE store_id=$1 AND date_from=$2::date AND date_to=$3::date',[storeId,from,to]);
    const {rows:orders}=await tx.query('SELECT * FROM finance_v1.order_mapping WHERE store_id=$1',[storeId]);
    const {rows:refunds}=await tx.query('SELECT * FROM finance_v1.refund_mapping WHERE store_id=$1',[storeId]);
    return calculateMappedSales({coverage,orders,refunds},{storeId,currency,from,to});
  });
}

/** One authorised database snapshot; also used by the staging RPC client. */
export function calculateMappedSales({coverage,orders,refunds},{storeId,currency,from,to}) {
  if(!Array.isArray(coverage)||!Array.isArray(orders)||!Array.isArray(refunds))throw new Error('Malformed sales evidence');
  if([...coverage,...orders,...refunds].some(r=>r.store_id!==storeId))throw new Error('Source store mismatch');
    if(coverage.length!==1 || !coverage[0].sales_and_refunds_complete || coverage[0].currency!==currency)throw new Error('Sales/refund coverage evidence missing');
    if([...orders,...refunds].some(r=>r.mapping_state!=='verified'))throw new Error('Missing or stale source evidence');
    const known=new Map(),events=[],totals=new Map();
    for(const o of orders) {
      if(o.currency!==currency)throw new Error('Mixed currency requires an agreed conversion policy');
      const n=normaliseSale({gross:pence(o.gross),grossVat:pence(o.gross_vat),discount:pence(o.discount),discountVat:pence(o.discount_vat),shipping:pence(o.shipping),shippingVat:pence(o.shipping_vat),basis:o.tax_basis});
      known.set(o.id,{...o,n});
      events.push({storeId,currency,id:`sale:${o.id}`,orderId:o.id,type:'sale',date:o.day,eligible:o.original_eligible,
        grossProductExVat:n.grossProductExVat,discountExVat:n.discountExVat,netShipping:n.netShipping,historicCost:null});
    }
    for(const r of refunds) {
      if(r.currency!==currency)throw new Error('Refund currency mismatch');
      const o=known.get(r.order_id);
      if(!o || !o.original_eligible || r.day<o.day)throw new Error('Refund order link/date/eligibility invalid');
      const productCash=pence(r.product_cash),productVat=pence(r.product_vat),shippingCash=pence(r.shipping_cash),shippingVat=pence(r.shipping_vat);
      if(!Number.isSafeInteger(productCash+shippingCash) || productCash+shippingCash!==pence(r.amount))throw new Error('Refund split does not reconcile to raw amount');
      if(r.day>to)continue;
      const cumulative=totals.get(r.order_id)??[0,0,0,0];
      const values=[productCash-productVat,productVat,shippingCash-shippingVat,shippingVat];
      const limits=[o.n.netProductSales,o.n.productVat,o.n.netShipping,o.n.shippingVat];
      values.forEach((v,i)=>{cumulative[i]+=v;if(!Number.isSafeInteger(cumulative[i])||cumulative[i]>limits[i])throw new Error('Cumulative refund exceeds original component');});
      totals.set(r.order_id,cumulative);
      // Sales-only mapping: no assertion of saleability or COGS from refund amounts.
      // The core computes sales separately; all selected period cost results are
      // explicitly suppressed below until the line-level recovery adapter exists.
      events.push({storeId,currency,id:`refund:${r.id}`,orderId:r.order_id,type:'refund',date:r.day,
        productCash,productVat,shippingCash,shippingVat,saleableReturn:false,costReversal:0});
    }
    const result=tradingPeriod({storeId,currency,from,to,events,coverageComplete:true});
    return {...result,cogs:null,profitDataState:'incomplete',costReason:'Historic line cost and stock recovery mapping pending',
      provenance:{storeId,currency,from,to,coverageEvidence:coverage[0].evidence_ref}};
}
