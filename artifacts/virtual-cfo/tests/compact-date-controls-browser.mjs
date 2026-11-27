// Isolated fictional browser acceptance only. No live user browser or database.
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,origin,store,otherStore} from './cfo-comparison-browser-fixture.mjs';
import {reviewedBrowserMonth} from './reviewed-pages.test-fixture.ts';
import {HISTORY_EDITION} from '../src/lib/v11/history-supported.ts';

const fixtureMonths=Array.from({length:12},(_,i)=>reviewedBrowserMonth(new Date(Date.UTC(2025,10+i,1)).toISOString().slice(0,10),i));
const listing={contract:'history-availability-v2',verification:'sealed-candidates-only',requiresReadValidation:true,storeId:store,currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor:'2024-11-01',months:fixtureMonths.map(({month:m})=>({from:m.selection.period.from,to:m.selection.period.to,snapshotId:m.selection.versionId,versionId:m.selection.versionId,versions:[{versionId:m.selection.versionId,status:'selected',kind:'base'}]}))};
const routes=['/dashboard','/profit-engine','/new-marketing','/new-cash-control','/plan'];
const headings={'/dashboard':'Scout’s View','/profit-engine':'Profit Engine','/new-marketing':'Growth & Marketing','/new-cash-control':'Cash Control','/plan':'Plan'};
const controls=page=>page.locator('section[aria-label="Reporting controls"]');
const root=page=>page.locator('.connected-reporting-context');
const button=(page,name)=>controls(page).getByRole('button',{name,exact:true});

async function scenario(options,run){
 const requests=[],forbiddenRequests=[];
 await fixture({...options,viewport:options.viewport??{width:1440,height:1000},requests,forbiddenRequests},async(page,context)=>{
  // Pin just the test browser clock. No fake date is sent to a real backend.
  await page.clock.setFixedTime(new Date('2026-11-27T12:00:00Z'));
  await context.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url());assert.equal(url.origin,origin);assert.equal(req.method(),'GET');
   const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   requests.push({path:url.pathname,from:url.searchParams.get('from'),to:url.searchParams.get('to'),store:url.searchParams.get('storeId')});
   if(url.pathname==='/api/history-reporting/months')return json(url.searchParams.get('storeId')===store?listing:{...listing,storeId:otherStore,months:[]});
   if(url.pathname==='/api/xero/cash-readiness')return json({state:'unavailable'},503);
   const m=fixtureMonths.find(m=>m.month.selection.period.from===url.searchParams.get('from'));
   if(!m||url.searchParams.get('storeId')!==store||url.searchParams.get('versionId')!==m.month.selection.versionId)return json({state:'unavailable'},409);
   if(url.pathname==='/api/history-reporting')return json(m.response);
   if(url.pathname==='/api/history-reporting/analysis')return json({state:'unavailable'},503);
   if(url.pathname==='/api/supplemental-reporting'&&url.searchParams.get('kind')==='acquisition')return json({contract:'reviewed-supplement-v1',state:'supported',kind:'acquisition',sourceBasis:'synthetic-local',snapshotId:'90000000-0000-4000-8000-000000000001',financialVersionId:m.month.selection.versionId,salesRevision:m.response.salesRevision,costRevision:m.response.costRevision,scope:m.acquisition.scope,observedAt:'2026-11-20T12:00:00Z',payload:m.acquisition});
   return json({state:'unavailable'},503);
  });
  await run(page,context,requests);
  assert.deepEqual(forbiddenRequests,[],'No provider/model/external request');
 });
}
async function ready(page,path){
 await page.waitForFunction(({path,name})=>location.pathname===path&&document.querySelector('main h1')?.textContent?.trim()===name,{path,name:headings[path]});
 await controls(page).waitFor();
 await page.waitForLoadState('networkidle');
}
async function navigate(page,path){
 const mobile=page.getByRole('button',{name:'Open navigation',exact:true});if(await mobile.isVisible())await mobile.click();
 await page.locator(`nav[aria-label="Main navigation"] a[href="${path}"]:visible`).first().click();
 await ready(page,path);
}
async function custom(page,from,to){
 await button(page,'Custom').click();
 await page.getByLabel('Custom start date',{exact:true}).fill(from);
 await page.getByLabel('Custom end date',{exact:true}).fill(to);
 await page.getByRole('button',{name:'Apply dates',exact:true}).click();
 await page.waitForLoadState('networkidle');
 assert.equal(await page.getByLabel('Custom start date',{exact:true}).inputValue(),from);
 assert.equal(await page.getByLabel('Custom end date',{exact:true}).inputValue(),to);
}

