import { normaliseSale, tradingPeriod, profitBridge } from './calculations.mjs';

/** Exact decimal pounds to pence. Never round an ambiguous source value. */
export function pence(value) {
  if (typeof value !== 'string' || !/^-?\d+(\.\d{1,2})?$/.test(value)) throw new Error('Missing or invalid source money');
  const negative = value.startsWith('-');
  const [whole, fraction=''] = (negative ? value.slice(1) : value).split('.');
  const result = (BigInt(whole)*100n + BigInt(fraction.padEnd(2,'0'))) * (negative ? -1n : 1n);
  if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('Source money overflow');
  return Number(result);
}
const add = (a,b) => {const n=a+b;if(!Number.isSafeInteger(n))throw new Error('Source total overflow');return n;};
const evidence = value => typeof value==='string' && value.trim().length>0;

/** Explicit evidence is required; raw legacy orders alone cannot meet the new contract. */
export function assessLegacyOrder(row) {
  const missing = [];
  if(!row.currency)missing.push('currency');
  // The current cloud schema has none of these verified source contracts.
  if(!['inclusive','exclusive'].includes(row.verified_tax_basis))missing.push('verified tax basis');
  if(!evidence(row.resolved_event_date_evidence))missing.push('resolved event date');
  if(typeof row.original_order_eligible!=='boolean')missing.push('original order eligibility');
  if(!evidence(row.historic_cost_evidence))missing.push('historic product cost evidence');
  return {ready:missing.length===0,missing};
}

/** Database client must provide transaction/query. No Supabase credentials or
 * network setup here. All reads run in one repeatable-read read-only snapshot.
 * Scope is not authentication: a future server must authorise storeId first.
 */
