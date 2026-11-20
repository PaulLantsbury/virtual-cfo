import test from 'node:test';
import assert from 'node:assert/strict';
import {acquisitionView,validateAcquisitionPayload,contributionRecoveryLabel} from './acquisition-evidence.ts';
const sha=(char:string)=>char.repeat(64);
function fixture(){
 const scope={storeId:'d7500000-0000-4000-8000-000000000009',currency:'GBP',timezone:'Europe/London',from:'2026-10-01',to:'2026-10-31'};
 const binding={snapshotId:'snapshot-october',edition:'synthetic-history-v2-2026-11',anchor:'2024-11-01',salesRevision:sha('a'),costRevision:sha('b'),formulaVersion:'night-scout-v11-2026-10-30'};
 const raw:any={contract:'synthetic-acquisition-v1',state:'supported',profile:'uk-gifts-v2',policy:'synthetic-identity-and-spend-v1',scope,financial:binding,source:{from:'2024-01-01',through:'2026-11-19',sourceHash:sha('c'),ordersHash:sha('d'),refundsHash:sha('e'),allocationHash:sha('f'),synthetic:true},coverage:{originalOrders:10,identifiedFirstOrders:6,identifiedRepeatOrders:2,guestOrders:1,unknownOrders:1,paidFirstCustomers:4},spend:{advertising:10000,acquisition:4000,retention:4000,unallocated:2000},revenue:{netProductSales:10000,identifiedFirst:6000,identifiedRepeat:3000,guest:500,unknown:500},metrics:{cac:null,firstOrderContribution:null,maturePaybackDays:null},limitations:['Unit fixture for strict optional economics validation; not live evidence.']};
 const policy='synthetic-order-cost-allocation-v1',source={costSourceHash:sha('1'),allocationHash:sha('2'),repeatMarketingHash:sha('3')};
 const first={contract:'synthetic-first-order-economics-v1',policy,scope:{from:scope.from,to:scope.to,observedThrough:scope.to,currency:'GBP',timezone:'Europe/London'},customers:4,netProductSales:5000,netShipping:1000,cogs:2000,variableCosts:1000,repeatMarketingCosts:0,contributionBeforeMarketing:3000,acquisitionSpend:4000,acquisitionMetricsState:'supported',source:{costSourceHash:source.costSourceHash,acquisitionSourceHash:raw.source.sourceHash,allocationHash:source.allocationHash},basis:'Allocated synthetic first-order contribution before all advertising and overheads.'};
 const curve=Array.from({length:90},(_,day)=>({day,netProductSales:day===0?4000:day===1?2000:6000,netShipping:0,cogs:day<2?1000:2000,variableCosts:day<2?500:1000,repeatMarketingCosts:day===0?0:day===1?100:200,contributionBeforeMarketing:day===0?2500:day===1?500:3000}));
 raw.economics={policy,first,dependencies:Array.from({length:6},(_,i)=>({from:`2026-${String(i+4).padStart(2,'0')}-01`,to:new Date(Date.UTC(2026,i+4,0)).toISOString().slice(0,10),versionId:`10000000-0000-4000-8000-${String(i).padStart(12,'0')}`,salesRevision:sha('4'),costRevision:sha('5')})),mature:{contract:'synthetic-mature-cohort-economics-v1',state:'supported',policy,scope:{from:'2026-04-01',to:'2026-06-30',observedThrough:'2026-09-30',days:90,currency:'GBP',timezone:'Europe/London'},customers:2,acquisitionSpend:2000,curve,source:{...source,acquisitionSourceHash:raw.source.sourceHash},basis:'Matched 90-day synthetic contribution with allocated repeat marketing; not cash payback.'},source};
 const financial:any={state:'supported',versionId:binding.snapshotId,scope:{storeId:scope.storeId,currency:'GBP',from:scope.from,to:scope.to},metadata:{edition:binding.edition,anchor:binding.anchor,formulaVersion:binding.formulaVersion},salesRevision:binding.salesRevision,costRevision:binding.costRevision,sales:{originalOrders:10,netProductSales:10000},components:{advertising:10000}};
 return {raw,financial};
}
test('valid optional allocated costs derive first economics and genuine day-zero contribution recovery',()=>{
 const {raw,financial}=fixture(),view=acquisitionView(raw,financial)!;
 assert.ok(view);assert.equal(view.economicsView!.firstOrderContribution,750);
 assert.equal(view.economicsView!.firstOrderBreakEvenCacBeforeOverheads,750);
 assert.equal(view.economicsView!.firstOrderContributionAfterAcquisition,-250);
 assert.equal(view.economicsView!.mature!.firstCrossingDay,0);
 assert.equal(view.economicsView!.mature!.cac,1000);assert.equal(view.economicsView!.mature!.grossProfitToCac,2);
 assert.equal(view.economicsView!.mature!.contributionAfterAcquisition,400);
 assert.equal(raw.metrics.maturePaybackDays,null,'No derived ratio or payback day is persisted');
});
test('a later observed refund can reverse first crossing; age-zero is tested for null rather than truthiness',()=>{
 const {raw,financial}=fixture(),view=acquisitionView(raw,financial)!;
 assert.equal(view.economicsView!.mature!.recoveryReversed,true);
 assert.equal(contributionRecoveryLabel(view.economicsView!.mature!.firstCrossingDay),'Day 0 · first-order day');
 const noCross=structuredClone(raw);noCross.economics.mature.acquisitionSpend=100000;
 const none=acquisitionView(noCross,financial)!;assert.equal(none.economicsView!.mature!.firstCrossingDay,null);assert.equal(none.economicsView!.mature!.recoveryReversed,false);
});
test('malformed or mismatched first/cohort economics rejects whole supplied supplement',()=>{
 for(const change of [(r:any)=>r.economics.first.customers++,(r:any)=>r.economics.first.acquisitionSpend++,(r:any)=>r.economics.first.scope.observedThrough='2026-11-01',(r:any)=>r.economics.first.repeatMarketingCosts=1,(r:any)=>r.economics.first.contributionBeforeMarketing++,(r:any)=>r.economics.source.costSourceHash=sha('9'),(r:any)=>r.economics.first.source.acquisitionSourceHash=sha('9'),(r:any)=>r.economics.mature.source.repeatMarketingHash=sha('9'),(r:any)=>r.economics.mature.curve.pop(),(r:any)=>r.economics.mature.curve[0].day=1,(r:any)=>r.economics.mature.curve[2].variableCosts=1000.5,(r:any)=>r.economics.mature.curve[2].contributionBeforeMarketing++,(r:any)=>r.economics.mature.scope.to='2026-07-01',(r:any)=>r.economics.mature.scope.observedThrough='2026-09-27',(r:any)=>r.economics.mature.customers=0,(r:any)=>r.economics.mature.acquisitionSpend=0,(r:any)=>r.economics.dependencies.pop(),(r:any)=>r.economics.dependencies[0].from='2026-05-01',(r:any)=>r.economics.dependencies[0].versionId='bad',(r:any)=>r.economics.dependencies[0].costRevision='bad']){
  const {raw,financial}=fixture();change(raw);assert.equal(validateAcquisitionPayload(raw,financial),false);
 }
});
test('selected pre-September reporting context withholds future mature cohort while current first-order inputs remain possible',()=>{
 const {raw,financial}=fixture();
 raw.scope.from=financial.scope.from=raw.economics.first.scope.from='2026-08-01';
 raw.scope.to=financial.scope.to=raw.economics.first.scope.to=raw.economics.first.scope.observedThrough='2026-08-31';
 assert.equal(validateAcquisitionPayload(raw,financial),false);
 raw.economics.mature=null;raw.economics.dependencies=[];assert.equal(validateAcquisitionPayload(raw,financial),true);assert.equal(acquisitionView(raw,financial)!.economicsView!.mature,null);
});
test('absence preserves base supplement; zero eligible acquisition spend does not manufacture free CAC',()=>{
 const {raw,financial}=fixture();delete raw.economics;
 assert.equal(validateAcquisitionPayload(raw,financial),true);assert.equal(acquisitionView(raw,financial)!.economicsView,null);
 const fixture2=fixture();fixture2.raw.spend.retention+=fixture2.raw.spend.acquisition;fixture2.raw.spend.acquisition=0;fixture2.raw.economics.first.acquisitionSpend=0;fixture2.raw.economics.first.acquisitionMetricsState='unavailable';
 const view=acquisitionView(fixture2.raw,fixture2.financial)!;assert.ok(view);assert.equal(view.cac,null);assert.equal(view.economicsView!.firstOrderContribution,750);
});
