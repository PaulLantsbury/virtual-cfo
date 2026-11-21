/** Offline synthetic partition rehearsal. Hash anchors must come from an independently reviewed source.
 * No new allocation, cohort forecast, eligibility approval, network or database action. */
import {createHash} from 'node:crypto';
import {RESERVED_SYNTHETIC_IDENTITY} from './staging-payload.mjs';
export const REPEAT_PARTITION_POLICY='synthetic-classified-event-period-economics-v1';
const fields=['netProductSales','netShipping','cogs','variableCosts','repeatMarketingCosts'];
const groups=['paidFirst','nonPaidFirst','identifiedRepeat','guest','unknown'];
function checkedJSON(v){
 let count=0;const path=new Set();
 function visit(x,depth){
 ensure(++count<=4000000&&depth<=24,'Source JSON exceeds offline bounds');
 if(x===null||typeof x==='string'||typeof x==='boolean')return;
 if(typeof x==='number'){ensure(Number.isSafeInteger(x)&&!Object.is(x,-0),'Unsafe numeric source JSON');return;}
 const array=Array.isArray(x);ensure(typeof x==='object'&&!path.has(x)&&(array?Object.getPrototypeOf(x)===Array.prototype:Object.getPrototypeOf(x)===Object.prototype),'Non-JSON or cyclic source');
 ensure(Object.getOwnPropertySymbols(x).length===0,'Symbol source properties rejected');
 const descriptors=Object.getOwnPropertyDescriptors(x);
 if(array)ensure(Object.keys(descriptors).length===x.length+1&&Array.from({length:x.length},(_,i)=>Object.hasOwn(descriptors,String(i))).every(Boolean),'Sparse or extended source array');
 path.add(x);
 for(const [key,d]of Object.entries(descriptors)){if(array&&key==='length')continue;ensure(d.enumerable&&Object.hasOwn(d,'value'),'Accessor/nonenumerable source rejected');visit(d.value,depth+1);}
 path.delete(x);
 }
 visit(v,0);const text=JSON.stringify(v);ensure(text.length<=128000000,'Source JSON exceeds offline byte bound');return text;
}
const hash=v=>createHash('sha256').update(checkedJSON(v)).digest('hex');
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const body=({sourceHash,...rest})=>rest;
const ensure=(v,m)=>{if(!v)throw Error(m);};
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
const safe=n=>{ensure(Number.isSafeInteger(n),'Unsafe partition amount');return n;};
const sum=values=>safe(Number(values.reduce((n,v)=>n+BigInt(safe(v)),0n)));
const zero=()=>Object.fromEntries(fields.map(k=>[k,0]));
const total=rows=>Object.fromEntries(fields.map(k=>[k,sum(rows.map(r=>r[k]))]));
const before=t=>sum([t.netProductSales,t.netShipping,-t.cogs,-t.variableCosts]);

/** Event-period totals, including refunds of earlier purchases. Original-order counts never decrease on refund.
 * This validates against supplied reviewed anchors; it is not a canonical-source authenticator. */
