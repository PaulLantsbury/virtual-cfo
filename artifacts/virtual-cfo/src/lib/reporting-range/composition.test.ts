import test from 'node:test';
import assert from 'node:assert/strict';
import {composeReviewedRange,type ReviewedRangeSelection} from './composition.ts';
import {reviewedBrowserMonth} from '../../../tests/reviewed-pages.test-fixture.ts';
import {profitBridge} from '../../../../../experiments/financial-v1/calculations.mjs';
import {allocateMonthlyRecurringCost,MONTHLY_COST_ALLOCATION_METHOD} from '../../../../../experiments/financial-v1/monthly-cost-allocation.mjs';

/** Disposable source envelopes only; no DB, network, generated live evidence or writes. */
function fixture(partial=false,single=false){
 const entries=(single?['2025-01-01']:['2025-01-01','2025-02-01']).map(reviewedBrowserMonth);
 const first=entries[0].month.selection,last=entries.at(-1)!.month.selection;
 const period=partial?{from:'2025-01-26',to:'2025-02-01'}:{from:first.period.from,to:last.period.to};
 const expected:ReviewedRangeSelection={storeId:first.storeId,currency:'GBP',timezone:'Europe/London',edition:first.edition,anchor:first.anchor,period,versions:entries.map(({month:m})=>({...m.selection.period,versionId:m.selection.versionId}))};
 const rangeId='c'.repeat(64),scope={storeId:first.storeId,currency:'GBP',timezone:'Europe/London',...period};
 const total=(field:string)=>entries.reduce((sum,e)=>sum+(e.response.sales as any)[field],0);
 const costs=(field:string)=>entries.reduce((sum,e)=>sum+(e.response.components as any)[field],0);
 const sales={grossProductSales:total('grossProductSales'),discounts:total('discounts'),netProductSales:total('netProductSales'),netShipping:total('netShipping'),originalOrders:total('originalOrders'),aov:{value:null,reason:null},provenance:{storeId:first.storeId,currency:'GBP',...period,coverageEvidence:`history-range:${rangeId}`}};
 const components={cogs:costs('cogs'),variableCosts:costs('variableCosts'),advertising:costs('advertising'),overheadIncludingDA:costs('overheadIncludingDA'),depreciationAmortisation:costs('depreciationAmortisation')};
 const policy='uk-gifts-v2-monthly-payroll-recurring-v1';
 const portions=partial?expected.versions.flatMap(v=>['salary','employer','pension'].flatMap(costId=>{
  const result=allocateMonthlyRecurringCost({storeId:first.storeId,currency:'GBP',costId,from:v.from>period.from?v.from:period.from,to:v.to<period.to?v.to:period.to,sources:[{storeId:first.storeId,currency:'GBP',costId,month:v.from.slice(0,7),sourceVersionId:v.versionId,selection:'selected',amountPence:costId==='salary'?1000:0,coverage:{complete:true,from:v.from,to:v.to},classification:{type:'recurring-monthly',approved:true,approvalId:policy}}]});
  assert.equal(result.state,'supported');return result.portions.map(p=>({...p,costId,methodVersion:result.methodVersion}));
 })):[];
 const timingAdjustment=partial?portions.reduce((sum,p)=>sum+p.valuePence,0)-1000:0;
 const raw={state:'supported',contract:'history-range-v1',rangeId,scope,
  versions:entries.map(({response:r,month:m})=>({...m.selection.period,versionId:m.selection.versionId,salesRevision:r.salesRevision,costRevision:r.costRevision})),
  monthlyResponses:entries.map(e=>e.response),
  metadata:{edition:first.edition,anchor:first.anchor,formulaVersion:entries[0].response.metadata.formulaVersion,sourceBasis:'synthetic-local',verification:'constituent-source-revisions',sourceAsOf:entries.map(e=>e.response.metadata.sourceAsOf).sort().at(-1),observedAt:entries.map(e=>e.response.metadata.observedAt).sort().at(-1),allocationBasis:partial?'allocated-recurring-monthly-costs':'actual-months',allocationMethod:MONTHLY_COST_ALLOCATION_METHOD},
  sales,components,profit:profitBridge({...sales,...components}),
  allocation:{kind:partial?'allocated-estimate':'actual-months',methodVersion:MONTHLY_COST_ALLOCATION_METHOD,classificationPolicy:policy,portions,datedAccrualOverheadIncludingDA:components.overheadIncludingDA-timingAdjustment,allocatedOverheadIncludingDA:components.overheadIncludingDA,timingAdjustmentToDatedAccrualEbitda:timingAdjustment}};
 return {raw,expected,entries};
}

