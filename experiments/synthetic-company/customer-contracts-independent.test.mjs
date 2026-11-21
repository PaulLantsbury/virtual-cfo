// Independent offline contract checks; no connections, SQL application or runtime activation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareCustomerSummaryVersions} from './customer-summary-version.mjs';
import {supplementalDigest} from './supplemental-reader.mjs';
import {reviewedBrowserMonth} from '../../artifacts/virtual-cfo/tests/reviewed-pages.test-fixture.ts';
import {composeHistoryMonth} from '../../artifacts/virtual-cfo/src/lib/v11/history-composition.ts';
import {acquisitionView,acquisitionFinancialContext} from '../../artifacts/virtual-cfo/src/lib/marketing/acquisition-evidence.ts';
import {partitionRepeatOrderEconomics} from './repeat-order-economics.mjs';
const uuid=i=>`91000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
function inventory(){
 const baseRows=[],contexts=[];let activity;
 for(let i=0;i<24;i++){
  const from=new Date(Date.UTC(2024,10+i,1)).toISOString().slice(0,10),f=structuredClone(reviewedBrowserMonth(from,i));
  f.response.versionId=f.response.snapshotId=f.response.metadata.versionId=uuid(i);f.month.selection.versionId=uuid(i);f.acquisition.financial.snapshotId=uuid(i);
  const month=composeHistoryMonth(f.response,f.month.selection);assert.ok(month);
  if(i===0)activity=structuredClone(f.acquisition.customerActivity);
  delete f.acquisition.customerActivity;
  for(const kind of ['cash','acquisition']){
   const body={contract:'reviewed-supplement-v1',kind,scope:{...f.acquisition.scope},financialVersionId:uuid(i),salesRevision:f.response.salesRevision,costRevision:f.response.costRevision,sourceBasis:'synthetic-local',observedAt:'2026-11-20T12:00:00Z',payload:kind==='cash'?{fixtureOnly:true}:f.acquisition};baseRows.push({body,bodyHash:supplementalDigest(body)});
  }
  contexts.push(acquisitionFinancialContext(month));
 }
 const b=baseRows[1];return {baseRows,candidates:[{baseBodyHash:b.bodyHash,financial:{scope:structuredClone(b.body.scope),financialVersionId:b.body.financialVersionId,salesRevision:b.body.salesRevision,costRevision:b.body.costRevision},activity}],contexts};
}
const input=f=>({baseRows:f.baseRows,candidates:f.candidates});
test('independent: additive proposal preserves exact48 hashes, identities and existing browser results',()=>{
 const f=inventory(),before=JSON.stringify(f.baseRows),views=f.baseRows.filter(r=>r.body.kind==='acquisition').map((r,i)=>acquisitionView(r.body.payload,f.contexts[i]));assert.ok(views.every(Boolean));assert.ok(views.every(v=>v.customerActivityView===null));
 const candidate=prepareCustomerSummaryVersions(input(f));assert.equal(candidate.protectedRows,48);assert.equal(JSON.stringify(f.baseRows),before);assert.ok(!Object.isFrozen(f.baseRows));
 assert.deepEqual(f.baseRows.filter(r=>r.body.kind==='acquisition').map((r,i)=>acquisitionView(r.body.payload,f.contexts[i])),views);
 assert.equal(candidate.operations[0].body.baseBodyHash,f.baseRows[1].bodyHash);assert.equal(candidate.remoteApplied,false);
});
test('independent: uncertain replay requires exact candidate readback; absent/conflicting history is not guessed',()=>{
 const f=inventory(),before=JSON.stringify(f.baseRows),p=prepareCustomerSummaryVersions(input(f)),prior=p.operations.map(({versionId,body})=>({versionId,body}));
 const replay=prepareCustomerSummaryVersions({...input(f),existingSidecars:prior});assert.equal(replay.operations[0].action,'unchanged');
 const altered=structuredClone(prior);altered[0].body.activity.basis+=' changed';altered[0].versionId=supplementalDigest(altered[0].body);assert.throws(()=>prepareCustomerSummaryVersions({...input(f),existingSidecars:altered}),/Changed sidecar/);
 assert.throws(()=>prepareCustomerSummaryVersions({...input(f),existingSidecars:[...prior,...prior]}),/Ambiguous/);assert.equal(JSON.stringify(f.baseRows),before);
});
test('independent: financial correction cannot silently relink existing customer edition',()=>{
 const f=inventory(),p=prepareCustomerSummaryVersions(input(f)),old=p.operations.map(({versionId,body})=>({versionId,body}));
 f.baseRows[1].body.financialVersionId=uuid(90);f.baseRows[1].body.costRevision='f'.repeat(64);f.baseRows[1].bodyHash=supplementalDigest(f.baseRows[1].body);
 assert.throws(()=>prepareCustomerSummaryVersions({...input(f),existingSidecars:old}),/Unknown acquisition base/);
 assert.throws(()=>prepareCustomerSummaryVersions(input(f)),/Unknown acquisition base/);
});
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const seal=x=>{delete x.sourceHash;x.sourceHash=hash(x);return x;};
function duplicateFirst(){
 const scope={storeId:'d7500000-0000-4000-8000-000000000009',currency:'GBP',timezone:'Europe/London',from:'2026-02-01',to:'2026-02-28'};
 const orders=['a','b'].map((orderId,i)=>({orderId,date:`2026-02-0${i+1}`,identityState:'identified',customerId:'one-customer',firstOrderId:orderId,firstOrderDate:`2026-02-0${i+1}`,paidFirst:false,channel:'organic',netProductSales:100}));
 const acq={contract:'synthetic-acquisition-source-v1',policy:'synthetic-identity-and-spend-v1',profile:'uk-gifts-v2',...scope,from:'2026-01-01',through:scope.to,orderObservations:orders,refundObservations:[],spendAllocations:[]};
 for(const [key,out] of [['orderObservations','ordersHash'],['refundObservations','refundsHash'],['spendAllocations','allocationHash']])acq[out]=hash(acq[key]);seal(acq);
 const entries=orders.map(o=>({date:o.date,orderId:o.orderId,customerId:o.customerId,netProductSales:100,netShipping:0,cogs:10,variableCosts:1,repeatMarketingCosts:0}));
 const costs={contract:'synthetic-acquisition-cost-source-v1',policy:'synthetic-order-cost-allocation-v1',...scope,from:'2026-01-01',through:scope.to,acquisitionSourceHash:acq.sourceHash,contributionEntries:entries,allocationProofs:[],repeatMarketingProofs:[],entriesHash:hash(entries),allocationHash:hash([]),repeatMarketingHash:hash([])};seal(costs);
 const expected={financialVersionId:uuid(1),salesRevision:'a'.repeat(64),costRevision:'b'.repeat(64),scope,acquisitionSourceHash:acq.sourceHash,costSourceHash:costs.sourceHash,ordersHash:acq.ordersHash,refundsHash:acq.refundsHash,allocationHash:acq.allocationHash,costEntriesHash:costs.entriesHash,costAllocationHash:costs.allocationHash,costRepeatMarketingHash:costs.repeatMarketingHash,originalOrders:2,totals:{netProductSales:200,netShipping:0,cogs:20,variableCosts:2,repeatMarketingCosts:0}};
 return {acq,costs,options:{from:scope.from,to:scope.to,expected}};
}
test('independent: one synthetic customer cannot have two different first-order witnesses',()=>{const f=duplicateFirst();assert.throws(()=>partitionRepeatOrderEconomics(f.acq,f.costs,f.options),/first|customer|witness|conflict/i);});
