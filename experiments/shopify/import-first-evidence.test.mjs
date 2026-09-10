import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,sql} from './finance-fixture.mjs';
import {collectShopifyOrders} from './collect.mjs';
import {loadShopifyDetails} from './map-sales.mjs';
import {expected,contextFixture,pageFixture,orderFixture,detailsFixture} from './fixtures.mjs';
import {recordShopifyCandidate} from './record-candidate.mjs';
import {importFirstEvidence} from './import-first-evidence.mjs';
import {prepareCandidateReview} from './review-candidate.mjs';
const C='90000000-0000-4000-8000-000000000003';
async function fixture(){
 const {db}=await setup();
 await db.exec(sql('proposed/ingest_v1_import_service.sql'));
 await db.query("INSERT INTO stores(id,shopify_domain,shopify_store_id) VALUES($1,'new-fixture.myshopify.com','3')",[C]);
 const request=async op=>op==='context'?contextFixture():op==='orders'?pageFixture([orderFixture()]):detailsFixture();
 const data=await loadShopifyDetails(request,await collectShopifyOrders(request,expected));
 data.settings={...data.settings,domain:'new-fixture.myshopify.com',shopId:'gid://shopify/Shop/3'};
 const scope={storeId:C,from:'2026-02-01',to:'2026-02-28',shopId:data.settings.shopId};
 const recorded=await recordShopifyCandidate(db,data,scope);
 return {db,input:{...scope,batchId:recorded.batchId}};
}
test('first import creates matching event evidence without certifying coverage or changing another store',async()=>{
 const {db,input}=await fixture();try{
 const before=(await db.query('SELECT * FROM public.orders ORDER BY id')).rows;
 assert.deepEqual(await importFirstEvidence(db,input),{status:'imported_awaiting_review',coverageCertified:false,orders:1,refunds:1});
 assert.deepEqual((await db.query('SELECT * FROM public.orders WHERE store_id<>$1 ORDER BY id',[C])).rows,before);
 const packet=await prepareCandidateReview(db,input);assert.equal(packet.status,'awaiting_independent_coverage_review',JSON.stringify(packet.issues));
 const {rows}=await db.query('SELECT event_date::text,product_cash,product_vat FROM finance_v1.refund_evidence WHERE store_id=$1',[C]);
 assert.equal(rows[0].event_date,'2026-03-05');assert.equal(Number(rows[0].product_cash),24);assert.equal(Number(rows[0].product_vat),4);
 assert.equal((await db.query('SELECT sales_and_refunds_complete FROM finance_v1.coverage_evidence WHERE store_id=$1',[C])).rows[0].sales_and_refunds_complete,false);
 await assert.rejects(importFirstEvidence(db,input),/empty store/);
 }finally{await db.close();}
});
test('changed source version is refused without inserting records',async()=>{
 const {db,input}=await fixture();try{
 await db.query("UPDATE ingest_v1.source_versions SET source_version=source_version+interval '1 day' WHERE store_id=$1",[C]);
 await assert.rejects(importFirstEvidence(db,input),/stale/);
 assert.equal((await db.query('SELECT count(*)::int n FROM orders WHERE store_id=$1',[C])).rows[0].n,0);
 }finally{await db.close();}
});
test('late failure rolls back all new records and evidence',async()=>{
 const {db,input}=await fixture();try{
 const failing={transaction:fn=>db.transaction(tx=>fn({query:(sql,args)=>{if(sql.startsWith('INSERT INTO finance_v1.coverage'))throw new Error('synthetic late failure');return tx.query(sql,args);}}))};
 await assert.rejects(importFirstEvidence(failing,input),/synthetic late/);
 for(const table of ['public.orders','public.refunds','finance_v1.order_evidence','finance_v1.refund_evidence'])assert.equal((await db.query(`SELECT count(*)::int n FROM ${table} WHERE store_id=$1`,[C])).rows[0].n,0);
 }finally{await db.close();}
});

test('restricted importer succeeds but cannot certify, overwrite sources or change permissions',async()=>{
 const {db,input}=await fixture();try{
 const restricted={transaction:fn=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE night_scout_import_service');return fn(tx);})};
 await importFirstEvidence(restricted,input);
 for(const query of [
  "UPDATE finance_v1.coverage_evidence SET sales_and_refunds_complete=true WHERE store_id='"+C+"'",
  "UPDATE public.orders SET net_sales=999 WHERE store_id='"+C+"'",
  'DELETE FROM public.refunds',
  'TRUNCATE public.orders CASCADE',
  "UPDATE ingest_v1.heads SET needs_recheck=false WHERE store_id='"+C+"'",
  "GRANT night_scout_import_service TO authenticated"
 ])await assert.rejects(restricted.transaction(tx=>tx.query(query)),/permission|policy|privilege|grant/i);
 const row=(await db.query('SELECT sales_and_refunds_complete FROM finance_v1.coverage_evidence WHERE store_id=$1',[C])).rows[0];assert.equal(row.sales_and_refunds_complete,false);
 }finally{await db.close();}
});
