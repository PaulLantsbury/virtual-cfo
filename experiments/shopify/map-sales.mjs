import {createHash} from 'node:crypto';
import {pence} from '../financial-v1/source-adapter.mjs';
import {eventDay} from '../financial-v1/event-evidence.mjs';
import {tradingPeriod} from '../financial-v1/calculations.mjs';
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const sum=values=>values.reduce((a,b)=>{check(Number.isSafeInteger(a+b),'Money overflow');return a+b;},0);
const nodes=connection=>{check(connection?.pageInfo?.hasNextPage===false&&Array.isArray(connection.nodes),'Incomplete financial detail');const list=connection.nodes;check(list.every(n=>typeof n.id==='string'&&n.id.length>0)&&new Set(list.map(n=>n.id)).size===list.length,'Duplicate or missing detail ID');return list;};

export async function loadShopifyDetails(read,extraction,{signal}={}) {
 signal=signal?AbortSignal.any([signal,AbortSignal.timeout(60000)]):AbortSignal.timeout(60000);
 check(extraction?.status==='extracted_for_mapping'&&Array.isArray(extraction.orders),'Order extraction required');
 const orders=[];
 for(const order of extraction.orders){
  signal?.throwIfAborted();
  const {order:detail}=await read('details',{id:order.id},signal);
  check(detail?.id===order.id&&detail.updatedAt===order.updatedAt,'Order changed during detail collection');
  check(Array.isArray(detail.refunds)&&detail.refunds.length===order.refunds.length,'Refund list changed during detail collection');
  const seen=new Set();
  const refunds=order.refunds.map(r=>{const d=detail.refunds.find(d=>d.id===r.id);check(d&&d.updatedAt===r.updatedAt&&!seen.has(d.id),'Refund changed during detail collection');seen.add(d.id);return {...r,...d};});
  orders.push({...order,lineItems:detail.lineItems,shippingLines:detail.shippingLines,refunds});
 }
 return {...extraction,orders,status:'details_for_mapping',detailFingerprint:createHash('sha256').update(JSON.stringify({settings:extraction.settings,orders})).digest('hex')};
}

/** Conservative first source mapping: unedited tax-exclusive orders with one successful SALE.
 * Candidate arithmetic only. No database writer or completeness certification.
 */
