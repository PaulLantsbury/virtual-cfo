import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,origin,otherStore,months} from './cfo-comparison-browser-fixture.mjs';
import {envelope,analysisWire} from './cfo-comparison-wire.fixture.mjs';
const comparison=page=>page.getByRole('region',{name:'Checked financial comparison',exact:true});
const current=page=>page.getByRole('region',{name:'Checked financial briefing',exact:true});
const select=async(page,from)=>{const picker=page.locator('.sv-period-picker');if(await picker.getAttribute('open')===null)await picker.locator('summary').first().click();await page.getByRole('combobox',{name:'Scout reviewed month',exact:true}).selectOption(from);};
const history=(route,url,item,json)=>json({...item.response,cfoBriefing:envelope(item)});
const previous=item=>months[months.indexOf(item)-1];
const analysis=(route,url,item,json)=>previous(item)?json(analysisWire(item,previous(item))):json({state:'unavailable'},409);
const noExternal=(requests,forbidden)=>{assert.deepEqual(forbidden,[]);assert.ok(requests.every(p=>['/api/history-reporting/months','/api/history-reporting','/api/history-reporting/analysis','/api/supplemental-reporting'].includes(p)),'No model, provider or unexpected API request');};
for(const width of [390,1440])test(`Adjacent-month comparison, independent manual comparison and containment ${width}px`,async()=>{
 const requests=[],forbiddenRequests=[];await fixture({viewport:{width,height:900},requests,forbiddenRequests,history,analysis},async page=>{
 await page.goto(origin+'/dashboard');await select(page,'2025-03-01');const region=comparison(page);await region.getByText(/decreased by £1\.00 to £13\.00/).waitFor();await region.getByText(/Compared automatically with February 2025/).waitFor();assert.equal(await page.getByText('Untrusted upstream sentence must never render',{exact:true}).count(),0);
 if(await page.locator('.sv-period-picker').getAttribute('open')===null)await page.locator('.sv-period-picker > summary').click();
 await page.getByText('Compare with an earlier month',{exact:true}).click();await page.getByRole('combobox',{name:'Scout comparison month',exact:true}).selectOption('2025-01-01');await region.getByText(/Compared automatically with February 2025/).waitFor();assert.doesNotMatch(await region.innerText(),/Compared automatically with January/);
 await region.getByText('Explore the checked comparison',{exact:true}).click();await region.getByText('Checked facts and source versions',{exact:true}).click();assert.equal(await region.locator('table').first().locator('tbody tr').count(),7);assert.ok(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1));assert.ok(await region.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 if(process.env.NIGHT_SCOUT_SCREENSHOT_DIR){await page.setViewportSize({width,height:2000});await region.screenshot({path:process.env.NIGHT_SCOUT_SCREENSHOT_DIR+`/checked-comparison-${width}.png`});}
 await page.getByRole('button',{name:'View fictional design',exact:true}).click();assert.equal(await comparison(page).count(),0);noExternal(requests,forbiddenRequests);
 });
});
test('Wrong or revoked prior withholds comparison while preserving accepted current briefing',async()=>{
 for(const mode of ['wrong','revoked']){const requests=[],forbiddenRequests=[];await fixture({requests,forbiddenRequests,history:(route,url,item,json)=>mode==='revoked'&&item===months[1]?json({state:'invalidated'},403):history(route,url,item,json),analysis:(route,url,item,json)=>{const wire=analysisWire(item,previous(item));wire.prior.salesRevision='old';return json(wire);}},async page=>{
 await page.goto(origin+'/dashboard');await select(page,'2025-03-01');await page.getByText('The immediately preceding month comparison is unavailable. The checked current-month briefing remains separate.',{exact:true}).waitFor();await current(page).getByText(/£13\.00/).first().waitFor();assert.equal(await comparison(page).count(),0);noExternal(requests,forbiddenRequests);
 });}
});
test('Actually pending analysis is discarded by month, company and same-window auth changes',async()=>{
 for(const mode of ['month','company','auth']){let arrive,release;const arrived=new Promise(r=>arrive=r),pending=new Promise(r=>release=r);let hold=false;const requests=[],forbiddenRequests=[];
 await fixture({secondStore:mode==='company',requests,forbiddenRequests,history,analysis:async(route,url,item,json)=>{if(hold&&item===months[1]){arrive();await pending;}try{return await analysis(route,url,item,json);}catch{}}},async(page,context)=>{
 await context.route('https://night-scout-test.invalid/auth/v1/logout*',route=>route.fulfill({status:204}));await page.goto(origin+'/dashboard');await select(page,'2025-03-01');await comparison(page).waitFor();hold=true;await select(page,'2025-02-01');await arrived;assert.equal(await comparison(page).count(),0,'Old comparison removed while new analysis pending');
 if(mode==='month')await select(page,'2025-01-01');if(mode==='company')await page.getByRole('combobox',{name:'Active store'}).selectOption(otherStore);if(mode==='auth')await page.evaluate(async()=>{const {supabase}=await import('/src/lib/supabase.ts');await supabase.auth.signOut({scope:'local'});});release();
 if(mode==='auth')await page.getByRole('heading',{name:'Sign in to Night Scout',exact:true}).waitFor();else await page.waitForLoadState('networkidle');assert.equal(await comparison(page).count(),0);noExternal(requests,forbiddenRequests);
 });}
});
