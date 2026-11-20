import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {readMappedSales} from './cloud-sales-adapter.mjs';
const STORE='10000000-0000-0000-0000-000000000001',OTHER='10000000-0000-0000-0000-000000000002';
const A='20000000-0000-0000-0000-000000000001',B='20000000-0000-0000-0000-000000000002';
const R1='30000000-0000-0000-0000-000000000001',R2='30000000-0000-0000-0000-000000000002';
const fixtures=JSON.parse(readFileSync(new URL('../../tests/fixtures/financial-acceptance-v1.json',import.meta.url))).cases;
const feb=fixtures.find(c=>c.id==='F03').expected,mar=fixtures.find(c=>c.id==='F04').expected;
let db;
before(async()=>{
  db=new PGlite();
  // Minimal relevant shape inspected in cloud; not a full Supabase baseline.
  await db.exec(`CREATE TABLE public.stores(id uuid PRIMARY KEY);
    CREATE TABLE public.orders(id uuid PRIMARY KEY,store_id uuid REFERENCES stores(id),order_date timestamptz,currency text,
      gross_sales numeric,discounts numeric,refunds numeric,tax numeric,shipping numeric,financial_status text);
    CREATE TABLE public.refunds(id uuid PRIMARY KEY,store_id uuid REFERENCES stores(id),order_id uuid REFERENCES orders(id),refund_date timestamptz,amount numeric);
    CREATE ROLE fixture_client;`);
  await db.exec(readFileSync(new URL('../../db-migrations/proposed/finance_v1_sales_evidence.sql',import.meta.url),'utf8'));
});
after(async()=>{await db.close();});
beforeEach(async()=>{
  await db.exec(`TRUNCATE finance_v1.coverage_evidence,finance_v1.refund_evidence,finance_v1.order_evidence,public.refunds,public.orders,public.stores;
    INSERT INTO stores VALUES ('${STORE}'),('${OTHER}');
    INSERT INTO orders VALUES ('${A}','${STORE}','2026-02-15',NULL,100,10,20,18,5,'paid'),('${B}','${STORE}','2026-02-15',NULL,50,0,50,0,0,'refunded');
    INSERT INTO refunds VALUES ('${R1}','${STORE}','${A}','2026-03-05',30),('${R2}','${STORE}','${B}','2026-03-05',50);`);
});
async function verify(){
  await db.exec(`INSERT INTO finance_v1.order_evidence(store_id,order_id,observed_raw,event_date,currency,original_eligible,tax_basis,gross_product_vat,discount_vat,shipping_vat,evidence_ref,verified_by)
    SELECT store_id,id,current_snapshot,'2026-02-15','GBP',true,'exclusive',CASE WHEN id='${A}' THEN 20 ELSE 0 END,CASE WHEN id='${A}' THEN 2 ELSE 0 END,CASE WHEN id='${A}' THEN 1 ELSE 0 END,'synthetic documented source','test verifier'
    FROM finance_v1.order_mapping;
    INSERT INTO finance_v1.refund_evidence(store_id,refund_id,order_id,observed_raw,event_date,currency,product_cash,product_vat,shipping_cash,shipping_vat,evidence_ref,verified_by)
    SELECT store_id,id,order_id,current_snapshot,'2026-03-05','GBP',CASE WHEN id='${R1}' THEN 24 ELSE 50 END,CASE WHEN id='${R1}' THEN 4 ELSE 0 END,CASE WHEN id='${R1}' THEN 6 ELSE 0 END,CASE WHEN id='${R1}' THEN 1 ELSE 0 END,'synthetic refund source','test verifier'
    FROM finance_v1.refund_mapping;
    INSERT INTO finance_v1.coverage_evidence VALUES ('${STORE}','2026-02-01','2026-02-28','GBP',true,'complete synthetic fixture','test verifier',now()),('${STORE}','2026-03-01','2026-03-31','GBP',true,'complete synthetic fixture','test verifier',now());`);
}
const read=(month='02')=>readMappedSales(db,{storeId:STORE,currency:'GBP',from:`2026-${month}-01`,to:month==='02'?'2026-02-28':'2026-03-31'});
test('proposed schema leaves raw records intact and empty evidence is blocked',async()=>{
  assert.equal((await db.query('SELECT count(*)::int n FROM orders')).rows[0].n,2);
  assert.equal((await db.query('SELECT count(*)::int n FROM finance_v1.order_evidence')).rows[0].n,0);
  await assert.rejects(()=>read(),/coverage/);
});
test('raw cloud-shaped records plus explicit evidence reproduce approved sales and refund periods',async()=>{
  const before=(await db.query('SELECT * FROM orders ORDER BY id')).rows;await verify();
  const f=await read(),m=await read('03');
  assert.equal(f.netProductSales,feb.netProductSales);assert.equal(f.aov.value,feb.aov);assert.equal(f.originalOrders,2);
  assert.equal(m.netProductSales,mar.netProductSales);assert.equal(m.netShipping,mar.netShipping);assert.equal(m.cashRefunded,mar.cashRefunded);assert.equal(m.hasActivity,true);
  assert.equal(m.cogs,null);assert.equal(m.profitDataState,'incomplete');
  assert.deepEqual((await db.query('SELECT * FROM orders ORDER BY id')).rows,before);
});
test('unverified and changed raw records invalidate mapping rather than reuse stale approval',async()=>{
  await verify();await db.exec(`DELETE FROM finance_v1.order_evidence WHERE order_id='${A}'`);
  await assert.rejects(()=>read(),/source evidence/);
  await db.exec('TRUNCATE finance_v1.order_evidence,finance_v1.refund_evidence,finance_v1.coverage_evidence');await verify();
  await db.exec(`UPDATE orders SET gross_sales=101 WHERE id='${A}'`);await assert.rejects(()=>read(),/stale/);
});
test('changed raw refund amount invalidates verified split',async()=>{
  await verify();await db.exec(`UPDATE refunds SET amount=31 WHERE id='${R1}'`);await assert.rejects(()=>read('03'),/stale/);
});
test('verified splits must still reconcile numerically with refund total',async()=>{
  await verify();await db.exec(`UPDATE finance_v1.refund_evidence SET product_cash=25 WHERE refund_id='${R1}'`);
  await assert.rejects(()=>read('03'),/raw amount/);
});
test('same-store constraints reject wrongly attached evidence',async()=>{
  await verify();await assert.rejects(()=>db.exec(`UPDATE finance_v1.order_evidence SET store_id='${OTHER}' WHERE order_id='${A}'`),/foreign key/);
});
test('cross-order evidence does not override actual refund link',async()=>{
  await verify();await db.exec(`UPDATE finance_v1.refund_evidence SET order_id='${B}' WHERE refund_id='${R1}'`);
  await assert.rejects(()=>read('03'),/stale/);
});
test('ordinary client role cannot read or modify evidence even with accidental table grants',async()=>{
  await verify();
  await db.exec('SET ROLE fixture_client');
  await assert.rejects(()=>db.query('SELECT * FROM finance_v1.order_mapping'),/permission/);
  await db.exec('RESET ROLE');
  await db.exec('GRANT USAGE ON SCHEMA finance_v1 TO fixture_client; GRANT SELECT,INSERT ON finance_v1.order_evidence TO fixture_client; SET ROLE fixture_client');
  assert.equal((await db.query('SELECT * FROM finance_v1.order_evidence')).rows.length,0);
  await assert.rejects(()=>db.exec(`INSERT INTO finance_v1.order_evidence(store_id,order_id,observed_raw,event_date,currency,original_eligible,tax_basis,gross_product_vat,discount_vat,shipping_vat,evidence_ref,verified_by) VALUES ('${STORE}','${A}','{}','2026-02-15','GBP',true,'exclusive',0,0,0,'untrusted','fixture_client')`),/row-level security/);
  await db.exec('RESET ROLE; REVOKE ALL ON SCHEMA finance_v1 FROM fixture_client; REVOKE ALL ON finance_v1.order_evidence FROM fixture_client');
});
test('draft executes atomically and does not silently overwrite an existing finance schema',async()=>{
  await verify();
  await assert.rejects(()=>db.exec(readFileSync(new URL('../../db-migrations/proposed/finance_v1_sales_evidence.sql',import.meta.url),'utf8')),/already exists/);
  await db.exec('ROLLBACK');assert.equal((await read()).netProductSales,14000);
});
