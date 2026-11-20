import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGrowthReview,behaviourSample,behaviourMetrics,growthTab,MATURE_COHORT,cohortMature} from '../src/lib/marketing/growth-review.ts';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('behaviour counts and money reconcile to the same complete financial sample',()=>{
 for(const months of [3,6,12])for(const comparison of ['last-year','rolling','none']){
  const r=buildGrowthReview(months,comparison),t=r.current;
  close(t.orders,r.marketing.current.orders);close(t.newCustomers,r.marketing.current.customers);close(t.newCustomers+t.repeatOrders,t.orders);
  close(t.netProductSales,r.profit.current.sales/100);close(t.newRevenue+t.repeatRevenue,t.netProductSales);
  close(r.metrics.aov,(r.profit.current.gross-r.profit.current.discounts)/100/t.orders);
  for(const row of r.rows){const b=row.behaviour;assert.ok(b.sessions>=b.cartSessions&&b.cartSessions>=b.checkoutSessions&&b.checkoutSessions>=b.purchaseSessions);assert.ok(b.orders>=b.purchaseSessions);close(b.newRevenue+b.repeatRevenue,b.netProductSales);}
 }
});
test('conversion uses purchasing sessions rather than order counts; AOV excludes refunds and shipping',()=>{
 const r=buildGrowthReview(3,'last-year'),b=r.current;
 close(r.metrics.conversion,b.purchaseSessions/b.sessions);assert.notEqual(r.metrics.conversion,b.orders/b.sessions);
 assert.notEqual(r.metrics.aov,r.marketing.current.revenue/b.orders);assert.notEqual(r.metrics.aov,b.netProductSales/b.orders);
});
test('ratio aggregates use matched summed denominators, not averages of monthly ratios',()=>{
 const r=buildGrowthReview(6,'last-year');close(r.metrics.conversion,r.rows.reduce((s,r)=>s+r.behaviour.purchaseSessions,0)/r.rows.reduce((s,r)=>s+r.behaviour.sessions,0));
 close(r.current.newRevenue,r.rows.reduce((s,r)=>s+r.behaviour.newRevenue,0));
});
test('None removes behavioural comparisons; rolling reference is clearly scaled not fabricated activity',()=>{
 const none=buildGrowthReview(3,'none');assert.equal(none.previous,null);assert.ok(none.rows.every(r=>r.previousBehaviour===null&&r.previousMetrics===null));
 const rolling=buildGrowthReview(12,'rolling'),pool=behaviourSample(rolling.marketing.benchmarkFrom,rolling.marketing.benchmarkTo);
 close(rolling.previous.newRevenue,pool.newRevenue*4);close(rolling.previous.orders,pool.orders*4);close(rolling.previousMetrics.conversion,behaviourMetrics(pool).conversion);
});
test('zero or nonfinite denominators are unavailable and incomplete date windows are rejected',()=>{
 const b=behaviourSample('2026-07-01','2026-07-31');const z=behaviourMetrics({...b,sessions:0,checkoutSessions:0,orders:0,netProductSales:0});
 assert.equal(z.conversion,null);assert.equal(z.checkoutCompletion,null);assert.equal(z.aov,null);assert.equal(z.repeatRevenueShare,null);
 assert.throws(()=>behaviourSample('2026-10-01','2026-10-31'));
});
test('mature contribution payback has a separate window and does not grant maturity to current cohorts',()=>{
 assert.equal(cohortMature(MATURE_COHORT.to,MATURE_COHORT.observedThrough),true);assert.equal(cohortMature('2026-09-30',MATURE_COHORT.observedThrough),false);
 close(MATURE_COHORT.curve.find(p=>p.day===55).contribution,MATURE_COHORT.cac);close(MATURE_COHORT.grossProfit90/MATURE_COHORT.cac,2.25);
 assert.notEqual(MATURE_COHORT.grossProfit90,MATURE_COHORT.contribution90);
});
test('tab query permits only the three specialist views',()=>{
 assert.equal(growthTab('?tab=conversion'),'conversion');assert.equal(growthTab('?tab=retention'),'retention');assert.equal(growthTab('?tab=anything'),'acquisition');
});
