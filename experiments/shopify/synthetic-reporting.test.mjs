import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticReportingFixture,SYNTHETIC_STORE} from './synthetic-reporting-fixture.mjs';
const selected=r=>Object.fromEntries(['grossProductSales','discounts','originalOrders','netProductSales','netShipping','productRefundExVat','productRefundVat','shippingRefundExVat','shippingRefundVat','cashRefunded','hasRefundActivity'].map(k=>[k,r[k]]));
test('synthetic eligible sales and later refunds reach member reporting only after separate exact-period reviews',async()=>{
 const f=await syntheticReportingFixture();try{
 assert.equal(f.provenance,'disposable-synthetic-only');
 const otherBefore=(await f.db.query('SELECT to_jsonb(o) row FROM public.orders o WHERE store_id<>$1 ORDER BY id',[SYNTHETIC_STORE])).rows;
 await assert.rejects(f.read('sale'),/coverage/);
 assert.deepEqual(await f.importEvidence(),{first:{status:'imported_awaiting_review',coverageCertified:false,orders:1,refunds:1},refund:{status:'imported_awaiting_review',coverageCertified:false,orders:0,refunds:0}});
 for(const period of ['sale','refund'])await assert.rejects(f.read(period),/coverage/);
 await f.review('sale');const sale=await f.read('sale');
 assert.deepEqual(selected(sale),{grossProductSales:10000,discounts:1000,originalOrders:1,netProductSales:9000,netShipping:500,productRefundExVat:0,productRefundVat:0,shippingRefundExVat:0,shippingRefundVat:0,cashRefunded:0,hasRefundActivity:false});assert.equal(sale.aov.value,9000);assert.equal(sale.cogs,null);assert.equal(sale.profitDataState,'incomplete');
 await assert.rejects(f.read('refund'),/coverage/);
 await f.review('refund');const refund=await f.read('refund');
 assert.deepEqual(selected(refund),{grossProductSales:0,discounts:0,originalOrders:0,netProductSales:-2000,netShipping:-200,productRefundExVat:2000,productRefundVat:400,shippingRefundExVat:200,shippingRefundVat:40,cashRefunded:2640,hasRefundActivity:true});assert.equal(refund.aov.value,null);assert.equal(refund.cogs,null);assert.equal(refund.profitDataState,'incomplete');
 assert.deepEqual(await f.read('sale'),sale); // Later-period review/refund must not rewrite original AOV.
 const evidence=(await f.db.query('SELECT gross_product_vat,shipping_vat FROM finance_v1.order_evidence WHERE store_id=$1',[SYNTHETIC_STORE])).rows[0];assert.equal(Number(evidence.gross_product_vat),18);assert.equal(Number(evidence.shipping_vat),1);
 assert.deepEqual((await f.db.query('SELECT to_jsonb(o) row FROM public.orders o WHERE store_id<>$1 ORDER BY id',[SYNTHETIC_STORE])).rows,otherBefore);
 assert.equal((await f.db.query('SELECT count(*)::int n FROM ingest_v1.review_audit WHERE store_id=$1',[SYNTHETIC_STORE])).rows[0].n,2);
 assert.equal((await f.db.query('SELECT bool_or(coverage_certified) value FROM ingest_v1.batches WHERE store_id=$1',[SYNTHETIC_STORE])).rows[0].value,false);
 }finally{await f.db.close();}
});
