import test from 'node:test';
import assert from 'node:assert/strict';
import {composeHistoryMonth} from './v11/history-composition.ts';
import {HISTORY_EDITION,type HistorySelection} from './v11/history-supported.ts';
import {newProfitLiveTotals} from './newProfitLiveModel.ts';
import {amount,sankeyFlows} from './newProfitPreview.ts';
const selection:HistorySelection={storeId:'profit-business',currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor:'2024-11-01',versionId:'profit-review',period:{from:'2025-01-01',to:'2025-01-31'}};
function response(){const scope={storeId:selection.storeId,currency:'GBP',from:selection.period.from,to:selection.period.to};return {state:'supported',versionId:selection.versionId,contract:'history-v2-proposal',scope,snapshotId:selection.versionId,salesRevision:'sales-1',costRevision:'cost-1',metadata:{versionId:selection.versionId,edition:HISTORY_EDITION,anchor:selection.anchor,sourceAsOf:'2025-02-01T00:00:00Z',observedAt:'2026-11-20T10:00:00Z',formulaVersion:'night-scout-v11-2026-10-30',sourceBasis:'synthetic-local',verification:'canonical-source-revision-only'},sales:{grossProductSales:12000,discounts:2000,netProductSales:9000,netShipping:500,originalOrders:10,aov:{value:1000,reason:null},provenance:scope},components:{cogs:4500,variableCosts:1000,advertising:500,overheadIncludingDA:2000,depreciationAmortisation:100},profit:{state:'complete',grossProfit:4500,contributionBeforeMarketing:4000,contribution:3500,ebitda:1600}};}
test('linked profit uses exact verified components; Sankey and per-order values reconcile',()=>{const t=newProfitLiveTotals(composeHistoryMonth(response(),selection))!;assert.equal(t.reversals,1000);assert.equal(t.cashOverheads,1900);assert.equal(t.ebitda,1600);assert.equal(t.operatingProfit,1500);assert.equal(amount(t,'ebitda',true),160);const sankey=sankeyFlows(t,false);assert.equal(sankey.state,'ready');if(sankey.state==='ready')assert.equal(sankey.uses.reduce((s,f)=>s+f.amount,0),9500);});
test('missing or cross-business evidence never falls back to synthetic preview figures',()=>{assert.equal(newProfitLiveTotals(null),null);assert.equal(newProfitLiveTotals(composeHistoryMonth(response(),{...selection,storeId:'other'})),null);const raw=response();delete (raw as any).components;const month=composeHistoryMonth(raw,selection)!;assert.equal(month.amounts.netProductSales,9000);assert.equal(newProfitLiveTotals(month),null);});
test('inconsistent stored subtotals or unavailable costs cannot become a linked Sankey',()=>{const raw=response();raw.profit.ebitda++;assert.equal(newProfitLiveTotals(composeHistoryMonth(raw,selection)),null);const copy=structuredClone(composeHistoryMonth(response(),selection)!);copy.input.profit!.cogs={state:'unavailable',value:null,reason:'Missing cost'};assert.equal(newProfitLiveTotals(copy),null);});
test('zero orders suppress per-order amounts rather than divide by zero',()=>{const raw=response();raw.sales.originalOrders=0;raw.sales.aov={value:null as any,reason:'No original orders'};const t=newProfitLiveTotals(composeHistoryMonth(raw,selection))!;assert.ok(t);assert.equal(amount(t,'ebitda',true),null);assert.equal(amount(t,'ebitda',false),1600);});

import {newProfitLinkedAmounts} from './newProfitLiveModel.ts';
test('a missing cost withholds unsupported profit but retains verified sales and original orders',()=>{const raw=response();delete (raw as any).components;const partial=newProfitLinkedAmounts(composeHistoryMonth(raw,selection));assert.equal(partial.sales,9000);assert.equal(partial.orders,10);assert.equal(partial.ebitda,null);assert.equal(partial.advertising,null);});

import {newProfitLiveBridge} from './newProfitLiveModel.ts';
test('linked change bridge requires separately verified scopes and reconciles total and per-order changes',()=>{const current=composeHistoryMonth(response(),selection)!;const priorSelection={...selection,versionId:'other-month',period:{from:'2024-12-01',to:'2024-12-31'}};const prior=response();prior.scope.from=priorSelection.period.from;prior.scope.to=priorSelection.period.to;prior.versionId=priorSelection.versionId;prior.snapshotId=priorSelection.versionId;prior.metadata.versionId=priorSelection.versionId;prior.metadata.sourceAsOf='2025-01-01T00:00:00Z';prior.sales.originalOrders=20;const comparison=composeHistoryMonth(prior,priorSelection)!;const total=newProfitLiveBridge(current,comparison,false);assert.equal(total[0].end,1600);assert.equal(total.at(-1)?.end,1600);const perOrder=newProfitLiveBridge(current,comparison,true);assert.equal(perOrder[0].end,80);assert.equal(perOrder.at(-1)?.end,160);assert.equal(perOrder.filter(s=>!s.subtotal).reduce((sum,s)=>sum+s.amount,80),160);assert.deepEqual(newProfitLiveBridge(current,current,false),[]);assert.deepEqual(newProfitLiveBridge(current,null,false),[]);const other=structuredClone(comparison);other.selection.storeId='other-business';assert.deepEqual(newProfitLiveBridge(current,other,false),[]);});

test('rejected profit components cannot be displayed as linked cost evidence',()=>{
 const raw=response();raw.profit.contributionBeforeMarketing++;
 const partial=newProfitLinkedAmounts(composeHistoryMonth(raw,selection));
 assert.equal(partial.sales,9000);assert.equal(partial.advertising,null);assert.equal(partial.cashOverheads,null);assert.equal(partial.ebitda,null);
});
test('partial subtraction cannot turn unsafe cost differences into linked amounts',()=>{
 const month=structuredClone(composeHistoryMonth(response(),selection)!);
 month.input.profit!.overheads.value=Number.MAX_SAFE_INTEGER;month.input.profit!.da.value=-Number.MAX_SAFE_INTEGER;
 assert.equal(newProfitLinkedAmounts(month).cashOverheads,null);
});
