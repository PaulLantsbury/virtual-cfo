/** Proposed synthetic-only matched cost allocation. Offline: no SQL/network/financial mutation. */
import {createHash} from 'node:crypto';
import {date,addDays,allocate,generate} from './generator.mjs';
import {stableId} from './staging-payload.mjs';
import {buildAcquisitionSource} from './acquisition-source.mjs';
import {profitEvidenceDigest as digest} from '../financial-v1/profit-evidence-reader.mjs';
export const ACQUISITION_COST_POLICY='synthetic-order-cost-allocation-v1';
export const MATURE_SYNTHETIC_COHORT=Object.freeze({from:'2026-04-01',to:'2026-06-30',observedThrough:'2026-09-30',days:90});
const ensure=(condition,message)=>{if(!condition)throw Error(message);};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sourceBody=source=>{const{sourceHash,...body}=source;return body;};
const safe=n=>{ensure(Number.isSafeInteger(n),'Unsafe acquisition cost amount');return n;};
const sum=values=>safe(Number(values.reduce((total,value)=>total+BigInt(value),0n)));
const journalHash=event=>{const body=structuredClone(event);delete body.refs.openingCohort;return digest(body);};
const variable=new Set(['storage','returns','pickPack','carrier','packaging','processor']);
const zero=()=>({netProductSales:0,netShipping:0,cogs:0,variableCosts:0,repeatMarketingCosts:0});
const add=(a,b)=>{for(const key of ['netProductSales','netShipping','cogs','variableCosts','repeatMarketingCosts'])a[key]=safe(a[key]+(b[key]??0));return a;};
const beforeMarketing=t=>safe(t.netProductSales+t.netShipping-t.cogs-t.variableCosts);
const dayAge=(first,day)=>Math.round((+date(day)-+date(first))/86400000);

