import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { historySupportedInput, HISTORY_EDITION, type HistorySelection } from '../v11/history-supported.ts';
import { supportedSlice } from '../v11/supported-slice.ts';
const require = createRequire(import.meta.url);
// Use the existing Vite toolchain; no browser, credentials or hosted requests.
const { build } = createRequire(require.resolve('vite'))('esbuild');
const compiled = await build({stdin:{contents:`import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {HistorySupportedPanel} from './src/pages/v11/history-supported-panel'; import {SupportedReportingSlice} from './src/pages/v11/supported-evidence-panel'; export const renderShared = props => renderToStaticMarkup(React.createElement(SupportedReportingSlice,props)); export const render = props => renderToStaticMarkup(React.createElement(HistorySupportedPanel,{...props,onMonthChange:()=>{},onRetry:()=>{}}));`,resolveDir:fileURLToPath(new URL('../../../',import.meta.url)),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',loader:{'.css':'empty'}});
const exported:{exports:any}={exports:{}};
new Function('require','module','exports',compiled.outputFiles[0].text)(require,exported,exported.exports);
const render=exported.exports.render;
const selection:HistorySelection={storeId:'test-history',currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor:'2024-11-01',versionId:'reviewed-jan',period:{from:'2025-01-01',to:'2025-01-31'}};
const scope={storeId:selection.storeId,currency:'GBP',from:selection.period.from,to:selection.period.to};
const raw={state:'supported',versionId:selection.versionId,contract:'history-v2-proposal',scope,snapshotId:selection.versionId,salesRevision:'sales-revision',costRevision:'cost-revision',metadata:{versionId:selection.versionId,edition:HISTORY_EDITION,anchor:selection.anchor,sourceAsOf:'2025-02-01T00:00:00Z',observedAt:'2026-11-05T10:00:00Z',formulaVersion:'night-scout-v11-2026-10-30',sourceBasis:'synthetic-local',verification:'canonical-source-revision-only'},sales:{grossProductSales:12000,discounts:2000,netProductSales:9000,netShipping:500,originalOrders:10,aov:{value:1000,reason:null},provenance:scope},components:{cogs:4500,variableCosts:1000,advertising:500,overheadIncludingDA:2000,depreciationAmortisation:100},profit:{state:'complete',grossProfit:4500,contributionBeforeMarketing:4000,contribution:3500,ebitda:1600}};
const availability={contract:'history-availability-v2',verification:'sealed-candidates-only',requiresReadValidation:true,...selection,months:[{...selection.period,snapshotId:selection.versionId,versionId:selection.versionId}]};
test('rendered request states keep Explore visible and withhold cached money; failure exposes retry',()=>{
 for(const state of [{loading:true},{error:'denied'},{error:'unavailable'},{invalidated:true},{selection:{...selection,versionId:''}}]){
  const html=render({selection,response:raw,availability,...state});
  assert.match(html,/Explore the Numbers/);assert.doesNotMatch(html,/£90\.00|£16\.00|Monthly sales and profit composition/);
  if(state.error==='unavailable') {assert.match(html,/Checking the selected evidence failed/);assert.match(html,/Retry evidence check/);}
 }
});
test('rendered cards, factual conclusion and chart table retain the exact selected month and evidence',()=>{
 const html=render({selection,response:raw,availability});
 for(const text of ['Selected-period EBITDA: £16.00.','£90.00','£15.00','2025-01-01','2025-01-31','2025-02-01T00:00:00Z','reviewed-jan','sales-revision','cost-revision','Per original eligible order','Monthly sales and profit composition']) assert.ok(html.includes(text),text);
 assert.match(html,/role="region"/);assert.match(html,/tabindex="0"/);assert.match(html,/Explore the Numbers/);
 const malformed=structuredClone(raw);malformed.sales.originalOrders=-1;
 const withheld=render({selection,response:malformed,availability});assert.match(withheld,/selected evidence is unavailable/);assert.doesNotMatch(withheld,/£90\.00/);
});

test('unselected instructions distinguish month and version, and a foreign prepared result cannot repaint cards',()=>{
 assert.match(render({selection:{...selection,period:{from:'',to:''},versionId:''},response:null,availability}),/Choose a reviewed month first/);
 assert.match(render({selection:{...selection,versionId:''},response:null,availability}),/Choose an evidence version for the selected month/);
 const current=historySupportedInput(raw,selection),foreign=structuredClone(supportedSlice(current));
 foreign.primary.context!.businessId='other-business';foreign.metrics[0].valuePence=1;
 const html=exported.exports.renderShared({current,preparedView:foreign});
 assert.match(html,/£90\.00/);assert.doesNotMatch(html,/£0\.01|other-business/);
});
