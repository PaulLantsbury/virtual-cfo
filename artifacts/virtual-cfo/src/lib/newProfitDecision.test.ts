import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProfitDecision } from './newProfitDecision.ts';
import { buildProfitPreview, comparisonTotals, annualisedScenarioPlan } from './newProfitPreview.ts';

test('default story identifies growth without profit and ranks observed deterioration rather than sensitivity',()=>{
 const model=buildProfitPreview({granularity:'weekly',months:3}),result=buildProfitDecision(model,'last-year');
 assert.equal(result.headline,'Sales up 1.8%; EBITDA down 53.3%.');
 assert.deepEqual(result.actions.map(a=>a.id),['discount','marketing','cost']);
 assert.equal(result.actions[0].adverseAmount,4631443);
 assert.equal(result.actions[1].adverseAmount,3619573);
 assert.match(result.summary,/Discounts, Advertising/);
 assert.equal(result.actions[1].annualHigh,null);
 assert.match(result.actions[1].assumedChange,/No advertising cut/);
 assert.equal(result.source,'synthetic-preview');
});
test('every horizon and comparator uses total expense effects and independent original-order context',()=>{
 for(const granularity of ['weekly','monthly'] as const)for(const months of ['last-week','last-month',3,6,12] as const)for(const basis of ['last-year','rolling'] as const){
  const model=buildProfitPreview({granularity,months}),ref=comparisonTotals(model,basis),result=buildProfitDecision(model,basis);
  for(const item of result.allActions){
   assert.ok(item.bridgeEffect===(item.metricKey==='gross'||item.metricKey==='shipping'?1:-1)*(model.current[item.metricKey]-ref[item.metricKey]));
   assert.equal(item.perOrder.current,model.current[item.metricKey]/model.current.orders);
   assert.equal(item.perOrder.reference,ref[item.metricKey]/ref.orders);
   assert.ok(item.firstStep&&item.successMetric&&item.guardrail&&item.reviewCadence&&item.evidenceGap);
  }
  assert.ok(result.actions.every((item,i)=>i===0||result.actions[i-1].adverseAmount>=item.adverseAmount));
  const plan=annualisedScenarioPlan(model);
  assert.deepEqual(result.combinedAnnual,{low:plan.combined.annualLow,high:plan.combined.annualHigh});
  assert.equal(result.allActions.filter(item=>item.annualHigh!==null).length,2);
  assert.equal(result.actions.some(item=>(item.id as string)==='payment'),false);
 }
});
test('neutral data does not invent deterioration or a percentage against zero/negative profits',()=>{
 const model=buildProfitPreview({granularity:'weekly',months:3});
 const neutral=buildProfitDecision({...model,current:{...model.priorYear}},'last-year');
 assert.ok(neutral.actions.every(item=>item.adverseAmount===0));
 assert.match(neutral.summary,/unchanged/);
 for(const value of [0,-100]){
  const result=buildProfitDecision({...model,priorYear:{...model.priorYear,ebitda:value}},'last-year');
  assert.equal(result.ebitda.pct,null);
  assert.doesNotMatch(result.headline,/EBITDA.*%/);
 }
});
test('higher total cost with lower cost per order is preserved rather than labelled inefficiency',()=>{
 const model=buildProfitPreview({granularity:'weekly',months:3}),previous=model.priorYear;
 const result=buildProfitDecision({...model,current:{...previous,variable:previous.variable*1.5,orders:previous.orders*2}},'last-year');
 const action=result.actions.find(item=>item.id==='cost')!;
 assert.ok(action.adverseAmount>0);assert.ok(action.perOrder.delta!<0);
 assert.match(action.why,/does not establish waste/);
});
test('nonfinite costs and absent orders cannot leak fabricated precision or invalid ranges',()=>{
 const model=buildProfitPreview({granularity:'weekly',months:3});
 const result=buildProfitDecision({...model,current:{...model.current,discounts:NaN,variable:Infinity,gross:NaN,orders:0,ebitda:NaN}},'last-year');
 assert.equal(result.ebitda.delta,null);assert.equal(result.ebitda.pct,null);
 for(const action of result.actions){assert.equal(action.perOrder.current,null);assert.equal(action.perOrder.delta,null);}
 assert.equal(result.allActions.find(a=>a.id==='discount')!.bridgeEffect,null);
 assert.equal(result.allActions.find(a=>a.id==='discount')!.annualLow,null);
 assert.equal(result.combinedAnnual,null);
 assert.doesNotMatch(JSON.stringify(result),/NaN|Infinity/);
});
test('headline follows global per-order toggle while ranking and annual impact remain total-based',()=>{
 const model=buildProfitPreview({granularity:'weekly',months:3});
 for(const basis of ['last-year','rolling'] as const){
  const total=buildProfitDecision(model,basis),unit=buildProfitDecision(model,basis,true),ref=comparisonTotals(model,basis);
  assert.equal(unit.sales.current,model.current.sales/model.current.orders);
  assert.equal(unit.ebitda.reference,ref.ebitda/ref.orders);
  assert.deepEqual(unit.actions,total.actions);assert.deepEqual(unit.combinedAnnual,total.combinedAnnual);
  assert.deepEqual(unit.margin,total.margin);assert.match(unit.headline,/per order/);assert.match(unit.summary,/per original order/);
 }
});
test('every independent driver can displace fixed action cards without counting net sales subtotals',()=>{
 const model=buildProfitPreview({granularity:'weekly',months:3});
 for(const key of ['gross','reversals','cogs','shipping','cashOverheads'] as const){
  const ref={...model.priorYear},current={...ref,[key]:ref[key]+(key==='gross'||key==='shipping'?-10000000:10000000)};
  const result=buildProfitDecision({...model,current},'last-year');
  assert.equal(result.actions[0].metricKey,key);assert.equal(result.actions[0].adverseAmount,10000000);
  assert.equal(result.allActions.length,8);assert.equal(result.actions.length,1);
  assert.ok(result.actions[0].annualLow===null&&result.actions[0].annualHigh===null);
  assert.ok(result.allActions.every(item=>(item.metricKey as string)!=='sales'));
 }
});
test('favourable drivers are shown as improvements to protect, and entirely missing evidence produces no actions',()=>{
 const model=buildProfitPreview({granularity:'weekly',months:3}),ref=model.priorYear;
 const favourable=buildProfitDecision({...model,current:{...ref,gross:ref.gross+1000,cogs:ref.cogs-500}},'last-year');
 assert.equal(favourable.actions[0].metricKey,'gross');assert.ok(favourable.actions.every(item=>item.status==='favourable'));
 assert.match(favourable.summary,/protect/);assert.match(favourable.actions[0].why,/not a promised further saving/);
 const missing=Object.fromEntries(Object.keys(ref).map(key=>[key,NaN])) as typeof ref;
 const unavailable=buildProfitDecision({...model,current:missing},'last-year');
 assert.equal(unavailable.actions.length,0);assert.match(unavailable.summary,/missing/);
});