export function prepareAcquisitionCosts(fixture,acquisitionSource){
 ensure(fixture?.from==='2024-11-01'&&fixture.scope?.profile==='uk-gifts-v2'&&fixture.scope.company==='fictional-uk-gifts','Actual financial-anchored v2 source required');
 ensure(fixture.fingerprint===generate({from:fixture.from,asOf:fixture.asOf,months:fixture.months,profile:'uk-gifts-v2'}).fingerprint&&hash((({fingerprint,...body})=>body)(fixture))===fixture.fingerprint,'Exact canonical financial ledger required');
 ensure(acquisitionSource&&hash(sourceBody(acquisitionSource))===acquisitionSource.sourceHash,'Acquisition source body changed');
 ensure(acquisitionSource?.through===fixture.to&&acquisitionSource?.sourceHash===buildAcquisitionSource(generate({from:'2024-01-01',asOf:fixture.asOf})).sourceHash,'Exact canonical acquisition source required');
 const observations=acquisitionSource.orderObservations,byOrder=new Map(observations.map(o=>[o.orderId,o])),byDay=new Map();
 for(const o of observations){if(!byDay.has(o.date))byDay.set(o.date,[]);byDay.get(o.date).push(o);}
 const saleByOrder=new Map(fixture.events.filter(e=>e.kind==='sale').map(e=>[stableId('order',e.refs.orderId),e]));
 const refundsByDay=new Map();
 for(const e of fixture.events.filter(e=>e.kind==='refund')){if(!refundsByDay.has(e.date))refundsByDay.set(e.date,[]);refundsByDay.get(e.date).push(e);}
 const book=new Map(),allocationProofs=[];
 function row(day,orderId){const key=day+'|'+(orderId??'unallocated');if(!book.has(key))book.set(key,{date:day,orderId,customerId:byOrder.get(orderId)?.customerId??null,...zero()});return book.get(key);}
 function change(day,orderId,values){add(row(day,orderId),values);}
 for(const e of fixture.events){
  if(e.kind==='sale')change(e.date,stableId('order',e.refs.orderId),{netProductSales:e.metrics.productSales,netShipping:e.metrics.shipping,cogs:e.metrics.cogs});
  if(e.kind==='refund')change(e.date,stableId('order',e.refs.orderId),{netProductSales:-e.metrics.refunds,cogs:e.metrics.cogs});
 }
 for(const e of fixture.events){
  const posting=e.postings.filter(p=>p.account.startsWith('expense:')&&variable.has(p.account.slice(8)));
  if(!posting.length)continue;
  ensure(posting.length===1,'One supported variable category per synthetic source required');
  const category=posting[0].account.slice(8),amount=posting[0].amount;
  ensure(Number.isSafeInteger(amount)&&amount>=0,'Unsupported negative/unsafe variable-cost source');
  let targets,method;
  if(category==='returns'){
   const returns=refundsByDay.get(e.date)||[];
   targets=returns.map(r=>({orderId:stableId('order',r.refs.orderId),weight:r.metrics.refunds}));method='same-day-refund-product-value';
  }else{
   const orders=byDay.get(e.date)||[];
   method=['pickPack','carrier','packaging'].includes(category)?'equal-original-orders':category==='processor'?'original-gross-receipts':'original-net-product-value';
   targets=orders.map(o=>{const sale=saleByOrder.get(o.orderId);ensure(sale,'Original sale cost witness missing');return {orderId:o.orderId,weight:method==='equal-original-orders'?1:method==='original-gross-receipts'?sale.metrics.productSales+sale.metrics.shipping+sale.metrics.outputVat:sale.metrics.productSales};});
  }
  // Multiple refunds of the same original order still carry separate source weights; combine exact allocations afterwards.
  const eligible=targets.filter(t=>t.weight>0);
  const assigned=eligible.length?allocate(amount,eligible.map(t=>t.weight)):[];
  const allocations=eligible.map((target,i)=>({orderId:target.orderId,amount:assigned[i]}));
  const unallocated=eligible.length?0:amount;
  ensure(sum(allocations.map(a=>a.amount))+unallocated===amount,'Variable-cost allocation does not reconcile');
  for(const a of allocations)change(e.date,a.orderId,{variableCosts:a.amount});
  if(unallocated)change(e.date,null,{variableCosts:unallocated});
  allocationProofs.push({sourceId:e.id,sourceHash:journalHash(e),date:e.date,category,amount,method,allocations,unallocated});
 }
 const repeatMarketingProofs=[];
 for(const source of acquisitionSource.spendAllocations.filter(a=>a.date>=fixture.from&&a.date<=fixture.to)){
  const targets=(byDay.get(source.date)||[]).filter(o=>o.channel===source.channel&&o.identityState==='identified'&&!o.paidFirst);
  const allocations=targets.length?allocate(source.retention,targets.map(o=>o.weight)).map((amount,i)=>({orderId:targets[i].orderId,amount})):[];
  const unallocated=targets.length?0:source.retention;
  ensure(sum(allocations.map(a=>a.amount))+unallocated===source.retention,'Non-acquisition marketing allocation does not reconcile');
  for(const a of allocations)change(source.date,a.orderId,{repeatMarketingCosts:a.amount});
  if(unallocated)change(source.date,null,{repeatMarketingCosts:unallocated});
  repeatMarketingProofs.push({sourceId:source.sourceId,sourceHash:source.sourceHash,date:source.date,amount:source.retention,method:'same-channel-known-nonacquisition-order-value',allocations,unallocated});
 }
 const contributionEntries=[...book.values()].sort((a,b)=>a.date.localeCompare(b.date)||(a.orderId??'').localeCompare(b.orderId??''));
 // Independent journal reconciliation catches dropped categories, double COGS/marketing and VAT contamination.
 const ledger={...zero()};
 for(const e of fixture.events){ledger.netProductSales+=e.metrics.productSales??0;ledger.netProductSales-=e.metrics.refunds??0;ledger.netShipping+=e.metrics.shipping??0;ledger.cogs+=e.metrics.cogs??0;for(const p of e.postings)if(p.account.startsWith('expense:')&&variable.has(p.account.slice(8)))ledger.variableCosts+=p.amount;}
 const totals=contributionEntries.reduce((t,e)=>add(t,e),zero());
 for(const key of ['netProductSales','netShipping','cogs','variableCosts'])ensure(totals[key]===safe(ledger[key]),'Allocated contribution ledger does not reconcile');
 ensure(totals.repeatMarketingCosts===sum(acquisitionSource.spendAllocations.filter(a=>a.date>=fixture.from&&a.date<=fixture.to).map(a=>a.retention)),'Non-acquisition marketing source reconciliation failed');
 const source={contract:'synthetic-acquisition-cost-source-v1',policy:ACQUISITION_COST_POLICY,storeId:acquisitionSource.storeId,currency:'GBP',timezone:'Europe/London',from:fixture.from,through:fixture.to,ledgerFingerprint:fixture.fingerprint,acquisitionSourceHash:acquisitionSource.sourceHash,
  contributionEntries,allocationProofs,repeatMarketingProofs,totals,entriesHash:hash(contributionEntries),allocationHash:hash(allocationProofs),repeatMarketingHash:hash(repeatMarketingProofs)};
 return {...source,sourceHash:hash(source)};
}
function validate(source,acquisition){
 ensure(source?.contract==='synthetic-acquisition-cost-source-v1'&&source.policy===ACQUISITION_COST_POLICY&&source.acquisitionSourceHash===acquisition?.sourceHash&&source.storeId===acquisition.storeId&&source.from==='2024-11-01'&&source.from>=acquisition.from&&source.through===acquisition.through&&source.currency==='GBP'&&source.timezone==='Europe/London','Exact synthetic acquisition cost scope required');
 ensure(hash(sourceBody(source))===source.sourceHash&&hash(source.contributionEntries)===source.entriesHash&&hash(source.allocationProofs)===source.allocationHash&&hash(source.repeatMarketingProofs)===source.repeatMarketingHash,'Acquisition cost source integrity failed');
 ensure(hash(sourceBody(acquisition))===acquisition.sourceHash,'Acquisition identity/spend source integrity failed');
}
const requireAllocated=(source,from,to)=>ensure(!source.allocationProofs.some(p=>p.date>=from&&p.date<=to&&p.unallocated!==0)&&!source.repeatMarketingProofs.some(p=>p.date>=from&&p.date<=to&&p.unallocated!==0),'Unallocated relevant source cost prevents customer economics');
const totalsFor=entries=>{const totals=entries.reduce((t,e)=>add(t,e),zero());return {...totals,contributionBeforeMarketing:beforeMarketing(totals)};};

