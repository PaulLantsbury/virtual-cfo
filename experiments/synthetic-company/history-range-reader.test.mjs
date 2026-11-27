import test from 'node:test';
import assert from 'node:assert/strict';
import {validatedHistoryDaily,readHistoryRangeInTransaction,requiredHistoryRangeMonths,validHistoryRangeScope} from './history-range-reader.mjs';
import {HISTORY_EDITION,HISTORY_FORMULA,historySourceAsOf} from './history-context.mjs';
import {profitBridge} from '../financial-v1/calculations.mjs';
const store='d7500000-0000-4000-8000-000000000009',now=()=>new Date('2026-11-27T12:00:00Z');
const scope=(from,to)=>({storeId:store,currency:'GBP',from,to});
const days=(from,to)=>(Date.parse(to)-Date.parse(from))/86400000+1;
const id=from=>'00000000-0000-4000-8000-'+from.replaceAll('-','').padStart(12,'0');
const select=s=>({edition:HISTORY_EDITION,versions:requiredHistoryRangeMonths(s).map(m=>({...m,versionId:id(m.from)}))});
const expense=(category,amount,kind='expense_accrual',refs={})=>({body:{kind,refs,postings:[{account:'expense:'+category,amount}]}});
function fixturePart(full,part,payrollAmount=days(full.from,full.to)*100){
 const n=days(part.from,part.to),pay=part.to===full.to?payrollAmount:0;
 const costEvents=[expense('premises',10*n),expense('depreciation',5*n,'depreciation'),expense('marketing',3*n)];
 if(part.to===full.to)for(let i=0;i<4;i++)costEvents.push({body:{kind:'payroll_accrual',refs:{staffId:'fictional-staff-'+(i+1)},postings:[{account:'expense:salary',amount:i===0?payrollAmount:0},{account:'expense:employer',amount:0},{account:'expense:pension',amount:0}]}});
 const sales={grossProductSales:1100*n,discounts:100*n,originalOrders:n,netProductSales:1000*n,netShipping:50*n,productRefundExVat:0,productRefundVat:0,shippingRefundExVat:0,shippingRefundVat:0,cashRefunded:0,cogs:null,profitDataState:'incomplete',hasRefundActivity:false,hasActivity:true,aov:{value:1000,reason:null},discountRate:{value:100/1100,reason:null},provenance:{storeId:store,currency:'GBP',from:part.from,to:part.to}};
 const components={cogs:20*n,variableCosts:10*n,advertising:3*n,overheadIncludingDA:15*n+pay,depreciationAmortisation:5*n};
 return {sales,components,profit:profitBridge({...sales,...components}),costEvents};
}
function setup(options={}){
 const calls=[];
 const readMonth=async(_tx,s)=>{calls.push(['month',s.from]);if(options.missing===s.from)return {state:'unavailable'};const base=fixturePart(s,s,options.payrollAmount);return {state:'supported',contract:'history-v2-proposal',scope:s,versionId:id(s.from),metadata:{edition:HISTORY_EDITION,anchor:'2024-11-01',formulaVersion:HISTORY_FORMULA,sourceBasis:'synthetic-local',sourceAsOf:historySourceAsOf(s.to),observedAt:'2026-11-05T12:00:00Z'},salesRevision:'a'.repeat(64),costRevision:'b'.repeat(64),...base};};
 const readSlice=async(_tx,full,_selection,part)=>{calls.push(['slice',part.from,part.to]);const r=fixturePart(full,part,options.payrollAmount);if(options.unknown)r.costEvents.push(expense('unknown',1));if(options.missingPayroll)r.costEvents=r.costEvents.filter(e=>e.body.kind!=='payroll_accrual');return r;};
 const run=s=>readHistoryRangeInTransaction({},s,{selection:select(s),now,readMonth,readSlice});
 return {run,calls,readMonth,readSlice};
}
test('scope requires exact bounded closed calendar input and exact ordered versions',async()=>{
 assert.equal(validHistoryRangeScope(scope('2026-02-30','2026-03-01')),false);
 assert.equal(validHistoryRangeScope({...scope('2026-01-01','2026-01-31'),extra:true}),false);
 assert.equal(validHistoryRangeScope(scope('2024-01-01','2026-01-01')),false);
 assert.equal(requiredHistoryRangeMonths(scope('2026-01-26','2026-02-01')).length,2);
 const f=setup(),s=scope('2026-01-26','2026-02-01');const chosen=select(s);chosen.versions.reverse();
 const r=await readHistoryRangeInTransaction({},s,{selection:chosen,now,readMonth:f.readMonth,readSlice:f.readSlice});assert.equal(r.state,'unavailable');assert.deepEqual(f.calls,[]);
 assert.equal((await f.run(scope('2026-11-01','2026-11-27'))).state,'unavailable');
});
test('complete months preserve actual components; totals and ratios use summed denominators',async()=>{
 const f=setup(),s=scope('2026-01-01','2026-02-28'),r=await f.run(s);
 assert.equal(r.state,'supported');assert.equal(r.metadata.allocationBasis,'actual-months');assert.equal(r.allocation.portions.length,0);assert.equal(r.sales.originalOrders,59);assert.equal(r.sales.netProductSales,59000);assert.equal(r.sales.aov.value,1000);assert.equal(r.components.overheadIncludingDA,6785);assert.equal(r.allocation.timingAdjustmentToDatedAccrualEbitda,0);assert.equal(f.calls.filter(c=>c[0]==='slice').length,0);
 assert.deepEqual(r.profit,profitBridge({...r.sales,...r.components}));assert.equal(r.rangeId.length,64);assert.equal(r.versions.length,2);
});
test('cross-month week uses each month daily payroll rate and retains dated costs',async()=>{
 const f=setup(),r=await f.run(scope('2026-01-26','2026-02-01'));assert.equal(r.state,'supported');
 assert.equal(r.components.overheadIncludingDA,805);assert.equal(r.components.advertising,21);assert.equal(r.components.cogs,140);assert.equal(r.components.variableCosts,70);assert.equal(r.components.depreciationAmortisation,35);
 assert.equal(r.metadata.allocationBasis,'allocated-recurring-monthly-costs');assert.equal(r.allocation.datedAccrualOverheadIncludingDA,3205);assert.equal(r.allocation.timingAdjustmentToDatedAccrualEbitda,-2400);
 const dated=profitBridge({...r.sales,...r.components,overheadIncludingDA:r.allocation.datedAccrualOverheadIncludingDA});assert.equal(r.profit.ebitda+r.allocation.timingAdjustmentToDatedAccrualEbitda,dated.ebitda);
 assert.ok(f.calls.slice(0,2).every(c=>c[0]==='month'),'All full monthly proofs precede slices');
 assert.doesNotMatch(JSON.stringify(r),/postings|staffId|costEvents|Authorization/);
});
test('adjacent custom slices conserve the exact monthly source including penny remainder',async()=>{
 const f=setup({payrollAmount:1}),s=scope('2026-01-01','2026-01-31');const [a,b,full]=await Promise.all([f.run(scope('2026-01-01','2026-01-15')),f.run(scope('2026-01-16','2026-01-31')),f.run(s)]);
 assert.equal(a.state,'supported');assert.equal(b.state,'supported');assert.equal(a.components.overheadIncludingDA+b.components.overheadIncludingDA,full.components.overheadIncludingDA);
 assert.equal(a.profit.ebitda+b.profit.ebitda,full.profit.ebitda);
});
test('missing, unclassified or unproven recurring sources never produce partial or zero-filled profit',async()=>{
 const s=scope('2026-01-26','2026-02-01');const missing=setup({missing:'2026-02-01'});assert.equal((await missing.run(s)).state,'unavailable');assert.equal(missing.calls.some(c=>c[0]==='slice'),false);
 assert.equal((await setup({unknown:true}).run(s)).state,'unavailable');assert.equal((await setup({missingPayroll:true}).run(s)).state,'unavailable');
});
test('missing or unclassified dated cash proof withholds cash without losing verified financial range',async()=>{
 const f=setup(),s=scope('2026-01-01','2026-01-15');
 const missing=await f.run(s);assert.equal(missing.state,'supported');assert.equal(missing.cashDatedPortions[0].state,'unavailable');
 const readSlice=async(...args)=>{const result=await f.readSlice(...args);result.salesManifest={sourceEvents:[{source_id:'fictional-bank-event',event_date:'2026-01-01',body:{date:'2026-01-01',kind:'unknown-bank-kind',postings:[{account:'bank',amount:100},{account:'processor',amount:-100}]}}]};return result;};
 const r=await readHistoryRangeInTransaction({},s,{selection:select(s),now,readMonth:f.readMonth,readSlice});
 assert.equal(r.state,'supported');assert.equal(r.cashDatedPortions[0].state,'unavailable');assert.equal(r.cashDatedPortions[0].openingBankOffsetPence,undefined);assert.doesNotMatch(JSON.stringify(r.cashDatedPortions),/fictional-bank-event|postings/);
});
test('compact daily summaries cover leap day and conserve one-penny monthly payroll',()=>{
 const full=scope('2024-02-01','2024-02-29'),witness=fixturePart(full,full,1);
 Object.assign(witness,{originalOrders:[],priorRefunds:[],selectedLines:[],selectedReturns:[]});for(const row of witness.costEvents)row.event_date=full.to;
 const daily=validatedHistoryDaily(witness,full,id(full.from));assert.equal(daily.length,29);assert.equal(daily[0].date,full.from);assert.equal(daily.at(-1).date,full.to);assert.equal(daily.reduce((n,row)=>n+row.components.overheadIncludingDA,0),436);
 assert.equal(daily.reduce((n,row)=>n+row.components.advertising,0),87);assert.equal(daily.reduce((n,row)=>n+row.sales.originalOrders,0),0);
 assert.doesNotMatch(JSON.stringify(daily),/postings|staffId|sourceEvents/);
});
test('real disposable SQL reader preserves monthly actuals, slices current sources and denies nonmembers',async()=>{
 const {createHistoryRehearsal,importHistory,invalidateHistoryMonth}=await import('./history-rehearsal.mjs');
 const {createHistoryService}=await import('./history-reader.mjs');
 const h=await createHistoryRehearsal({withLoadedJanuary:false,now});
 try{
  await importHistory(h,{from:'2025-01-01',asOf:'2025-03-01'});
  const auth=id=>({auth:{getUser:async()=>({data:{user:{id,is_anonymous:false}}})}});
  const service=createHistoryService(h.db,auth(h.reviewerId),{now});
  const listing=await service.available({storeId:h.storeId,currency:'GBP'},'Bearer fixture');
  const selected=listing.months.filter(m=>m.from>='2025-01-01'&&m.from<='2025-02-01').map(({from,to,versionId})=>({from,to,versionId}));
  const january={storeId:h.storeId,currency:'GBP',from:'2025-01-01',to:'2025-01-31'};
  const original=await service.read(january,'Bearer fixture',{edition:HISTORY_EDITION,versionId:selected[0].versionId});
  const full=await service.range(january,'Bearer fixture',{edition:HISTORY_EDITION,versions:[selected[0]]});
  assert.equal(full.state,'supported');assert.equal(full.dailyFinancial.length,31);for(const key of Object.keys(full.components))assert.equal(full.dailyFinancial.reduce((n,row)=>n+row[key],0),full.components[key]);assert.deepEqual(full.components,original.components);assert.deepEqual(full.profit,original.profit);assert.deepEqual(full.monthlyResponses,[original]);
  const week={...january,from:'2025-01-26',to:'2025-02-01'},r=await service.range(week,'Bearer fixture',{edition:HISTORY_EDITION,versions:selected});
  assert.equal(r.state,'supported');assert.equal(r.metadata.allocationBasis,'allocated-recurring-monthly-costs');assert.equal(r.versions.length,2);assert.equal(r.monthlyResponses.length,2);
  assert.equal(r.dailyFinancial.length,7);assert.equal(r.dailyFinancial[0].date,week.from);assert.equal(r.dailyFinancial.at(-1).date,week.to);for(const key of Object.keys(r.components))assert.equal(r.dailyFinancial.reduce((n,row)=>n+row[key],0),r.components[key]);
  assert.equal(r.cashDatedPortions.length,2);assert.ok(r.cashDatedPortions.every(p=>p.state==='supported'),JSON.stringify(r.cashDatedPortions));
  for(const p of r.cashDatedPortions){assert.equal(p.allocatedEbitda+p.allocatedToDatedEbitdaAdjustment,p.datedAccrualEbitda);assert.equal(p.datedAccrualEbitda+Object.values(p.workingCapital).reduce((a,b)=>a+b,0),p.selectedBankMovementPence);assert.equal(p.closingBankOffsetPence-p.openingBankOffsetPence,p.selectedBankMovementPence);assert.equal(p.proofHash.length,64);}
  assert.doesNotMatch(JSON.stringify(r.cashDatedPortions),/postings|staffId|sourceEvents/);
  // Exercise the real SQL response through the browser's independent financial
  // guard and chart aggregation, rather than a hand-authored wire fixture.
  const {composeReviewedRange}=await import('../../artifacts/virtual-cfo/src/lib/reporting-range/composition.ts');
  const {reportingFinancialBuckets}=await import('../../artifacts/virtual-cfo/src/lib/reporting-range/buckets.ts');
  const expected=raw=>({storeId:h.storeId,currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor:raw.metadata.anchor,period:{from:raw.scope.from,to:raw.scope.to},versions:raw.versions.map(({from,to,versionId})=>({from,to,versionId}))});
  const composed=composeReviewedRange(JSON.parse(JSON.stringify(r)),expected(r));
  assert.ok(composed,'Actual SQL range response must be accepted by the client source guard');
  assert.equal(composed.amounts.ebitda,r.profit.ebitda);
  assert.equal(composed.range.cashDatedPortions.length,2);
  for(const view of ['weekly','monthly']){
   const buckets=reportingFinancialBuckets(composed,view,false);assert.ok(buckets);
   assert.equal(buckets[0].from,week.from);assert.equal(buckets.at(-1).to,week.to);
   assert.equal(buckets.reduce((n,b)=>n+b.sales,0),r.sales.netProductSales);
   assert.equal(buckets.reduce((n,b)=>n+b.ebitda,0),r.profit.ebitda);
   assert.equal(buckets.reduce((n,b)=>n+b.orders,0),r.sales.originalOrders);
  }
  const composedFull=composeReviewedRange(JSON.parse(JSON.stringify(full)),expected(full));
  assert.ok(composedFull);assert.equal(reportingFinancialBuckets(composedFull,'monthly',false)[0].ebitda,original.profit.ebitda);
  const edited=structuredClone(r);edited.components.advertising++;
  assert.equal(composeReviewedRange(edited,expected(edited)),null,'A changed source total must not pass the independent browser composition');

  assert.deepEqual(await service.read(january,'Bearer fixture',{edition:HISTORY_EDITION,versionId:selected[0].versionId}),original);
  const denied=createHistoryService(h.db,auth('00000000-0000-4000-8000-000000000099'),{now});
  await assert.rejects(denied.range(week,'Bearer fixture',{edition:HISTORY_EDITION,versions:selected}),/membership/);
  await invalidateHistoryMonth(h,{from:'2025-02-01',to:'2025-02-28',reason:'Range test constituent withdrawal'});
  const withdrawn=await service.range(week,'Bearer fixture',{edition:HISTORY_EDITION,versions:selected});assert.equal(withdrawn.state,'unavailable');assert.equal(withdrawn.sales,undefined);
 }finally{await h.db.close();}
});
