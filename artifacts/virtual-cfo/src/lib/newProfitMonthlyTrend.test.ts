import test from 'node:test';
import assert from 'node:assert/strict';
import { composeHistoryMonth } from './v11/history-composition.ts';
import { HISTORY_EDITION, type HistorySelection } from './v11/history-supported.ts';
import { buildNewProfitMonthlyTrend, newProfitMonthRatios } from './newProfitMonthlyTrend.ts';
function month(index:number,orders=10,missingCosts=false){
 const date=new Date(Date.UTC(2025,index,1)),from=date.toISOString().slice(0,10),to=new Date(Date.UTC(2025,index+1,0)).toISOString().slice(0,10);
 const selection:HistorySelection={storeId:'profit-business',currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor:'2024-11-01',versionId:`profit-${index}`,period:{from,to}};
 const scope={storeId:selection.storeId,currency:'GBP',from,to};
 const next=new Date(Date.UTC(2025,index+1,1));const londonHour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'numeric',hourCycle:'h23'}).format(next));const sourceAsOf=new Date(next.getTime()-londonHour*3600000).toISOString();
 const raw={state:'supported',versionId:selection.versionId,contract:'history-v2-proposal',scope,snapshotId:selection.versionId,salesRevision:'sales-1',costRevision:'cost-1',metadata:{versionId:selection.versionId,edition:HISTORY_EDITION,anchor:selection.anchor,sourceAsOf,observedAt:'2026-11-20T10:00:00Z',formulaVersion:'night-scout-v11-2026-10-30',sourceBasis:'synthetic-local',verification:'canonical-source-revision-only'},sales:{grossProductSales:12000,discounts:2000,netProductSales:9000,netShipping:500,originalOrders:orders,aov:{value:orders?10000/orders:null,reason:orders?null:'No orders'},provenance:scope},components:{cogs:4500,variableCosts:1000,advertising:500,overheadIncludingDA:2000,depreciationAmortisation:100},profit:{state:'complete',grossProfit:4500,contributionBeforeMarketing:4000,contribution:3500,ebitda:1600}};
 if(missingCosts)delete (raw as any).components;
 return composeHistoryMonth(raw,selection)!;
}
test('monthly revenue, EBITDA, discount/refund and overhead rates use the exact linked source',()=>{
 const months=[0,1,2,3].map(i=>month(i));const trend=buildNewProfitMonthlyTrend(months,months[3],3,false,'rolling')!;
 assert.equal(trend.actualCount,3);assert.equal(trend.from,'2025-02-01');assert.equal(trend.rows[2].revenue,9500);assert.equal(trend.rows[2].profit,1600);assert.equal(trend.rows[2].comparisonProfit,1600);
 assert.equal(trend.rows[2].discountRate,2000/12000*100);assert.equal(trend.rows[2].refundRate,1000/12000*100);assert.equal(trend.rows[2].overheads,1900);assert.equal(trend.rows[2].overheadRate,1900/9500);
 assert.equal(trend.rows[0].comparisonProfit,null);assert.equal(trend.rows[2].referenceFrom,'2025-01-01');assert.equal(trend.rows[2].referenceTo,'2025-03-31');
});
test('per-order rolling comparator weights original orders instead of averaging ratios',()=>{
 const months=[month(0,10),month(1,20),month(2,30),month(3,8)];const trend=buildNewProfitMonthlyTrend(months,months[3],3,true,'rolling')!;
 assert.equal(trend.rows[2].comparisonProfit,4800/60);assert.equal(trend.rows[2].profit,1600/8);assert.equal(trend.rows[2].revenue,9500/8);assert.notEqual(trend.rows[2].comparisonProfit,(160+80+1600/30)/3);
 assert.equal(trend.rows[2].discountRate,2000/12000*100);
});
test('cross-company, noncontiguous, duplicate and wrong end-version histories are rejected',()=>{
 const months=[0,1,2,3].map(i=>month(i));const other=structuredClone(months);other[0].selection.storeId='other';assert.equal(buildNewProfitMonthlyTrend(other,months[3],3,false,'none'),null);
 assert.equal(buildNewProfitMonthlyTrend([months[0],months[2],months[3]],months[3],3,false,'none'),null);
 assert.equal(buildNewProfitMonthlyTrend([months[0],months[0]],months[0],3,false,'none'),null);
 const end=structuredClone(months[3]);end.selection.versionId='corrected';assert.equal(buildNewProfitMonthlyTrend(months,end,3,false,'none'),null);
 assert.equal(buildNewProfitMonthlyTrend(months,null,3,false,'none'),null);
});
test('missing costs preserve sales but never create profit or rolling-comparison zeroes',()=>{
 const months=[month(0,10,true),month(1),month(2),month(3)];const trend=buildNewProfitMonthlyTrend(months,months[3],6,false,'rolling')!;
 assert.equal(trend.actualCount,4);assert.equal(trend.rows[0].revenue,9500);assert.equal(trend.rows[0].profit,null);assert.equal(trend.rows[3].comparisonProfit,null);
 const ratios=newProfitMonthRatios(months[0]);assert.equal(ratios.ebitdaMargin,null);assert.equal(ratios.discountRate,2000/12000);
});
test('zero orders suppress monetary per-order figures and unsupported comparisons stay gaps',()=>{
 const months=[month(0,0),month(1,0)];const trend=buildNewProfitMonthlyTrend(months,months[1],3,true,'last-year')!;
 assert.equal(trend.rows[1].profit,null);assert.equal(trend.rows[1].revenue,null);assert.equal(trend.rows[1].comparisonProfit,null);assert.equal(trend.rows[1].profitMargin,1600/9500);
 assert.equal(newProfitMonthRatios(null).grossMargin,null);
});
