// Independent actual-page acceptance. Fictional loopback Auth/source only;
// production component and hook must be present in the coordinator's final checkout.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,origin,otherStore} from './cfo-briefing-browser-fixture.mjs';
function envelope(item){const {response:r}=item;return {contract:'history-cfo-briefing-v1',scope:{...r.scope,timezone:'Europe/London'},sourceBasis:'synthetic-local',financialVersionId:r.versionId,salesRevision:r.salesRevision,costRevision:r.costRevision,observedAt:r.metadata.observedAt,engineFormulaVersion:'profit-evidence-v1',policyVersion:'cfo-guardrails-core-v1',status:'supported',facts:Object.entries({netProductSales:r.sales.netProductSales,netShipping:r.sales.netShipping,grossProfit:r.profit.grossProfit,contribution:r.profit.contribution,operatingProfit:r.profit.ebitda-r.components.depreciationAmortisation,ebitda:r.profit.ebitda}).map(([key,value])=>({key,value,unit:'pence',evidenceRefs:['history-v2:'+r.versionId],ruleIds:['context','calculation','freshness']})),investigation:{text:['Check the underlying sales and classified costs before attributing a cause. These figures alone do not establish which action will improve results.'],ruleIds:['calculation','ladder']}};}
const briefing=page=>page.getByRole('region',{name:'Checked financial briefing',exact:true});
const select=async(page,from)=>{const controls=page.locator('.sv-period-picker');if(await controls.getAttribute('open')===null)await controls.locator('summary').first().click();await page.getByRole('combobox',{name:'Scout reviewed month',exact:true}).selectOption(from);};
const unavailable='Checked financial commentary is unavailable for this report. The supported figures remain available.';
const normal=(route,url,item,json)=>json({...item.response,cfoBriefing:envelope(item)});
for(const width of [390,1440])test(`Checked briefing current facts, month change and fictional exclusion at ${width}px`,async()=>{
 const forbiddenRequests=[];await fixture({viewport:{width,height:900},forbiddenRequests,history:normal},async page=>{
 await page.goto(origin+'/dashboard');assert.equal(await briefing(page).count(),0);await select(page,'2025-03-01');const region=briefing(page);await region.waitFor();await region.getByText(/£90\.00/).first().waitFor();await region.getByText(/£33\.00/).first().waitFor();await region.getByText(/£14\.00/).first().waitFor();await region.getByText('Explore the checked briefing',{exact:true}).click();await region.getByText(/version-2/).first().waitFor();assert.ok(await region.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Briefing contents fit its box');assert.ok(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1),'Page is contained');if(process.env.NIGHT_SCOUT_SCREENSHOT_DIR){await page.setViewportSize({width,height:2000});await region.screenshot({path:process.env.NIGHT_SCOUT_SCREENSHOT_DIR+`/checked-briefing-${width}.png`});await page.setViewportSize({width,height:900});}
 await select(page,'2025-02-01');await briefing(page).getByText(/£15\.00/).first().waitFor();assert.doesNotMatch(await briefing(page).innerText(),/version-2/);
 await page.getByRole('button',{name:'View fictional design',exact:true}).click();assert.equal(await briefing(page).count(),0);assert.deepEqual(forbiddenRequests,[]);
 });
});
test('Old/mismatched/unsupported briefing never replaces valid underlying financial figures',async()=>{
 let mutate=()=>{};const forbiddenRequests=[];
 await fixture({forbiddenRequests,history:(route,url,item,json)=>{const value=envelope(item);mutate(value);return json({...item.response,cfoBriefing:value});}},async page=>{
 for(const change of [b=>b.financialVersionId='old-version',b=>b.scope.storeId=otherStore,b=>b.scope.from='2024-01-01',b=>b.salesRevision='wrong',b=>b.status='unavailable',b=>b.facts[0].value++]){
 mutate=change;await page.goto(origin+'/dashboard');await select(page,'2025-03-01');await briefing(page).getByText(unavailable,{exact:true}).waitFor();assert.equal(await briefing(page).getByText('Explore the checked briefing',{exact:true}).count(),0);await page.locator('.sv-flow-revenue').getByText('£95',{exact:false}).waitFor();
 }assert.deepEqual(forbiddenRequests,[]);
 });
});
test('Failed/denied report and pending company or same-window auth change discard briefing',async()=>{
 for(const mode of ['failed','denied','company','auth']){
 let arrive,release;const arrived=new Promise(r=>arrive=r),pending=new Promise(r=>release=r);let hold=false;
 await fixture({secondStore:mode==='company',history:async(route,url,item,json)=>{if(!hold)return normal(route,url,item,json);arrive();await pending;try{return json(mode==='failed'||mode==='denied'?{error:'unavailable'}:{...item.response,cfoBriefing:envelope(item)},mode==='failed'?503:mode==='denied'?403:200);}catch{}}},async(page,context)=>{
 await context.route('https://night-scout-test.invalid/auth/v1/logout*',route=>route.fulfill({status:204}));await page.goto(origin+'/dashboard');await select(page,'2025-03-01');await briefing(page).getByText(/£14\.00/).first().waitFor();hold=true;await select(page,'2025-02-01');await arrived;assert.equal(await briefing(page).count(),0,'Old briefing removed while new report pending');
 if(mode==='company')await page.getByRole('combobox',{name:'Active store'}).selectOption(otherStore);
 if(mode==='auth')await page.evaluate(async()=>{const {supabase}=await import('/src/lib/supabase.ts');await supabase.auth.signOut({scope:'local'});});
 release();if(mode==='auth')await page.getByRole('heading',{name:'Sign in to Night Scout',exact:true}).waitFor();else await page.waitForLoadState('networkidle');assert.equal(await briefing(page).count(),0);
 });
 }
});
