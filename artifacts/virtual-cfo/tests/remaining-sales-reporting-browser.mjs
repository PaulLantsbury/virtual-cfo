// Read-only, synthetic browser contract for the remaining shared sales consumers.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,chooseCustom,evidence,storeId,otherStoreId} from './shared-sales-fixture.mjs';
const entries=['/growth-quality','/pricing-optimisation','/marketing-efficiency','/cash-control'];
const summary=page=>page.getByRole('region',{name:'Verified sales figures',exact:true});
async function values(page,sales,aov,discounts){
 for(const [label,value]of [['Net product sales',sales],['Original average order value',aov],['Product discounts',discounts]]) await summary(page).getByRole('group',{name:label,exact:true}).getByText(value,{exact:true}).waitFor();
}
const profitRespond=()=>({data:{data:{state:'unavailable',reason:'Synthetic sales-only test'}}});
for(const entry of entries){
 for(const viewport of ['desktop','mobile']) test(`${entry} ${viewport}: shared sales, discounts and sample separation`,async()=>fixture({entry,viewport,profitRespond},async(page,{origin,calls})=>{
  await values(page,'£90.00','£90.00','£10.00');
  assert.doesNotMatch(await summary(page).innerText(),/420,000|124,500|198,000|Source-reported/);
  assert.match(await page.locator('body').innerText(),/sample/i);
  await chooseCustom(page);await values(page,'£90.00','£90.00','£10.00');
  assert.ok(calls.some(c=>c.p_date_from==='2026-02-01'&&c.p_date_to==='2026-02-28'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
  await page.goto(origin+entries[(entries.indexOf(entry)+1)%entries.length]);await values(page,'£90.00','£90.00','£10.00');
  assert.equal(await page.getByLabel('From',{exact:true}).inputValue(),'2026-02-01');
 }));
 for(const state of ['missing','zero','refund']) test(`${entry}: ${state} evidence preserves unavailable/zero/refund distinctions`,async()=>fixture({entry,state,profitRespond},async page=>{
  if(state==='missing')await values(page,'Unavailable','Unavailable','Unavailable');
  if(state==='zero')await values(page,'£0.00','Unavailable','£0.00');
  if(state==='refund')await values(page,'-£20.00','Unavailable','£0.00');
 }));
 test(`${entry}: store switch replaces currency and refuses mismatched response`,async()=>fixture({entry,twoStores:true,profitRespond,respond:params=>params.p_store_id===otherStoreId?{data:evidence({...params,p_store_id:storeId})}:null},async page=>{
  await values(page,'£90.00','£90.00','£10.00');await page.getByRole('combobox',{name:'Active store'}).selectOption(otherStoreId);await values(page,'Unavailable','Unavailable','Unavailable');assert.doesNotMatch(await summary(page).innerText(),/£90\.00/);
 }));
}