test('presets resolve complete UK dates automatically and only Custom reveals date fields',async()=>scenario({},async page=>{
 await page.goto(origin+'/dashboard');await ready(page,'/dashboard');
 assert.equal(await button(page,'Last month').getAttribute('aria-pressed'),'true');
 assert.match(await root(page).innerText(),/1 Oct 2026.*31 Oct 2026/);
 assert.equal(await page.getByLabel('Custom start date',{exact:true}).isVisible(),false);
 assert.equal(await page.locator('select[aria-label="Scout reviewed month"]').count(),0,'No ending-month picker remains');
 await button(page,'Last week').click();
 assert.equal(await button(page,'Weekly').getAttribute('aria-pressed'),'true');
 assert.match(await root(page).innerText(),/16 Nov 2026.*22 Nov 2026/);
 assert.equal(await page.getByLabel('Custom start date',{exact:true}).isVisible(),false);
 await button(page,'Last month').click();
 assert.equal(await button(page,'Monthly').getAttribute('aria-pressed'),'true');
 await page.waitForFunction(()=>document.querySelector('.sv-outcome strong')?.textContent?.includes('£90'));
 await custom(page,'2026-10-03','2026-10-17');
 await page.waitForFunction(()=>document.querySelector('.sv-outcome strong')?.textContent==='—');
 assert.equal(await page.locator('.sv-outcome strong').first().innerText(),'—','Partial custom range cannot reuse full-month sales');
 await navigate(page,'/plan');assert.equal(await page.getByRole('button',{name:'Save plan',exact:true}).isEnabled(),false,'Partial custom range cannot enable a full-month Plan baseline');
 await navigate(page,'/dashboard');
 await custom(page,'2026-10-01','2026-10-31');
 await page.waitForFunction(()=>document.querySelector('.sv-outcome strong')?.textContent?.includes('£90'));
}));

test('invalid custom drafts do not replace the last checked report',async()=>scenario({},async page=>{
 await page.goto(origin+'/dashboard');await ready(page,'/dashboard');await button(page,'Custom').click();
 await page.getByLabel('Custom start date',{exact:true}).fill('2026-10-17');await page.getByLabel('Custom end date',{exact:true}).fill('2026-10-03');await page.getByRole('button',{name:'Apply dates',exact:true}).click();
 assert.equal(await page.getByRole('alert').isVisible(),true);assert.match(await root(page).locator('.src-summary').innerText(),/1 Oct 2026.*31 Oct 2026/);
 await page.getByLabel('Custom start date',{exact:true}).fill('2026-12-01');await page.getByLabel('Custom end date',{exact:true}).fill('2026-12-31');await page.getByRole('button',{name:'Apply dates',exact:true}).click();
 assert.equal(await page.getByRole('alert').isVisible(),true);assert.match(await root(page).locator('.src-summary').innerText(),/1 Oct 2026.*31 Oct 2026/);
}));

test('custom dates and shared preferences survive all five routes, reverse edits and reload',async()=>scenario({},async page=>{
 await page.goto(origin+'/dashboard');await ready(page,'/dashboard');await custom(page,'2026-10-01','2026-10-31');
 await button(page,'Per order').click();await button(page,'Last year').click();
 for(const path of routes.slice(1)){
  await navigate(page,path);
  for(const name of ['Custom','Monthly','Per order','Last year'])assert.equal(await button(page,name).getAttribute('aria-pressed'),'true',path+': '+name);
  assert.equal(await page.getByLabel('Custom start date',{exact:true}).inputValue(),'2026-10-01');
  assert.equal(await page.getByLabel('Custom end date',{exact:true}).inputValue(),'2026-10-31');
 }
 await custom(page,'2026-01-01','2026-01-31');await button(page,'Total').click();
 await navigate(page,'/dashboard');
 assert.equal(await page.getByLabel('Custom start date',{exact:true}).inputValue(),'2026-01-01');
 assert.equal(await button(page,'Total').getAttribute('aria-pressed'),'true');
 await page.reload();await ready(page,'/dashboard');
 assert.equal(await button(page,'Custom').getAttribute('aria-pressed'),'true');
 assert.equal(await page.getByLabel('Custom end date',{exact:true}).inputValue(),'2026-01-31');
}));

test('custom range choices stay isolated by company',async()=>scenario({secondStore:true},async page=>{
 await page.goto(origin+'/dashboard');await ready(page,'/dashboard');await custom(page,'2026-01-01','2026-01-31');
 await page.getByRole('combobox',{name:'Active store'}).selectOption(otherStore);await page.waitForLoadState('networkidle');
 assert.equal(await button(page,'Last month').getAttribute('aria-pressed'),'true');
 assert.equal(await page.getByLabel('Custom start date',{exact:true}).isVisible(),false);
 await page.getByRole('combobox',{name:'Active store'}).selectOption(store);await page.waitForLoadState('networkidle');
 assert.equal(await button(page,'Custom').getAttribute('aria-pressed'),'true');
 assert.equal(await page.getByLabel('Custom start date',{exact:true}).inputValue(),'2026-01-01');
}));

test('compact panels fit all five pages at desktop and mobile sizes',async()=>{
 for(const width of [1440,390])await scenario({viewport:{width,height:width===390?844:1000}},async page=>{
  await page.goto(origin+'/dashboard');await ready(page,'/dashboard');
  for(const path of routes){
   if(new URL(page.url()).pathname!==path)await navigate(page,path);
   assert.equal(await controls(page).count(),1,path+': one shared group');
   assert.equal(await button(page,'Last month').getAttribute('aria-pressed'),'true');
   assert.equal(await page.getByLabel('Custom start date',{exact:true}).isVisible(),false);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,path+': no page-wide overflow');
   if(process.env.NIGHT_SCOUT_COMPACT_SHOTS){
    fs.mkdirSync(process.env.NIGHT_SCOUT_COMPACT_SHOTS,{recursive:true,mode:0o700});
    await page.getByRole('heading',{name:headings[path],level:1,exact:true}).click({trial:true});
    await page.screenshot({path:process.env.NIGHT_SCOUT_COMPACT_SHOTS+'/'+path.slice(1)+'-'+width+'.png'});
   }
  }
  await button(page,'Custom').click();
  assert.equal(await page.getByLabel('Custom start date',{exact:true}).isVisible(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Custom date fields fit at'+width);
 });
});
