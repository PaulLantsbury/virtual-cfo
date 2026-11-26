import test from 'node:test';
import assert from 'node:assert/strict';
import {HISTORY_EDITION,type HistorySelection} from './v11/history-supported.ts';
import {reviewedSeriesSelections,readReviewedSeries} from './reviewedHistorySeries.ts';
const selection:HistorySelection={storeId:'profit-business',currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor:'2024-11-01',versionId:'profit-review',period:{from:'2025-01-01',to:'2025-01-31'}};
function response(){const scope={storeId:selection.storeId,currency:'GBP',from:selection.period.from,to:selection.period.to};return {state:'supported',versionId:selection.versionId,contract:'history-v2-proposal',scope,snapshotId:selection.versionId,salesRevision:'sales-1',costRevision:'cost-1',metadata:{versionId:selection.versionId,edition:HISTORY_EDITION,anchor:selection.anchor,sourceAsOf:'2025-02-01T00:00:00Z',observedAt:'2026-11-20T10:00:00Z',formulaVersion:'night-scout-v11-2026-10-30',sourceBasis:'synthetic-local',verification:'canonical-source-revision-only'},sales:{grossProductSales:12000,discounts:2000,netProductSales:9000,netShipping:500,originalOrders:10,aov:{value:1000,reason:null},provenance:scope},components:{cogs:4500,variableCosts:1000,advertising:500,overheadIncludingDA:2000,depreciationAmortisation:100},profit:{state:'complete',grossProfit:4500,contributionBeforeMarketing:4000,contribution:3500,ebitda:1600}};}

const dec={...selection,versionId:'dec',period:{from:'2024-12-01',to:'2024-12-31'}};
const inventory=[{...dec.period,snapshotId:'dec',versions:[{versionId:'dec',status:'selected' as const,kind:'base' as const}]},{...selection.period,snapshotId:selection.versionId,versions:[{versionId:selection.versionId,status:'selected' as const,kind:'base' as const}]}];
test('plans only contiguous selected versions ending at explicitly chosen month',()=>{
 assert.deepEqual(reviewedSeriesSelections(inventory,selection).map(s=>s.versionId),['dec',selection.versionId]);
 assert.deepEqual(reviewedSeriesSelections(inventory,{...selection,versionId:'withdrawn'}),[]);
 assert.deepEqual(reviewedSeriesSelections(inventory,selection,24),[]);
 assert.deepEqual(reviewedSeriesSelections([inventory[0],{...inventory[1],from:'2025-02-01',to:'2025-02-28'}],{...selection,period:{from:'2025-02-01',to:'2025-02-28'}}),[]);
 assert.deepEqual(reviewedSeriesSelections([{...inventory[0],versions:[...inventory[0].versions,{versionId:'ambiguous',status:'selected',kind:'base'}]},inventory[1]],selection),[]);
});
function source(s:HistorySelection){const r=response();r.versionId=s.versionId;r.snapshotId=s.versionId;r.metadata.versionId=s.versionId;r.scope.from=s.period.from;r.scope.to=s.period.to;r.metadata.sourceAsOf=s.period.from==='2024-12-01'?'2025-01-01T00:00:00Z':'2025-02-01T00:00:00Z';return r;}
test('reads sequentially and retains each validated version',async()=>{
 let active=0,max=0;
 const points=await readReviewedSeries([dec,selection],async s=>{active++;max=Math.max(max,active);await Promise.resolve();active--;return source(s);},new AbortController().signal);
 assert.equal(max,1);assert.deepEqual(points.map(m=>m.evidence.versionId),['dec',selection.versionId]);
});
test('a failed or cross-company month rejects the entire series without partial success',async()=>{
 await assert.rejects(readReviewedSeries([dec,selection],async s=>{const r=source(s);if(s.versionId===selection.versionId)r.scope.storeId='other';return r;},new AbortController().signal));
 await assert.rejects(readReviewedSeries([dec,selection],async()=>{throw Error('not authorised');},new AbortController().signal));
});
test('cancellation prevents subsequent database reads',async()=>{
 const controller=new AbortController();let reads=0;
 await assert.rejects(readReviewedSeries([dec,selection],async s=>{reads++;controller.abort();return source(s);},controller.signal));assert.equal(reads,1);
});

test('earlier months use declared authoritative head without changing the explicit ending selection',()=>{
 const corrected={...inventory[0],snapshotId:'correction',versionId:'correction',versions:[...inventory[0].versions,{versionId:'correction',status:'selected' as const,kind:'expense-correction' as const}]};
 assert.deepEqual(reviewedSeriesSelections([corrected,inventory[1]],selection).map(s=>s.versionId),['correction',selection.versionId]);
 assert.deepEqual(reviewedSeriesSelections([{...corrected,versions:[inventory[0].versions[0],{...corrected.versions[1],status:'invalidated' as const}]},inventory[1]],selection),[]);
 assert.deepEqual(reviewedSeriesSelections([corrected,inventory[1]],{...selection,versionId:'withdrawn'}),[]);
});
