import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {partitionRepeatOrderEconomics} from './repeat-order-economics.mjs';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const seal=x=>{delete x.sourceHash;x.sourceHash=hash(x);return x;};
function fixture(){
 const from='2026-02-01',to='2026-02-28',scope={storeId:'d7500000-0000-4000-8000-000000000009',currency:'GBP',timezone:'Europe/London',from,to};
 const order=(id,date,state,first=id,channel='organic')=>({orderId:id,date,identityState:state,customerId:state==='identified'?'c-'+first:null,firstOrderId:state==='identified'?first:null,firstOrderDate:state==='identified'?(first==='p'?'2026-01-10':date):null,paidFirst:state==='identified'&&first===id&&['meta','google'].includes(channel),channel,netProductSales:100});
 const orders=[order('p','2026-01-10','identified','p','meta'),order('r','2026-02-01','identified','p'),order('n','2026-02-02','identified'),order('a','2026-02-02','identified','a','meta'),order('g','2026-02-02','guest'),order('u','2026-02-02','unknown')];
 const acquisition={contract:'synthetic-acquisition-source-v1',policy:'synthetic-identity-and-spend-v1',profile:'uk-gifts-v2',storeId:scope.storeId,currency:scope.currency,timezone:scope.timezone,from:'2026-01-01',through:to,orderObservations:orders,refundObservations:[{sourceId:'refund-p',sourceHash:'f'.repeat(64),date:'2026-02-03',orderId:'p',netProductRefund:20}],spendAllocations:[]};
 for(const [k,p]of [['orderObservations','ordersHash'],['refundObservations','refundsHash'],['spendAllocations','allocationHash']])acquisition[p]=hash(acquisition[k]);seal(acquisition);
 const entries=orders.filter(o=>o.date>=from).map(o=>({date:o.date,orderId:o.orderId,customerId:o.customerId,netProductSales:100,netShipping:5,cogs:40,variableCosts:10,repeatMarketingCosts:['n','r'].includes(o.orderId)?3:0}));
 entries.push({date:'2026-02-03',orderId:'p',customerId:'c-p',netProductSales:-20,netShipping:0,cogs:-5,variableCosts:1,repeatMarketingCosts:0});
 const totals=Object.fromEntries(['netProductSales','netShipping','cogs','variableCosts','repeatMarketingCosts'].map(k=>[k,entries.reduce((n,e)=>n+e[k],0)]));
 const costs={contract:'synthetic-acquisition-cost-source-v1',policy:'synthetic-order-cost-allocation-v1',storeId:scope.storeId,currency:scope.currency,timezone:scope.timezone,from:'2026-01-01',through:to,acquisitionSourceHash:acquisition.sourceHash,contributionEntries:entries,allocationProofs:[],repeatMarketingProofs:[]};
 costs.entriesHash=hash(entries);costs.allocationHash=hash([]);costs.repeatMarketingHash=hash([]);seal(costs);
 const expected={financialVersionId:'reviewed-version',salesRevision:'a'.repeat(64),costRevision:'b'.repeat(64),scope,acquisitionSourceHash:acquisition.sourceHash,costSourceHash:costs.sourceHash,ordersHash:acquisition.ordersHash,refundsHash:acquisition.refundsHash,allocationHash:acquisition.allocationHash,costEntriesHash:costs.entriesHash,costAllocationHash:costs.allocationHash,costRepeatMarketingHash:costs.repeatMarketingHash,totals,originalOrders:5};
 return {acquisition,costs,options:{from,to,expected}};
}
const run=f=>partitionRepeatOrderEconomics(f.acquisition,f.costs,f.options);
test('partitions paid, nonpaid first, repeat, guest, unknown without residual-repeat inference',()=>{
 const p=run(fixture());assert.equal(p.partitions.identifiedRepeat.originalOrders,1);assert.equal(p.partitions.nonPaidFirst.originalOrders,1);assert.equal(p.partitions.paidFirst.originalOrders,1);
 assert.equal(p.partitions.identifiedRepeat.repeatMarketingCosts,3);assert.equal(p.partitions.nonPaidFirst.repeatMarketingCosts,3);
 assert.equal(p.forecastEligibility,'unavailable');
 for(const k of Object.keys(p.totals))assert.equal(Object.values(p.partitions).reduce((n,g)=>n+g[k],0),p.totals[k]);
});
test('later refund keeps original paid-first classification and event-period amount, not repeat',()=>{
 const p=run(fixture());assert.equal(p.partitions.paidFirst.netProductSales,80);assert.equal(p.partitions.paidFirst.cogs,35);assert.equal(p.partitions.paidFirst.originalOrders,1);
 assert.equal(p.partitions.identifiedRepeat.netProductSales,100);
});
test('scope, anchors, financial amounts and original population mismatches fail closed',()=>{
 for(const mutate of [f=>f.options.expected.scope.storeId='other',f=>f.options.expected.refundsHash='bad',f=>f.options.expected.totals.cogs++,f=>f.options.expected.originalOrders++,f=>f.options.to='2026-02-30']){const f=fixture();mutate(f);assert.throws(()=>run(f));}
});
test('changed or duplicated source evidence cannot pass independently pinned anchors',()=>{
 for(const mutate of [f=>f.acquisition.orderObservations.push(f.acquisition.orderObservations[0]),f=>f.costs.contributionEntries[0].netProductSales++,f=>f.acquisition.refundObservations[0].date='2026-01-01']){const f=fixture();mutate(f);assert.throws(()=>run(f));}
});
test('self-rehashed sources still require original independent reviewed anchors',()=>{const f=fixture();f.acquisition.orderObservations[0].customerId='changed';f.acquisition.ordersHash=hash(f.acquisition.orderObservations);seal(f.acquisition);assert.throws(()=>run(f));});

