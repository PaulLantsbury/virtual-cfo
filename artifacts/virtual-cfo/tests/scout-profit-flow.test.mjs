import test from 'node:test';
import assert from 'node:assert/strict';
import {buildScoutProfitFlow,buildScoutProfitFlowFromTotals} from '../src/lib/scout/profit-flow.ts';
import {composeHistoryMonth} from '../src/lib/v11/history-composition.ts';
import {HISTORY_EDITION} from '../src/lib/v11/history-supported.ts';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const current={sales:10000,shipping:1000,cogs:4000,variable:1000,advertising:1000,cashOverheads:4000,contribution:5000,ebitda:1000,orders:10};
const prior={sales:9000,shipping:1000,cogs:4000,variable:1000,advertising:1000,cashOverheads:3500,contribution:4000,ebitda:500,orders:20};
const scope={storeId:'sample',currency:'GBP',timezone:'Europe/London',from:'2026-07-01',to:'2026-09-30',versionId:'SAMPLE-Q3-26',edition:'v11-fictional-design',anchor:'fixed-v11-fixture',formulaVersion:'formula-1',basis:'fictional'};
const priorScope={...scope,from:'2025-07-01',to:'2025-09-30',versionId:'SAMPLE-Q3-25'};
const options={currentScope:scope,previousScope:priorScope,comparisonLabel:'same quarter last year'};
test('Sankey reuses net sales plus shipping and exact cost uses, with contribution only an intermediate subtotal',()=>{
 const r=buildScoutProfitFlowFromTotals(current,prior,options);assert.equal(r.state,'ready');assert.equal(r.flows.total,11000);assert.equal(r.flows.uses.reduce((s,u)=>s+u.amount,0),11000);assert.ok(!r.flows.uses.some(u=>u.id==='contribution'));assert.equal(r.rows.find(r=>r.key==='contribution').subtotal,true);assert.equal(r.rows.find(r=>r.key==='contribution').amount,5000);assert.equal(r.rows.find(r=>r.key==='ebitda').amount,1000);
 assert.equal(r.totals.sales+r.totals.shipping-r.totals.cogs-r.totals.variable-r.totals.advertising,r.totals.contribution);assert.equal(r.totals.contribution-r.totals.cashOverheads,r.totals.ebitda);
});
test('comparison names exact source windows and versions, uses total revenue for margin and reports arithmetic not cause',()=>{
 const r=buildScoutProfitFlowFromTotals(current,prior,options),c=r.comparison;assert.equal(c.label,'same quarter last year');assert.equal(c.from,'2025-07-01');assert.equal(c.to,'2025-09-30');assert.equal(c.currentVersion,'SAMPLE-Q3-26');assert.equal(c.previousVersion,'SAMPLE-Q3-25');assert.equal(c.contribution.delta,1000);assert.equal(c.ebitda.delta,500);close(c.margin.current,1000/11000*100);close(c.margin.previous,5);close(c.margin.changePp,1000/11000*100-5);assert.match(r.commentary,/not proof of cause or cash generated/);assert.match(r.commentary,/same quarter last year \(2025-07-01–2025-09-30\)/);
});
test('per-order flows and comparison each use their own original-order denominator; margins remain total ratios',()=>{
 const r=buildScoutProfitFlowFromTotals(current,prior,{...options,perOrder:true});assert.equal(r.state,'ready');assert.equal(r.flows.total,1100);assert.equal(r.comparison.contribution.current,500);assert.equal(r.comparison.contribution.previous,200);assert.equal(r.comparison.ebitda.current,100);assert.equal(r.comparison.ebitda.previous,25);assert.equal(r.comparison.ebitda.delta,75);close(r.comparison.margin.current,1000/11000*100);
});
test('zero orders withhold per-order outputs while retaining independently valid totals and margin',()=>{
 const r=buildScoutProfitFlowFromTotals({...current,orders:0},prior,{...options,perOrder:true});assert.equal(r.state,'unavailable');assert.ok(r.rows.every(r=>r.amount===null));assert.equal(r.comparison.ebitda.current,null);assert.equal(r.comparison.ebitda.delta,null);assert.equal(r.totals.ebitda,1000);close(r.comparison.margin.current,1000/11000*100);
});
test('loss and negative-source periods retain signed table/comparison but never force a positive Sankey',()=>{
 const loss=buildScoutProfitFlowFromTotals({...current,cashOverheads:6000,ebitda:-1000},prior,options);assert.equal(loss.state,'unavailable');assert.match(loss.reason,/Signed or loss/);assert.equal(loss.rows.find(r=>r.key==='ebitda').amount,-1000);assert.equal(loss.comparison.ebitda.delta,-1500);assert.ok(loss.comparison.margin.current<0);
 const shipping=buildScoutProfitFlowFromTotals({...current,shipping:-500,contribution:3500,cashOverheads:3000,ebitda:500},prior,options);assert.equal(shipping.state,'unavailable');assert.equal(shipping.totals.shipping,-500);
 const breakEven=buildScoutProfitFlowFromTotals({...current,cashOverheads:5000,ebitda:0},prior,options);assert.equal(breakEven.state,'ready');assert.equal(breakEven.flows.uses.find(u=>u.id==='ebitda').amount,0);
});
test('zero revenue, missing or inconsistent evidence never produces an invented flow',()=>{
 const zero=Object.fromEntries(Object.keys(current).map(k=>[k,0]));const z=buildScoutProfitFlowFromTotals(zero,prior,options);assert.equal(z.state,'unavailable');assert.equal(z.comparison.margin.current,null);
 for(const invalid of [null,{...current,contribution:5001},{...current,ebitda:999},{...current,cogs:null},{...current,sales:10000.5},{...current,sales:NaN},{...current,sales:Number.MAX_SAFE_INTEGER,shipping:Number.MAX_SAFE_INTEGER,cogs:Number.MAX_SAFE_INTEGER,variable:0,advertising:0,cashOverheads:0,contribution:Number.MAX_SAFE_INTEGER,ebitda:Number.MAX_SAFE_INTEGER}]){const r=buildScoutProfitFlowFromTotals(invalid,prior,options);assert.equal(r.state,'unavailable');assert.equal(r.totals,null);assert.equal(r.comparison,null);assert.deepEqual(r.rows,[]);}
});
test('nonpositive prior profit has no relative growth percentage; margin percentage points still work',()=>{
 for(const p of [{...prior,cashOverheads:4000,ebitda:0},{...prior,cashOverheads:6000,ebitda:-2000}]){const r=buildScoutProfitFlowFromTotals(current,p,options);assert.equal(r.comparison.ebitda.changePct,null);assert.equal(r.comparison.ebitda.delta,current.ebitda-p.ebitda);close(r.comparison.margin.changePp,current.ebitda/11000*100-p.ebitda/10000*100);}
});
test('cross-company, cross-edition, mixed basis, future/overlapping and reused-version comparisons are withheld',()=>{
 for(const s of [{...priorScope,storeId:'other'},{...priorScope,currency:'USD'},{...priorScope,edition:'other'},{...priorScope,formulaVersion:'other'},{...priorScope,basis:'reviewed'},{...priorScope,from:'2026-08-01',to:'2026-09-30'},{...priorScope,from:'2027-07-01',to:'2027-09-30'},{...priorScope,versionId:scope.versionId}]){const r=buildScoutProfitFlowFromTotals(current,prior,{...options,previousScope:s});assert.equal(r.state,'ready');assert.equal(r.comparison,null);assert.match(r.commentary,/Comparison unavailable: choose a supported earlier period/);}
 const reviewed=buildScoutProfitFlowFromTotals(current,prior,{...options,currentScope:{...scope,basis:'reviewed',anchor:'2024-11-01'}});assert.equal(reviewed.totals,null);
});
const selection={storeId:'profit-business',currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor:'2024-11-01',versionId:'profit-review',period:{from:'2025-01-01',to:'2025-01-31'}};
function response(s=selection){const scope={storeId:s.storeId,currency:'GBP',from:s.period.from,to:s.period.to};const next=new Date(s.period.to+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);return {state:'supported',versionId:s.versionId,contract:'history-v2-proposal',scope,snapshotId:s.versionId,salesRevision:'sales-1',costRevision:'cost-1',metadata:{versionId:s.versionId,edition:HISTORY_EDITION,anchor:s.anchor,sourceAsOf:next.toISOString().slice(0,10)+'T00:00:00Z',observedAt:'2026-11-20T10:00:00Z',formulaVersion:'night-scout-v11-2026-10-30',sourceBasis:'synthetic-local',verification:'canonical-source-revision-only'},sales:{grossProductSales:12000,discounts:2000,netProductSales:9000,netShipping:500,originalOrders:10,aov:{value:1000,reason:null},provenance:scope},components:{cogs:4500,variableCosts:1000,advertising:500,overheadIncludingDA:2000,depreciationAmortisation:100},profit:{state:'complete',grossProfit:4500,contributionBeforeMarketing:4000,contribution:3500,ebitda:1600}};}
test('reviewed adapter preserves exact evidence and independent cost scope, never using design inputs',()=>{
 const m=composeHistoryMonth(response(),selection),pSelection={...selection,versionId:'earlier-review',period:{from:'2024-12-01',to:'2024-12-31'}},p=composeHistoryMonth(response(pSelection),pSelection);assert.ok(m&&p);const r=buildScoutProfitFlow(m,p,'December 2024');assert.equal(r.state,'ready');assert.equal(r.flows.total,9500);assert.equal(r.totals.cashOverheads,1900);assert.equal(r.comparison.label,'December 2024');assert.equal(r.comparison.currentVersion,selection.versionId);assert.equal(r.comparison.ebitda.delta,0);
 const missing=response();delete missing.components;const partial=buildScoutProfitFlow(composeHistoryMonth(missing,selection),p,'December 2024');assert.equal(partial.state,'unavailable');assert.equal(partial.comparison,null);
});
test('reviewed selection/evidence/snapshot mismatch or invalidated state cannot produce a chart or comparison',()=>{
 const original=composeHistoryMonth(response(),selection);assert.ok(original);
 const alterations=[m=>m.selection.versionId='different',m=>m.evidence.versionId='different',m=>m.context.snapshotId='different',m=>m.input.snapshot.id='different',m=>m.input.freshness='invalidated',m=>m.input.expected.storeId='other',m=>m.evidence.costCoverage='unavailable'];
 for(const alter of alterations){const m=structuredClone(original);alter(m);const r=buildScoutProfitFlow(m);assert.equal(r.totals,null);assert.equal(r.state,'unavailable');}
});

test('a difference outside safe monetary range is withheld, including against a signed loss baseline',()=>{const max=Number.MAX_SAFE_INTEGER,c={sales:max,shipping:0,cogs:0,variable:0,advertising:0,cashOverheads:0,contribution:max,ebitda:max,orders:1},p={sales:1,shipping:0,cogs:0,variable:0,advertising:0,cashOverheads:max,contribution:1,ebitda:1-max,orders:1};const r=buildScoutProfitFlowFromTotals(c,p,options);assert.equal(r.totals.ebitda,max);assert.equal(r.comparison.ebitda.delta,null);assert.equal(r.comparison.ebitda.changePct,null);assert.match(r.commentary,/EBITDA by unavailable/);});
