/** Canonical synthetic source proposal only. No connection, SQL execution or provider data. */
import {createHash} from 'node:crypto';
import {generate,PROFILE,date,addDays,allocate} from './generator.mjs';
const months=[6,6,6,6,7,7,7,7,8,9,13,18];
export const RESERVED_SYNTHETIC_IDENTITY=Object.freeze({storeId:'d7500000-0000-4000-8000-000000000009',domain:'fictional-uk-gifts-v2.invalid',externalId:'fictional-uk-gifts-v2',name:'Fictional UK Gifts — synthetic reporting only',currency:'GBP',timezone:'Europe/London'});
export const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const money=p=>(p/100).toFixed(2);
export function stableId(kind,key) {const h=hash([PROFILE.version,kind,key]);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;}
const identity=RESERVED_SYNTHETIC_IDENTITY;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ensure=(ok,message)=>{if(!ok)throw Error(message);};
function monthEnd(value) {return new Date(Date.UTC(Number(value.slice(0,4)),Number(value.slice(5,7)),0)).toISOString().slice(0,10);}
function potentialReturnPlans(orders,p) {
 const groups=new Map();for(const e of orders){if(!groups.has(e.date))groups.set(e.date,[]);groups.get(e.date).push(e);}
 const plans=new Map();
 for(const [day,sales] of groups) {
  const refundDate=addDays(day,14),month=Number(refundDate.slice(5,7)),dayOfMonth=Number(refundDate.slice(8)),count=Number(monthEnd(refundDate).slice(8));
  const monthly=allocate(p.refunds,months)[month-1];
  let remaining=2*allocate(monthly/2,Array(count).fill(1))[dayOfMonth-1];
  // Fictional product composition is predetermined from this profile/date rule. No future refund event is materialised.
  for(const e of sales) {
   const amount=Math.min(remaining,2*Math.floor(Math.min(e.metrics.productSales,2*e.metrics.cogs)/2));
   if(amount)plans.set(e.refs.orderId,{amount,cost:amount/2,refundDate});
   remaining-=amount;if(!remaining)break;
  }
  ensure(remaining===0,'Predetermined gift-item composition lacks refund capacity');
 }
 return plans;
}
export function prepareStagingPayload(fixture,{reviewerId,from=fixture.from,to=fixture.to,identity:target,reviewed=false}={}) {
 ensure(JSON.stringify(target)===JSON.stringify(identity),'Exact reserved new synthetic identity required');
 ensure(uuid.test(reviewerId||''),'Explicit existing reviewer UUID required');
 ensure(reviewed===true,'Explicit synthetic source-model review required; this is not live completeness approval');
 date(from);date(to);ensure(from<=to&&from>=fixture.from&&to<=fixture.to,'Requested window outside retained ledger');
 const {fingerprint,...ledgerBody}=fixture;ensure(hash(ledgerBody)===fingerprint,'Source ledger fingerprint mismatch');
 const rebuilt=generate({asOf:fixture.asOf,from:fixture.from,months:fixture.months,company:fixture.scope.company,profile:fixture.scope.profile});
 ensure(rebuilt.fingerprint===fingerprint,'Source ledger differs from deterministic profile');
 ensure(fixture.scope.profile===PROFILE.version&&fixture.scope.company===PROFILE.company&&fixture.scope.provenance==='synthetic-local'&&fixture.scope.provider===null,'Current isolated synthetic v2 profile required');
 const ids=new Set();for(const e of fixture.events){ensure(e.company===fixture.scope.company&&e.currency==='GBP'&&e.timezone==='Europe/London'&&e.profile===fixture.scope.profile&&e.provider===null&&e.provenance==='synthetic-local','Mixed event scope refused');ensure(!ids.has(e.id),'Duplicate synthetic event');ids.add(e.id);ensure(e.postings.every(p=>Number.isSafeInteger(p.amount))&&e.postings.reduce((s,p)=>s+p.amount,0)===0,'Unbalanced synthetic journal');}
 const [y,m]=from.split('-').map(Number),earlier=new Date(Date.UTC(y,m-2,1,12)).toISOString().slice(0,10);
 // Retain genuine earlier generated order snapshots for opening refund links. Do not reconstruct gross/VAT from refunds.
 const prior=generate({asOf:fixture.asOf,from:earlier,profile:PROFILE.version});
 const allSales=prior.events.filter(e=>e.kind==='sale');
 const requiredRefunds=fixture.events.filter(e=>e.kind==='refund'&&e.date>=from&&e.date<=to);
 const refundSources=new Set(requiredRefunds.map(e=>e.refs.orderId));
 const selectedSales=allSales.filter(e=>(e.date>=from&&e.date<=to)||refundSources.has(e.refs.orderId));
 const byOrder=new Map(selectedSales.map(e=>[e.refs.orderId,e]));ensure(requiredRefunds.every(r=>byOrder.has(r.refs.orderId)),'Retained original order evidence required');
 const plans=potentialReturnPlans(allSales,PROFILE),orders=[],lines=[],refunds=[],returns=[];
 for(const e of selectedSales) {
  const id=stableId('order',e.refs.orderId),v=e.metrics,plan=plans.get(e.refs.orderId);
  orders.push({id,store_id:identity.storeId,shopify_order_id:`synthetic:${PROFILE.version}:${e.refs.orderId}`,order_date:`${e.date}T12:00:00Z`,event_date:e.date,currency:'GBP',gross_sales:money(v.gross),discounts:money(v.discounts),net_sales:money(v.productSales),shipping:money(v.shipping),tax:money(v.outputVat),total_sales:money(v.productSales+v.shipping+v.outputVat),financial_status:'paid',gross_product_vat:money(Math.round(v.gross/5)),discount_vat:money(Math.round(v.gross/5)-v.productVat),shipping_vat:money(v.shippingVat)});
  const splits=plan&&(plan.amount<v.productSales||plan.cost<v.cogs)?[{key:'gift-returnable',net:plan.amount,cost:plan.cost},{key:'gift-retained',net:v.productSales-plan.amount,cost:v.cogs-plan.cost}]:[{key:'gift-returnable',net:v.productSales,cost:v.cogs}];
  const discounts=allocate(v.discounts,splits.map(s=>s.net));
  for(let i=0;i<splits.length;i++){const part=splits[i];lines.push({id:stableId('line',`${e.refs.orderId}:${part.key}`),store_id:identity.storeId,order_id:id,shopify_line_item_id:`synthetic:${e.refs.orderId}:${part.key}`,quantity:1,price:money(part.net+discounts[i]),discount:money(discounts[i]),total:money(part.net),historic_unit_cost_pence:part.cost,sale_date:e.date,synthetic_product:part.key});}
 }
 for(const e of requiredRefunds) {
  const o=byOrder.get(e.refs.orderId),plan=plans.get(e.refs.orderId),lineId=stableId('line',`${e.refs.orderId}:gift-returnable`);
  ensure(plan?.amount===e.metrics.refunds&&plan.cost===-e.metrics.cogs&&plan.refundDate===e.date,'Actual refund differs from predetermined fictional product units');
  const id=stableId('refund',e.id);
  refunds.push({id,store_id:identity.storeId,order_id:stableId('order',o.refs.orderId),shopify_refund_id:`synthetic:${PROFILE.version}:${e.id}`,refund_date:`${e.date}T12:00:00Z`,event_date:e.date,amount:money(e.metrics.refunds+e.metrics.refundedVat),product_cash:money(e.metrics.refunds+e.metrics.refundedVat),product_vat:money(e.metrics.refundedVat),shipping_cash:'0.00',shipping_vat:'0.00'});
  returns.push({source_return_id:stableId('return',e.id),line_id:lineId,saleable_date:e.date,quantity:1,refund_id:id});
 }
 const scopes=[];
 for(let start=from.slice(0,7)+'-01';start<=to;start=addDays(monthEnd(start),1)) {
  const end=monthEnd(start);if(start<from||end>to)continue;
  scopes.push({storeId:identity.storeId,currency:'GBP',from:start,to:end,versionId:stableId('profit-version',start)});
 }
 const expenses=[];
 for(const scope of scopes) {
  const totals={variable:0,advertising:0,overhead:0,depreciation_amortisation:0},references={};
  for(const e of fixture.events.filter(e=>e.date>=scope.from&&e.date<=scope.to))for(const p of e.postings){
   if(!p.account.startsWith('expense:'))continue;
   const category=p.account.slice(8),classification=['storage','returns','pickPack','carrier','packaging','processor'].includes(category)?'variable':category==='marketing'?'advertising':category==='depreciation'?'depreciation_amortisation':'overhead';
   totals[classification]+=p.amount;(references[classification]??=[]).push(e.id);
  }
  for(const [classification,amount]of Object.entries(totals))expenses.push({id:stableId('expense',`${scope.from}:${classification}`),categoryId:stableId('expense-category',classification),classification,amount:money(amount),from:scope.from,to:scope.to,journalIds:[...new Set(references[classification]||[])]});
 }
 const coverage=scopes.map(s=>({store_id:identity.storeId,date_from:s.from,date_to:s.to,currency:'GBP',sales_and_refunds_complete:true}));
 // Partial selected windows remain unsealed; exact-period sales coverage can be reviewed separately.
 const payload={status:'local-staging-proposal-only',identity,reviewerId,profile:PROFILE.version,window:{from,to},sourceLedgerFingerprint:fixture.fingerprint,sourceLedger:{asOf:fixture.asOf,from:fixture.from,months:fixture.months},
  sourceAsOf:{businessDate:fixture.to,basis:'completed synthetic London business days',canonicalVerification:false},orders,lines,refunds,returns,expenses,coverage,scopes,
  limitations:['No live project/connection binding or authorised remote application.','Synthetic product composition uses actual quantity-one gift items; never monetary units as quantities.','Monthly coverage/profit seals apply only to explicitly reviewed complete local synthetic months.','Partial months are unsealed and unsupported by monthly profit.','Cash/payroll/stock ledger activity is retained by source fingerprint; canonical sales/profit tables do not model every service.','Canonical snapshot-as-of/coverage metadata and durable daily append remain separate contracts.']};
 return {...payload,payloadHash:hash(payload)};
}
