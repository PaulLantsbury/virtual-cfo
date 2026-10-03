import test from 'node:test';
import assert from 'node:assert/strict';
import {historicalProfitFixture,setupHistoricalProfitEvidence,HISTORICAL_PROFIT_IDS as ids} from './historical-profit-fixture.mjs';
import {createProfitReportingService} from './profit-reporting-service.mjs';
// Independent hand-worked pence oracle. Never produced by fixture/calculator code.
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
];
const sourceTables=['public.stores','public.store_memberships','public.orders','public.refunds','finance_v1.order_evidence','finance_v1.refund_evidence','finance_v1.coverage_evidence'];
const costTables=['public.order_line_items','public.overhead_categories','public.overhead_entries','finance_v1.profit_evidence_versions','finance_v1.line_cost_evidence','finance_v1.stock_return_evidence','finance_v1.expense_evidence','finance_v1.profit_component_coverage'];
async function snapshot(db,tables){const out={};for(const t of tables)out[t]=(await db.query(`SELECT to_jsonb(t)::text row FROM ${t} t ORDER BY to_jsonb(t)::text`)).rows;return out;}
const ready=(r,key,value)=>{assert.equal(r[key].state,'ready',key);assert.equal(r[key].value,value,key);};
test('All13 complete imported/reviewed months reconcile through stored immutable profit evidence',async()=>{
 const f=await historicalProfitFixture({prepareProfit:false});try{
  const before=await snapshot(f.db,sourceTables);
  await setupHistoricalProfitEvidence(f.db,f.profitOptions);
  assert.deepEqual(await snapshot(f.db,sourceTables),before,'Profit supplements preserve all imported sales/evidence/memberships and other stores');
  for(const [month,orders,sales,shipping,cogs,gross,contribution,operating,ebitda]of expected){
   const r=await f.readProfit(month);assert.equal(r.readError,null,month);
   assert.deepEqual([r.result.sales.originalOrders,r.result.sales.netProductSales,r.result.sales.netShipping,r.result.sales.aov.value],[orders,sales,shipping,8000],month);
   for(const [key,value]of Object.entries({cogs,grossProfit:gross,contribution,operatingProfit:operating,ebitda}))ready(r.result,key,value);
  }
  const feb=(await f.readProfit('2026-02')).result,march=(await f.readProfit('2026-03')).result,april=(await f.readProfit('2026-04')).result;
  assert.deepEqual([feb.sales.cashRefunded,feb.sales.productRefundVat,feb.sales.shippingRefundVat],[2520,400,20]);
  assert.deepEqual([march.sales.cashRefunded,march.sales.productRefundVat,march.variableCosts.value],[3600,600,4000]);
  assert.deepEqual([feb.recoveredCosts.value,march.recoveredCosts.value,april.recoveredCosts.value,april.sales.cashRefunded],[0,0,1500,0]);
  for(const key of ['2026-09','2025-09-partial']){
   const r=(await f.readProfit(key)).result;assert.equal(r.sales.netProductSales,48000);assert.equal(r.sales.aov.value,8000);
   for(const metric of ['cogs','grossProfit','contribution','operatingProfit','ebitda']){assert.equal(r[metric].value,null);assert.equal(r[metric].state,'unavailable');}
   assert.match(r.reason,/complete calendar month/);
  }
  assert.equal((await f.db.query('SELECT count(*)::int n FROM finance_v1.profit_evidence_versions')).rows[0].n,13);
  assert.equal((await f.db.query('SELECT count(*)::int n FROM finance_v1.line_cost_evidence')).rows[0].n,127);
  assert.equal((await f.db.query('SELECT count(*)::int n FROM finance_v1.stock_return_evidence')).rows[0].n,1);
  const supabase={auth:{getUser:async()=>({data:{user:{id:f.userId,is_anonymous:false}},error:null})}};
  const service=createProfitReportingService(f.db,supabase);
  const response=await service.read(f.scopes['2026-04'],'Bearer fixture-token');
  assert.equal(response.state,'ready');ready(response.report,'operatingProfit',35700);
  const missing=await service.read({...f.scopes['2026-09'],to:'2026-09-30'},'Bearer fixture-token');assert.equal(missing.state,'unavailable');
 }finally{await f.db.close();}
});
test('Prepared supplement rolls back failures and refuses replay or edits to sealed evidence',async()=>{
 const f=await historicalProfitFixture({prepareProfit:false});try{
  const before=await snapshot(f.db,[...sourceTables,...costTables]);
  const malformed=new Map(f.profitOptions.orderIds);malformed.delete(malformed.keys().next().value);
  await assert.rejects(setupHistoricalProfitEvidence(f.db,{...f.profitOptions,orderIds:malformed}),/Exact imported historical order manifest/);
  assert.deepEqual(await snapshot(f.db,[...sourceTables,...costTables]),before);
  for(const failAt of ['after-sources','before-commit']){
   await assert.rejects(setupHistoricalProfitEvidence(f.db,{...f.profitOptions,failAt}),/Injected/);
   assert.deepEqual(await snapshot(f.db,[...sourceTables,...costTables]),before);
  }
  await setupHistoricalProfitEvidence(f.db,f.profitOptions);const installed=await snapshot(f.db,[...sourceTables,...costTables]);
  await assert.rejects(setupHistoricalProfitEvidence(f.db,f.profitOptions),/replay refused/);
  await assert.rejects(f.db.query('UPDATE finance_v1.line_cost_evidence SET historic_unit_cost_pence=0 WHERE version_id=$1',[ids.versions['2026-08']]),/append-only/);
  assert.deepEqual(await snapshot(f.db,[...sourceTables,...costTables]),installed);
 }finally{await f.db.close();}
});
test('Changed cost sources withhold dependants while supported subtotals remain; membership and sales still fail closed',async()=>{
 const f=await historicalProfitFixture();try{
  const expense=(await f.db.query("SELECT source_id FROM finance_v1.expense_evidence WHERE version_id=$1 AND classification='overhead'",[ids.versions['2026-08']])).rows[0].source_id;
  await f.db.query('UPDATE public.overhead_entries SET amount=amount+1 WHERE id=$1',[expense]);
  const stale=(await f.readProfit('2026-08'));assert.ok(stale.readError);ready(stale.result,'grossProfit',60000);ready(stale.result,'contribution',49600);assert.equal(stale.result.operatingProfit.value,null);
  await f.db.query('UPDATE public.overhead_entries SET amount=amount-1 WHERE id=$1',[expense]);
  const line=ids.lineIds['line-history-2026-08-1-a'];await f.db.query('UPDATE public.order_line_items SET quantity=2 WHERE id=$1',[line]);
  const cost=(await f.readProfit('2026-08')).result;assert.equal(cost.sales.netProductSales,96000);assert.equal(cost.cogs.value,null);ready(cost,'overheads',3000);
  await f.db.query('UPDATE public.order_line_items SET quantity=1 WHERE id=$1',[line]);
  await f.db.query('DELETE FROM public.store_memberships WHERE user_id=$1 AND store_id=$2',[f.userId,f.storeId]);await assert.rejects(f.readProfit('2026-08'),/membership/);
  await f.db.query('INSERT INTO public.store_memberships VALUES($1,$2)',[f.userId,f.storeId]);
  await f.db.query('UPDATE public.orders SET gross_sales=gross_sales+0.01 WHERE id=$1',[f.profitOptions.orderIds.get('history-2026-08-1-a')]);await assert.rejects(f.readProfit('2026-08'),/stale|evidence|mapping/i);
 }finally{await f.db.close();}
});
