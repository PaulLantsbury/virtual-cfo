// Scoped read-only evidence checks; every external service is mocked by the helper.
// Run with a fake-config development preview: /verified-sales is intentionally DEV-only.
// A production build must not expose that route just to satisfy this suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,evidence,chooseCustom,metrics,storeId,otherStoreId} from './shared-sales-fixture.mjs';
const storageKey=id=>`night-scout:sales-reporting:${id}`;
for(const viewport of ['desktop','mobile']){
 test(`${viewport}: shared custom dates and financial values survive navigation across three pages`,async()=>fixture({viewport},async(page,{origin,calls})=>{
  await metrics(page);
  assert.ok(calls.some(c=>c.p_date_from==='2026-08-01' && c.p_date_to==='2026-08-31'),'Store London month wins over browser Los Angeles month at boundary');
  await chooseCustom(page);
  await metrics(page);
  for(const path of ['/verified-sales','/margin-analysis','/dashboard']){
   await page.goto(origin+path);await metrics(page);
   if(path!=='/margin-analysis')assert.ok((await page.getByRole('region',{name:'Verified sales figures',exact:true}).getByRole('group',{name:'Gross product sales',exact:true}).innerText()).includes('£100.00'));
   assert.equal(await page.getByRole('combobox',{name:'Reporting period',exact:true}).inputValue(),'custom');
   assert.equal(await page.getByLabel('From',{exact:true}).inputValue(),'2026-02-01');
   assert.equal(await page.getByLabel('To',{exact:true}).inputValue(),'2026-02-28');
  }
  assert.ok(calls.some(c=>c.p_date_from==='2026-02-01' && c.p_date_to==='2026-02-28'));
 }));
 test(`${viewport}: refund-only period remains negative with unavailable original AOV`,async()=>fixture({viewport,state:'refund'},async(page,{origin,calls})=>{
  for(const path of ['/dashboard','/verified-sales','/margin-analysis']){
   await page.goto(origin+path);await metrics(page,'-£20.00','Unavailable');
  }
  assert.ok(calls.every(c=>['2026-08-01','2026-07-01'].includes(c.p_date_from)),'No order-only lookback beyond selected/prior period');
 }));
 test(`${viewport}: known complete zero is preserved and never becomes missing evidence`,async()=>fixture({viewport,state:'zero'},async(page,{origin})=>{
  for(const path of ['/dashboard','/verified-sales','/margin-analysis']){await page.goto(origin+path);await metrics(page,'£0.00','Unavailable');}
 }));
 test(`${viewport}: absent coverage never becomes zero or sample source values`,async()=>fixture({viewport,state:'missing'},async(page,{origin})=>{
  for(const path of ['/dashboard','/verified-sales','/margin-analysis']){
   await page.goto(origin+path);
   await page.getByText(/Verified figures unavailable|Verified sales unavailable/).first().waitFor();
   const figures=page.getByRole('region',{name:'Verified sales figures',exact:true});
   if(await figures.count())assert.doesNotMatch(await figures.innerText(),/£|€|95,000|90\.00|0\.00/);
  }
 }));
 test(`${viewport}: failed previous period does not hide valid current figures`,async()=>fixture({viewport,respond:params=>params.p_date_from==='2026-07-01'?{data:{message:'Prior unavailable'},status:503}:null},async page=>{
  await metrics(page);
  await page.getByText(/comparison.*unavailable|verified previous period|previous period.*unavailable/i).first().waitFor();
  await metrics(page);
 }));
}
test('Settings failure has no actual money fallback and makes no financial reads',async()=>fixture({settingsMissing:true},async(page,{origin,calls})=>{
 for(const path of ['/dashboard','/verified-sales','/margin-analysis']){
  await page.goto(origin+path);await page.getByText(/Reporting settings unavailable|Verified figures unavailable|Verified sales unavailable/).first().waitFor();
  const figures=page.getByRole('region',{name:'Verified sales figures',exact:true});
  if(await figures.count())assert.doesNotMatch(await figures.innerText(),/£|GBP|0\.00/);
 }
 assert.equal(calls.length,0);
}));
test('Corrupt stored custom dates fail closed without financial reads',async()=>fixture({initialStorage:{[storageKey(storeId)]:JSON.stringify({mode:'custom',from:'2026-02-30',to:'2026-03-01'})}},async(page,{calls})=>{
 await page.getByText(/Choose real calendar dates/).first().waitFor();
 assert.equal(calls.length,0,'Invalid persisted period cannot fetch or silently choose another period');
}));
test('Delayed previous store response cannot replace current store or its own saved dates',async()=>{
 let release,entered;const began=new Promise(r=>entered=r);const held=new Promise(r=>release=r);
 await fixture({twoStores:true,initialStorage:{[storageKey(storeId)]:JSON.stringify({mode:'custom',from:'2026-02-01',to:'2026-02-28'})},respond:async params=>{
  if(params.p_store_id===storeId){entered();await held;return {data:evidence(params)};}return null;
 }},async(page,{calls})=>{
  await began;
  await page.getByRole('combobox',{name:'Active store'}).selectOption(otherStoreId);
  await metrics(page,'€90.00','€90.00');
  assert.equal(await page.getByRole('combobox',{name:'Reporting period',exact:true}).inputValue(),'last_complete_month');
  release();await page.waitForLoadState('networkidle');await metrics(page,'€90.00','€90.00');
  assert.ok(calls.some(c=>c.p_store_id===otherStoreId&&c.p_date_from==='2026-08-01'));
 });
});
test('Delayed old-date response cannot overwrite the selected refund period',async()=>{
 let release,entered;const began=new Promise(r=>entered=r);const held=new Promise(r=>release=r);
 await fixture({initialStorage:{[storageKey(storeId)]:JSON.stringify({mode:'custom',from:'2026-02-01',to:'2026-02-28'})},respond:async params=>{
  if(params.p_date_from==='2026-02-01'){entered();await held;return {data:evidence(params)};}
  return {data:evidence(params,{state:'refund'})};
 }},async page=>{
  await began;await chooseCustom(page,'2026-03-01','2026-03-31');await metrics(page,'-£20.00','Unavailable');
  release();await page.waitForLoadState('networkidle');await metrics(page,'-£20.00','Unavailable');
  assert.equal(await page.getByLabel('From',{exact:true}).inputValue(),'2026-03-01');
 });
});