export function firstOrderEconomics(source,acquisition,{from,to,observedThrough=to}={}){
 validate(source,acquisition);date(from);date(to);date(observedThrough);
 ensure(from<=to&&from>=source.from&&to<=observedThrough&&observedThrough<=source.through,'Covered first-order observation window required');
 requireAllocated(source,from,observedThrough);
 const first=acquisition.orderObservations.filter(o=>o.paidFirst&&o.date>=from&&o.date<=to),ids=new Set(first.map(o=>o.orderId));
 const entries=source.contributionEntries.filter(e=>ids.has(e.orderId)&&e.date<=observedThrough);
 const totals=totalsFor(entries);
 const acquisitionSpend=sum(acquisition.spendAllocations.filter(a=>a.date>=from&&a.date<=to).flatMap(a=>a.firstAllocations).filter(a=>ids.has(a.orderId)).map(a=>a.amount));
 return {contract:'synthetic-first-order-economics-v1',policy:ACQUISITION_COST_POLICY,scope:{from,to,observedThrough,currency:'GBP',timezone:'Europe/London'},customers:first.length,...totals,acquisitionSpend,acquisitionMetricsState:first.length>0&&acquisitionSpend>0?'supported':'unavailable',
  source:{costSourceHash:source.sourceHash,acquisitionSourceHash:acquisition.sourceHash,allocationHash:source.allocationHash},
  basis:'Paid first orders only; observed refunds retain original order and event date; allocated synthetic variable costs; before all advertising and overheads.'};
}

export function matureCohortEconomics(source,acquisition,{from,to,observedThrough,days=90}={}){
 validate(source,acquisition);date(from);date(to);date(observedThrough);
 ensure(days===90&&from<=to&&from>=source.from&&observedThrough<=source.through&&addDays(to,days)<=observedThrough,'Complete 90-day cohort observations required');
 requireAllocated(source,from,addDays(to,days-1));
 const first=acquisition.orderObservations.filter(o=>o.paidFirst&&o.date>=from&&o.date<=to),byCustomer=new Map(first.map(o=>[o.customerId,o]));
 ensure(byCustomer.size===first.length,'Cohort first-customer identity duplicated');
 const firstIds=new Set(first.map(o=>o.orderId));
 const acquisitionSpend=sum(acquisition.spendAllocations.filter(a=>a.date>=from&&a.date<=to).flatMap(a=>a.firstAllocations).filter(a=>firstIds.has(a.orderId)).map(a=>a.amount));
 ensure(first.length>0&&acquisitionSpend>0,'Positive paired cohort customers and acquisition spend required');
 const ageBuckets=Array.from({length:days},()=>zero());
 for(const e of source.contributionEntries){const original=byCustomer.get(e.customerId);if(!original||e.date>observedThrough)continue;const age=dayAge(original.date,e.date);if(age<0||age>=days)continue;add(ageBuckets[age],e);}
 const cumulative=zero();
 const curve=ageBuckets.map((bucket,day)=>{add(cumulative,bucket);return {day,...cumulative,contributionBeforeMarketing:beforeMarketing(cumulative)};});
 return {contract:'synthetic-mature-cohort-economics-v1',state:'supported',policy:ACQUISITION_COST_POLICY,scope:{from,to,observedThrough,days,currency:'GBP',timezone:'Europe/London'},customers:first.length,acquisitionSpend,curve,
  source:{costSourceHash:source.sourceHash,acquisitionSourceHash:acquisition.sourceHash,allocationHash:source.allocationHash,repeatMarketingHash:source.repeatMarketingHash},
  basis:'Age days 0–89 inclusive; customer-linked first and repeat orders, event-dated refunds and allocated variable costs. Deduct cumulative matched non-acquisition marketing before comparing with the cohort acquisition spend. Overheads, VAT and unallocated/unknown marketing excluded; not cash payback.'};
}
