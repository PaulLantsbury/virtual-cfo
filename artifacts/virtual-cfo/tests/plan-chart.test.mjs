import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMarketingReview,sampleTotals,metrics} from '../src/lib/marketing/review-model.ts';
import {futureDefaults,projectFuture} from '../src/lib/planning/future-plan.ts';
import {futureChartRows} from '../src/lib/planning/plan-chart.ts';
const base=buildMarketingReview({granularity:'monthly',horizon:3,comparison:'last-year'}).baseline30;
const defaults=futureDefaults(base),today='2026-11-20';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('all three series compare the same future months, with no historical or gap buckets',()=>{
 for(const months of [3,6,12]){
  const projection=projectFuture(base,{...defaults,months,conversion:10},today),rows=futureChartRows(projection);
  assert.equal(rows.length,months);assert.equal(rows[0].from,'2026-12-01');assert.equal(rows[0].previousFrom,'2025-12-01');assert.equal(rows[0].previousTo,'2025-12-31');
  rows.forEach((r,j)=>{assert.equal(r.from,projection.rows[j].from);assert.ok(Number.isFinite(r.plan));assert.ok(Number.isFinite(r.baseline));close(r.plan,projection.rows[j].ebitda);close(r.baseline,projection.rows[j].baseline);});
 }
});
test('3 and 6 month comparisons have complete matched prior-year sample actuals',()=>{
 for(const months of [3,6])for(const perOrder of [false,true]){
  const p=projectFuture(base,{...defaults,months},today),rows=futureChartRows(p,perOrder);
  rows.forEach(r=>{const actual=sampleTotals(r.previousFrom,r.previousTo);assert.notEqual(r.priorActual,null);close(r.priorActual,metrics(actual).ebitda/(perOrder?actual.orders:1));});
 }
});
test('twelve-month comparator does not invent actuals for partial October or missing November',()=>{
 const p=projectFuture(base,{...defaults,months:12},today),rows=futureChartRows(p);
 assert.equal(rows.filter(r=>r.priorActual!==null).length,10);
 assert.deepEqual(rows.filter(r=>r.priorActual===null).map(r=>r.previousFrom),['2026-10-01','2026-11-01']);
 assert.ok(rows.every(r=>Number.isFinite(r.plan)&&Number.isFinite(r.baseline)));
});
test('prior-year February uses its actual calendar length, including leap years',()=>{
 let calls=[];
 const p=projectFuture(base,defaults,'2025-01-20');
 futureChartRows(p,false,null,(from,to)=>{calls.push([from,to]);return {...base,days:(Date.parse(to)-Date.parse(from))/86400000+1};});
 assert.deepEqual(calls[0],['2024-02-01','2024-02-29']);
});
test('unchanged plan coincides with baseline; per-order paths and target keep own denominators',()=>{
 const p=projectFuture(base,defaults,today),same=futureChartRows(p);
 same.forEach(r=>close(r.plan,r.baseline));
 const changed=projectFuture(base,{...defaults,repeat:10},today),rows=futureChartRows(changed,true,15000);
 rows.forEach((r,j)=>{close(r.plan,changed.rows[j].ebitda/changed.rows[j].orders);close(r.baseline,changed.rows[j].baseline/changed.rows[j].baselineOrders);close(r.goal,15000/changed.rows[j].orders);});
});
test('missing, partial, nonfinite and zero-order per-order actuals remain unavailable',()=>{
 const p=projectFuture(base,defaults,today);
 for(const read of [()=>{throw Error('missing');},()=>({...base,days:1}),()=>({...base,days:31,overheads:NaN}),()=>({...base,days:31,orders:0})])assert.equal(futureChartRows(p,true,null,read)[0].priorActual,null);
 for(const target of [null,NaN,-1])assert.equal(futureChartRows(p,false,target)[0].goal,null);
});
