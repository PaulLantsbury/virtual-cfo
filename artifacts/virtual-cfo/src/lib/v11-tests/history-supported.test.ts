import test from 'node:test';import assert from 'node:assert/strict';
import {historySupportedInput,historyAvailableMonths,HISTORY_EDITION,type HistorySelection} from '../v11/history-supported.ts';
import {supportedSlice}from'../v11/supported-slice.ts';
const selection:HistorySelection={storeId:'test-history',currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor:'2024-11-01',versionId:'history-test-version',period:{from:'2025-01-01',to:'2025-01-31'}};
function response(){const scope={storeId:selection.storeId,currency:'GBP',from:selection.period.from,to:selection.period.to};return {state:'supported',versionId:'history-test-version',contract:'history-v2-proposal',scope,snapshotId:'history-test-version',salesRevision:'sales-test-revision',costRevision:'cost-test-revision',metadata:{versionId:'history-test-version',edition:HISTORY_EDITION,anchor:selection.anchor,sourceAsOf:'2025-02-01T00:00:00Z',observedAt:'2026-11-05T10:00:00Z',formulaVersion:'night-scout-v11-2026-10-30',sourceBasis:'synthetic-local',verification:'canonical-source-revision-only'},sales:{grossProductSales:12000,discounts:2000,netProductSales:9000,netShipping:500,originalOrders:10,aov:{value:1000,reason:null},provenance:scope},components:{cogs:4500,variableCosts:1000,advertising:500,overheadIncludingDA:2000,depreciationAmortisation:100},profit:{state:'complete',grossProfit:4500,contributionBeforeMarketing:4000,contribution:3500,ebitda:1600}};}
test('exact history edition composes shared cards and evidence with independently stated subtotals',()=>{const view=supportedSlice(historySupportedInput(response(),selection));assert.equal(view.primary.state,'supported');assert.deepEqual(view.metrics.map(m=>m.valuePence),[9000,4500,3500,1600]);assert.equal(view.primary.source,'synthetic-local');assert.equal(view.primary.context?.snapshotAsOf,'2025-02-01T00:00:00Z');});
test('v1, crossbusiness, different opening edition and observed-time substitution fail closed',()=>{for(const mutate of [(r:any)=>r.metadata.versionId='other-version',(r:any)=>r.versionId='other-version',(r:any)=>r.contract='v1',(r:any)=>r.scope.storeId='other',(r:any)=>r.metadata.anchor='2025-01-01',(r:any)=>r.metadata.edition='other',(r:any)=>r.metadata.sourceAsOf=r.metadata.observedAt,(r:any)=>r.metadata.verification='sample']){const r=response();mutate(r);assert.equal(historySupportedInput(r,selection).snapshot,null);}});
test('missing cost components preserve authorised sales without reconstructing profits from reported subtotals',()=>{const r=response();delete (r as any).components;const view=supportedSlice(historySupportedInput(r,selection));assert.equal(view.metrics[0].valuePence,9000);assert.equal(view.metrics[3].valuePence,null);assert.equal(view.primary.state,'partial');});
test('summer London exclusive month end is retained without UTC date shifting',()=>{const selected={...selection,period:{from:'2025-07-01',to:'2025-07-31'}};const r=response();r.scope.from=selected.period.from;r.scope.to=selected.period.to;r.metadata.sourceAsOf='2025-07-31T23:00:00Z';assert.ok(historySupportedInput(r,selected).snapshot);r.metadata.sourceAsOf='2025-08-01T00:00:00Z';assert.equal(historySupportedInput(r,selected).snapshot,null);});
test('month availability binds edition and anchor, never infers ranges or chooses a default',()=>{const a={contract:'history-availability-v2',verification:'sealed-candidates-only',requiresReadValidation:true,...selection,months:[{...selection.period,snapshotId:'history-test-version'}]};assert.equal(historyAvailableMonths(a,selection).length,1);assert.deepEqual(historyAvailableMonths({...a,verification:'financial-ready'},selection),[]);assert.deepEqual(historyAvailableMonths({...a,requiresReadValidation:false},selection),[]);assert.deepEqual(historyAvailableMonths({...a,storeId:'other'},selection),[]);assert.deepEqual(historyAvailableMonths({...a,months:[...a.months,...a.months]},selection),[]);assert.deepEqual(historyAvailableMonths(null,selection),[]);});

