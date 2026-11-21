// Margin presentation regressions; shared source contract is tested separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,metrics} from './shared-sales-fixture.mjs';
const profitRespond=()=>({data:{state:'unavailable',reason:'No sealed profit evidence is available for this month'}});
for(const viewport of ['desktop','mobile']){
 test(`${viewport}: verified sales never become actual margin or sample scenario inputs`,async()=>fixture({viewport,entry:'/margin-analysis',profitRespond},async page=>{
  await metrics(page);
  const status=page.getByRole('region',{name:'Margin reporting status'});
  assert.match(await status.innerText(),/Missing costs remain unavailable/);
  const sample=page.getByRole('region',{name:'Sample margin model notice'});
  assert.match(await sample.innerText(),/fixed sample inputs, not results or recommendations for your business/);
  assert.equal(await page.getByRole('button',{name:'CFO Monitoring Status'}).count(),0);
  assert.equal(await page.getByPlaceholder('Ask a question about this page…').count(),0);
  const output=page.getByText('Sample contribution',{exact:true}).locator('..');
  const baseline=await output.innerText();assert.match(baseline,/52,913/);
  const slider=page.locator('[aria-label="Meta CAC change"]').getByRole('slider');
  await slider.focus();await slider.press('Home');assert.notEqual(await output.innerText(),baseline);
  await page.getByRole('button',{name:'Reset sample scenario'}).click();assert.equal(await output.innerText(),baseline);
  await slider.focus();await slider.press('End');assert.match(await page.locator('main').innerText(),/Below the illustrative threshold/);
  await page.getByRole('button',{name:'Reset sample scenario'}).click();
  await page.getByRole('combobox',{name:'Reporting period',exact:true}).selectOption('last_complete_week');
  await metrics(page);assert.equal(await output.innerText(),baseline,'Source selection never mutates sample model');
  await page.getByRole('heading',{name:'Supporting Sample Analysis',exact:true}).click();
  for(const name of ['Sample Margin Drivers','Sample Contribution Bridge','Sample Margin by Channel','Sample Margin Trend','Sample Unit Economics'])assert.equal(await page.getByRole('heading',{name,exact:true}).isVisible(),true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }));
 test(`${viewport}: free plan retains shared source amounts and honest sample gates`,async()=>fixture({viewport,plan:'free',entry:'/margin-analysis',profitRespond},async page=>{
  await metrics(page);assert.equal(await page.getByRole('slider').count(),0);
  assert.equal(await page.getByText(/Upgrading does not supply missing profit evidence or validate the sample model/).count(),1);
  await page.getByRole('heading',{name:'Supporting Sample Analysis',exact:true}).click();
  assert.equal(await page.getByText('Supporting sample analysis available on Pro',{exact:true}).isVisible(),true);
 }));
}
