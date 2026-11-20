import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildPlanReview,calculatePlan,defaultInput,planBridge,PLAN_VERSION} from '../src/lib/planning/plan-model.ts';
import {metrics,spendScenario} from '../src/lib/marketing/review-model.ts';
import {createDraft,readDrafts,writeDrafts,reviewDraft,rescheduleDraft,validateDraft} from '../src/lib/planning/drafts.ts';
import {readReviewContext,reviewQuery} from '../src/lib/planning/review-context.ts';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const model=buildPlanReview({horizon:3,granularity:'monthly',comparison:'last-year'}),base=model.baseline30,b=metrics(base);
test('all planning periods use the shared Marketing baseline and disclose scope',()=>{
 for(const horizon of ['last-week','last-month',3,6,12])for(const granularity of ['weekly','monthly']){
  const p=buildPlanReview({horizon,granularity,comparison:'last-year'});assert.equal(p.baseline30.days,30);assert.equal(p.actions.length,3);assert.ok(Number.isFinite(p.cashAbsorbed));assert.ok(p.from<=p.to);
 }
});
test('unchanged orders, spend and traffic are identity on the same 30-day basis',()=>{
 for(const method of ['orders','spend','traffic']){const r=calculatePlan(base,{...defaultInput(),method});near(r.ebitda,b.ebitda);near(r.revenue,base.revenue);near(r.orders,base.orders);near(r.delta,0);}
});
test('spend method exactly reuses Marketing response, including diminishing CAC',()=>{
 for(const pct of [-80,-20,0,20,80])for(const elasticity of [0,.35,.85]){
  const p=calculatePlan(base,{...defaultInput(),method:'spend',spendChange:pct,elasticity});
  const m=spendScenario(base,{direction:pct===0?'hold':pct>0?'scale':'reduce',changePct:Math.abs(pct),elasticity,extraOverheads:0});
  near(p.ebitda,m.ebitda);near(p.orders,m.totals.orders);near(p.cac,m.cac);near(p.marginalCac,m.marginalCac);
 }
});
test('inactive growth methods do not add orders or affect the current result',()=>{
 const orders=calculatePlan(base,{...defaultInput(),orderChange:10,spendChange:NaN,sessionsChange:NaN,conversionRate:NaN});near(orders.orders,base.orders*1.1);near(orders.advertising,base.advertising);
 const spend=calculatePlan(base,{...defaultInput(),method:'spend',orderChange:NaN,sessionsChange:NaN,conversionRate:NaN});near(spend.ebitda,b.ebitda);
 const traffic=calculatePlan(base,{...defaultInput(),method:'traffic',orderChange:90,spendChange:80,sessionsChange:10,conversionRate:2.2});near(traffic.orders,base.orders*1.1*1.1);near(traffic.advertising,base.advertising);
});
test('combined revenue, volume, costs and implementation reconcile once',()=>{
 const input={...defaultInput(),orderChange:10,revenueChange:2,unitSaving:.5,overheadSaving:300,extraCosts:200,implementationCost:100};const r=calculatePlan(base,input);
 const expectedVolume=base.beforeAds*.1,expectedRevenue=base.revenue*1.1*.02,expectedSaving=base.orders*1.1*.5;
 near(r.ebitda,b.ebitda+expectedVolume+expectedRevenue+expectedSaving+300-200-100);near(r.afterAds-r.overheads,r.ebitda);
 near(r.movements.reduce((s,x)=>s+x.amount,0),r.delta);
});
test('total and per-order bridges conserve profit with own denominators',()=>{
 for(const method of ['orders','spend','traffic'])for(const perOrder of [false,true]){
  const r=calculatePlan(base,{...defaultInput(),method,orderChange:-20,spendChange:20,conversionRate:2.5,revenueChange:3,unitSaving:.2,extraCosts:500});const rows=planBridge(base,r,perOrder);
  near(rows.at(-1).end,perOrder?r.ebitda/r.orders:r.ebitda);near(rows[0].end,perOrder?b.ebitda/base.orders:b.ebitda);
 }
});
test('invalid active assumptions withhold results rather than keeping an old answer',()=>{
 for(const bad of [{orderChange:NaN},{method:'spend',spendChange:81},{method:'spend',elasticity:.9},{method:'traffic',conversionRate:0},{unitSaving:10000},{overheadSaving:base.overheads+1},{extraCosts:-1},{implementationCost:Infinity},{revenueChange:31}])assert.equal(calculatePlan(base,{...defaultInput(),...bad}),null);
});
test('None removes comparative priority claims and source context rejects unknown parameters',()=>{
 const m=buildPlanReview({horizon:3,granularity:'monthly',comparison:'none'});assert.equal(m.previous,null);assert.match(m.ranking,/unranked/);
 for(const horizon of ['last-week','last-month',3,6,12]){
  const q=reviewQuery(horizon,'monthly','rolling'),r=readReviewContext('?'+q);assert.equal(r.horizon,horizon);assert.equal(r.comparison,'rolling');
 }
 assert.deepEqual(readReviewContext('?reviewHorizon=bad&reviewView=bad&reviewCompare=bad'),{horizon:null,granularity:null,comparison:null});
 assert.equal(readReviewContext('?reviewHorizon=last-week&reviewView=monthly').granularity,'weekly');
});
const makeDraft=()=>createDraft({id:'draft-1',title:'Sample cost review',action:'costs',owner:'Test owner',reviewDate:'2026-11-27',objective:'Check matched cost per order',stopRule:'Stop if service or contribution deteriorates',createdAt:'2026-11-20T12:00:00Z',baseline:structuredClone(base),sourceFrom:model.from,sourceTo:model.to,target:15000,input:defaultInput(),ebitda:b.ebitda},'2026-11-20');
test('sample drafts round-trip by explicit scope and retain their frozen baseline',()=>{
 const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};const d=makeDraft();writeDrafts(storage,'user-a/store-a',[d]);assert.equal(readDrafts(storage,'user-b/store-a').length,0);assert.equal(readDrafts(storage,'user-a/store-b').length,0);assert.equal(readDrafts(storage,'user-a/store-a')[0].version,PLAN_VERSION);
 const original=d.baseline.overheads;base.overheads+=100;near(readDrafts(storage,'user-a/store-a')[0].baseline.overheads,original);base.overheads-=100;
});
test('draft review and reasoned rescheduling preserve original dates and history',()=>{
 const d=makeDraft(),r=reviewDraft(d,'Checked the supplier quote; no realised benefit established.','2026-11-22T12:00:00Z');assert.equal(r.status,'reviewed');assert.equal(d.status,'planned');assert.equal(r.history.length,2);
 assert.throws(()=>rescheduleDraft(r,'2026-12-01','','2026-11-20','2026-11-23T12:00:00Z'));
 const moved=rescheduleDraft(r,'2026-12-01','Awaiting a quote','2026-11-20','2026-11-23T12:00:00Z');assert.equal(moved.originalReviewDate,'2026-11-27');assert.equal(moved.reviewDate,'2026-12-01');assert.equal(moved.history.length,3);
 assert.throws(()=>reviewDraft(d,'','2026-11-22T12:00:00Z'));
});
test('corrupt, mismatched or impossible drafts are refused without replacing storage',()=>{
 const d=makeDraft();assert.equal(validateDraft({...d,ebitda:d.ebitda+1}),false);assert.equal(validateDraft({...d,owner:''}),false);assert.equal(validateDraft({...d,version:'old'}),false);assert.equal(validateDraft({...d,baseline:{...d.baseline,days:92}}),false);
 assert.throws(()=>readDrafts({getItem:()=>'{bad'},'x'));assert.throws(()=>readDrafts({getItem:()=>JSON.stringify([d,d])},'x'));assert.throws(()=>createDraft({...d,reviewDate:'2026-11-19'},'2026-11-20'));
});
test('stock investigations have no fabricated EBITDA result or target benefit',()=>{
 const d=makeDraft();const stock={...d,action:'stock',input:null,ebitda:null,target:null};assert.equal(validateDraft(stock),true);assert.equal(validateDraft({...stock,ebitda:1000}),false);assert.equal(validateDraft({...stock,input:defaultInput()}),false);
});
