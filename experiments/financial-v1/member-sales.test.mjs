import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {fetchVerifiedSales} from './rpc-sales-adapter.mjs';
import {prepareOrderEvent,prepareRefundEvent} from './event-evidence.mjs';
const A='90000000-0000-4000-8000-000000000001',B='90000000-0000-4000-8000-000000000002',U='80000000-0000-4000-8000-000000000001',O='91000000-0000-4000-8000-000000000001',R='92000000-0000-4000-8000-000000000001';
const sql=p=>readFileSync(new URL('../../db-migrations/'+p,import.meta.url),'utf8');
test('exact staging baseline and evidence endpoint enforce membership and event-period calculations',async()=>{
const db=new PGlite();try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;`);
 await db.exec(sql('staging/20260909_bootstrap.sql'));await db.exec('ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon,authenticated');await db.exec(sql('proposed/finance_v1_sales_evidence.sql'));await db.exec(sql('proposed/finance_v1_member_read.sql'));
 await db.query("INSERT INTO stores(id,shopify_domain,shopify_store_id) VALUES($1,'a.invalid','a'),($2,'b.invalid','b')",[A,B]);
 await db.query('INSERT INTO auth.users VALUES($1)',[U]);await db.query('INSERT INTO store_memberships VALUES($1,$2)',[U,A]);
 await db.query("INSERT INTO orders(id,store_id,shopify_order_id,order_date,currency,gross_sales,discounts,refunds,tax,shipping,financial_status) VALUES($1,$2,'sample','2026-02-15T12:00:00Z','GBP',123,0,20,0,0,'refunded')",[O,A]);
 await db.query("INSERT INTO refunds(id,store_id,order_id,refund_date,amount) VALUES($1,$2,$3,'2026-03-15T12:00:00Z',20)",[R,A,O]);
 const original=prepareOrderEvent({saleTimestamp:'2026-02-15T12:00:00Z',storeTimeZone:'Europe/London',originalPaymentStatus:'paid',isTest:false,cancelledBeforeSale:false,requiresAdjustmentReview:false,evidenceRef:'synthetic:sale'});
 const refund=prepareRefundEvent({refundTimestamp:'2026-03-15T12:00:00Z',storeTimeZone:'Europe/London',requiresAdjustmentReview:false,evidenceRef:'synthetic:refund'});
 await db.query("INSERT INTO finance_v1.order_evidence(store_id,order_id,observed_raw,event_date,currency,original_eligible,tax_basis,gross_product_vat,discount_vat,shipping_vat,evidence_ref,verified_by) SELECT store_id,id,current_snapshot,$1,'GBP',$2,'exclusive',0,0,0,$3,'fixture' FROM finance_v1.order_mapping",[original.event_date,original.original_eligible,original.evidence_ref]);
 await db.query("INSERT INTO finance_v1.refund_evidence(store_id,refund_id,order_id,observed_raw,event_date,currency,product_cash,product_vat,shipping_cash,shipping_vat,evidence_ref,verified_by) SELECT store_id,id,order_id,current_snapshot,$1,'GBP',20,0,0,0,$2,'fixture' FROM finance_v1.refund_mapping",[refund.event_date,refund.evidence_ref]);
 await db.query("INSERT INTO finance_v1.coverage_evidence VALUES($1,'2026-02-01','2026-02-28','GBP',true,'synthetic','fixture',now()),($1,'2026-03-01','2026-03-31','GBP',true,'synthetic','fixture',now())",[A]);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[U]);await db.exec('SET ROLE authenticated');
 const rpc=async(name,p)=>({data:(await db.query('SELECT public.verified_sales_source($1,$2,$3) AS data',[p.p_store_id,p.p_date_from,p.p_date_to])).rows[0].data,error:null});
 const read=(from,to,storeId=A)=>fetchVerifiedSales(rpc,{storeId,currency:'GBP',from,to});
 const feb=await read('2026-02-01','2026-02-28'),mar=await read('2026-03-01','2026-03-31');
 assert.equal(feb.netProductSales,12300);assert.equal(feb.aov.value,12300);assert.equal(feb.originalOrders,1);
 assert.equal(mar.netProductSales,-2000);assert.equal(mar.hasActivity,true);assert.equal(mar.originalOrders,0);assert.equal(mar.cogs,null);
 await assert.rejects(read('2026-02-01','2026-02-28',B),e=>e.code==='42501');
 await assert.rejects(db.query('UPDATE finance_v1.order_evidence SET original_eligible=false'),e=>e.code==='42501');
 await assert.rejects(read('2026-04-01','2026-04-30'),/coverage/);
 await db.exec('RESET ROLE;SET ROLE anon');await assert.rejects(read('2026-02-01','2026-02-28'),e=>e.code==='42501');
 await db.exec('RESET ROLE');await db.query('UPDATE orders SET gross_sales=124 WHERE id=$1',[O]);await db.exec('SET ROLE authenticated');await assert.rejects(read('2026-02-01','2026-02-28'),/stale/);
 await db.exec('RESET ROLE');await db.query('DELETE FROM store_memberships WHERE user_id=$1',[U]);await db.exec('SET ROLE authenticated');await assert.rejects(read('2026-02-01','2026-02-28'),e=>e.code==='42501');
 assert.equal((await db.query('SELECT count(*)::int n FROM finance_v1.order_evidence')).rows[0].n,0);
}finally{await db.close();}});
test('RPC adapter rejects wrong scope and errors rather than falling back to legacy values',async()=>{
 const scope={storeId:A,currency:'GBP',from:'2026-02-01',to:'2026-02-28'};
 await assert.rejects(fetchVerifiedSales(async()=>({data:null,error:{message:'denied'}}),scope),/unavailable/);
 await assert.rejects(fetchVerifiedSales(async()=>({data:{version:1,storeId:B,from:scope.from,to:scope.to},error:null}),scope),/scope/);
});
test('exact combined staging package produces August original AOV and September refunds, and refuses repeat application',async()=>{
const db=new PGlite();try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;`);
 await db.exec(sql('staging/20260909_bootstrap.sql'));
 await db.query("INSERT INTO stores(id,shopify_domain,shopify_store_id) VALUES($1,'night-scout-staging-a.invalid','staging-test-a'),($2,'night-scout-staging-b.invalid','staging-test-b')",[A,B]);
 await db.query('INSERT INTO auth.users VALUES($1)',[U]);await db.query('INSERT INTO store_memberships VALUES($1,$2)',[U,B]);
 await db.query("INSERT INTO orders(id,store_id,shopify_order_id,order_date,created_at,currency,gross_sales,net_sales,total_sales,shipping) VALUES($1,$2,'staging-isolation-a','2026-08-15T12:00:00Z','2026-08-15T12:00:00Z','GBP',123,123,123,0),('91000000-0000-4000-8000-000000000002',$3,'staging-isolation-b','2026-08-15T12:00:00Z','2026-08-15T12:00:00Z','GBP',987,987,987,0)",[O,A,B]);
 const bundle=sql('staging/20260909_finance_setup.sql');await db.exec(bundle);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[U]);await db.exec('SET ROLE authenticated');
 const rpc=async(name,p)=>({data:(await db.query('SELECT public.verified_sales_source($1,$2,$3) AS data',[p.p_store_id,p.p_date_from,p.p_date_to])).rows[0].data,error:null});
 const aug=await fetchVerifiedSales(rpc,{storeId:B,currency:'GBP',from:'2026-08-01',to:'2026-08-31'}),sep=await fetchVerifiedSales(rpc,{storeId:B,currency:'GBP',from:'2026-09-01',to:'2026-09-30'});
 assert.equal(aug.netProductSales,98700);assert.equal(aug.aov.value,98700);assert.equal(sep.netProductSales,-8700);assert.equal(sep.hasActivity,true);assert.equal(sep.aov.value,null);
 await db.exec('RESET ROLE');await assert.rejects(db.exec(bundle),/already exists/);await db.exec('ROLLBACK');
 assert.equal((await db.query('SELECT count(*)::int n FROM refunds')).rows[0].n,2);
}finally{await db.close();}});