import { historyReadState } from '../v11/history-supported.ts';
import { composeHistoryMonth, composeHistorySeries } from '../v11/history-composition.ts';
test('selection lifecycle separates no selection, loading, denial and invalidation without displaying old responses',()=>{
 assert.equal(historyReadState({...selection,versionId:''},response()),'unselected');
 assert.equal(historyReadState(selection,response(),{loading:true}),'loading');
 assert.equal(historyReadState(selection,response(),{error:'denied'}),'denied');
 assert.equal(historyReadState(selection,{state:'invalidated'}),'invalidated');
 assert.equal(historyReadState(selection,{state:'stale'}),'invalidated');
 assert.equal(historyReadState(selection,null),'unavailable');
 assert.equal(historyReadState(selection,response()),'supported');
 const other={...selection,storeId:'other-business'};
 assert.equal(historyReadState(other,response()),'unavailable');
 assert.equal(historyReadState({...selection,versionId:'later-version'},response()),'unavailable');
 assert.equal(historyReadState({...selection,period:{from:'2025-02-01',to:'2025-02-28'}},response()),'unavailable');
});
test('monthly composition uses the same scoped card result, exact original count and independently reconciled operating profit',()=>{
 const month=composeHistoryMonth(response(),selection)!;
 assert.deepEqual(month.amounts,{netProductSales:9000,netShipping:500,turnover:9500,grossProfit:4500,contribution:3500,operatingProfit:1500,ebitda:1600});
 assert.equal(month.originalOrders,10);
 assert.equal(month.view.metrics[0].valuePence,month.amounts.netProductSales);
 assert.equal(month.context.snapshotId,month.evidence.versionId);
 assert.equal(month.evidence.salesRevision,'sales-test-revision');
 assert.equal(month.evidence.financialProfile,'uk-gifts-v2');
 const corrupt=response();corrupt.profit.ebitda++;
 assert.equal(composeHistoryMonth(corrupt,selection)!.amounts.operatingProfit,null);
 assert.equal(composeHistoryMonth(response(),{...selection,storeId:'other'}),null);
});
test('explicit multi-month series sums original-order denominators and amounts, preserving each selected evidence version',()=>{
 const second={...selection,versionId:'feb-version',period:{from:'2025-02-01',to:'2025-02-28'}};
 const feb=response();feb.versionId=second.versionId;feb.snapshotId=second.versionId;feb.metadata.versionId=second.versionId;
 feb.scope.from=second.period.from;feb.scope.to=second.period.to;feb.metadata.sourceAsOf='2025-03-01T00:00:00Z';feb.sales.originalOrders=30;
 const series=composeHistorySeries([{selection,response:response()},{selection:second,response:feb}])!;
 assert.equal(series.originalOrders,40);assert.equal(series.amounts.turnover,19000);
 assert.equal(series.perOrder.netProductSales,450);assert.equal(series.aov,500);
 assert.equal(series.ebitdaMargin,3200/19000);assert.equal(series.operatingMargin,3000/19000);
 assert.notEqual(series.perOrder.netProductSales,(9000/10+9000/30)/2);
 assert.deepEqual(series.months.map(m=>m.evidence.versionId),[selection.versionId,second.versionId]);
 assert.equal(composeHistorySeries([{selection:second,response:feb},{selection,response:response()}]),null);
 assert.equal(composeHistorySeries([{selection,response:response()},{selection,response:response()}]),null);
 assert.equal(composeHistorySeries([{selection,response:response()},{selection:{...second,anchor:'2024-12-01'},response:feb}]),null);
 const larger=structuredClone(feb);
 larger.sales.grossProductSales=24000;larger.sales.discounts=4000;larger.sales.netProductSales=18000;larger.sales.netShipping=1000;
 larger.components={cogs:6000,variableCosts:2000,advertising:500,overheadIncludingDA:4000,depreciationAmortisation:200};
 larger.profit={state:'complete',grossProfit:12000,contributionBeforeMarketing:11000,contribution:10500,ebitda:6700};
 const unequal=composeHistorySeries([{selection,response:response()},{selection:second,response:larger}])!;
 assert.equal(unequal.grossMargin,16500/27000);
 assert.notEqual(unequal.grossMargin,(4500/9000+12000/18000)/2);
 feb.sales.originalOrders=0;
 const zero=composeHistorySeries([{selection:second,response:feb}])!;
 assert.equal(zero.perOrder.ebitda,null);assert.equal(zero.aov,null);
});
test('missing profit evidence remains a chart gap, not zero; invalidated sources never enter series',()=>{
 const raw=response();delete (raw as any).components;
 const month=composeHistoryMonth(raw,selection)!;
 assert.equal(month.amounts.netProductSales,9000);assert.equal(month.amounts.ebitda,null);
 assert.equal(composeHistorySeries([{selection,response:{...response(),state:'invalidated'}}]),null);
});

test('known source-revision change and a withdrawn selected version are invalidation, not no selection',()=>{
 assert.equal(historyReadState(selection,{state:'unavailable',reason:'History evidence changed'}),'invalidated');
 assert.equal(historyReadState({...selection,versionId:''},null,{invalidated:true}),'invalidated');
 assert.equal(historyReadState(selection,{state:'unavailable',reason:'Exact month coverage unavailable'}),'unavailable');
});

