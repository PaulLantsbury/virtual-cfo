import test from 'node:test';
import assert from 'node:assert/strict';
import { linkedMarketingMetrics } from './linked-model.ts';
import { composeHistoryMonth } from '../v11/history-composition.ts';
import { HISTORY_EDITION, type HistorySelection } from '../v11/history-supported.ts';
const selection:HistorySelection={storeId:'marketing-test',currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor:'2024-11-01',versionId:'marketing-version',period:{from:'2025-01-01',to:'2025-01-31'}};
function response(){const scope={storeId:selection.storeId,currency:'GBP',from:selection.period.from,to:selection.period.to};return {state:'supported',versionId:selection.versionId,contract:'history-v2-proposal',scope,snapshotId:selection.versionId,salesRevision:'sales-revision',costRevision:'cost-revision',metadata:{versionId:selection.versionId,edition:HISTORY_EDITION,anchor:selection.anchor,sourceAsOf:'2025-02-01T00:00:00Z',observedAt:'2026-11-20T12:00:00Z',formulaVersion:'night-scout-v11-2026-10-30',sourceBasis:'synthetic-local',verification:'canonical-source-revision-only'},sales:{grossProductSales:12000,discounts:2000,netProductSales:9000,netShipping:500,originalOrders:10,aov:{value:1000,reason:null},provenance:scope},components:{cogs:4500,variableCosts:1000,advertising:500,overheadIncludingDA:2000,depreciationAmortisation:100},profit:{state:'complete',grossProfit:4500,contributionBeforeMarketing:4000,contribution:3500,ebitda:1600}};}
test('linked marketing uses matched verified financial amounts, excludes D&A once and never manufactures CAC',()=>{
 const result=linkedMarketingMetrics(composeHistoryMonth(response(),selection))!;
 assert.equal(result.revenue,9500);assert.equal(result.beforeAds,4000);assert.equal(result.advertising,500);
 assert.equal(result.overheads,1900);assert.equal(result.contribution,3500);assert.equal(result.ebitda,1600);
 assert.equal(result.poas,8);assert.equal(result.roas,19);assert.equal(result.contributionPerOrder,350);
 assert.equal(result.advertisingCapacity,2100);assert.equal(result.breakEvenPoas,4000/2100);
 assert.equal(result.cac,null);assert.equal(result.firstOrderContribution,null);assert.equal(result.maturePaybackDays,null);
});
test('zero advertising and zero orders are unavailable denominators, never infinity or zero substitute',()=>{
 const raw=response();raw.components.advertising=0;raw.profit.contribution=4000;raw.profit.ebitda=2100;raw.sales.originalOrders=0;
 const result=linkedMarketingMetrics(composeHistoryMonth(raw,selection))!;
 assert.equal(result.advertising,0);assert.equal(result.poas,null);assert.equal(result.roas,null);assert.equal(result.contributionPerOrder,null);
});
test('missing or cross-store evidence never becomes a fictional marketing result',()=>{
 assert.equal(linkedMarketingMetrics(null),null);
 assert.equal(linkedMarketingMetrics(composeHistoryMonth(response(),{...selection,storeId:'other-company'})),null);
 const raw=response();delete (raw as any).components;
 const result=linkedMarketingMetrics(composeHistoryMonth(raw,selection))!;
 assert.equal(result.revenue,9500);assert.equal(result.advertising,null);assert.equal(result.poas,null);assert.equal(result.ebitda,null);
});
test('conflicting reported profit cannot escape the shared reconciliation guard through marketing ratios',()=>{
 const raw=response();raw.profit.contributionBeforeMarketing=999999;
 const result=linkedMarketingMetrics(composeHistoryMonth(raw,selection))!;
 assert.equal(result.revenue,9500);assert.equal(result.beforeAds,null);assert.equal(result.advertising,null);assert.equal(result.overheads,null);assert.equal(result.poas,null);assert.equal(result.ebitda,null);
});