// Re-pin intentionally malformed fixtures to exercise validation beyond integrity anchoring.
function repin(f){const a=f.acquisition,c=f.costs,e=f.options.expected;
 for(const [k,p]of [['orderObservations','ordersHash'],['refundObservations','refundsHash'],['spendAllocations','allocationHash']])a[p]=hash(a[k]);seal(a);
 c.acquisitionSourceHash=a.sourceHash;c.entriesHash=hash(c.contributionEntries);c.allocationHash=hash(c.allocationProofs);c.repeatMarketingHash=hash(c.repeatMarketingProofs);seal(c);
 Object.assign(e,{acquisitionSourceHash:a.sourceHash,costSourceHash:c.sourceHash,ordersHash:a.ordersHash,refundsHash:a.refundsHash,allocationHash:a.allocationHash,costEntriesHash:c.entriesHash,costAllocationHash:c.allocationHash,costRepeatMarketingHash:c.repeatMarketingHash});return f;
}
test('malformed independently pinned identity/refund/cost evidence fails validation',()=>{
 for(const mutate of [
  f=>f.acquisition.refundObservations[0].date='2026-01-01',
  f=>f.acquisition.refundObservations[0].orderId='missing',
  f=>f.acquisition.orderObservations[1].firstOrderDate='2026-01-09',
  f=>f.acquisition.orderObservations[2].customerId='c-p',
  f=>f.acquisition.orderObservations[4].paidFirst=true,
  f=>f.costs.contributionEntries[0].orderId=null,
  f=>f.costs.contributionEntries.push(f.costs.contributionEntries[0]),
  f=>f.costs.contributionEntries[0].variableCosts=-1,
 ]){const f=fixture();mutate(f);repin(f);assert.throws(()=>run(f));}
});
test('only reserved synthetic company and complete month accepted; non-JSON source fails closed',()=>{
 for(const mutate of [f=>{f.options.expected.scope.storeId='other';f.acquisition.storeId='other';f.costs.storeId='other';repin(f);},f=>{f.options.from='2026-02-02';f.options.expected.scope.from=f.options.from;},f=>{f.acquisition.bad=Infinity;},f=>{f.acquisition.bad=f.acquisition;}]){const f=fixture();mutate(f);assert.throws(()=>run(f));}
});
test('verified zero month is zero, not absent, with all five populations preserved',()=>{
 const f=fixture();f.acquisition.orderObservations=[];f.acquisition.refundObservations=[];f.costs.contributionEntries=[];for(const k of Object.keys(f.options.expected.totals))f.options.expected.totals[k]=0;f.options.expected.originalOrders=0;repin(f);
 const p=run(f);assert.equal(p.partitions.identifiedRepeat.originalOrders,0);assert.equal(p.partitions.identifiedRepeat.contributionBeforeMarketing,0);assert.equal(p.forecastEligibility,'unavailable');
});

test('real canonical generated sources fit the contract without inventing new allocations',async()=>{
 const {generate,summarise}=await import('./generator.mjs');
 const {buildAcquisitionSource}=await import('./acquisition-source.mjs');
 const {prepareAcquisitionCosts}=await import('./acquisition-costs.mjs');
 const ledger=generate({from:'2024-11-01',asOf:'2024-12-01'}),a=buildAcquisitionSource(generate({from:'2024-01-01',asOf:'2024-12-01'})),c=prepareAcquisitionCosts(ledger,a);
 const from='2024-11-01',to='2024-11-30',month=summarise(ledger,from,to),rows=c.contributionEntries.filter(e=>e.date>=from&&e.date<=to);
 const totals=Object.fromEntries(['netProductSales','netShipping','cogs','variableCosts','repeatMarketingCosts'].map(k=>[k,rows.reduce((n,r)=>n+r[k],0)]));
 const expected={financialVersionId:'offline-rehearsal-not-published',salesRevision:'a'.repeat(64),costRevision:'b'.repeat(64),scope:{storeId:a.storeId,currency:a.currency,timezone:a.timezone,from,to},acquisitionSourceHash:a.sourceHash,costSourceHash:c.sourceHash,ordersHash:a.ordersHash,refundsHash:a.refundsHash,allocationHash:a.allocationHash,costEntriesHash:c.entriesHash,costAllocationHash:c.allocationHash,costRepeatMarketingHash:c.repeatMarketingHash,totals,originalOrders:a.orderObservations.filter(o=>o.date>=from&&o.date<=to).length};
 const result=partitionRepeatOrderEconomics(a,c,{from,to,expected});
 assert.equal(result.totals.netProductSales,month.productSales-month.refunds);assert.equal(result.totals.variableCosts,month.variableCosts);
 assert.ok(result.partitions.identifiedRepeat.originalOrders>0);assert.ok(result.partitions.nonPaidFirst.originalOrders>0);assert.equal(result.forecastEligibility,'unavailable');
});

test('source descriptor guard rejects accessors without execution and noncanonical JSON',()=>{
 let touched=false;const accessor=fixture();Object.defineProperty(accessor.acquisition,'extra',{enumerable:true,get(){touched=true;return 1;}});assert.throws(()=>run(accessor));assert.equal(touched,false);
 for(const mutate of [f=>{f.acquisition.extra=Symbol('bad');},f=>{Object.defineProperty(f.acquisition,'extra',{value:1,enumerable:false});},f=>{f.acquisition.extra=[,1];},f=>{f.acquisition.extra=-0;},f=>{f.acquisition.extra=Number.MAX_SAFE_INTEGER+1;},f=>{f.acquisition.extra=Object.create({x:1});}]){const f=fixture();mutate(f);assert.throws(()=>run(f));}
});