export function partitionRepeatOrderEconomics(acquisition,costs,{from,to,expected}={}){
 checkedJSON(acquisition);checkedJSON(costs);checkedJSON(expected);
 ensure(day(from)&&day(to)&&from<=to,'Valid event period required');
 ensure(expected&&typeof expected==='object','Independent reviewed anchors required');
 ensure(from.endsWith('-01')&&to===new Date(Date.UTC(+from.slice(0,4),+from.slice(5,7),0)).toISOString().slice(0,10),'One complete calendar month required');
 ensure(['acquisitionSourceHash','costSourceHash','ordersHash','refundsHash','allocationHash','costEntriesHash','costAllocationHash','costRepeatMarketingHash'].every(k=>sha(expected[k])),'Reviewed SHA256 anchors required');
 ensure(typeof expected.financialVersionId==='string'&&expected.financialVersionId.length>0&&sha(expected.salesRevision)&&sha(expected.costRevision),'Exact financial version bindings required');
 const scope=expected.scope;
 ensure(scope&&scope.from===from&&scope.to===to&&scope.currency==='GBP'&&scope.timezone==='Europe/London'&&scope.storeId===RESERVED_SYNTHETIC_IDENTITY.storeId,'Exact reviewed scope required');
 ensure(acquisition?.contract==='synthetic-acquisition-source-v1'&&acquisition.policy==='synthetic-identity-and-spend-v1'&&acquisition.profile==='uk-gifts-v2','Synthetic identity policy required');
 ensure(costs?.contract==='synthetic-acquisition-cost-source-v1'&&costs.policy==='synthetic-order-cost-allocation-v1','Existing reviewed allocation policy required');
 for(const source of [acquisition,costs])ensure(source.storeId===scope.storeId&&source.currency===scope.currency&&source.timezone===scope.timezone&&day(source.from)&&day(source.through)&&source.from<=from&&source.through>=to&&hash(body(source))===source.sourceHash,'Source scope or integrity mismatch');
 ensure(expected.acquisitionSourceHash===acquisition.sourceHash&&expected.costSourceHash===costs.sourceHash&&costs.acquisitionSourceHash===acquisition.sourceHash,'Reviewed source anchors mismatch');
 for(const [field,proof] of [['orderObservations','ordersHash'],['refundObservations','refundsHash'],['spendAllocations','allocationHash']])ensure(Array.isArray(acquisition[field])&&hash(acquisition[field])===acquisition[proof]&&expected[proof]===acquisition[proof],'Identity/refund/spend proof mismatch');
 for(const [field,proof] of [['contributionEntries','entriesHash'],['allocationProofs','allocationHash'],['repeatMarketingProofs','repeatMarketingHash']])ensure(Array.isArray(costs[field])&&hash(costs[field])===costs[proof]&&expected['cost'+proof[0].toUpperCase()+proof.slice(1)]===costs[proof],'Cost proof mismatch');
 const byId=new Map(),firstByCustomer=new Map();
 for(const o of acquisition.orderObservations){ensure(o&&typeof o.orderId==='string'&&o.orderId&&!byId.has(o.orderId)&&day(o.date)&&['identified','guest','unknown'].includes(o.identityState)&&typeof o.paidFirst==='boolean'&&Number.isSafeInteger(o.netProductSales)&&o.netProductSales>=0&&o.date>=acquisition.from&&o.date<=acquisition.through,'Invalid or duplicate order');byId.set(o.orderId,o);}
 const classify=o=>{
  if(o.identityState!=='identified'){ensure(!o.customerId&&!o.firstOrderId&&!o.firstOrderDate&&!o.paidFirst,'Unidentified order cannot carry customer classification');return o.identityState;}
  const first=byId.get(o.firstOrderId);
  ensure(typeof o.customerId==='string'&&o.customerId&&first&&first.identityState==='identified'&&first.customerId===o.customerId&&first.firstOrderId===first.orderId&&first.date===o.firstOrderDate&&first.date<=o.date,'Original identified first-order witness required');
  const previous=firstByCustomer.get(o.customerId);ensure(!previous||previous===o.firstOrderId,'Conflicting first-order customer identity');firstByCustomer.set(o.customerId,o.firstOrderId);
  const isFirst=o.orderId===o.firstOrderId;
  ensure(o.paidFirst===(isFirst&&['meta','google'].includes(o.channel)),'Paid-first classification mismatch');
  return isFirst?(o.paidFirst?'paidFirst':'nonPaidFirst'):'identifiedRepeat';
 };
 const classes=new Map([...byId].map(([id,o])=>[id,classify(o)]));
 const counts=Object.fromEntries(groups.map(g=>[g,0]));
 for(const o of byId.values())if(o.date>=from&&o.date<=to)counts[classes.get(o.orderId)]++;
 const refunds=new Set(),revenue=new Map();
 const change=(id,amount)=>revenue.set(id,sum([revenue.get(id)??0,amount]));
 for(const o of byId.values())if(o.date>=from&&o.date<=to)change(o.orderId,o.netProductSales);
 for(const r of acquisition.refundObservations){ensure(r&&typeof r.sourceId==='string'&&!refunds.has(r.sourceId)&&day(r.date)&&r.date>=acquisition.from&&r.date<=acquisition.through&&Number.isSafeInteger(r.netProductRefund)&&r.netProductRefund>=0,'Invalid, duplicate or unmatched refund');refunds.add(r.sourceId);if(r.date>=from&&r.date<=to){ensure(byId.has(r.orderId)&&r.date>=byId.get(r.orderId).date,'Selected refund original witness required');change(r.orderId,-r.netProductRefund);}}
 ensure(costs.contributionEntries.every(e=>e&&day(e.date)&&e.date>=costs.from&&e.date<=costs.through),'Invalid cost event dates');
 const selected=costs.contributionEntries.filter(e=>e.date>=from&&e.date<=to);
 const entryKeys=new Set(),entryRevenue=new Map();
 for(const e of selected){ensure(day(e.date)&&byId.has(e.orderId)&&e.customerId===(byId.get(e.orderId).customerId??null)&&e.date>=byId.get(e.orderId).date&&fields.every(k=>Number.isSafeInteger(e[k]))&&e.variableCosts>=0&&e.repeatMarketingCosts>=0,'Unallocated, unmatched or unsafe cost entry');const key=e.date+'|'+e.orderId;ensure(!entryKeys.has(key),'Duplicate contribution entry');entryKeys.add(key);entryRevenue.set(e.orderId,sum([entryRevenue.get(e.orderId)??0,e.netProductSales]));}
 for(const id of new Set([...revenue.keys(),...entryRevenue.keys()]))ensure((revenue.get(id)??0)===(entryRevenue.get(id)??0),'Order/refund revenue does not reconcile');
 const totals=total(selected),financial=expected.totals;
 ensure(financial&&fields.every(k=>Number.isSafeInteger(financial[k])&&totals[k]===financial[k]),'Reviewed event-period financial totals mismatch');
 const partitions=Object.fromEntries(groups.map(g=>{const rows=selected.filter(e=>classes.get(e.orderId)===g),t=total(rows);return [g,{originalOrders:counts[g],...t,contributionBeforeMarketing:before(t),contributionAfterAllocatedNonAcquisitionMarketing:sum([before(t),-t.repeatMarketingCosts])}];}));
 for(const k of fields)ensure(sum(groups.map(g=>partitions[g][k]))===totals[k],'Partition conservation failed');
 ensure(sum(Object.values(counts))===expected.originalOrders,'Reviewed original-order population mismatch');
 return {contract:'synthetic-repeat-order-partition-v1',policy:REPEAT_PARTITION_POLICY,scope:{...scope},partitions,totals,
 financial:{versionId:expected.financialVersionId,salesRevision:expected.salesRevision,costRevision:expected.costRevision},
 source:{acquisitionSourceHash:acquisition.sourceHash,costSourceHash:costs.sourceHash,ordersHash:acquisition.ordersHash,refundsHash:acquisition.refundsHash,costAllocationHash:costs.allocationHash,costEntriesHash:costs.entriesHash,costRepeatMarketingHash:costs.repeatMarketingHash},
 forecastEligibility:'unavailable',limitations:['Synthetic identified repeat orders only; first-order identity policy is not merchant acceptance.','Existing non-acquisition marketing allocation includes non-paid first orders; partitioned deductions are not a new causal retention allocation.','Zero activity is allowed only against matching reviewed zero totals and population. Net sales and COGS can be signed on evidenced refunds/returns; variable and allocated non-acquisition marketing costs must be nonnegative.',
 'Event-period refunds preserve original classification and do not rewrite original order counts. No repeat-rate uplift, lifetime value or cash forecast is established.']};
}
