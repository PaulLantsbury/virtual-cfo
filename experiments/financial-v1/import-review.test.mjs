import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewImportBatch} from './import-review.mjs';
const now=new Date('2026-04-02T12:00:00Z');
function fixture(){
 const settings={currency:'GBP',timezone:'Europe/London'};
 return {version:1,scope:{storeId:'A',...settings,from:'2026-03-01',to:'2026-03-31'},
 manifest:{storeId:'A',...settings,from:'2026-03-01',to:'2026-03-31',sourceRef:'synthetic-only',snapshotRef:'snapshot-1',capturedAt:'2026-04-01T12:00:00Z',originalOrdersAndLifetimeRefunds:true,
 pages:{orders:[{cursor:null,nextCursor:null,snapshotRef:'snapshot-1',ids:['order-1']}],refunds:[{cursor:null,nextCursor:null,snapshotRef:'snapshot-1',ids:['refund-1']}]}},
 orders:[{id:'order-1',store_id:'A',day:'2026-02-15',currency:'GBP',gross:'100',gross_vat:'20',discount:'10',discount_vat:'2',shipping:'0',shipping_vat:'0',tax_basis:'exclusive',original_eligible:true,mapping_state:'verified',evidence_ref:'synthetic-sale',settings}],
 refunds:[{id:'refund-1',store_id:'A',order_id:'order-1',day:'2026-03-05',currency:'GBP',amount:'24',product_cash:'24',product_vat:'4',shipping_cash:'0',shipping_vat:'0',mapping_state:'verified',evidence_ref:'synthetic-refund',settings}]};
}
test('dry-run candidate preserves refund event period without certifying coverage or mutating input',()=>{
 const b=fixture(),copy=structuredClone(b);const r=reviewImportBatch(b,{now});
 assert.equal(r.status,'ready_for_source_review');assert.equal(r.coverageCertified,false);assert.equal(r.candidate.netProductSales,-2000);assert.equal(r.candidate.aov.value,null);assert.deepEqual(b,copy);
});
test('replay and changed batches are distinguished for subsequent reconciliation',()=>{
 const b=fixture(),first=reviewImportBatch(b,{now});
 assert.equal(reviewImportBatch(b,{now,previousFingerprint:first.fingerprint}).replay,true);
 b.manifest.snapshotRef='snapshot-2';for(const stream of Object.values(b.manifest.pages))stream[0].snapshotRef='snapshot-2';
 assert.equal(reviewImportBatch(b,{now,previousFingerprint:first.fingerprint}).changedSincePrevious,true);
});
test('partial pages, missing records, duplicates and mixed snapshots are blocked',()=>{
 for(const mutate of [b=>b.manifest.pages.orders[0].nextCursor='next',b=>b.manifest.pages.orders[0].ids=[],b=>b.orders.push(structuredClone(b.orders[0])),b=>b.manifest.pages.refunds[0].snapshotRef='other',b=>delete b.manifest.pages.refunds,b=>b.manifest.pages.orders[0].ids.push('order-1')]){
 const b=fixture();mutate(b);const r=reviewImportBatch(b,{now});assert.equal(r.status,'blocked');assert.equal(r.candidate,null);
 }
});
test('settings changes and absent lifetime refund evidence cannot pass',()=>{
 for(const mutate of [b=>b.manifest.timezone='UTC',b=>b.orders[0].settings={currency:'GBP',timezone:'UTC'},b=>b.manifest.originalOrdersAndLifetimeRefunds=false,b=>b.manifest.storeId='B',b=>b.scope.currency='JPY',b=>b.orders[0].mapping_state='stale_evidence']){
 const b=fixture();mutate(b);assert.equal(reviewImportBatch(b,{now}).status,'blocked');
 }
});
test('bad refund links, over-refunds and invalid money remain blocked by shared arithmetic',()=>{
 for(const mutate of [b=>b.refunds[0].order_id='missing',b=>{b.refunds[0].product_cash='240';b.refunds[0].amount='240';},b=>b.orders[0].gross=null]){
 const b=fixture();mutate(b);assert.equal(reviewImportBatch(b,{now}).status,'blocked');
 }
});
test('ongoing periods, early snapshots and future captures cannot claim completeness',()=>{
 const b=fixture();assert.equal(reviewImportBatch(b,{now:new Date('2026-03-31T12:00:00Z')}).status,'blocked');
 b.manifest.capturedAt='2026-03-30T12:00:00Z';assert.equal(reviewImportBatch(b,{now}).status,'blocked');
 b.manifest.capturedAt='2026-04-03T12:00:00Z';assert.equal(reviewImportBatch(b,{now}).status,'blocked');
});
test('complete chained pages and an explicit empty snapshot are reviewable',()=>{
 const b=fixture();
 b.manifest.pages.orders=[{cursor:null,nextCursor:'page-2',snapshotRef:'snapshot-1',ids:[]},{cursor:'page-2',nextCursor:null,snapshotRef:'snapshot-1',ids:['order-1']}];
 assert.equal(reviewImportBatch(b,{now}).status,'ready_for_source_review');
 b.orders=[];b.refunds=[];
 for(const name of ['orders','refunds'])b.manifest.pages[name]=[{cursor:null,nextCursor:null,snapshotRef:'snapshot-1',ids:[]}];
 const r=reviewImportBatch(b,{now});assert.equal(r.status,'ready_for_source_review');assert.equal(r.candidate.hasActivity,false);assert.equal(r.coverageCertified,false);
});
test('earlier refunds are retained when checking cumulative component limits',()=>{
 const b=fixture();const older={...b.refunds[0],id:'refund-0',day:'2026-02-20',amount:'96',product_cash:'96',product_vat:'16'};
 b.refunds.push(older);b.manifest.pages.refunds[0].ids.push('refund-0');
 assert.equal(reviewImportBatch(b,{now}).status,'blocked');
});
