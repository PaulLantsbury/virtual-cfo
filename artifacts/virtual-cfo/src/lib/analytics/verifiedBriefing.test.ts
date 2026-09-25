import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVerifiedBriefing } from './verifiedBriefing.ts';
import type { VerifiedSales } from '../../../../../experiments/financial-v1/rpc-sales-adapter.mjs';
const august: VerifiedSales = {grossProductSales:98700,discounts:0,netProductSales:98700,netShipping:0,originalOrders:1,productRefundExVat:0,cashRefunded:0,aov:{value:98700,reason:null},hasActivity:true,hasRefundActivity:false,cogs:null,profitDataState:'incomplete',provenance:{storeId:'B',currency:'GBP',from:'2026-08-01',to:'2026-08-31',coverageEvidence:'synthetic'}};
test('original AOV and explanations follow verified rules without legacy ratios',()=>{
 const b=buildVerifiedBriefing(august,null,'error');
 assert.equal(b.metrics.find(m=>m.id==='averageOrderValue')?.value,'£987.00');
 assert.match(b.summary,/Net product sales were £987.00/);
 assert.ok(!b.metrics.some(m=>m.id==='refundRate'||m.id==='repeatPurchaseRate'));
 assert.ok(b.metrics.every(m=>m.direction==='unknown'));
 assert.match(b.metrics.find(m=>m.id==='averageOrderValue')!.explanation,/Later refunds do not change/);
});
test('refund-only narrative and numbers retain negative sales and unavailable AOV',()=>{
 const b=buildVerifiedBriefing({...august,grossProductSales:0,netProductSales:-8700,originalOrders:0,productRefundExVat:8700,aov:{value:null,reason:'no orders'},hasRefundActivity:true},august,'ready');
 assert.match(b.summary,/refunds from earlier sales and no new qualifying orders/);
 assert.equal(b.metrics.find(m=>m.id==='netSales')?.value,'-£87.00');
 assert.equal(b.metrics.find(m=>m.id==='averageOrderValue')?.value,'Unavailable');
 assert.equal(b.refunds,'£87.00');
 assert.equal(b.signals.length,1);
});
test('verified inactivity is explicit and zero denominator is unavailable',()=>{
 const b=buildVerifiedBriefing({...august,grossProductSales:0,netProductSales:0,originalOrders:0,aov:{value:null,reason:'no orders'},hasActivity:false},null,'error');
 assert.match(b.summary,/no sales or refunds/);
 assert.equal(b.metrics.find(m=>m.id==='discountDependency')?.value,'Unavailable');
});
test('currency follows evidence and incompatible comparison is withheld',()=>{
 const usd={...august,provenance:{...august.provenance,currency:'USD'}};
 const b=buildVerifiedBriefing(usd,august,'ready');
 assert.match(b.metrics.find(m=>m.id==='netSales')!.value,/US\$987.00/);
 assert.match(b.summary,/US\$987.00/);
 assert.ok(b.metrics.every(m=>m.direction==='unknown'));
 assert.equal(b.signals.length,0);
});