test('multi-month composition sums checked inputs and recomputes weighted ratios',()=>{
 const {raw,expected}=fixture(),r=composeReviewedRange(raw,expected);assert.ok(r);
 assert.equal(r.amounts.netProductSales,18000);assert.equal(r.amounts.ebitda,3100);assert.equal(r.amounts.operatingProfit,2900);
 assert.equal(r.originalOrders,21);assert.equal(r.originalProductSales,20000);assert.equal(r.view.primary.result.aov,20000/21);
 assert.equal(r.view.primary.result.contributionMargin,6900/19000);assert.equal(r.context.period.from,'2025-01-01');
 assert.equal(r.evidence.verification,'constituent-source-revisions');assert.equal(r.range.months.length,2);
 assert.notEqual(r.evidence.versionId,r.range.months[0].evidence.versionId);
});
test('one complete source month keeps all accepted monthly amounts unchanged',()=>{
 const {raw,expected,entries}=fixture(false,true),r=composeReviewedRange(raw,expected);assert.ok(r);
 assert.deepEqual(r.amounts,entries[0].month.amounts);assert.equal(r.originalOrders,entries[0].month.originalOrders);
 assert.equal(r.range.allocationBasis,'actual-months');
});
test('partial range uses its own date scope and explicit allocated basis without pretending to be a month',()=>{
 const {raw,expected}=fixture(true),r=composeReviewedRange(raw,expected);assert.ok(r);
 assert.deepEqual(r.context.period,expected.period);assert.equal(r.range.allocationBasis,'allocated-recurring-monthly-costs');
 assert.equal(r.range.allocation.timingAdjustmentToDatedAccrualEbitda,-770);
 assert.equal(r.range.months[0].context.period.from,'2025-01-01');assert.equal(r.range.months[1].context.period.to,'2025-02-28');
});
test('wrong scope, selected version, source revision, missing or conflicting monthly witness fail closed',()=>{
 const {raw,expected}=fixture();
 for(const mutate of [
  (v:any)=>{v.scope.storeId='other-company';},(v:any)=>{v.versions[0].versionId='old-version';},
  (v:any)=>{v.versions[0].salesRevision='f'.repeat(64);},(v:any)=>{v.monthlyResponses.pop();},
  (v:any)=>{v.monthlyResponses[0].profit.ebitda+=1;},
 ]){const v=structuredClone(raw);mutate(v);assert.equal(composeReviewedRange(v,expected),null);}
});
test('canonical profit disagreement, missing input and unsafe amounts never become zero or supported profit',()=>{
 const {raw,expected}=fixture();
 for(const mutate of [(v:any)=>{v.profit.ebitda+=1;},(v:any)=>{v.components.cogs=null;},(v:any)=>{v.sales.originalOrders=-1;},(v:any)=>{v.components.variableCosts=Number.MAX_SAFE_INTEGER+1;}]){
  const v=structuredClone(raw);mutate(v);assert.equal(composeReviewedRange(v,expected),null);
 }
});
test('partial cost allocation must retain its method, classification and exact dated-accrual reconciliation',()=>{
 const {raw,expected}=fixture(true);
 for(const mutate of [
  (v:any)=>{v.metadata.allocationBasis='actual-months';},(v:any)=>{delete v.allocation;},
  (v:any)=>{v.allocation.methodVersion='invented-method';},(v:any)=>{v.metadata.allocationMethod='invented-method';},
  (v:any)=>{v.allocation.timingAdjustmentToDatedAccrualEbitda+=1;},
  (v:any)=>{v.allocation.allocatedOverheadIncludingDA+=1;},
 ]){const v=structuredClone(raw);mutate(v);assert.equal(composeReviewedRange(v,expected),null);}
});