import { QueryClient, QueryObserver } from '@tanstack/react-query';
test('delayed query completion cannot replace the active month/version or another business response',async()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
 let releaseOld!:(value:unknown)=>void;
 const oldPromise=new Promise(resolve=>{releaseOld=resolve;});
 const key=(s:HistorySelection)=>['history-report','test-user',s.storeId,s.edition,s.period.from,s.period.to,s.versionId];
 const observer=new QueryObserver(client,{queryKey:key(selection),queryFn:()=>oldPromise,placeholderData:undefined});
 const stop=observer.subscribe(()=>{});
 const next={...selection,storeId:'other-business',versionId:'other-version'};
 const nextResponse=response();nextResponse.scope.storeId=next.storeId;nextResponse.versionId=next.versionId;nextResponse.snapshotId=next.versionId;nextResponse.metadata.versionId=next.versionId;
 observer.setOptions({queryKey:key(next),queryFn:async()=>nextResponse,placeholderData:undefined});
 assert.equal(observer.getCurrentResult().data,undefined);
 await observer.refetch();
 assert.equal(historyReadState(next,observer.getCurrentResult().data),'supported');
 releaseOld(response());
 await oldPromise;await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal((observer.getCurrentResult().data as any).scope.storeId,next.storeId);
 assert.equal(historyReadState(selection,observer.getCurrentResult().data),'unavailable');
 // An explicitly cleared selection cannot reuse the successfully cached previous result.
 assert.equal(historyReadState({...next,versionId:''},observer.getCurrentResult().data),'unselected');
 stop();client.clear();
});

import { historyChoiceEnabled, historyChoiceWithdrawn } from '../v11/history-supported.ts';
test('explicit selections do not survive authenticated identity or business changes; absent versions are withdrawn',()=>{
 const choice={userId:'alice',storeId:selection.storeId,edition:HISTORY_EDITION};
 assert.equal(historyChoiceEnabled(choice,'alice',selection.storeId),true);
 for(const [user,store] of [['bob',selection.storeId],[null,selection.storeId],['alice','other']] as const) assert.equal(historyChoiceEnabled(choice,user,store),false);
 assert.equal(historyChoiceWithdrawn(selection.versionId,[]),true);
 assert.equal(historyChoiceWithdrawn(selection.versionId,[{versionId:selection.versionId,status:'invalidated'}]),true);
 assert.equal(historyChoiceWithdrawn('',[]),false);
 assert.equal(historyChoiceWithdrawn(selection.versionId,[{versionId:selection.versionId,status:'selected'}]),false);
});
test('metadata-valid invalid sales produces an explicit unavailable state, never a blank supported panel',()=>{
 const raw=response();raw.sales.originalOrders=-1;
 assert.ok(historySupportedInput(raw,selection).snapshot);
 assert.equal(composeHistoryMonth(raw,selection),null);
 assert.equal(historyReadState(selection,raw),'unavailable');
});
test('composed money and evidence are immutable snapshots independent of caller/cache mutations',()=>{
 const raw=response(),chosen=structuredClone(selection),month=composeHistoryMonth(raw,chosen)!;
 raw.sales.netProductSales=1;raw.scope.storeId='other';raw.metadata.observedAt='changed';chosen.period.from='2026-01-01';chosen.versionId='other';
 assert.equal(month.amounts.netProductSales,9000);
 assert.equal(month.selection.period.from,'2025-01-01');assert.equal(month.selection.versionId,selection.versionId);
 assert.equal(month.input.sales!.provenance.storeId,selection.storeId);
 assert.equal(month.evidence.observedAt,'2026-11-05T10:00:00Z');
 assert.ok(Object.isFrozen(month));assert.ok(Object.isFrozen(month.input.sales!.provenance));assert.ok(Object.isFrozen(month.selection.period));
 assert.throws(()=>{month.selection.period.from='mutated';},TypeError);
});

test('multi-month sums preserve exact pence through cancellation near safe integer limits',()=>{
 const periods=[{from:'2025-01-01',to:'2025-01-31',asOf:'2025-02-01T00:00:00Z'},{from:'2025-02-01',to:'2025-02-28',asOf:'2025-03-01T00:00:00Z'},{from:'2025-03-01',to:'2025-03-31',asOf:'2025-03-31T23:00:00Z'}];
 const shipping=[Number.MAX_SAFE_INTEGER,2,-Number.MAX_SAFE_INTEGER];
 const entries=periods.map((period,i)=>{
  const selected={...selection,versionId:`version-${i}`,period:{from:period.from,to:period.to}};
  const raw=response();raw.versionId=raw.snapshotId=raw.metadata.versionId=selected.versionId;raw.scope.from=period.from;raw.scope.to=period.to;raw.metadata.sourceAsOf=period.asOf;
  raw.sales.grossProductSales=raw.sales.discounts=raw.sales.netProductSales=0;raw.sales.netShipping=shipping[i];raw.sales.aov.value=0;delete (raw as any).components;
  return {selection:selected,response:raw};
 });
 const series=composeHistorySeries(entries)!;assert.ok(series);assert.equal(series.amounts.netShipping,2);assert.equal(series.amounts.turnover,2);
});
