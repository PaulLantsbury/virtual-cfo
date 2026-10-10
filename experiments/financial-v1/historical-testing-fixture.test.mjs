import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchVerifiedSales} from './rpc-sales-adapter.mjs';
import {calculateProfitEvidence} from './profit-evidence.mjs';
import {historicalManifest,historicalInput,historicalCosts,PERIODS} from './historical-testing-fixture.mjs';

// Hand-worked fixed pence oracle from the reviewed proposal, independent of
// fixture generation and production arithmetic. No calculator builds expected values.
const expected=[
  ['2025-08',6,48000,1800,18000,30000,24800,21800,22400],
  ['2025-09',9,72000,2700,27000,45000,37200,34200,34800],
  ['2025-10',9,72000,2700,27000,45000,37200,34200,34800],
  ['2025-11',12,96000,3600,36000,60000,49600,46600,47200],
  ['2025-12',15,120000,4500,45000,75000,62000,59000,59600],
  ['2026-01',6,48000,1800,18000,30000,24800,21800,22400],
  ['2026-02',6,46000,1700,18000,28000,22700,19700,20300],
  ['2026-03',9,69000,2700,27000,42000,33800,30800,31400],
  ['2026-04',9,72000,2700,25500,46500,38700,35700,36300],
  ['2026-05',9,72000,2700,27000,45000,37200,34200,34800],
  ['2026-06',12,96000,3600,36000,60000,49600,46600,47200],
  ['2026-07',12,96000,3600,36000,60000,49600,46600,47200],
  ['2026-08',12,96000,3600,36000,60000,49600,46600,47200],
  ['2026-09',6,48000,1800,null,null,null,null,null],
];
async function salesFor(month,options,mutate=()=>{}) {
  const input=historicalInput(month,options);mutate(input);
  return fetchVerifiedSales(async(name,args)=>{
    assert.equal(name,'verified_sales_source');assert.equal(args.p_store_id,input.scope.storeId);
    return {error:null,data:{version:1,storeId:input.scope.storeId,from:input.scope.from,to:input.scope.to,...input.mapped}};
  },input.scope);
}
async function reportFor(month,mutate=()=>{}) {
  const input=historicalCosts(historicalInput(month).scope,await salesFor(month));mutate(input);
  return calculateProfitEvidence(input);
}
for(const [month,originalOrders,netProductSales,netShipping,cogs,grossProfit,contribution,operatingProfit,ebitda] of expected) {
  test(`fixed independent historical oracle ${month}`,async()=>{
    const r=await reportFor(month);
    for(const [key,value] of Object.entries({originalOrders,netProductSales,netShipping})) assert.equal(r.sales[key],value,key);
    assert.equal(r.sales.aov.value,8000);
    for(const [key,value] of Object.entries({cogs,grossProfit,contribution,operatingProfit,ebitda})) {
      assert.equal(r[key].value,value,key);assert.equal(r[key].state,value===null?'unavailable':'ready',key);
    }
    if(month==='2026-09') assert.match(r.reason,/complete calendar month/);
  });
}
test('manifest is deterministic, isolated, explicit-offset and uniquely linked',()=>{
  const m=historicalManifest();assert.deepEqual(m,historicalManifest());
  assert.equal(m.orders.length,132);assert.equal(m.actions.length,135);
  assert.equal(m.refunds.length,2);assert.equal(m.recoveries.length,1);
  assert.equal(new Set(m.actions.map(a=>a.id)).size,135);
  assert.equal(new Set(m.expenses.map(e=>e.sourceId)).size,m.expenses.length);
  const localDate=new Intl.DateTimeFormat('en-CA',{timeZone:m.timezone,year:'numeric',month:'2-digit',day:'2-digit'});
  const localHour=new Intl.DateTimeFormat('en-GB',{timeZone:m.timezone,hour:'2-digit',hourCycle:'h23'});
  for(const order of m.orders) {
    assert.equal(localDate.format(new Date(order.occurredAt)),order.day);
    assert.equal(localHour.format(new Date(order.occurredAt)),String(10+'abc'.indexOf(order.id.at(-1))));
    assert.equal(order.synthetic,true);assert.equal(order.original_eligible,true);
  }
  for(const action of m.actions) {
    assert.ok(Number.isFinite(Date.parse(action.occurredAt)));
    assert.equal(localDate.format(new Date(action.occurredAt)),action.occurredAt.slice(0,10));
    assert.equal(localHour.format(new Date(action.occurredAt)),action.occurredAt.slice(11,13));
    assert.ok(Date.parse(action.occurredAt)<=Date.parse(m.frozenAt));
    if(action.originalOrderId) assert.ok(m.orders.some(o=>o.id===action.originalOrderId));
  }
  assert.equal(m.expenses.filter(e=>e.category==='overheads').length,13);
  assert.equal(PERIODS.length,14);assert.equal(m.status,'prepared-only');
});
test('August year-on-year and September matched partial periods do not mix scopes',async()=>{
  assert.equal((await salesFor('2025-08')).netProductSales,48000);
  assert.equal((await salesFor('2026-08')).netProductSales,96000);
  for(const [month,options] of [['2025-09',{throughDay:17}],['2026-09',{}]]) {
    const s=await salesFor(month,options);
    assert.equal(s.netProductSales,48000);assert.equal(s.originalOrders,6);assert.equal(s.aov.value,8000);
    const r=calculateProfitEvidence(historicalCosts(historicalInput(month,options).scope,s));
    assert.equal(r.operatingProfit.value,null);
  }
  assert.throws(()=>historicalInput('2026-10'),/Unreviewed/);
  assert.throws(()=>historicalInput('2026-08',{throughDay:17}),/Unreviewed/);
});
test('excluded £999 test order never changes eligible sales or profit',async()=>{
  const s=await salesFor('2026-08',{excludedTestOrder:true});
  assert.deepEqual(s,await salesFor('2026-08'));
  const r=calculateProfitEvidence(historicalCosts(historicalInput('2026-08').scope,s));
  assert.equal(r.contribution.value,49600);
});
test('refund-event cash/VAT and independently dated stock recovery remain separate',async()=>{
  const feb=await reportFor('2026-02'),march=await reportFor('2026-03'),april=await reportFor('2026-04');
  assert.equal(feb.sales.cashRefunded,2520);assert.equal(feb.sales.productRefundVat,400);assert.equal(feb.sales.shippingRefundVat,20);
  assert.equal(march.sales.cashRefunded,3600);assert.equal(march.sales.productRefundVat,600);
  assert.equal(feb.recoveredCosts.value,0);assert.equal(march.recoveredCosts.value,0);
  assert.equal(april.recoveredCosts.value,1500);assert.equal(april.sales.cashRefunded,0);
  assert.equal(march.variableCosts.value,4000);
});
test('missing historical cost and overhead evidence preserve independently supported subtotals',async()=>{
  const cost=await reportFor('2026-08',i=>{i.costEvidence.lines.find(l=>l.soldOn==='2026-08-05').unitCostPence=null;});
  assert.equal(cost.sales.netProductSales,96000);assert.equal(cost.grossProfit.value,null);
  const overhead=await reportFor('2026-08',i=>{i.costEvidence.coverage.overheads.complete=false;});
  assert.equal(overhead.grossProfit.value,60000);assert.equal(overhead.contribution.value,49600);
  assert.equal(overhead.operatingProfit.value,null);assert.equal(overhead.ebitda.value,null);
});
test('stale evidence, penny mismatch and incomplete extraction fail closed',async()=>{
  for(const mutate of [i=>{i.mapped.orders[0].mapping_state='stale';},i=>{i.mapped.refunds[0].amount='25.21';},i=>{i.mapped.coverage[0].sales_and_refunds_complete=false;}]) {
    await assert.rejects(()=>salesFor('2026-02',{},mutate));
  }
});
test('cost preparation refuses unreviewed scopes before declaring synthetic coverage',async()=>{
  const scope=historicalInput('2026-08').scope,sales=await salesFor('2026-08');
  for(const override of [
    {from:'2026-10-01',to:'2026-10-31'},
    {from:'2026-08-02'},
    {to:'2026-08-30'},
    {from:'2026-09-01',to:'2026-09-30'},
    {currency:'USD'},
    {storeId:'another-store'},
  ]) assert.throws(()=>historicalCosts({...scope,...override},sales),/scope/);
  assert.throws(()=>historicalCosts(null,sales),/scope/);
});
