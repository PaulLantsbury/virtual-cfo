// Disposable end-to-end database tests. No mocked sales callback, network or credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import {setup as financeSetup,sql,U,A,B} from '../shopify/finance-fixture.mjs';
import {readProfitEvidence} from './profit-evidence-reader.mjs';
import {createProfitSalesReader} from './profit-sales-reader.mjs';
import {setupProfitStagingFixture,PROFIT_STAGING_IDS as ids} from './profit-staging-fixture.mjs';
const periods=[['2026-02-01','2026-02-28'],['2026-03-01','2026-03-31'],['2026-04-01','2026-04-30']];
const readSales=createProfitSalesReader({userId:U});
async function database(){
 const {db}=await financeSetup(undefined,{installIntake:false});
 await db.exec(sql('proposals/20260913_profit_evidence.sql'));
 return db;
}
const setup=db=>setupProfitStagingFixture(db,{userId:U,readSales});
const report=(db,month=0,callback=readSales)=>readProfitEvidence(db,{versionId:ids.versions[month],scope:{storeId:ids.store,currency:'GBP',from:periods[month][0],to:periods[month][1]},readSales:callback});
const preservedTables=['public.stores','public.orders','public.refunds','public.store_memberships','finance_v1.order_evidence','finance_v1.refund_evidence','finance_v1.coverage_evidence'];
async function priorSnapshot(db){
 const rows={};
 for(const table of preservedTables){
  const key=table==='public.stores'?'id':'store_id';
  rows[table]=(await db.query(`SELECT to_jsonb(t) row FROM ${table} t WHERE ${key} IN ($1,$2) ORDER BY to_jsonb(t)::text`,[A,B])).rows;
 }
 return rows;
}
function ready(result,expected){for(const [key,value]of Object.entries(expected)){assert.equal(result[key].state,'ready',key);assert.equal(result[key].value,value,key);}}
async function counts(db){const result={};for(const table of [...preservedTables,'public.order_line_items','public.overhead_categories','public.overhead_entries','public.marketing_channel_daily_metrics','finance_v1.profit_evidence_versions','finance_v1.line_cost_evidence','finance_v1.stock_return_evidence','finance_v1.expense_evidence','finance_v1.profit_component_coverage'])result[table]=(await db.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n;return result;}

test('Actual mapped sales and prepared cost evidence reconcile February, March refunds and April restock',async()=>{
 const db=await database();try{
  const prior=await priorSnapshot(db);await setup(db);
  const feb=await report(db);assert.equal(feb.readError,null);
  assert.equal(feb.result.sales.netProductSales,14000);assert.equal(feb.result.sales.netShipping,500);assert.equal(feb.result.sales.originalOrders,2);assert.equal(feb.result.sales.aov.value,7000);
  ready(feb.result,{cogs:6000,grossProfit:8000,variableCosts:1500,advertising:1000,contributionBeforeMarketing:7000,contribution:6000,overheads:2500,da:500,operatingProfit:3500,ebitda:4000});
  const march=await report(db,1);assert.equal(march.readError,null);
  assert.equal(march.result.sales.netProductSales,-7000);assert.equal(march.result.sales.netShipping,-500);assert.equal(march.result.sales.originalOrders,0);assert.equal(march.result.sales.aov.value,null);assert.equal(march.result.sales.hasRefundActivity,true);
  ready(march.result,{cogs:0,grossProfit:-7000,variableCosts:0,advertising:0,contribution:-7500,operatingProfit:-7500,ebitda:-7500});
  const april=await report(db,2);assert.equal(april.readError,null);
  assert.equal(april.result.sales.netProductSales,0);assert.equal(april.result.sales.hasRefundActivity,false);
  ready(april.result,{cogs:-4000,grossProfit:4000,contribution:4000,operatingProfit:4000,ebitda:4000});
  ready((await report(db)).result,{cogs:6000,operatingProfit:3500});
  assert.deepEqual(await priorSnapshot(db),prior,'Existing A/B sources, evidence and memberships are unchanged');
 }finally{await db.close();}
});
test('Actual sales callback requires server identity, store membership and matching settings',async()=>{
 const db=await database();try{
  await setup(db);assert.throws(()=>createProfitSalesReader(),/identity/);
  const outsider='95000000-0000-4000-8000-000000000001';await db.query('INSERT INTO auth.users(id) VALUES($1)',[outsider]);
  await assert.rejects(report(db,0,createProfitSalesReader({userId:outsider})),/membership/);
  await db.query('DELETE FROM public.store_memberships WHERE user_id=$1 AND store_id=$2',[U,ids.store]);
  await assert.rejects(report(db),/membership/);
  await db.query('INSERT INTO public.store_memberships(user_id,store_id) VALUES($1,$2)',[U,ids.store]);
  await db.query("UPDATE public.stores SET currency_code='EUR' WHERE id=$1",[ids.store]);
  await assert.rejects(report(db),/currency/);
 }finally{await db.close();}
});
test('Raw expense, line and sales evidence changes invalidate only supported dependencies',async()=>{
 const db=await database();try{
  await setup(db);
  await db.query('UPDATE public.overhead_entries SET amount=amount+1 WHERE id=$1',[ids.expenses[1]]);
  const staleExpense=await report(db);ready(staleExpense.result,{grossProfit:8000,contribution:6000});assert.equal(staleExpense.result.operatingProfit.value,null);assert.ok(staleExpense.readError);
  await db.query('UPDATE public.overhead_entries SET amount=amount-1 WHERE id=$1',[ids.expenses[1]]);
  await db.query('UPDATE public.order_line_items SET quantity=2 WHERE id=$1',[ids.lines[0]]);
  const staleLine=await report(db);assert.equal(staleLine.result.cogs.value,null);assert.equal(staleLine.result.sales.netProductSales,14000);ready(staleLine.result,{variableCosts:1500,advertising:1000,overheads:2500});
  await db.query('UPDATE public.order_line_items SET quantity=1 WHERE id=$1',[ids.lines[0]]);
  await db.query("UPDATE finance_v1.order_evidence SET evidence_ref=evidence_ref||' revised' WHERE order_id=$1",[ids.orders[0]]);
  const revisedEvidence=await report(db);assert.equal(revisedEvidence.result.sales.netProductSales,14000);assert.equal(revisedEvidence.result.operatingProfit.value,null);assert.ok(revisedEvidence.readError,'A change to verification metadata invalidates the sealed cost/sales binding');
  await db.query('UPDATE public.orders SET gross_sales=gross_sales+1 WHERE id=$1',[ids.orders[0]]);
  await assert.rejects(report(db),/evidence|stale/i,'Stale raw sales cannot be supplied as a valid profit baseline');
 }finally{await db.close();}
});
test('Fixture replay and changes to sealed evidence are refused without duplicate records',async()=>{
 const db=await database();try{
  await setup(db);const before=await counts(db),prior=await priorSnapshot(db);
  await assert.rejects(setup(db),/replay refused/);
  assert.deepEqual(await counts(db),before);assert.deepEqual(await priorSnapshot(db),prior);
  await assert.rejects(db.query("UPDATE finance_v1.expense_evidence SET canonical_expense_key='replacement' WHERE version_id=$1",[ids.versions[0]]),/append-only/);
  await assert.rejects(db.query(`INSERT INTO finance_v1.stock_return_evidence VALUES($1,$2,'duplicate-april',$3,'2026-04-06',1,'duplicate synthetic event')`,[ids.versions[2],ids.store,ids.lines[0]]),/sealed/);
  assert.deepEqual(await counts(db),before);ready((await report(db,2)).result,{cogs:-4000});
 }finally{await db.close();}
});
test('Early and late setup failures roll back new store, membership, sources and sealed versions atomically',async()=>{
 const db=await database();try{
  const before=await counts(db),prior=await priorSnapshot(db);
  for(const failAt of ['after-sources','before-commit']){
   await assert.rejects(setupProfitStagingFixture(db,{userId:U,readSales,failAt}),/Injected fixture failure/);
   assert.deepEqual(await counts(db),before,`${failAt} leaves no partial fixture`);
   assert.deepEqual(await priorSnapshot(db),prior);
   assert.equal((await db.query('SELECT count(*)::int n FROM public.store_memberships WHERE store_id=$1',[ids.store])).rows[0].n,0);
  }
  await setup(db);ready((await report(db)).result,{operatingProfit:3500});
 }finally{await db.close();}
});

test('Calendar dates remain correct when the driver returns UK summer dates as previous-day UTC instants',async()=>{
 const db=await database();try{
  await setup(db);
  const shifted={transaction:fn=>db.transaction(tx=>fn({exec:s=>tx.exec(s),query:async(...args)=>{
   const r=await tx.query(...args);
   for(const row of r.rows){
    if(row.scope_to==='2026-03-31')row.date_to=new Date('2026-03-30T23:00:00Z');
    if(row.scope_from==='2026-04-01')row.date_from=new Date('2026-03-31T23:00:00Z');
    if(row.scope_to==='2026-04-30')row.date_to=new Date('2026-04-29T23:00:00Z');
    if(row.recovery_day==='2026-04-05')row.saleable_date=new Date('2026-04-04T23:00:00Z');
   }
   return r;
  }}))};
  const march=await report(shifted,1),april=await report(shifted,2);
  assert.equal(march.readError,null);assert.equal(april.readError,null);
  ready(march.result,{operatingProfit:-7500});ready(april.result,{recoveredCosts:4000,operatingProfit:4000});
  assert.equal(april.input.costEvidence.recoveries[0].recoveryOn,'2026-04-05');
 }finally{await db.close();}
});