export function mapShopifySales(extraction,{storeId,shopId,from,to}){
 try{
  check(extraction?.status==='details_for_mapping'&&typeof storeId==='string'&&storeId.length>0,'Detailed extraction and local store required');
  check(typeof shopId==='string'&&extraction.settings?.shopId===shopId,'Shopify identity does not match mapping scope');
  const {currency,timezone}=extraction.settings;
  check(Intl.supportedValuesOf('currency').includes(currency)&&new Intl.NumberFormat('en-GB',{style:'currency',currency}).resolvedOptions().maximumFractionDigits===2,'Unsupported currency precision');
  const money=bag=>{check(bag?.shopMoney?.currencyCode===currency,'Missing or mismatched money currency');const n=pence(bag.shopMoney.amount);check(n>=0,'Negative source component');return n;};
  const tax=lines=>{check(Array.isArray(lines),'Missing tax evidence');return sum(lines.map(t=>money(t.priceSet)));};
  const events=[],excluded=[],seen=new Set();
  for(const o of extraction.orders){
   check(o?.id&&!seen.has(o.id),'Duplicate source order');seen.add(o.id);
   check(typeof o.test==='boolean'&&typeof o.edited==='boolean'&&o.currencyCode===currency,'Missing order facts');
   if(o.test){excluded.push({id:o.id,reason:'TEST_ORDER'});continue;}
   check(Array.isArray(o.transactions)&&Array.isArray(o.refunds)&&o.transactionsCount?.precision==='EXACT'&&o.transactionsCount.count===o.transactions.length,'Incomplete payment history');
   check(new Set(o.transactions.map(t=>t.id)).size===o.transactions.length,'Duplicate transaction');
   const paid=o.transactions.filter(t=>['SALE','CAPTURE'].includes(t.kind)&&t.status==='SUCCESS');
   if(!paid.length&&['PENDING','AUTHORIZED','VOIDED'].includes(o.displayFinancialStatus)&&!o.refunds.length&&o.transactions.every(t=>['AUTHORIZATION','VOID'].includes(t.kind))){excluded.push({id:o.id,reason:'UNPAID_ORDER'});continue;}
   check(!o.edited&&o.cancelledAt===null,'Order edits or cancellations require review');
   check(o.taxesIncluded===false,'Tax-inclusive allocation requires review');
   check(paid.length===1&&paid[0].kind==='SALE'&&o.transactions.every(t=>t===paid[0]||t.kind==='REFUND'),'Split/capture/payment history requires review');
   const sale=paid[0],saleDay=eventDay(sale.processedAt,timezone);
   const lines=nodes(o.lineItems),shipping=nodes(o.shippingLines);check(lines.length>0,'Original product lines required');
   const limits=new Map();let gross=0,discount=0,productTax=0,shippingNet=0,shippingTax=0,shippingDiscount=0;
   for(const line of lines){
    check(line.isGiftCard===false&&Number.isSafeInteger(line.quantity)&&line.quantity>0,'Unsupported product line');
    check(Array.isArray(line.discountAllocations),'Missing discount evidence');
    const g=money(line.originalTotalSet),d=sum(line.discountAllocations.map(a=>money(a.allocatedAmountSet))),v=tax(line.taxLines);
    check(d<=g,'Discount exceeds product value');gross=sum([gross,g]);discount=sum([discount,d]);productTax=sum([productTax,v]);limits.set(line.id,[g-d,v]);
   }
   const shippingLimits=new Map();
   for(const line of shipping){
    check(line.isRemoved===false,'Removed shipping requires review');const original=money(line.originalPriceSet),n=money(line.discountedPriceSet),v=tax(line.taxLines);
    check(n<=original,'Invalid shipping discount');shippingDiscount=sum([shippingDiscount,original-n]);shippingNet=sum([shippingNet,n]);shippingTax=sum([shippingTax,v]);shippingLimits.set(line.id,[n,v]);
   }
   const charge=sum([gross-discount,productTax,shippingNet,shippingTax]);
   check(charge===money(o.originalTotalPriceSet)&&charge===money(sale.amountSet),'Original payment does not reconcile');
   check(sum([productTax,shippingTax])===money(o.totalTaxSet)&&sum([discount,shippingDiscount])===money(o.totalDiscountsSet),'Order tax/discount totals do not reconcile');
   events.push({id:`sale:${o.id}`,orderId:o.id,storeId,currency,type:'sale',date:saleDay,eligible:true,grossProductExVat:gross,discountExVat:discount,netShipping:shippingNet,productVat:productTax,shippingVat:shippingTax,customerCharge:charge,historicCost:null});
   const used=new Map(),usedShipping=new Map(),refundTransactions=new Set(),refundIds=new Set();
   const consume=(map,usage,key,net,vat)=>{const limit=map.get(key);check(limit,'Refund original line missing');const previous=usage.get(key)||[0,0];const next=[sum([previous[0],net]),sum([previous[1],vat])];check(next.every((v,i)=>v<=limit[i]),'Refund exceeds original line component');usage.set(key,next);};
   for(const r of o.refunds){
    check(r.id&&!refundIds.has(r.id),'Duplicate refund');refundIds.add(r.id);
    check(nodes(r.orderAdjustments).length===0,'Refund adjustments require review');
    const txs=nodes(r.transactions);check(txs.length===1&&txs[0].kind==='REFUND'&&txs[0].status==='SUCCESS','Refund payment requires review');
    const tx=txs[0],originalTx=o.transactions.find(t=>t.id===tx.id);check(originalTx&&originalTx.kind==='REFUND'&&originalTx.status===tx.status&&originalTx.processedAt===tx.processedAt&&money(originalTx.amountSet)===money(tx.amountSet)&&!refundTransactions.has(tx.id),'Refund transaction does not reconcile');refundTransactions.add(tx.id);
    const day=eventDay(tx.processedAt,timezone);check(Date.parse(tx.processedAt)>=Date.parse(sale.processedAt),'Refund precedes sale');
    let product=0,pvat=0,ship=0,svat=0;
    for(const line of nodes(r.refundLineItems)){const n=money(line.subtotalSet),v=money(line.totalTaxSet);consume(limits,used,line.lineItem?.id,n,v);product=sum([product,n]);pvat=sum([pvat,v]);}
    for(const line of nodes(r.refundShippingLines)){const n=money(line.subtotalAmountSet),v=money(line.taxAmountSet);consume(shippingLimits,usedShipping,line.shippingLine?.id,n,v);ship=sum([ship,n]);svat=sum([svat,v]);}
    const total=sum([product,pvat,ship,svat]);check(total===money(r.totalRefundedSet)&&total===money(tx.amountSet),'Refund components do not reconcile to payment');
    events.push({id:`refund:${r.id}`,orderId:o.id,storeId,currency,type:'refund',date:day,productCash:sum([product,pvat]),productVat:pvat,shippingCash:sum([ship,svat]),shippingVat:svat,saleableReturn:false,costReversal:0});
   }
   check(o.transactions.filter(t=>t.kind==='REFUND').every(t=>refundTransactions.has(t.id)),'Refund history has unmapped transactions');
  }
  const candidate=tradingPeriod({events,storeId,currency,from,to,coverageComplete:true});
  return {status:'mapped_for_review',coverageCertified:false,excluded,events,candidate:{...candidate,cogs:null,profitDataState:'incomplete'}};
 }catch(error){return {status:'blocked',coverageCertified:false,issues:[error.message],candidate:null};}
}