export async function readSourcePeriod(db, { storeId, currency, from, to }) {
  if(!storeId || !currency || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from>to)throw new Error('Invalid source scope');
  return db.transaction(async tx => {
    await tx.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    const params=[storeId,from,to];
    const {rows:coverage}=await tx.query('SELECT * FROM source_coverage WHERE store_id=$1 AND date_from=$2::date AND date_to=$3::date',params);
    if(coverage.length!==1 || !coverage[0].trading_complete || coverage[0].currency!==currency || !evidence(coverage[0].evidence))throw new Error('Verified trading coverage required');
    const {rows:orders}=await tx.query(`SELECT *, event_date::text AS day,
      gross::text AS gross, gross_vat::text AS gross_vat, discount::text AS discount,
      discount_vat::text AS discount_vat, shipping::text AS shipping, shipping_vat::text AS shipping_vat,
      historic_unit_cost::text AS historic_unit_cost FROM source_orders WHERE store_id=$1 AND event_date<=$2::date`,[storeId,to]);
    const {rows:refunds}=await tx.query(`SELECT *, event_date::text AS day, returned_date::text AS returned_day,
      product_cash::text AS product_cash, product_vat::text AS product_vat,
      shipping_cash::text AS shipping_cash, shipping_vat::text AS shipping_vat
      FROM source_refunds WHERE store_id=$1 AND event_date<=$2::date ORDER BY event_date,id`,[storeId,to]);
    // Only original orders needed for this period or its refund histories are normalised.
    const activeOrders=new Set(refunds.filter(r=>r.day>=from).map(r=>r.order_id));
    orders.filter(o=>o.day>=from).forEach(o=>activeOrders.add(o.id));
    const normalised=new Map(),events=[],totals=new Map();
    for(const o of orders.filter(o=>activeOrders.has(o.id))) {
      if(o.currency!==currency || !evidence(o.date_evidence) || typeof o.eligible!=='boolean')throw new Error('Order currency/date/eligibility unresolved');
      const sale=normaliseSale({gross:pence(o.gross),grossVat:pence(o.gross_vat),discount:pence(o.discount),discountVat:pence(o.discount_vat),shipping:pence(o.shipping),shippingVat:pence(o.shipping_vat),basis:o.tax_basis});
      const unit=o.historic_unit_cost===null || !evidence(o.cost_evidence) ? null : pence(o.historic_unit_cost);
      if(unit!==null && unit<0)throw new Error('Negative historic cost');
      const cost=unit===null?null:unit*o.quantity;
      if(cost!==null && !Number.isSafeInteger(cost))throw new Error('Historic cost overflow');
      normalised.set(o.id,{...o,sale,unit});
      events.push({id:`sale:${o.id}`,type:'sale',storeId,orderId:o.id,currency,date:o.day,eligible:o.eligible,
        grossProductExVat:sale.grossProductExVat,discountExVat:sale.discountExVat,netShipping:sale.netShipping,historicCost:cost});
    }
    for(const r of refunds.filter(r=>activeOrders.has(r.order_id))) {
      const order=normalised.get(r.order_id);
      if(!order || order.day>r.day || order.eligible!==true)throw new Error('Refund original order not verified');
      if(r.currency!==currency || !evidence(r.date_evidence))throw new Error('Refund currency/date unresolved');
      const productCash=pence(r.product_cash),productVat=pence(r.product_vat),shippingCash=pence(r.shipping_cash),shippingVat=pence(r.shipping_vat);
      if(Math.min(productCash,productVat,shippingCash,shippingVat)<0 || productVat>productCash || shippingVat>shippingCash)throw new Error('Invalid refund components');
      const t=totals.get(r.order_id)??{product:0,productVat:0,shipping:0,shippingVat:0,units:0};
      if(!Number.isSafeInteger(r.saleable_quantity) || r.saleable_quantity<0 || !evidence(r.recovery_evidence))throw new Error('Product recovery evidence required');
      t.product=add(t.product,productCash-productVat);t.productVat=add(t.productVat,productVat);
      t.shipping=add(t.shipping,shippingCash-shippingVat);t.shippingVat=add(t.shippingVat,shippingVat);t.units=add(t.units,r.saleable_quantity);
      if(t.product>order.sale.netProductSales || t.productVat>order.sale.productVat || t.shipping>order.sale.netShipping || t.shippingVat>order.sale.shippingVat || t.units>order.quantity)throw new Error('Cumulative refund/return exceeds original sale');
      totals.set(r.order_id,t);
      if(r.day<from)continue;
      // Cross-period stock recovery needs a separate event contract, not a guess.
      if(r.saleable_quantity>0 && (!r.returned_day || r.returned_day<from || r.returned_day>to))throw new Error('Return-to-stock period unresolved');
      const reversal=r.saleable_quantity===0?0:order.unit===null?null:order.unit*r.saleable_quantity;
      events.push({id:`refund:${r.id}`,type:'refund',storeId,orderId:r.order_id,currency,date:r.day,
        productCash,productVat,shippingCash,shippingVat,saleableReturn:r.saleable_quantity>0,costReversal:reversal});
    }
    const trading=tradingPeriod({events,storeId,currency,from,to,coverageComplete:true});
    const {rows:costs}=await tx.query('SELECT *, amount::text AS amount FROM source_costs WHERE store_id=$1 AND event_date BETWEEN $2::date AND $3::date',params);
    const groups={variable:0,advertising:0,overhead:0,depreciation_amortisation:0};
    for(const c of costs) {
      if(c.currency!==currency || !Object.hasOwn(groups,c.category))throw new Error('Cost classification/currency unresolved');
      groups[c.category]=add(groups[c.category],pence(c.amount));
    }
    const complete=coverage[0].costs_complete;
    const profit=profitBridge({...trading,variableCosts:complete?groups.variable:null,advertising:complete?groups.advertising:null,
      overheadIncludingDA:complete?add(groups.overhead,groups.depreciation_amortisation):null,depreciationAmortisation:complete?groups.depreciation_amortisation:null});
    return {trading,profit,provenance:{storeId,currency,from,to,coverageEvidence:coverage[0].evidence,containsEstimates:costs.some(c=>c.provenance==='estimated'),costsComplete:complete}};
  });
}
