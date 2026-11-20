import test from 'node:test';
import assert from 'node:assert/strict';
import { generate } from './generator.mjs';
import { stableId, RESERVED_SYNTHETIC_IDENTITY } from './staging-payload.mjs';
import { buildAcquisitionSource, summarizeAcquisitionSource } from './acquisition-source.mjs';
import { supplementalDigest } from './supplemental-reader.mjs';
import { validateAcquisitionPayload, acquisitionView } from '../../artifacts/virtual-cfo/src/lib/marketing/acquisition-evidence.ts';
const fixture=generate({from:'2024-01-01',asOf:'2024-03-01'});
const source=buildAcquisitionSource(fixture);
const financial=(from='2024-02-01',to='2024-02-29')=>({state:'supported',versionId:'reviewed-month-1',scope:{storeId:RESERVED_SYNTHETIC_IDENTITY.storeId,currency:'GBP',from,to},metadata:{edition:'synthetic-history-v2-2026-11',anchor:'2024-01-01',formulaVersion:'night-scout-v11-2026-10-30'},salesRevision:'sales-r',costRevision:'cost-r',sales:{originalOrders:fixture.events.filter(e=>e.kind==='sale'&&e.date>=from&&e.date<=to).length,netProductSales:fixture.events.filter(e=>e.date>=from&&e.date<=to).reduce((n,e)=>n+(e.metrics.productSales||0)-(e.metrics.refunds||0),0)},components:{advertising:fixture.events.filter(e=>e.date>=from&&e.date<=to).flatMap(e=>e.postings).filter(p=>p.account==='expense:marketing').reduce((n,p)=>n+p.amount,0)}});
const summary=()=>summarizeAcquisitionSource(source,{from:'2024-02-01',to:'2024-02-29',financial:financial()});
test('source is exact order-linked, immutable, contact-free and extension-stable',()=>{
 const before=JSON.stringify(fixture);
 const repeated=buildAcquisitionSource(fixture);
 assert.equal(repeated.sourceHash,source.sourceHash);assert.equal(JSON.stringify(fixture),before);
 const extended=buildAcquisitionSource(generate({from:'2024-01-01',asOf:'2024-03-02'}));
 assert.deepEqual(extended.orderObservations.filter(o=>o.date<=source.through),source.orderObservations);
 assert.deepEqual(extended.spendAllocations.filter(a=>a.date<=source.through),source.spendAllocations);
 for(const o of source.orderObservations){assert.equal(o.orderId,stableId('order',o.orderRef));assert.match(o.saleSourceHash,/^[a-f0-9]{64}$/);assert.equal('email' in o,false);assert.equal('name' in o,false);if(o.identityState!=='identified'){assert.equal(o.customerId,null);assert.equal(o.firstOrderId,null);}else assert.ok(o.firstOrderDate<=o.date);}
});
test('every advertising source partitions exact pennies and customer-level acquisitions reconcile',()=>{
 for(const a of source.spendAllocations){assert.equal(a.acquisition+a.retention+a.unallocated,a.advertising);assert.equal(a.firstAllocations.reduce((n,r)=>n+r.amount,0),a.acquisition);}
 const p=summary();assert.ok(p.coverage.guestOrders>0);assert.ok(p.coverage.unknownOrders>0);assert.ok(p.coverage.identifiedRepeatOrders>0);assert.ok(p.coverage.paidFirstCustomers>0);
 assert.equal(p.coverage.identifiedFirstOrders+p.coverage.identifiedRepeatOrders+p.coverage.guestOrders+p.coverage.unknownOrders,p.coverage.originalOrders);
 assert.equal(p.spend.advertising,financial().components.advertising);assert.equal(p.metrics.cac,null);assert.equal(acquisitionView(p,financial()).cac,p.spend.acquisition/p.coverage.paidFirstCustomers);
 assert.equal(p.metrics.firstOrderContribution,null);assert.equal(p.metrics.maturePaybackDays,null);
 assert.equal(validateAcquisitionPayload(p,financial()),true);assert.equal(acquisitionView(p,financial())?.coverage.originalOrders,p.coverage.originalOrders);
});
test('summary and complete review envelope retain integer-pence/count values only',()=>{
 const p=summary();
 const body={contract:'reviewed-supplement-v1',kind:'acquisition',scope:p.scope,financialVersionId:p.financial.snapshotId,salesRevision:p.financial.salesRevision,costRevision:p.financial.costRevision,sourceBasis:'synthetic-local',observedAt:'2026-11-20T18:00:00Z',payload:p};
 assert.match(supplementalDigest(body),/^[a-f0-9]{64}$/);
 body.payload.metrics.cac=body.payload.spend.acquisition/body.payload.coverage.paidFirstCustomers;
 assert.equal(validateAcquisitionPayload(body.payload,financial()),false);
});
test('source rejects wrong inception, tampering, missing reviewed financial scope and mismatched totals',()=>{
 assert.throws(()=>buildAcquisitionSource(generate({from:'2024-02-01',asOf:'2024-03-01'})),/inception/);
 const changed=structuredClone(source);changed.orderObservations[0].customerId='changed';
 assert.throws(()=>summarizeAcquisitionSource(changed,{from:'2024-02-01',to:'2024-02-29',financial:financial()}),/integrity/);
 assert.throws(()=>summarizeAcquisitionSource(source,{from:'2024-02-01',to:'2024-02-29',financial:{...financial(),scope:{...financial().scope,storeId:'other'}}}),/scope/);
 const f=financial();f.sales.originalOrders++;
 assert.throws(()=>summarizeAcquisitionSource(source,{from:'2024-02-01',to:'2024-02-29',financial:f}),/reconcile/);
});
test('frontend/server validator rejects cross-company/version/revision, changed allocation or fabricated metrics',()=>{
 const valid=summary();
 for(const modify of [p=>p.scope.storeId='other',p=>p.financial.snapshotId='other',p=>p.financial.costRevision='changed',p=>p.spend.acquisition++,p=>p.coverage.guestOrders++,p=>p.revenue.identifiedFirst++,p=>p.metrics.cac=99,p=>p.metrics.firstOrderContribution=2500,p=>p.metrics.maturePaybackDays=55,p=>p.source.from='2024-02-01',p=>p.source.sourceHash='bad']){const p=structuredClone(valid);modify(p);assert.equal(validateAcquisitionPayload(p,financial()),false);}
 assert.equal(validateAcquisitionPayload(null,financial()),false);assert.equal(validateAcquisitionPayload(valid,null),false);
});
test('zero paid first customers means unavailable CAC, never infinity or fixture replacement',()=>{
 const p=summary();p.coverage.identifiedFirstOrders-=p.coverage.paidFirstCustomers;p.coverage.identifiedRepeatOrders+=p.coverage.paidFirstCustomers;p.coverage.paidFirstCustomers=0;
 p.spend.retention+=p.spend.acquisition;p.spend.acquisition=0;p.metrics.cac=null;
 assert.equal(validateAcquisitionPayload(p,financial()),true);
 p.metrics.cac=0;assert.equal(validateAcquisitionPayload(p,financial()),false);
});
test('identity revenue preserves refund event timing and original-order classification including unknown originals',()=>{
 const p=summary();
 assert.equal(p.revenue.identifiedFirst+p.revenue.identifiedRepeat+p.revenue.guest+p.revenue.unknown,p.revenue.netProductSales);
 assert.equal(p.revenue.netProductSales,financial().sales.netProductSales);
 const byOrder=new Map(source.orderObservations.map(o=>[o.orderId,o]));
 const oldRefund=source.refundObservations.find(r=>r.date>='2024-02-01'&&byOrder.get(r.orderId)?.date<'2024-02-01');
 assert.ok(oldRefund,'February must retain refund links to January orders');
 const januaryFinancial=financial('2024-01-01','2024-01-31');
 const january=summarizeAcquisitionSource(source,{from:'2024-01-01',to:'2024-01-31',financial:januaryFinancial});
 assert.equal(january.revenue.netProductSales,januaryFinancial.sales.netProductSales);
 assert.ok(source.refundObservations.some(r=>r.date<'2024-01-15'&&!byOrder.has(r.orderId)),'Opening original-order identity stays unknown, not invented');
});
test('simulated analytics counts have exact session/order links, daily coverage and browser-derived ratios',()=>{
 const p=summary(),view=acquisitionView(p,financial());
 assert.equal(p.analytics.daily.length,29);assert.equal(p.analytics.totals.orders,p.coverage.originalOrders);
 assert.ok(p.analytics.totals.purchasingSessions<p.analytics.totals.orders,'Some purchasing sessions contain multiple orders');
 for(const d of source.analyticsDays){assert.equal(d.sessionOrderLinks.reduce((n,s)=>n+s.orderIds.length,0),d.orders);assert.equal(d.sessionOrderLinks.length,d.purchasingSessions);assert.ok(d.purchasingSessions<=d.checkoutSessions&&d.checkoutSessions<=d.cartSessions&&d.cartSessions<=d.sessions);}
 assert.equal(view.funnel.conversion,p.analytics.totals.purchasingSessions/p.analytics.totals.sessions);
 assert.equal(view.funnel.checkoutCompletion,p.analytics.totals.purchasingSessions/p.analytics.totals.checkoutSessions);
 for(const change of [p=>p.analytics.daily.pop(),p=>p.analytics.daily[0].date='2024-02-02',p=>p.analytics.daily[0].purchasingSessions=p.analytics.daily[0].orders+1,p=>p.analytics.totals.sessions++,p=>p.analytics.policy='provider-events',p=>p.analytics.coverage.complete=false]){const broken=structuredClone(p);change(broken);assert.equal(validateAcquisitionPayload(broken,financial()),false);}
 const noAnalytics=structuredClone(p);delete noAnalytics.analytics;assert.equal(validateAcquisitionPayload(noAnalytics,financial()),true);assert.equal(acquisitionView(noAnalytics,financial()).funnel,null);
});
