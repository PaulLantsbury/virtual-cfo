import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileCandidateEvents,prepareCandidateReview} from './review-candidate.mjs';
import {collectShopifyOrders} from './collect.mjs';
import {loadShopifyDetails} from './map-sales.mjs';
import {sourceVersions} from './source-versions.mjs';
import {expected,contextFixture,orderFixture,pageFixture,detailsFixture} from './fixtures.mjs';
const order={id:'local-1',shopify_order_id:'1',mapping_state:'verified',gross:'100',gross_vat:'20',discount:'10',discount_vat:'2',shipping:'0',shipping_vat:'0',tax_basis:'exclusive',day:'2026-02-15',currency:'GBP',original_eligible:true};
const sale={id:'sale:gid://shopify/Order/1',orderId:'gid://shopify/Order/1',type:'sale',date:order.day,currency:'GBP',eligible:true,grossProductExVat:10000,discountExVat:1000,netShipping:0};
test('reconciliation matches source identities and original sale components',()=>{
 assert.deepEqual(reconcileCandidateEvents([sale],[order],[]),[]);
 assert.deepEqual(reconcileCandidateEvents([sale],[{...order,shopify_order_id:'gid://shopify/Order/1'}],[]),[]);
 const differences=reconcileCandidateEvents([sale],[{...order,shopify_order_id:'2'}],[]);
 assert.deepEqual(differences.map(d=>d.reason),['missing_finance_event','unexpected_finance_event']);
 assert.equal(reconcileCandidateEvents([sale],[{...order,gross:'110',discount:'20'}],[])[0].reason,'financial_event_mismatch');
 assert.equal(reconcileCandidateEvents([sale],[{...order,day:'2026-02-16'}],[])[0].reason,'financial_event_mismatch');
});
test('duplicate, missing and stale evidence fail closed',()=>{
 assert.throws(()=>reconcileCandidateEvents([sale],[order,order],[]),/Duplicate/);
 assert.throws(()=>reconcileCandidateEvents([sale],[{...order,shopify_order_id:null}],[]),/identity/);
 assert.throws(()=>reconcileCandidateEvents([sale],[{...order,mapping_state:'stale_evidence'}],[]),/stale/);
});
test('later refund tax splits and original order links are compared',()=>{
 const r={id:'local-r',order_id:order.id,shopify_refund_id:'1',mapping_state:'verified',day:'2026-03-05',currency:'GBP',product_cash:'24',product_vat:'4',shipping_cash:'0',shipping_vat:'0'};
 const event={id:'refund:gid://shopify/Refund/1',orderId:sale.orderId,type:'refund',date:r.day,currency:'GBP',productCash:2400,productVat:400,shippingCash:0,shippingVat:0};
 assert.deepEqual(reconcileCandidateEvents([sale,event],[order],[r]),[]);
 assert.equal(reconcileCandidateEvents([sale,event],[order],[{...r,product_vat:'3'}])[0].reason,'financial_event_mismatch');
 assert.throws(()=>reconcileCandidateEvents([sale,event],[order],[{...r,order_id:'different'}]),/order missing/);
});
async function fixture(){
 const request=async op=>op==='context'?contextFixture():op==='orders'?pageFixture([orderFixture()]):detailsFixture();
 const data=await loadShopifyDetails(request,await collectShopifyOrders(request,expected));
 const scope={storeId:'store-a',shopId:expected.shopId,from:'2026-02-01',to:'2026-02-28'};
 const store={id:scope.storeId,shopify_domain:expected.domain,shopify_store_id:'1',currency_code:'GBP',timezone:data.settings.timezone};
 const head={batch_id:'batch-1',needs_recheck:true,payload:{source:{apiVersion:data.apiVersion,settings:data.settings,orders:data.orders,scope}}};
 const rows={store,head,versions:sourceVersions(data.orders).map(r=>({source_id:r.id,source_version:r.version,fingerprint:r.fingerprint})),orders:[{...order,store_id:scope.storeId}],refunds:[{id:'r',store_id:scope.storeId,order_id:order.id,shopify_refund_id:data.orders[0].refunds[0].id,mapping_state:'verified',day:'2026-03-05',currency:'GBP',amount:'24',product_cash:'24',product_vat:'4',shipping_cash:'0',shipping_vat:'0'}],coverage:[{store_id:scope.storeId,currency:'GBP',sales_and_refunds_complete:false,evidence_ref:'synthetic-only'}]};
 const calls=[];
 const db={transaction:fn=>fn({exec:async sql=>{calls.push(sql);assert.match(sql,/READ ONLY/);},query:async sql=>{calls.push(sql);assert.match(sql,/^SELECT/);return {rows:sql.includes('FROM public.stores')?[rows.store]:sql.includes('FROM ingest_v1.heads')?[rows.head]:sql.includes('source_versions')?rows.versions:sql.includes('order_mapping')?rows.orders:sql.includes('refund_mapping')?rows.refunds:rows.coverage};}})};
 return {db,rows,scope,calls};
}
test('matching review stays uncertified, read-only and bound to an exact snapshot',async()=>{
 const {db,rows,scope}=await fixture();
 const first=await prepareCandidateReview(db,scope);
 assert.equal(first.status,'awaiting_independent_coverage_review');
 assert.equal(first.coverageCertified,false);assert.equal(first.figures,null);
 assert.equal(rows.coverage[0].sales_and_refunds_complete,false);assert.equal(rows.head.needs_recheck,true);
 assert.equal((await prepareCandidateReview(db,scope)).snapshotDigest,first.snapshotDigest);
 rows.head.batch_id='batch-2';assert.notEqual((await prepareCandidateReview(db,scope)).snapshotDigest,first.snapshotDigest);
 rows.store.timezone='Pacific/Auckland';assert.equal((await prepareCandidateReview(db,scope)).status,'blocked');
});
test('advanced versions and missing evidence block the review packet',async()=>{
 const {db,rows,scope}=await fixture();rows.versions[0].source_version='2027-01-01T00:00:00Z';
 assert.equal((await prepareCandidateReview(db,scope)).status,'blocked');
 const f=await fixture();f.rows.coverage=[];
 assert.equal((await prepareCandidateReview(f.db,f.scope)).status,'blocked');
});
