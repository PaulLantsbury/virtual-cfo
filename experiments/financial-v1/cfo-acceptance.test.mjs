import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchVerifiedSales} from './rpc-sales-adapter.mjs';
import {calculateProfitEvidence} from './profit-evidence.mjs';
import {acceptanceInput,acceptanceCosts} from './cfo-acceptance-fixture.mjs';
async function salesFor(month='02',mutate=()=>{}) {
 const input=acceptanceInput(month);mutate(input);
 return fetchVerifiedSales(async(name,args)=>{
  assert.equal(name,'verified_sales_source');assert.equal(args.p_store_id,input.scope.storeId);
  return {error:null,data:{version:1,storeId:input.scope.storeId,from:input.scope.from,to:input.scope.to,...input.mapped}};
 },input.scope);
}
async function reportFor(month='02',mutate=()=>{}) {
 const input=acceptanceCosts(acceptanceInput(month).scope,await salesFor(month));mutate(input);
 return calculateProfitEvidence(input);
}
function ready(report,expected){for(const [key,value]of Object.entries(expected)){assert.equal(report[key].state,'ready',key);assert.equal(report[key].value,value,key);}}
test('mixed recorded tax bases, discount, excluded order and same-month refund retain original AOV',async()=>{
 const s=await salesFor();
 for(const [key,value]of Object.entries({grossProductSales:26000,discounts:2000,originalOrders:3,netProductSales:22000,netShipping:800,productRefundExVat:2000,productRefundVat:400,shippingRefundExVat:100,shippingRefundVat:20,cashRefunded:2520}))assert.equal(s[key],value,key);
 assert.equal(s.aov.value,8000);assert.equal(s.cogs,null);
 assert.ok(Math.abs(s.discountRate.value-0.07692307692307693)<1e-14);
});
test('hand-worked full profit and margins use the same sales returned by the website RPC adapter',async()=>{
 const r=await reportFor();
 ready(r,{cogs:9000,grossProfit:13000,variableCosts:1200,advertising:2300,contributionBeforeMarketing:12600,contribution:10300,overheads:3000,operatingProfit:7300,da:600,ebitda:7900,revenueDenominator:22800});
 assert.ok(Math.abs(r.contributionMargin.value-0.4517543859649123)<1e-14);
 assert.ok(Math.abs(r.operatingMargin.value-0.3201754385964912)<1e-14);
});
test('later refund and later saleable recovery each affect their own month and never rewrite original AOV',async()=>{
 const before=await salesFor();const march=await reportFor('03');
 assert.equal(march.sales.netProductSales,-3000);assert.equal(march.sales.originalOrders,0);assert.equal(march.sales.aov.value,null);assert.equal(march.sales.hasActivity,true);
 ready(march,{cogs:0,grossProfit:-3000,contribution:-3400,operatingProfit:-6400,ebitda:-5800});
 const april=await reportFor('04');assert.equal(april.sales.netProductSales,0);
 ready(april,{cogs:-1500,grossProfit:1500,contribution:1500,operatingProfit:1500,ebitda:1500});
 for(const r of [march,april])for(const k of ['contributionMargin','operatingMargin'])assert.equal(r[k].value,null);
 assert.deepEqual(await salesFor(),before);
});
test('incomplete later costs preserve supported subtotals without invented zero profit',async()=>{
 const r=await reportFor('02',i=>{i.costEvidence.coverage.overheads.complete=false;});
 ready(r,{grossProfit:13000,contribution:10300});assert.equal(r.operatingProfit.value,null);assert.equal(r.ebitda.value,null);
 const missing=await reportFor('02',i=>{i.costEvidence.lines[0].unitCostPence=null;});
 assert.equal(missing.sales.netProductSales,22000);assert.equal(missing.grossProfit.value,null);
});
test('missing coverage, stale source and unreconciled refund fail closed at the shared sales boundary',async()=>{
 for(const mutate of [i=>{i.mapped.coverage[0].sales_and_refunds_complete=false;},i=>{i.mapped.orders[0].mapping_state='stale';},i=>{i.mapped.refunds[0].amount='25.21';}])await assert.rejects(()=>salesFor('02',mutate));
});
