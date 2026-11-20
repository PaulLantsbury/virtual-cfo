import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateDays, DAILY_SAMPLE } from '../src/lib/newProfitPreview.ts';
import { buildMarketingReview, metrics, requirements, spendScenario, scenarioBridge, recommendation, performanceStatus } from '../src/lib/marketing/review-model.ts';
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-6, `${a} ≠ ${b}`);
const model = buildMarketingReview({granularity:'monthly',horizon:3,comparison:'last-year'});
const base = model.baseline30;
const input = {direction:'hold',changePct:20,elasticity:.35,extraOverheads:0};
test('all supported periods and granularities have complete, scoped chart buckets',()=>{
 for(const granularity of ['weekly','monthly'])for(const horizon of ['last-week','last-month',3,6,12]){
  const m=buildMarketingReview({granularity,horizon,comparison:'last-year'});
  assert.equal(m.rows[0].from,m.from);assert.equal(m.rows.at(-1).to,m.to);assert.equal(m.rows.length,m.selectedCount);
  near(m.rows.reduce((s,r)=>s+r.totals.advertising,0),m.current.advertising);
  near(m.rows.reduce((s,r)=>s+r.totals.customers,0),m.current.customers);
  assert.ok(m.rows.every(r=>r.compareCac!==null&&r.comparePoas!==null));
 }
});
test('financial totals reconcile to Profit Engine and exclude D&A from EBITDA overheads',()=>{
 const p=aggregateDays(DAILY_SAMPLE.filter(d=>d.date>=model.from&&d.date<=model.to));
 near(model.current.overheads,p.cashOverheads/100);near(metrics(model.current).ebitda,p.ebitda/100);
 near(model.current.revenue,(p.sales+p.shipping)/100);
});
test('ratios use weighted matched amounts, not mean bucket ratios',()=>{
 const t=model.current,m=metrics(t);
 near(m.cac,t.acquisitionSpend/t.customers);near(m.poas,t.beforeAds/t.advertising);
 const weighted=model.rows.reduce((s,r)=>s+r.cac*r.totals.customers,0)/t.customers;
 near(m.cac,weighted);
});
test('rolling comparison uses the preceding benchmark and None removes comparison',()=>{
 const r=buildMarketingReview({granularity:'weekly',horizon:3,comparison:'rolling'});
 assert.ok(r.referenceTo<r.from);assert.equal(r.rows.length,13);
 assert.ok(r.rows.every(row=>row.compareCac===r.rows[0].compareCac));
 const n=buildMarketingReview({granularity:'monthly',horizon:6,comparison:'none'});
 assert.equal(n.previous,null);assert.equal(n.referenceFrom,null);assert.ok(n.rows.every(r=>r.compareCac===null&&r.comparePoas===null));
 assert.match(recommendation(n.current,n.previous,n.baseline30,.35).efficiency,/Select a comparison/);
});
test('30-day baseline uses weighted daily rates from latest selected buckets',()=>{
 const rows=model.rows.slice(-3);const weights=rows.reduce((s,_,i)=>s+i+1,0);
 const expected=rows.reduce((s,r,i)=>s+r.totals.advertising/r.totals.days*(i+1),0)/weights*30;
 near(base.advertising,expected);assert.equal(base.days,30);
 const single=buildMarketingReview({granularity:'weekly',horizon:'last-week',comparison:'none'});
 near(single.baseline30.overheads,single.current.overheads/7*30);
});
test('break-even and target EBITDA reconcile; indicative CAC holds other ads fixed',()=>{
 const t={revenue:100000,beforeAds:40000,advertising:20000,acquisitionSpend:16000,overheads:15000,da:500,orders:2000,customers:1000,firstContributionTotal:20000,firstRevenueTotal:50000,days:30};
 const r=requirements(t,8000);
 assert.equal(r.breakEven.budget,25000);assert.equal(r.breakEven.cac,21);assert.equal(r.breakEven.poas,1.6);assert.equal(r.breakEven.roas,4);
 assert.equal(r.target.budget,17000);assert.equal(r.target.cac,13);near(r.target.poas,40000/17000);near(r.target.roas,100000/17000);
 assert.equal(r.target.contribution,23000);assert.equal(metrics(t).ebitda,5000);
});
test('missing, impossible and zero targets do not create misleading return thresholds',()=>{
 const none=requirements(base,null);assert.equal(none.target,null);
 assert.equal(requirements(base,-1),null);assert.equal(requirements(base,NaN),null);
 const r=requirements({...base,overheads:base.beforeAds+1},100);
 assert.equal(r.breakEven.poas,null);assert.equal(r.breakEven.cac,null);assert.equal(r.target.roas,null);
 const exact=requirements({...base,overheads:base.beforeAds},0);assert.equal(exact.breakEven.budget,0);assert.equal(exact.breakEven.poas,null);
});
test('Hold is identity and extra fixed costs reduce EBITDA exactly once',()=>{
 const r=spendScenario(base,input);near(r.ebitda,metrics(base).ebitda);near(r.newOrders,0);near(r.delta,0);
 const cost=spendScenario(base,{...input,extraOverheads:1000});near(cost.delta,-1000);
});
test('higher spend raises average CAC and customers; reductions lower both under the stated response',()=>{
 const up=spendScenario(base,{...input,direction:'scale'}),down=spendScenario(base,{...input,direction:'reduce'});
 assert.ok(up.cac>metrics(base).cac);assert.ok(up.totals.customers>base.customers);
 assert.ok(down.cac<metrics(base).cac);assert.ok(down.totals.customers<base.customers);
 near(up.totals.advertising-up.totals.acquisitionSpend,base.advertising-base.acquisitionSpend);
 near(up.delta,up.volumeContribution-up.adChange);
});
test('zero sensitivity gives constant CAC and the response supports diminishing returns',()=>{
 const r=spendScenario(base,{...input,direction:'scale',elasticity:0});near(r.cac,metrics(base).cac);near(r.totals.customers,base.customers*1.2);
 const low=spendScenario(base,{...input,direction:'scale',elasticity:.1}),high=spendScenario(base,{...input,direction:'scale',elasticity:.7});
 assert.ok(high.totals.customers<low.totals.customers);assert.ok(high.marginalCac>high.cac);
});
test('scenario financial bridge reconciles on total and each scenario’s own per-order basis',()=>{
 for(const direction of ['hold','scale','reduce'])for(const perOrder of [false,true]){
 const s=spendScenario(base,{...input,direction,changePct:35,extraOverheads:750});const rows=scenarioBridge(base,s,perOrder);
 near(rows.at(-1).end,perOrder?s.ebitda/s.totals.orders:s.ebitda);
 near(rows[0].end+rows.filter(r=>!r.total).reduce((a,r)=>a+r.amount,0),rows.at(-1).end);
 }
});
test('invalid scenario controls fail closed without financial output',()=>{
 for(const patch of [{elasticity:1},{changePct:90},{extraOverheads:-1},{extraOverheads:NaN},{direction:'bad'}])assert.equal(spendScenario(base,{...input,...patch}),null);
});

test('performance colours respect metric direction, equal benchmarks and missing evidence',()=>{
 assert.equal(performanceStatus(40,35,true),'bad'); // Higher CAC is worse.
 assert.equal(performanceStatus(30,35,true),'good');
 assert.equal(performanceStatus(2,1.5),'good'); // Higher POAS is better.
 assert.equal(performanceStatus(1,1.5),'bad');
 assert.equal(performanceStatus(0,0),'equal');
 for(const missing of [null,NaN,Infinity]){
  assert.equal(performanceStatus(missing,0),'unknown');
  assert.equal(performanceStatus(0,missing),'unknown');
 }
 // The business can cover costs while missing its target and deteriorating.
 assert.equal(performanceStatus(160,123),'good');
 assert.equal(performanceStatus(160,169),'bad');
 assert.equal(performanceStatus(160,200),'bad');
});
