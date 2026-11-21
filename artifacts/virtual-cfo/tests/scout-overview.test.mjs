import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScoutOverview } from '../src/lib/scout/overview-model.ts';
const snapshot=(overrides={})=>({scope:{storeId:'company-a',currency:'GBP',timezone:'Europe/London',from:'2026-09-01',to:'2026-09-30',versionId:'REVIEWED-SEP'},financial:{sales:10000000,contribution:3000000,ebitda:1000000,overheads:2000000,advertising:1200000,orders:1000},...overrides});
const previous=(overrides={})=>snapshot({scope:{...snapshot().scope,from:'2025-09-01',to:'2025-09-30',versionId:'REVIEWED-PRIOR'},...overrides});
const overview=(current,prior)=>buildScoutOverview({current,previous:prior,comparisonLabel:'September 2025 (last year)'});
test('five independent outcomes include contribution and cash; bank remains a dated balance',()=>{
 const cash={operatingCash:700000,openingBank:4000000,closingBank:4500000,bankMovement:500000,stock:-300000,debtors:0,settlements:0,supplierCredit:0,otherWorkingCapital:0};
 const result=overview(snapshot({cash}),previous());
 assert.deepEqual(result.outcomes.map(o=>o.id),['sales','contribution','ebitda','operatingCash','bank']);
 const contribution=result.outcomes[1],bank=result.outcomes[4];assert.equal(contribution.value,3000000);assert.equal(result.outcomes[2].value,1000000);
 assert.equal(bank.kind,'balance');assert.equal(bank.asAt,'2026-09-30');assert.equal(bank.previous,4000000);assert.equal(bank.delta,500000);assert.equal(bank.comparisonLabel,'since 2026-09-01');
 assert.equal(result.outcomes[3].previous,null);assert.equal(result.outcomes[3].changePct,null);
});
test('rising sales with falling contribution/profit produces a supported profit-pressure finding',()=>{
 const prior=previous({financial:{...snapshot().financial,sales:9000000,contribution:4000000,ebitda:2000000,advertising:900000}});
 const r=overview(snapshot(),prior);assert.equal(r.verdict.title,'More sales are not becoming more profit.');assert.equal(r.primaryAction.href,'/profit-engine');
 assert.match(r.insights[0].evidence,/September 2025 \(last year\)/);assert.doesNotMatch(r.insights[0].implication,/caused by|guaranteed|will save/i);assert.equal(r.insights[0].visual.length,3);
});
test('contribution shortfall outranks cash and acquisition; ranked findings are bounded and not permanent stock warnings',()=>{
 const current=snapshot({financial:{...snapshot().financial,contribution:1500000,ebitda:-500000},cash:{operatingCash:-1000000,openingBank:3000000,closingBank:2000000,bankMovement:-1000000,stock:-500000,debtors:0,settlements:0,supplierCredit:0,otherWorkingCapital:0},acquisition:{cac:4000,firstOrderContribution:2500,sessions:10000,purchasingSessions:100,newCustomers:60,repeatOrders:100,repeatRevenue:400000}});
 const prior=previous({acquisition:{cac:3000,firstOrderContribution:2500,sessions:9000,purchasingSessions:180,newCustomers:80,repeatOrders:90,repeatRevenue:300000}});
 const r=overview(current,prior);assert.equal(r.insights.length,3);assert.equal(r.insights[0].id,'overhead-gap');assert.equal(r.insights[0].visual[0].value,1500000);assert.ok(r.insights.some(i=>i.id==='acquisition-gap'));assert.equal(r.outcomes[2].changePct,-150);
 const noCash=overview(snapshot(),null);assert.ok(!noCash.insights.some(i=>i.id==='cash-conversion'));assert.ok(!noCash.verdict.title.includes('stock'));
});
test('positive EBITDA consuming cash ranks cash first and describes signed stock effects without calling them savings',()=>{
 const cash={operatingCash:-500000,openingBank:6000000,closingBank:5500000,bankMovement:-500000,stock:-1500000,debtors:0,settlements:0,supplierCredit:0,otherWorkingCapital:0};
 const r=overview(snapshot({cash}),previous());assert.equal(r.primaryAction.href,'/new-cash-control');assert.match(r.verdict.title,/consumed operating cash/);assert.match(r.insights[0].evidence,/Stock absorbed/);assert.doesNotMatch(r.insights[0].implication,/wasted|recover £|guaranteed saving/i);
});
test('cash bridge or bank roll-forward conflicts withhold cash instead of inventing reconciliation',()=>{
 const cash={operatingCash:1000000,openingBank:1000000,closingBank:2000000,bankMovement:900000,stock:0,debtors:0,settlements:0,supplierCredit:0,otherWorkingCapital:0};
 const a=overview(snapshot({cash}),previous());assert.equal(a.outcomes[3].value,null);assert.equal(a.outcomes[4].value,null);
 const b=overview(snapshot({cash:{...cash,bankMovement:1000000,stock:-100}}),previous());assert.equal(b.coverage.cash,false);
});
test('different business, future or overlapping comparisons never influence outcomes or findings',()=>{
 for(const scope of [{...previous().scope,storeId:'other'},{...previous().scope,from:'2026-09-01',to:'2026-09-30'},{...previous().scope,from:'2026-10-01',to:'2026-10-31'}]){
  const r=overview(snapshot(),previous({scope}));assert.equal(r.coverage.comparisonSupported,false);assert.equal(r.outcomes[0].previous,null);assert.ok(!r.insights.some(i=>i.id==='profit-pressure'));assert.equal(r.comparisonLabel,'No supported comparison selected');
 }
});
test('unknown/partial evidence preserves independent supported sales without fictional fallback or false quiet',()=>{
 const empty=overview(null,null);assert.equal(empty.outcomes.filter(o=>o.value!==null).length,0);assert.equal(empty.sample,false);assert.equal(empty.insights.length,0);assert.match(empty.verdict.title,/Choose reviewed evidence/);
 const partial=overview(snapshot({financial:{sales:10000000,contribution:null,ebitda:null,overheads:null,advertising:null,orders:1000}}),null);
 assert.equal(partial.outcomes[0].value,10000000);assert.equal(partial.outcomes[1].value,null);assert.match(partial.verdict.explanation,/not an all-clear/);assert.equal(partial.insights.length,0);
 const conflict=overview(snapshot({financial:{...snapshot().financial,ebitda:100}}),null);assert.equal(conflict.outcomes[0].value,10000000);assert.equal(conflict.outcomes[1].value,null);assert.equal(conflict.outcomes[2].value,null);
});
test('acquisition judgement requires both CAC and matched first-order contribution',()=>{
 const raw={cac:4000,firstOrderContribution:null,sessions:20000,purchasingSessions:200,newCustomers:100,repeatOrders:200,repeatRevenue:600000};
 assert.ok(!overview(snapshot({acquisition:raw}),null).insights.some(i=>i.id==='acquisition-gap'));
 const supported=overview(snapshot({acquisition:{...raw,firstOrderContribution:2000}}),null);assert.equal(supported.insights[0].id,'acquisition-gap');assert.match(supported.insights[0].implication,/not (?:a|the) business-wide break-even CAC/);
});
test('customer findings distinguish session conversion, repeat orders and future cohort uncertainty',()=>{
 const raw={cac:null,firstOrderContribution:null,sessions:20000,purchasingSessions:200,newCustomers:100,repeatOrders:200,repeatRevenue:600000};
 const old={...raw,sessions:10000,purchasingSessions:200,newCustomers:150,repeatRevenue:400000};
 const r=overview(snapshot({acquisition:raw}),previous({acquisition:old}));assert.deepEqual(r.insights.map(i=>i.id),['traffic-conversion','repeat-pipeline']);assert.match(r.insights[0].evidence,/2.00% to 1.00%/);assert.match(r.insights[1].implication,/not proof that retention improved/);assert.match(r.insights[1].implication,/not forecast/);
 const zero=overview(snapshot({acquisition:{...raw,sessions:0}}),previous({acquisition:old}));assert.ok(!zero.insights.some(i=>i.id==='traffic-conversion'));
});
test('negative or zero prior denominators never manufacture a percentage growth claim',()=>{
 const old=previous({financial:{...snapshot().financial,contribution:1000000,ebitda:-1000000}});assert.equal(overview(snapshot(),old).outcomes[2].changePct,null);
 const zero=previous({financial:{...snapshot().financial,contribution:2000000,ebitda:0}});assert.equal(overview(snapshot(),zero).outcomes[2].changePct,null);
});

test('a supported negative EBITDA is visible even when the cost explanation is incomplete',()=>{const r=overview(snapshot({financial:{sales:10000000,contribution:null,ebitda:-1000000,overheads:null,advertising:null,orders:1000}}),null);assert.equal(r.outcomes[2].value,-1000000);assert.equal(r.insights[0].id,'reported-loss');assert.equal(r.verdict.tone,'warning');assert.match(r.insights[0].evidence,/split is incomplete/);});
test('fractional or nonfinite stored money never becomes a precise supported headline',()=>{const r=overview(snapshot({financial:{...snapshot().financial,sales:100.5,contribution:NaN,ebitda:Infinity}}),null);assert.equal(r.outcomes[0].value,null);assert.equal(r.outcomes[1].value,null);assert.equal(r.outcomes[2].value,null);});
