import test from 'node:test';
import assert from 'node:assert/strict';
import {orderFixture,detailsFixture} from './fixtures.mjs';
import {planSubsequentImport} from './plan-subsequent-import.mjs';
const scope={storeId:'store-c',shopId:'gid://shopify/Shop/3',from:'2026-02-01',to:'2026-03-31'};
function order(id=1){const o=orderFixture(id),d=detailsFixture(id).order;return {...o,...d,refunds:o.refunds.map((r,i)=>({...r,...d.refunds[i]}))};}
function source(orders=[order()]){return {scope,settings:{domain:'test.myshopify.com',shopId:scope.shopId,currency:'GBP',timezone:'Europe/London'},orders};}
function withoutRefund(){const o=order();o.refunds=[];o.transactions=o.transactions.filter(t=>t.kind==='SALE');o.transactionsCount.count=1;o.displayFinancialStatus='PAID';return o;}
const plan=(prior,next)=>planSubsequentImport({priorSources:[prior],source:next,scope});
test('later refund adds only the refund on its March event date, preserving February sale',()=>{
 const prior=source([withoutRefund()]),next=source(),copy=structuredClone({prior,next});const r=plan(prior,next);
 assert.equal(r.status,'planned_awaiting_database_checks');assert.equal(r.newOrders,0);assert.equal(r.newRefunds,1);assert.equal(r.unchangedEvents,1);
 assert.deepEqual(r.affectedEventDates,['2026-03-05']);assert.equal(r.additions[0].productCash-r.additions[0].productVat,2000);assert.equal(r.coverageCertified,false);
 assert.deepEqual({prior,next},copy);
});
test('overlapping cumulative batch adds a new order and refund without duplicating earlier events',()=>{
 const r=plan(source(),source([order(),order(2)]));assert.equal(r.newOrders,1);assert.equal(r.newRefunds,1);assert.equal(r.unchangedEvents,2);
 assert.ok(r.additions.every(e=>e.orderId==='gid://shopify/Order/2'));
});
test('identical batch is an empty plan, not a new certification or technical import receipt',()=>{
 const r=plan(source(),source());assert.deepEqual(r.additions,[]);assert.equal(r.unchangedEvents,2);assert.equal(r.coverageCertified,false);
});
test('missing earlier order or refund blocks the entire plan',()=>{
 for(const next of [source([order(2)]),source([withoutRefund()])]){const r=plan(source(),next);assert.equal(r.status,'blocked');assert.deepEqual(r.additions,[]);}
});
test('changed original event date and ambiguous edited source are blocked',()=>{
 for(const mutate of [o=>{o.transactions[0].processedAt='2026-02-16T12:00:00Z';},o=>{o.edited=true;}]){
 const next=source();mutate(next.orders[0]);assert.equal(plan(source(),next).status,'blocked');
 }
});
test('duplicate refund identity across different orders is refused',()=>{
 const next=source([order(),order(2)]);next.orders[1].refunds[0].id=next.orders[0].refunds[0].id;
 assert.equal(plan(source(),next).status,'blocked');
});
test('identity/settings mismatch or missing committed history is refused',()=>{
 const next=source();next.settings.timezone='UTC';assert.equal(plan(source(),next).status,'blocked');
 const other=source();other.scope={...scope,storeId:'other'};assert.equal(plan(source(),other).status,'blocked');
 assert.equal(planSubsequentImport({priorSources:[],source:source(),scope}).status,'blocked');
});
test('multiple committed batches deduplicate history and reject conflicting prior events',()=>{
 const a=source([withoutRefund()]),b=source();const r=planSubsequentImport({priorSources:[a,b],source:source([order(),order(2)]),scope});
 assert.equal(r.unchangedEvents,2);assert.equal(r.newOrders,1);
 const changed=source();changed.orders[0].transactions[0].processedAt='2026-02-16T12:00:00Z';
 assert.equal(planSubsequentImport({priorSources:[b,changed],source:source(),scope}).status,'blocked');
});
