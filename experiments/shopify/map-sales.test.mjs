import test from 'node:test';
import assert from 'node:assert/strict';
import {collectShopifyOrders} from './collect.mjs';
import {createShopifyReader} from './client.mjs';
import {loadShopifyDetails,mapShopifySales} from './map-sales.mjs';
import {expected,contextFixture,orderFixture,pageFixture,detailsFixture,connectionFixture as conn} from './fixtures.mjs';
const scope={storeId:'local-fixture',shopId:expected.shopId,from:'2026-02-01',to:'2026-02-28'};
const money=amount=>({shopMoney:{amount,currencyCode:'GBP'}});
async function extraction(){const order=orderFixture();const read=async op=>op==='context'?contextFixture():op==='orders'?pageFixture([order]):detailsFixture();return loadShopifyDetails(read,await collectShopifyOrders(read,expected));}
test('synthetic HTTP through collection, detail mapping and approved period arithmetic',async()=>{
 const responses=[contextFixture(),pageFixture([orderFixture()]),contextFixture(),detailsFixture()];
 const read=createShopifyReader({...expected,accessToken:'synthetic-token',fetchImpl:async()=>new Response(JSON.stringify({data:responses.shift()}),{headers:{'x-shopify-api-version':'2026-07'}})});
 const data=await loadShopifyDetails(read,await collectShopifyOrders(read,expected));
 const feb=mapShopifySales(data,scope),mar=mapShopifySales(data,{...scope,from:'2026-03-01',to:'2026-03-31'});
 assert.equal(feb.status,'mapped_for_review');assert.equal(feb.candidate.netProductSales,9000);assert.equal(feb.candidate.aov.value,9000);assert.equal(feb.candidate.discounts,1000);
 assert.equal(mar.candidate.netProductSales,-2000);assert.equal(mar.candidate.productRefundVat,400);assert.equal(mar.candidate.aov.value,null);assert.equal(mar.candidate.hasRefundActivity,true);assert.equal(mar.coverageCertified,false);assert.equal(mar.candidate.cogs,null);
});
test('shipping revenue and shipping refunds stay outside product AOV',async()=>{
 const data=await extraction(),o=data.orders[0];
 o.shippingLines=conn([{id:'shipping-1',isRemoved:false,originalPriceSet:money('6'),discountedPriceSet:money('5'),taxLines:[{priceSet:money('1')}]}]);
 o.originalTotalPriceSet=money('114');o.transactions[0].amountSet=money('114');o.totalTaxSet=money('19');o.totalDiscountsSet=money('11');
 const r=o.refunds[0];r.refundShippingLines=conn([{id:'refund-shipping-1',shippingLine:{id:'shipping-1'},subtotalAmountSet:money('2'),taxAmountSet:money('0.4')}]);r.totalRefundedSet=money('26.4');r.transactions.nodes[0].amountSet=money('26.4');
 const feb=mapShopifySales(data,scope),mar=mapShopifySales(data,{...scope,from:'2026-03-01',to:'2026-03-31'});
 assert.equal(feb.candidate.aov.value,9000);assert.equal(feb.candidate.netShipping,500);assert.equal(mar.candidate.netShipping,-200);assert.equal(mar.candidate.cashRefunded,2640);
});
test('payment event timestamp determines store-local sale period',async()=>{
 const data=await extraction();data.orders[0].transactions[0].processedAt='2026-02-28T23:30:00Z';data.settings.timezone='Europe/Paris';
 const feb=mapShopifySales(data,scope),mar=mapShopifySales(data,{...scope,from:'2026-03-01',to:'2026-03-31'});
 assert.equal(feb.candidate.originalOrders,0);assert.equal(mar.candidate.originalOrders,1);assert.equal(mar.candidate.netProductSales,7000);
});
test('test and demonstrably unpaid orders are excluded',async()=>{
 const data=await extraction();data.orders[0].test=true;assert.equal(mapShopifySales(data,scope).candidate.originalOrders,0);
 data.orders[0].test=false;data.orders[0].displayFinancialStatus='PENDING';data.orders[0].transactions=[];data.orders[0].transactionsCount.count=0;data.orders[0].refunds=[];
 assert.equal(mapShopifySales(data,scope).excluded[0].reason,'UNPAID_ORDER');
});
test('ambiguous pricing/payments and missing financial detail are blocked',async()=>{
 for(const mutate of [o=>o.taxesIncluded=true,o=>o.edited=true,o=>o.transactions[0].kind='CAPTURE',o=>o.lineItems.pageInfo.hasNextPage=true,o=>o.lineItems.nodes[0].discountAllocations=null,o=>o.lineItems.nodes[0].originalTotalSet=money('101'),o=>o.refunds[0].transactions.nodes[0].status='PENDING',o=>o.lineItems.nodes[0].isGiftCard=true]){
 const data=await extraction();mutate(data.orders[0]);const r=mapShopifySales(data,scope);assert.equal(r.status,'blocked');assert.equal(r.candidate,null);
 }
});
test('refund adjustments, bad original links and component/payment mismatch are blocked',async()=>{
 for(const mutate of [r=>r.orderAdjustments=conn([{id:'adjustment'}]),r=>r.refundLineItems.nodes[0].lineItem.id='missing',r=>r.refundLineItems.nodes[0].subtotalSet=money('21'),r=>r.refundShippingLines.pageInfo.hasNextPage=true]){
 const data=await extraction();mutate(data.orders[0].refunds[0]);assert.equal(mapShopifySales(data,scope).status,'blocked');
 }
});
test('detail collection rejects changed source versions',async()=>{
 const raw=await collectShopifyOrders(async op=>op==='context'?contextFixture():pageFixture([orderFixture()]),expected);
 const d=detailsFixture();d.order.updatedAt='2026-03-06T00:00:00Z';
 await assert.rejects(()=>loadShopifyDetails(async()=>d,raw),/changed/);
});
test('cumulative refunds cannot exceed original product or VAT components',async()=>{
 const data=await extraction(),o=data.orders[0],r=structuredClone(o.refunds[0]);
 r.id='gid://shopify/Refund/2';r.refundLineItems.nodes[0].id='gid://shopify/RefundLineItem/2';r.refundLineItems.nodes[0].subtotalSet=money('80');r.refundLineItems.nodes[0].totalTaxSet=money('16');r.totalRefundedSet=money('96');r.transactions.nodes[0].id='gid://shopify/OrderTransaction/12';r.transactions.nodes[0].amountSet=money('96');o.refunds.push(r);o.transactions.push(r.transactions.nodes[0]);o.transactionsCount.count++;
 assert.equal(mapShopifySales(data,scope).status,'blocked');
});
test('mapping scope and order tax reconciliation are enforced',async()=>{
 const data=await extraction();assert.equal(mapShopifySales(data,{...scope,shopId:'wrong'}).status,'blocked');
 data.orders[0].totalTaxSet=money('19');assert.equal(mapShopifySales(data,scope).status,'blocked');
});
