import {createHash} from 'node:crypto';
import {API_VERSION} from './queries.mjs';
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const gid=(id,type)=>typeof id==='string'&&new RegExp(`^gid://shopify/${type}/[0-9]+$`).test(id);
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
function context(data,expected){
 const s=data?.shop,scopes=data?.currentAppInstallation?.accessScopes;
 check(s&&s.id===expected.shopId&&s.myshopifyDomain===expected.domain,'Shopify account does not match configured store');
 check(Array.isArray(scopes)&&['read_orders','read_all_orders'].every(required=>scopes.some(s=>s.handle===required)),'Full order-history read permissions required');
 check(typeof s.currencyCode==='string'&&typeof s.ianaTimezone==='string','Missing Shopify reporting settings');
 new Intl.DateTimeFormat('en-GB',{timeZone:s.ianaTimezone}).format();
 return {shopId:s.id,domain:s.myshopifyDomain,currency:s.currencyCode,timezone:s.ianaTimezone};
}
/** Full accessible history, never filtered by original sale period: later refunds may belong to old orders.
 * Bounded extraction only. Summary records are NOT sufficient to populate finance evidence.
 */
export async function collectShopifyOrders(read,expected,{signal,maxPages=100,now=()=>new Date()}={}){
 signal=signal?AbortSignal.any([signal,AbortSignal.timeout(60000)]):AbortSignal.timeout(60000);
 check(gid(expected?.shopId,'Shop'),'Expected Shopify identity required');
 check(Number.isInteger(maxPages)&&maxPages>0&&maxPages<=1000,'Invalid page limit');
 const startedAt=now().toISOString(),settings=context(await read('context',{},signal),expected);
 const orders=[],pages=[],ids=new Set(),refundIds=new Set(),cursors=new Set(),review=[];
 let after=null;
 for(let page=0;;page++){
  signal?.throwIfAborted();check(page<maxPages,'Shopify extraction page limit reached; no complete result');
  const data=await read('orders',{after},signal),connection=data?.orders;
  check(connection&&Array.isArray(connection.nodes)&&typeof connection.pageInfo?.hasNextPage==='boolean','Malformed Shopify order page');
  for(const order of connection.nodes){
   check(gid(order?.id,'Order')&&!ids.has(order.id),'Duplicate or invalid Shopify order');ids.add(order.id);
   check(instant(order.updatedAt)&&instant(order.processedAt),'Missing order timestamps');
   check(typeof order.test==='boolean'&&typeof order.edited==='boolean'&&typeof order.taxesIncluded==='boolean','Missing order source facts');
   check(order.currencyCode===settings.currency,'Order currency differs from shop currency; review required');
   check(Array.isArray(order.transactions)&&order.transactionsCount?.precision==='EXACT'&&order.transactionsCount.count===order.transactions.length,'Incomplete order transactions');
   check(new Set(order.transactions.map(t=>t.id)).size===order.transactions.length&&order.transactions.every(t=>gid(t.id,'OrderTransaction')),'Duplicate or invalid order transaction');
   check(Array.isArray(order.refunds),'Missing Shopify refund list');
   if(order.edited||order.cancelledAt)review.push({orderId:order.id,reason:'ORDER_ADJUSTMENT_REVIEW'});
   for(const refund of order.refunds){
    check(gid(refund?.id,'Refund')&&!refundIds.has(refund.id),'Duplicate or invalid Shopify refund');refundIds.add(refund.id);
    check(instant(refund.createdAt)&&instant(refund.updatedAt),'Missing refund timestamps');
    check(refund.transactions?.pageInfo?.hasNextPage===false&&Array.isArray(refund.transactions.nodes),'Incomplete refund transactions');
    const tx=refund.transactions.nodes;
    check(new Set(tx.map(t=>t.id)).size===tx.length&&tx.every(t=>gid(t.id,'OrderTransaction')),'Duplicate or invalid refund transaction');
    if(!tx.length||tx.some(t=>t.kind!=='REFUND'||t.status!=='SUCCESS'||!instant(t.processedAt)))review.push({orderId:order.id,refundId:refund.id,reason:'REFUND_PAYMENT_REVIEW'});
   }
   orders.push(order);
  }
  const {hasNextPage,endCursor}=connection.pageInfo;
  check(!hasNextPage||(connection.nodes.length>0&&typeof endCursor==='string'&&endCursor.length>0&&!cursors.has(endCursor)),'Shopify pagination failed to advance');
  pages.push({cursor:after,nextCursor:hasNextPage?endCursor:null,ids:connection.nodes.map(o=>o.id)});
  if(!hasNextPage)break;
  cursors.add(endCursor);after=endCursor;
 }
 const finishedSettings=context(await read('context',{},signal),expected);
 check(JSON.stringify(settings)===JSON.stringify(finishedSettings),'Shopify settings changed during extraction');
 const completedAt=now().toISOString();
 return {version:1,apiVersion:API_VERSION,status:'extracted_for_mapping',coverageCertified:false,
  settings,startedAt,completedAt,pages,orders,review,
  fingerprint:createHash('sha256').update(JSON.stringify({settings,orders})).digest('hex'),
  limitations:['NOT_SNAPSHOT_ISOLATED','LINE_TAX_DISCOUNT_MAPPING_PENDING','ORIGINAL_PAYMENT_ELIGIBILITY_PENDING','SOURCE_RECONCILIATION_PENDING']};
}
