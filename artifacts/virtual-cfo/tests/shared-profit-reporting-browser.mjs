// Isolated UI contract: all financial responses are synthetic; external writes blocked.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,chooseCustom,storeId} from './shared-sales-fixture.mjs';
const ready=value=>({state:'ready',value,reason:null});
const absent=reason=>({state:'unavailable',value:null,reason});
function response(scope,mode='complete') {
 const zero=mode==='zero',loss=mode==='loss';
 const net=zero?0:loss?-2000:9000;
 const contribution=zero?0:loss?-2000:3000;
 const operating=zero?0:loss?-4000:1000;
 const report={scope,state:mode==='partial'?'partial':'complete',reason:null,
 sales:{grossProductSales:zero||loss?0:10000,discounts:zero||loss?0:1000,productRefundExVat:loss?2000:0,netProductSales:net,netShipping:zero||loss?0:500,originalOrders:zero||loss?0:1,aov:{value:zero||loss?null:9000,reason:zero||loss?'No original orders':null},provenance:scope},
 originalCosts:ready(zero||loss?0:4000),recoveredCosts:ready(0),cogs:ready(zero||loss?0:4000),grossProfit:ready(zero?0:loss?-2000:5000),variableCosts:ready(zero||loss?0:1500),contributionBeforeMarketing:ready(zero?0:loss?-2000:4000),advertising:ready(zero||loss?0:1000),contribution:ready(contribution),overheads:ready(zero?0:2000),operatingProfit:ready(operating),da:ready(zero?0:500),ebitda:ready(zero?0:loss?-3500:1500),revenueDenominator:ready(zero?0:loss?-2000:9500),contributionMargin:zero||loss?absent('Positive revenue required'):ready(3000/9500),operatingMargin:zero||loss?absent('Positive revenue required'):ready(1000/9500)};
 if(mode==='partial')for(const key of ['overheads','operatingProfit','da','ebitda','operatingMargin'])report[key]=absent('Overhead evidence incomplete');
 return {data:{state:'ready',versionId:'isolated-version',report}};
}
const summary=page=>page.getByRole('region',{name:'Verified profit summary',exact:true});
async function amounts(page,values){for(const [label,value]of Object.entries(values))await summary(page).getByRole('group',{name:label,exact:true}).getByText(value,{exact:true}).waitFor();}
const standard={'Gross profit':'£50.00',Contribution:'£30.00','Operating profit':'£10.00',EBITDA:'£15.00'};
for(const viewport of ['desktop','mobile'])for(const entry of ['/dashboard','/margin-analysis']) {
 test(`${viewport} ${entry}: shared profit, scope and separate model`,async()=>fixture({viewport,entry,profitRespond:(scope,headers)=>{assert.match(headers.authorization,/^Bearer /);assert.equal(scope.storeId,storeId);assert.equal(scope.currency,'GBP');return response(scope);}},async(page,{origin})=>{
  await amounts(page,standard);assert.match(await summary(page).innerText(),/Contribution margin: 31.6%.*Operating margin: 10.5%/);
  assert.doesNotMatch(await page.locator('body').innerText(),/profit and margins? (are |remain )?unavailable|actual margins? (are |remain )?unavailable/i);
  if(entry==='/margin-analysis'){const notice=page.getByRole('region',{name:'Sample margin model notice'});assert.match(await notice.innerText(),/fixed sample inputs/);assert.doesNotMatch(await summary(page).innerText(),/124,500|52,913/);}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow');
  await chooseCustom(page);await amounts(page,standard);
  await page.goto(origin+(entry==='/dashboard'?'/margin-analysis':'/dashboard'));await amounts(page,standard);assert.equal(await page.getByLabel('From',{exact:true}).inputValue(),'2026-02-01');assert.equal(await page.getByLabel('To',{exact:true}).inputValue(),'2026-02-28');
  await summary(page).getByRole('link',{name:'View the full breakdown in Profit Overview'}).click();await page.getByRole('region',{name:'Verified profit overview'}).getByRole('group',{name:'Gross profit',exact:true}).getByText('£50.00',{exact:true}).waitFor();
 }));
 test(`${viewport} ${entry}: incomplete overhead preserves supported subtotals`,async()=>fixture({viewport,entry,profitRespond:scope=>response(scope,'partial')},async page=>{
  await amounts(page,{'Gross profit':'£50.00',Contribution:'£30.00','Operating profit':'Unavailable',EBITDA:'Unavailable'});assert.match(await summary(page).innerText(),/Overhead evidence incomplete/);assert.match(await summary(page).innerText(),/Operating margin: Unavailable/);
 }));
}
for(const entry of ['/dashboard','/margin-analysis']){
 test(`${entry}: failed report never replaces missing costs with sample or zero`,async()=>fixture({entry,profitRespond:()=>({status:503,data:{error:'Unavailable'}})},async page=>{await amounts(page,{'Gross profit':'Unavailable',Contribution:'Unavailable','Operating profit':'Unavailable',EBITDA:'Unavailable'});assert.doesNotMatch(await summary(page).innerText(),/£0\.00|52,913|21,900/);}));
 test(`${entry}: weekly period makes no profit request`,async()=>{let requests=0;await fixture({entry,initialStorage:{[`night-scout:sales-reporting:${storeId}`]:JSON.stringify({mode:'last_complete_week'})},profitRespond:scope=>{requests++;return response(scope);}},async page=>{await amounts(page,{'Gross profit':'Unavailable'});assert.match(await summary(page).innerText(),/complete calendar month/);assert.equal(requests,0);});});
 for(const mode of ['zero','loss'])test(`${entry}: ${mode} period is represented without invented margin`,async()=>fixture({entry,state:mode==='zero'?'zero':'refund',profitRespond:scope=>response(scope,mode)},async page=>{await amounts(page,mode==='zero'?{'Gross profit':'£0.00',Contribution:'£0.00','Operating profit':'£0.00',EBITDA:'£0.00'}:{'Gross profit':'-£20.00',Contribution:'-£20.00','Operating profit':'-£40.00',EBITDA:'-£35.00'});assert.match(await summary(page).innerText(),/Contribution margin: Unavailable.*Operating margin: Unavailable/);}));
}
