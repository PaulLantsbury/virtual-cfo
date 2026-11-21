import test from 'node:test';
import assert from 'node:assert/strict';
import { supportedSlice } from '../v11/supported-slice.ts';
import type { ReportingAdapterInput } from '../v11/reporting-adapter.ts';
const make = (from = '2026-09-01', to = '2026-09-30'): ReportingAdapterInput => ({
 expected:{storeId:'test-business',currency:'GBP',timezone:'Europe/London',period:{from,to}},
 access:'allowed',freshness:'current',snapshot:{id:'test-version',asOf:'2026-10-01T00:00:00Z'},profit:null,
 sales:{grossProductSales:12000,discounts:2000,netProductSales:9000,netShipping:500,originalOrders:10,aov:{value:1000,reason:null},provenance:{storeId:'test-business',currency:'GBP',from,to,coverageEvidence:'test-coverage'}}
});
test('supported sales survive missing costs; evidence and cards share exact amounts',()=>{
 const view=supportedSlice(make());assert.equal(view.metrics[0].valuePence,9000);assert.equal(view.metrics[3].valuePence,null);assert.equal(view.primary.state,'partial');
});
test('missing canonical metadata and wrong business never acquire fixture values',()=>{
 const missing=make();missing.snapshot=null;assert.equal(supportedSlice(missing).metrics[0].valuePence,null);
 const cross=make();cross.sales!.provenance.storeId='other';assert.equal(supportedSlice(cross).primary.context,null);
});
test('comparison scope must match requested business dates and mode',()=>{
 const period={from:'2026-08-01',to:'2026-08-31'};const prior=make(period.from,period.to);
 assert.equal(supportedSlice(make(),{period,input:prior}).metrics[0].changePence,0);
 prior.expected.storeId='other';assert.equal(supportedSlice(make(),{period,input:prior}).comparisonAvailable,false);
});
test('retained stale evidence remains inspectable without comparative claims',()=>{
 const current=make();current.freshness='stale';current.retainedScope={storeId:'test-business',currency:'GBP',from:'2026-09-01',to:'2026-09-30'};
 const view=supportedSlice(current,{period:{from:'2026-08-01',to:'2026-08-31'},input:make('2026-08-01','2026-08-31')});
 assert.equal(view.metrics[0].valuePence,9000);assert.equal(view.primary.isRetained,true);assert.equal(view.metrics[0].changePence,null);
});
