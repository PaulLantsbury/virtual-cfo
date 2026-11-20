import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMarketingReview} from '../src/lib/marketing/review-model.ts';
import {futureDefaults,projectFuture,zeroLevers,leverImpacts,futureBridge,readFutureDrafts,writeFutureDrafts,FUTURE_VERSION,LEVERS,nextMonth} from '../src/lib/planning/future-plan.ts';
const base=buildMarketingReview({granularity:'monthly',horizon:3,comparison:'last-year'}).baseline30;
const today='2026-11-20',defaults=futureDefaults(base);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('calendar horizon starts next full month with real day counts including leap February',()=>{
 assert.equal(nextMonth(today),'2026-12-01');assert.equal(nextMonth('2026-12-31'),'2027-01-01');
 const p=projectFuture(base,{...defaults,months:12},today);assert.equal(p.rows.length,12);assert.equal(p.rows[0].days,31);assert.equal(p.rows[2].days,28);assert.equal(p.rows.at(-1).from,'2027-11-01');
 assert.equal(projectFuture(base,defaults,'2028-01-20').rows[0].days,29);
});
test('unchanged path is identity each month and on total across 3/6/12 month horizons',()=>{
 for(const months of [3,6,12])for(const trend of [-10,0,10]){const p=projectFuture(base,{...defaults,months,trend},today);p.rows.forEach(r=>{close(r.ebitda,r.baseline);close(r.orders,r.baselineOrders);});close(p.delta,0);close(p.ebitda,p.baseline);}
});
test('CAC reduction creates first orders at fixed spend; effective CAC falls exactly',()=>{
 const p=projectFuture(base,{...defaults,cac:10},today),r=p.rows[0];
 close(r.customers,base.customers*31/30/.9);close(r.cac,base.acquisitionSpend/base.customers*.9);close(r.repeatOrders,(base.orders-base.customers)*31/30);
 close(r.delta,base.firstContributionTotal*31/30*(1/.9-1));
});
test('relative conversion increases both pools without adding another acquisition budget',()=>{
 const p=projectFuture(base,{...defaults,conversion:10},today),r=p.rows[0];close(r.orders,r.baselineOrders*1.1);close(r.advertising,base.advertising*31/30);close(r.delta,base.beforeAds*31/30*.1);
});
test('repeat lever affects existing repeat pool only and has no new-cohort lag invention',()=>{
 const p=projectFuture(base,{...defaults,repeat:10},today),r=p.rows[0];close(r.customers,base.customers*31/30);close(r.repeatOrders,(base.orders-base.customers)*31/30*1.1);close(r.delta,(base.beforeAds-base.firstContributionTotal)*31/30*.1);
 const acquisition=projectFuture(base,{...defaults,cac:10},today);close(acquisition.rows[2].repeatOrders,(base.orders-base.customers)*28/30);
});
test('extra AOV earns only the explicit contribution margin, no pure-profit revenue uplift',()=>{
 for(const aovMargin of [0,50,100]){const p=projectFuture(base,{...defaults,aov:5,aovMargin},today);p.rows.forEach(r=>{close(r.delta,base.revenue*r.days/30*.05*aovMargin/100);close(r.orders,r.baselineOrders);});}
});
test('combined interactions recalculate once and both bridge display units reconcile',()=>{
 const p=projectFuture(base,{...defaults,cac:10,conversion:10,repeat:10,aov:5,costs:.5,overheads:1000,spend:20,ongoing:250,setup:1500},today);
 close(p.delta,p.movements.reduce((s,m)=>s+m.amount,0));close(p.ebitda-p.baseline,p.delta);
 for(const perOrder of [false,true]){const rows=futureBridge(p,perOrder);close(rows[0].end+rows.slice(1,-1).reduce((s,r)=>s+r.amount,0),rows.at(-1).end);close(rows.at(-1).end,perOrder?p.ebitda/p.orders:p.ebitda);}
 const values=Object.fromEntries(LEVERS.map(l=>[l.id,l.value]));const standalone=leverImpacts(base,defaults,today,values).reduce((s,l)=>s+l.delta,0);assert.notEqual(standalone,p.delta);
});
test('delay/ramp controls affect recurring effects; one-off cost charged exactly once',()=>{
 const p=projectFuture(base,{...defaults,overheads:1000,startMonth:2,rampMonths:2,setup:900,ongoing:100},today);
 close(p.rows[0].delta,0);close(p.rows[1].delta,-450);close(p.rows[2].delta,900);close(p.movements.find(m=>m.label==='One-off setup expense').amount,-900);
});
test('standalone rankings exclude other changes and expenses while retaining timing',()=>{
 const values=Object.fromEntries(LEVERS.map(l=>[l.id,l.value]));const impacts=leverImpacts(base,{...defaults,spend:30,setup:1000,ongoing:200,startMonth:2},today,values);
 for(const l of impacts)close(l.delta,projectFuture(base,{...zeroLevers({...defaults,startMonth:2}),[l.id]:values[l.id]},today).delta);
});
test('invalid active inputs and impossible savings withhold all dependent projections',()=>{
 for(const patch of [{months:5},{cac:100},{conversion:NaN},{repeat:-31},{aov:21},{costs:base.revenue/base.orders},{overheads:base.overheads+1},{setup:-1},{aovMargin:101},{startMonth:4},{rampMonths:0},{trend:11}])assert.equal(projectFuture(base,{...defaults,...patch},today),null,JSON.stringify(patch));
});
test('frozen monthly draft round-trip refuses corruption without overwriting it',()=>{
 let raw=null;const storage={getItem:()=>raw,setItem:(_k,v)=>{raw=v;}};const p=projectFuture(base,defaults,today);
 const d={version:FUTURE_VERSION,id:'sample',owner:'Review',reviewDate:'2026-11-27',objective:'Check contribution',stopRule:'Stop if costs outweigh benefit',createdAt:'2026-11-20T12:00:00Z',today,sourceFrom:'2026-07-01',sourceTo:'2026-09-30',base,input:defaults,target:15000,ebitda:p.ebitda,notes:'',history:[{at:'2026-11-20T12:00:00Z',note:'Saved draft'}]};
 writeFutureDrafts(storage,'scoped',[d]);assert.deepEqual(readFutureDrafts(storage,'scoped'),[d]);const saved=raw;
 for(const next of [[{...d,ebitda:0}],[{...d,version:'unknown'}],[d,d],[{...d,reviewDate:'2026-99-99'}]]){assert.throws(()=>writeFutureDrafts(storage,'scoped',next));assert.equal(raw,saved);}
 raw='broken';assert.throws(()=>readFutureDrafts(storage,'scoped'));assert.equal(raw,'broken');
});

test('downside conversion and basket assumptions reduce profit and reconcile together',()=>{
 const p=projectFuture(base,{...defaults,conversion:-10,aov:-5},today);
 assert.ok(p.delta<0);assert.ok(p.rows[0].orders<p.rows[0].baselineOrders);
 const b=futureBridge(p);close(b[0].end+b.slice(1,-1).reduce((s,r)=>s+r.amount,0),p.ebitda);
});
