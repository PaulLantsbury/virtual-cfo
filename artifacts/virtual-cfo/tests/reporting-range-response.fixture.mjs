// Disposable browser observations only. Never used by hosted reporting.
import {reviewedBrowserMonth} from './reviewed-pages.test-fixture.ts';
import {profitBridge} from '../../../experiments/financial-v1/calculations.mjs';
import {allocateMonthlyRecurringCost,MONTHLY_COST_ALLOCATION_METHOD} from '../../../experiments/financial-v1/monthly-cost-allocation.mjs';
import {composeReviewedRange} from '../src/lib/reporting-range/composition.ts';
export const rangeMonths=['2025-01-01','2025-02-01','2025-03-01'].map(reviewedBrowserMonth);
const daily=['2025-01-27','2025-01-28','2025-01-29','2025-01-30','2025-01-31','2025-02-01','2025-02-02'].map(date=>({date,grossProductSales:1100,discounts:100,netProductSales:1000,netShipping:50,originalOrders:1,cogs:400,variableCosts:100,advertising:50,datedNonPayrollOverhead:15,depreciationAmortisation:5}));
const policy='uk-gifts-v2-monthly-payroll-recurring-v1';
export function browserRangeResponse(from,to){
 const entries=rangeMonths.filter(e=>e.month.selection.period.from<=to&&e.month.selection.period.to>=from);
 if(!entries.length)return {state:'unavailable',contract:'history-range-v1',reason:'No fixture sources'};
 const first=entries[0].month.selection,versions=entries.map(({month:m,response:r})=>({...m.selection.period,versionId:m.selection.versionId,salesRevision:r.salesRevision,costRevision:r.costRevision}));
 const whole=from===first.period.from&&to===entries.at(-1).month.selection.period.to;
 if(!whole&&(from<'2025-01-27'||to>'2025-02-02'))return {state:'unavailable',contract:'history-range-v1',reason:'No disposable dated observations for this fixture range'};
 const rangeId='d'.repeat(64),scope={storeId:first.storeId,currency:'GBP',timezone:'Europe/London',from,to};
 const sum=key=>whole?entries.reduce((n,e)=>n+(e.response.sales[key]??e.response.components[key]),0):daily.filter(d=>d.date>=from&&d.date<=to).reduce((n,d)=>n+d[key],0);
 const sales={grossProductSales:sum('grossProductSales'),discounts:sum('discounts'),netProductSales:sum('netProductSales'),netShipping:sum('netShipping'),originalOrders:sum('originalOrders'),aov:{value:null,reason:null},provenance:{storeId:first.storeId,currency:'GBP',from,to,coverageEvidence:`history-range:${rangeId}`}};
 const portions=whole?[]:versions.flatMap(v=>['salary','employer','pension'].flatMap(costId=>{
  const result=allocateMonthlyRecurringCost({storeId:first.storeId,currency:'GBP',costId,from:v.from>from?v.from:from,to:v.to<to?v.to:to,sources:[{storeId:first.storeId,currency:'GBP',costId,month:v.from.slice(0,7),sourceVersionId:v.versionId,selection:'selected',amountPence:costId==='salary'?1000:0,coverage:{complete:true,from:v.from,to:v.to},classification:{type:'recurring-monthly',approved:true,approvalId:policy}}]});
  if(result.state!=='supported')throw Error('Invalid fixture allocation');return result.portions.map(p=>({...p,costId,methodVersion:result.methodVersion}));
 }));
 const allocatedPayroll=portions.reduce((n,p)=>n+p.valuePence,0),datedPayroll=!whole&&from<='2025-01-31'&&to>='2025-01-31'?1000:0;
 const overheadIncludingDA=whole?sum('overheadIncludingDA'):sum('datedNonPayrollOverhead')+allocatedPayroll;
 const datedOverhead=whole?overheadIncludingDA:sum('datedNonPayrollOverhead')+datedPayroll;
 const components={cogs:sum('cogs'),variableCosts:sum('variableCosts'),advertising:sum('advertising'),overheadIncludingDA,depreciationAmortisation:sum('depreciationAmortisation')};
 const raw={state:'supported',contract:'history-range-v1',rangeId,scope,versions,monthlyResponses:entries.map(e=>e.response),metadata:{edition:first.edition,anchor:first.anchor,formulaVersion:entries[0].response.metadata.formulaVersion,sourceBasis:'synthetic-local',verification:'constituent-source-revisions',sourceAsOf:entries.map(e=>e.response.metadata.sourceAsOf).sort().at(-1),observedAt:entries.map(e=>e.response.metadata.observedAt).sort().at(-1),allocationBasis:whole?'actual-months':'allocated-recurring-monthly-costs',allocationMethod:MONTHLY_COST_ALLOCATION_METHOD},sales,components,profit:profitBridge({...sales,...components}),allocation:{kind:whole?'actual-months':'allocated-estimate',methodVersion:MONTHLY_COST_ALLOCATION_METHOD,classificationPolicy:policy,portions,datedAccrualOverheadIncludingDA:datedOverhead,allocatedOverheadIncludingDA:overheadIncludingDA,timingAdjustmentToDatedAccrualEbitda:overheadIncludingDA-datedOverhead},cashDatedPortions:[]};
 if(!whole)raw.dailyFinancial=daily.filter(d=>d.date>=from&&d.date<=to).map(d=>{const allocated=versions.filter(v=>v.from<=d.date&&v.to>=d.date).reduce((n,v)=>n+allocateMonthlyRecurringCost({storeId:first.storeId,currency:'GBP',costId:'salary',from:d.date,to:d.date,sources:[{storeId:first.storeId,currency:'GBP',costId:'salary',month:v.from.slice(0,7),sourceVersionId:v.versionId,selection:'selected',amountPence:1000,coverage:{complete:true,from:v.from,to:v.to},classification:{type:'recurring-monthly',approved:true,approvalId:policy}}]}).valuePence,0);return {date:d.date,grossProductSales:d.grossProductSales,discounts:d.discounts,netProductSales:d.netProductSales,netShipping:d.netShipping,originalOrders:d.originalOrders,cogs:d.cogs,variableCosts:d.variableCosts,advertising:d.advertising,overheadIncludingDA:d.datedNonPayrollOverhead+allocated,depreciationAmortisation:d.depreciationAmortisation};});
 const expected={...first,period:{from,to},versions:versions.map(({from,to,versionId})=>({from,to,versionId}))};
 if(!composeReviewedRange(raw,expected))throw Error('Disposable range response failed independent source guards');
 return raw;
}
