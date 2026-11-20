import test from 'node:test';
import assert from 'node:assert/strict';
import { composeHistoryMonth } from '../v11/history-composition.ts';
import { HISTORY_EDITION, type HistorySelection } from '../v11/history-supported.ts';
import { linkedMarketingMetrics } from './linked-model.ts';
import { linkedFinancialScenario, linkedMarketingHistory, linkedMarketingThresholds } from './linked-connections-model.ts';
function month(index: number, advertising = 500, orders = 10, storeId = 'company-a') {
 const from=`2025-${String(index).padStart(2,'0')}-01`, to=new Date(Date.UTC(2025,index,0)).toISOString().slice(0,10);
 const selection:HistorySelection={storeId,currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor:'2024-11-01',versionId:`v-${index}`,period:{from,to}};
 const scope={storeId,currency:'GBP',from,to};
 const raw={state:'supported',versionId:selection.versionId,contract:'history-v2-proposal',scope,snapshotId:selection.versionId,salesRevision:'sales',costRevision:'cost',metadata:{versionId:selection.versionId,edition:HISTORY_EDITION,anchor:selection.anchor,sourceAsOf:new Date(Date.UTC(2025,index,1)).toISOString(),observedAt:'2026-11-20T12:00:00Z',formulaVersion:'night-scout-v11-2026-10-30',sourceBasis:'synthetic-local',verification:'canonical-source-revision-only'},sales:{grossProductSales:12000,discounts:2000,netProductSales:9000,netShipping:500,originalOrders:orders,aov:{value:1000,reason:null},provenance:scope},components:{cogs:4500,variableCosts:1000,advertising,overheadIncludingDA:2000,depreciationAmortisation:100},profit:{state:'complete',grossProfit:4500,contributionBeforeMarketing:4000,contribution:4000-advertising,ebitda:2100-advertising}};
 return composeHistoryMonth(raw,selection)!;
}
test('history sums financial inputs, then divides; no unweighted ratio or per-order averages',()=>{
 const model=linkedMarketingHistory([month(1,500,10),month(2,1500,30)])!;
 assert.equal(model.totals.advertising,2000);assert.equal(model.totals.beforeAds,8000);assert.equal(model.totals.poas,4);
 assert.notEqual(model.totals.poas,(8+4000/1500)/2);
 assert.equal(model.totals.orders,40);assert.equal(model.rows[1].month.selection.versionId,'v-2');
});
test('history refuses mixed companies, reversed or missing months rather than joining a misleading trend',()=>{
 assert.equal(linkedMarketingHistory([]),null);
 assert.equal(linkedMarketingHistory([month(1),month(2,500,10,'company-b')]),null);
 assert.equal(linkedMarketingHistory([month(2),month(1)]),null);
 // A duplicate period is an overlap, never a second genuine month.
 assert.equal(linkedMarketingHistory([month(1),month(1)]),null);
});
test('zero spend preserves genuine zeros but cannot create a return ratio',()=>{
 const model=linkedMarketingHistory([month(1,0),month(2,0)])!;
 assert.equal(model.totals.advertising,0);assert.equal(model.totals.poas,null);assert.equal(model.totals.roas,null);
});
test('fixed-sales limits use cash overhead once and guard nonpositive target capacity',()=>{
 const base=linkedMarketingMetrics(month(1))!;
 assert.equal(linkedMarketingThresholds(base,null)!.capacity,2100);
 assert.equal(linkedMarketingThresholds(base,1000)!.poas,4000/1100);
 assert.equal(linkedMarketingThresholds(base,2100)!.poas,null);
 assert.equal(linkedMarketingThresholds(base,2500)!.capacity,-400);
 assert.equal(linkedMarketingThresholds(base,-1),null);
 assert.equal(linkedMarketingThresholds(base,NaN),null);
});
test('conditional bridge uses independent assumptions and reconciles; no sales response is manufactured',()=>{
 const base=linkedMarketingMetrics(month(1))!;
 const hold=linkedFinancialScenario(base,{advertisingChangePct:0,contributionChangePct:0,extraOverheads:0})!;
 assert.equal(hold.ebitda,base.ebitda);assert.equal(hold.difference,0);
 const spend=linkedFinancialScenario(base,{advertisingChangePct:20,contributionChangePct:0,extraOverheads:0})!;
 assert.equal(spend.beforeAds,4000);assert.equal(spend.difference,-100);
 const scenario=linkedFinancialScenario(base,{advertisingChangePct:20,contributionChangePct:10,extraOverheads:50})!;
 assert.equal(scenario.difference,250);
 assert.equal(scenario.contributionEffect+scenario.advertisingEffect+scenario.overheadEffect,scenario.difference);
});
test('conditional result rejects missing financial baselines, invalid controls and unsafe overflow',()=>{
 const base=linkedMarketingMetrics(month(1))!;
 const input={advertisingChangePct:0,contributionChangePct:0,extraOverheads:0};
 assert.equal(linkedFinancialScenario(null,input),null);
 assert.equal(linkedFinancialScenario({...base,beforeAds:null},input),null);
 assert.equal(linkedFinancialScenario(base,{...input,advertisingChangePct:-101}),null);
 assert.equal(linkedFinancialScenario(base,{...input,contributionChangePct:Infinity}),null);
 assert.equal(linkedFinancialScenario(base,{...input,extraOverheads:-1}),null);
 assert.equal(linkedFinancialScenario(base,{...input,extraOverheads:NaN}),null);
 assert.equal(linkedFinancialScenario(base,{...input,extraOverheads:Number.MAX_SAFE_INTEGER}),null);
});
