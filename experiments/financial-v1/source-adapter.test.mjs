import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {readSourcePeriod,pence,assessLegacyOrder} from './source-adapter.mjs';
const cases=Object.fromEntries(JSON.parse(readFileSync(new URL('../../tests/fixtures/financial-acceptance-v1.json',import.meta.url))).cases.map(c=>[c.id,c]));
const pounds=n=>n===null?null:(n/100).toFixed(2);
let db;
before(async()=>{db=new PGlite();await db.exec(readFileSync(new URL('./source-schema.sql',import.meta.url),'utf8'));});
after(async()=>{await db.close();});
beforeEach(async()=>{
  await db.exec('TRUNCATE source_refunds,source_orders,source_costs,source_coverage');
  for(const o of cases.F03.given.orders) {
    await db.query(`INSERT INTO source_orders VALUES ($1,$2,'2026-02-15','fixture date','GBP',true,'exclusive',$3,$4,$5,0,$6,$7,1,$8,'historic invoice')`,
      ['store-A',o.id,pounds(o.grossProductExVat),pounds(o.productVat),pounds(o.discountExVat),pounds(o.netShipping),pounds(o.shippingVat),pounds(o.historicCost)]);
  }
  for(const [i,r] of cases.F04.given.refunds.entries()) {
    await db.query(`INSERT INTO source_refunds VALUES ('store-A',$1,$2,'2026-03-05','fixture refund date','GBP',$3,$4,$5,$6,$7,$8,'fixture recovery evidence')`,
      [`refund-${i}`,r.originalOrder,pounds(r.productCash),pounds(r.productVat),pounds(r.shippingCash),pounds(r.shippingVat),r.saleableReturn?1:0,r.saleableReturn?'2026-03-05':null]);
  }
  await db.exec(`INSERT INTO source_coverage VALUES ('store-A','2026-02-01','2026-02-28','GBP',true,true,'complete fixture import'),('store-A','2026-03-01','2026-03-31','GBP',true,true,'complete fixture import')`);
  const g=cases.F03.given;
  for(const [key,val] of Object.entries(g.variableCosts))await cost(key,'2026-02-20',val,'variable');
  await cost('ad','2026-02-20',g.advertising,'advertising');
  for(const [key,val]of Object.entries(g.overheads))await cost(key,'2026-02-20',val,key==='depreciationAmortisation'?'depreciation_amortisation':'overhead');
  await cost('return','2026-03-20',cases.F04.given.returnHandling,'variable');
  await cost('march-oh','2026-03-20',2000,'overhead');await cost('march-da','2026-03-20',500,'depreciation_amortisation');
});
async function cost(id,day,value,category){await db.query('INSERT INTO source_costs VALUES ($1,$2,$3,$4,$5,$6,$7)',['store-A',id,day,'GBP',pounds(value),category,'actual']);}
const read=(month='02',storeId='store-A')=>readSourcePeriod(db,{storeId,currency:'GBP',from:`2026-${month}-01`,to:month==='02'?'2026-02-28':'2026-03-31'});
const equal=(r,e,keys)=>keys.forEach(k=>assert.deepEqual(r[k],e[k],k));
test('PostgreSQL source records reproduce F03 profit bridge and F04 later refunds',async()=>{
  const feb=await read(),march=await read('03');
  equal(feb.trading,cases.F03.expected,['grossProductSales','discounts','netProductSales','originalOrders','netShipping','cogs']);
  assert.equal(feb.trading.aov.value,cases.F03.expected.aov);
  equal(feb.profit,cases.F03.expected,['revenueDenominator','grossProfit','contributionBeforeMarketing','contribution','operatingProfit','ebitda']);
  equal(march.trading,cases.F04.expected,['netProductSales','netShipping','cogs','cashRefunded','productRefundExVat','productRefundVat','shippingRefundExVat','shippingRefundVat','hasRefundActivity']);
  equal(march.profit,cases.F04.expected,['grossProfit','contribution','operatingProfit','ebitda']);
  assert.deepEqual(await read(),feb,'March query does not restate February');
  assert.equal(march.trading.hasActivity,true);
});
test('inclusive source amounts normalise without subtracting VAT twice',async()=>{
  await db.exec(`UPDATE source_orders SET tax_basis='inclusive',gross=120,gross_vat=20,discount=12,discount_vat=2,shipping=6 WHERE id='synthetic-A'`);
  const r=await read();assert.equal(r.trading.netProductSales,cases.F03.expected.netProductSales);assert.equal(r.trading.netShipping,500);
});
test('missing cost evidence preserves sales and withholds profit',async()=>{
  await db.exec(`UPDATE source_orders SET cost_evidence=NULL WHERE id='synthetic-A'`);
  const r=await read();assert.equal(r.trading.netProductSales,14000);assert.equal(r.trading.cogs,null);assert.equal(r.profit.contribution,null);assert.equal(r.profit.state,'incomplete');
});
test('same ids in another store do not enter selected store totals',async()=>{
  await db.exec(`INSERT INTO source_orders SELECT 'store-B',id,event_date,date_evidence,currency,eligible,tax_basis,9999,gross_vat,discount,discount_vat,shipping,shipping_vat,quantity,historic_unit_cost,cost_evidence FROM source_orders WHERE store_id='store-A'`);
  assert.equal((await read()).trading.netProductSales,14000);
  await assert.rejects(()=>read('02','store-B'),/coverage/);
});
test('database rejects duplicate imports and cross-store refund links',async()=>{
  await assert.rejects(()=>db.exec(`INSERT INTO source_orders SELECT * FROM source_orders LIMIT 1`),/duplicate/);
  await assert.rejects(()=>db.exec(`INSERT INTO source_refunds SELECT 'store-B',id,order_id,event_date,date_evidence,currency,product_cash,product_vat,shipping_cash,shipping_vat,saleable_quantity,returned_date,recovery_evidence FROM source_refunds LIMIT 1`),/foreign key/);
  assert.equal((await read('03')).trading.cashRefunded,8000);
});
test('duplicate source cost cannot be relabelled and counted twice',async()=>{
  await assert.rejects(()=>cost('ad','2026-02-20',1000,'overhead'),/duplicate/);
  assert.equal((await read()).profit.contribution,6000);
});
test('missing currency, tax basis, eligibility or event evidence blocks trading',async()=>{
  for(const [column,original]of [['currency',"'GBP'"],['tax_basis',"'exclusive'"],['eligible','true'],['date_evidence',"'fixture date'"]]){
    await db.exec(`UPDATE source_orders SET ${column}=NULL WHERE id='synthetic-A'`);
    await assert.rejects(()=>read());
    await db.exec(`UPDATE source_orders SET ${column}=${original} WHERE id='synthetic-A'`);
  }
});
test('missing refund VAT or recovery evidence is not interpreted as zero',async()=>{
  await db.exec(`UPDATE source_refunds SET product_vat=NULL WHERE id='refund-0'`);
  await assert.rejects(()=>read('03'),/money/);
  await db.exec(`UPDATE source_refunds SET product_vat=4,recovery_evidence=NULL WHERE id='refund-0'`);
  await assert.rejects(()=>read('03'),/recovery/);
});
test('cumulative historical refunds and returns cannot exceed the original sale',async()=>{
  await db.exec(`INSERT INTO source_refunds VALUES ('store-A','older','synthetic-A','2026-02-20','date','GBP',100,10,0,0,0,NULL,'not recovered')`);
  await assert.rejects(()=>read('03'),/Cumulative/);
  await db.exec(`DELETE FROM source_refunds WHERE id='older'; UPDATE source_refunds SET saleable_quantity=2 WHERE id='refund-1'`);
  await assert.rejects(()=>read('03'),/Cumulative/);
});
test('return-to-stock outside refund period stays unresolved',async()=>{
  await db.exec(`UPDATE source_refunds SET returned_date='2026-04-01' WHERE id='refund-1'`);
  await assert.rejects(()=>read('03'),/period unresolved/);
});
test('coverage distinguishes missing trading, missing costs and known zero costs',async()=>{
  await db.exec(`UPDATE source_coverage SET trading_complete=false WHERE date_from='2026-02-01'`);
  await assert.rejects(()=>read(),/coverage/);
  await db.exec(`UPDATE source_coverage SET trading_complete=true,costs_complete=false WHERE date_from='2026-02-01'`);
  const r=await read();assert.equal(r.trading.netProductSales,14000);assert.equal(r.profit.state,'incomplete');
  await db.exec(`DELETE FROM source_costs WHERE event_date<'2026-03-01'; UPDATE source_coverage SET costs_complete=true WHERE date_from='2026-02-01'`);
  assert.equal((await read()).profit.contribution,8500);
});
test('cost estimates remain identifiable and currency mismatch is rejected',async()=>{
  await db.exec(`UPDATE source_costs SET provenance='estimated' WHERE source_id='ad'`);
  assert.equal((await read()).provenance.containsEstimates,true);
  await db.exec(`UPDATE source_costs SET currency='USD' WHERE source_id='ad'`);
  await assert.rejects(()=>read(),/currency/);
});
test('decimal conversion is exact and refuses precision loss',()=>{
  assert.equal(pence('0.29'),29);assert.equal(pence('-70.00'),-7000);assert.equal(pence('100'),10000);
  for(const bad of [null,undefined,'','1e2','0.001','900719925474099.99',0.29])assert.throws(()=>pence(bad));
});
test('legacy cloud-shaped rows cannot be certified from populated totals alone',()=>{
  const result=assessLegacyOrder({gross_sales:100,tax:20,net_sales:80,currency:null});
  assert.equal(result.ready,false);assert.equal(result.missing.length,5);
});
