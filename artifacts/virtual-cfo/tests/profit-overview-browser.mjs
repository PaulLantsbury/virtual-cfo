// Isolated browser regression: fake Supabase and local API responses only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fixture,chooseCustom,storeId,otherStoreId} from './shared-sales-fixture.mjs';
const ready=value=>({state:'ready',value,reason:null});
const absent=reason=>({state:'unavailable',value:null,reason});
function response(scope,partial=false) {
 const report={scope,state:partial?'partial':'complete',reason:null,
  sales:{grossProductSales:10000,discounts:1000,productRefundExVat:0,netProductSales:9000,netShipping:500,originalOrders:1,aov:{value:9000,reason:null},provenance:{...scope,coverageEvidence:'isolated test'}},
  originalCosts:ready(4000),recoveredCosts:ready(0),cogs:ready(4000),grossProfit:ready(5000),variableCosts:ready(1500),contributionBeforeMarketing:ready(4000),advertising:ready(1000),contribution:ready(3000),overheads:ready(2000),operatingProfit:ready(1000),da:ready(500),ebitda:ready(1500),revenueDenominator:ready(9500),contributionMargin:ready(3000/9500),operatingMargin:ready(1000/9500)};
 if(partial)for(const key of ['overheads','operatingProfit','da','ebitda'])report[key]=absent('Overhead evidence incomplete');
 return {data:{state:'ready',versionId:'isolated-version',report}};
}
const metric=(page,label)=>page.getByRole('region',{name:'Verified profit overview',exact:true}).getByRole('group',{name:label,exact:true});
async function amount(page,label,text){await metric(page,label).getByText(text,{exact:true}).waitFor();}
for(const viewport of ['desktop','mobile']) {
 test(`${viewport}: source profit bridge and sales reconcile, scenario remains separate`,async()=>fixture({viewport,entry:'/profit-engine',profitRespond:scope=>response(scope)},async(page,{origin})=>{
  await amount(page,'Sales','£90.00');await amount(page,'Gross profit','£50.00');await amount(page,'Contribution','£30.00');await amount(page,'Operating profit','£10.00');await amount(page,'EBITDA','£15.00');
  assert.match(await page.getByRole('region',{name:'Profit reporting status'}).innerText(),/Synthetic Store/);
  const table=page.getByRole('table',{name:'Verified profit bridge'});
  const cogs=table.getByRole('row').filter({has:page.getByRole('rowheader',{name:/^Net cost of goods sold/})});assert.equal(await cogs.getByRole('cell').innerText(),'-£40.00');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
  await chooseCustom(page);await amount(page,'Contribution','£30.00');
  await page.goto(origin+'/verified-sales');await page.getByRole('group',{name:'Net product sales',exact:true}).getByText('£90.00',{exact:true}).waitFor();assert.equal(await page.getByLabel('From',{exact:true}).inputValue(),'2026-02-01');
  await page.goto(origin+'/profit-engine');await amount(page,'Sales','£90.00');
  assert.match(await page.getByRole('link',{name:'Explore the separate sample model in Scenario Planner'}).innerText(),/sample model/);
  if(process.env.NIGHT_SCOUT_PROFIT_SCREENSHOT_DIR){await mkdir(process.env.NIGHT_SCOUT_PROFIT_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:`${process.env.NIGHT_SCOUT_PROFIT_SCREENSHOT_DIR}/${viewport}.png`,fullPage:true});}
 }));
 test(`${viewport}: partial evidence preserves early subtotals`,async()=>fixture({viewport,entry:'/profit-engine',profitRespond:scope=>response(scope,true)},async page=>{
  await amount(page,'Contribution','£30.00');await amount(page,'Operating profit','Unavailable');await amount(page,'EBITDA','Unavailable');assert.match(await metric(page,'Operating profit').innerText(),/Overhead evidence incomplete/);
 }));
}
test('Unavailable API preserves verified sales, never substitutes a sample or zero',async()=>fixture({entry:'/profit-engine',profitRespond:()=>({status:503,data:{error:'Unavailable'}})},async page=>{
 await amount(page,'Sales','£90.00');await amount(page,'Gross profit','Unavailable');assert.doesNotMatch(await page.getByRole('region',{name:'Verified profit overview'}).innerText(),/95,000|21,900|£0\.00/);
}));
test('Non-month selection remains selected, with no profit request',async()=>{
 let calls=0;
 await fixture({entry:'/profit-engine',initialStorage:{[`night-scout:sales-reporting:${storeId}`]:JSON.stringify({mode:'last_complete_week'})},profitRespond:scope=>{calls++;return response(scope);}},async page=>{
  await amount(page,'Sales','£90.00');await amount(page,'Gross profit','Unavailable');assert.equal(calls,0);assert.equal(await page.getByRole('combobox',{name:'Reporting period',exact:true}).inputValue(),'last_complete_week');assert.match(await metric(page,'Gross profit').innerText(),/complete calendar month/);
 });
});
test('Loading and delayed old-store profit cannot replace current store',async()=>{
 let release,entered;const began=new Promise(resolve=>entered=resolve),held=new Promise(resolve=>release=resolve);
 await fixture({entry:'/profit-engine',twoStores:true,profitRespond:async scope=>{if(scope.storeId===storeId){entered();await held;}return response(scope);}},async page=>{
  await began;await amount(page,'Gross profit','Unavailable');await page.getByRole('combobox',{name:'Active store'}).selectOption(otherStoreId);await amount(page,'Gross profit','€50.00');release();await page.waitForLoadState('networkidle');await amount(page,'Gross profit','€50.00');assert.doesNotMatch(await metric(page,'Gross profit').innerText(),/£/);
 });
});
test('Mismatched API period fails closed',async()=>fixture({entry:'/profit-engine',profitRespond:scope=>response({...scope,from:'2020-01-01'})},async page=>{
 await amount(page,'Sales','£90.00');await amount(page,'Gross profit','Unavailable');
}));
test('Free plan keeps detailed profit amounts locked',async()=>fixture({entry:'/profit-engine',plan:'free',profitRespond:scope=>response(scope)},async page=>{
 await amount(page,'Gross profit','£50.00');for(const cell of await page.getByRole('table',{name:'Verified profit bridge'}).getByRole('cell').all())assert.equal(await cell.innerText(),'Locked');
}));
