// Isolated local browser acceptance: fictional GET-only responses; all external calls blocked.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,origin,store} from './cfo-comparison-browser-fixture.mjs';
import {rangeMonths,browserRangeResponse} from './reporting-range-response.fixture.mjs';
import {browserSupplement,attachPartialCash} from './reporting-range-supplements.fixture.mjs';
import {HISTORY_EDITION} from '../src/lib/v11/history-supported.ts';
const paths=['/dashboard','/profit-engine','/new-marketing','/new-cash-control','/plan'];
const headings={'/dashboard':'Scout’s View','/profit-engine':'Profit Engine','/new-marketing':'Growth & Marketing','/new-cash-control':'Cash Control','/plan':'Plan'};
const controls=p=>p.getByRole('region',{name:'Reporting controls',exact:true});
const button=(p,name)=>controls(p).getByRole('button',{name,exact:true});
async function ready(p,path){await p.waitForFunction(({path,name})=>location.pathname===path&&document.querySelector('main h1')?.textContent===name,{path,name:headings[path]});await controls(p).waitFor();await p.waitForLoadState('networkidle');}
async function navigate(p,path){await p.getByRole('link',{name:headings[path],exact:true}).first().click();await ready(p,path);}
async function custom(p,from,to,view='Monthly'){
 await button(p,'Custom').click();await p.getByLabel('Custom start date',{exact:true}).fill(from);await p.getByLabel('Custom end date',{exact:true}).fill(to);await p.getByRole('button',{name:'Apply dates',exact:true}).click();await button(p,view).click();
}
async function scenario(options,run){
 const forbiddenRequests=[],requests=[];
 await fixture({viewport:{width:1440,height:1000},forbiddenRequests},async(page,context)=>{
  await page.clock.setFixedTime(new Date('2026-11-27T12:00:00Z'));
  const listed=rangeMonths.filter(m=>m.month.selection.period.from!==options.missing);
  const listing={contract:'history-availability-v2',verification:'sealed-candidates-only',requiresReadValidation:true,storeId:store,currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor:'2024-11-01',months:listed.map(({month:m})=>({...m.selection.period,snapshotId:m.selection.versionId,versionId:m.selection.versionId,versions:[{versionId:m.selection.versionId,status:'selected',kind:'base'}]}))};
  await context.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url()),from=url.searchParams.get('from'),to=url.searchParams.get('to');assert.equal(req.method(),'GET');assert.equal(url.origin,origin);requests.push({path:url.pathname,from,to});
   const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(url.pathname==='/api/history-reporting/months')return json(listing);
   if(url.pathname==='/api/history-reporting/range'){
    if(options.delayFrom===from)await new Promise(resolve=>setTimeout(resolve,350));
    const raw=browserRangeResponse(from,to);return json(options.supplements&&raw.state==='supported'?attachPartialCash(raw):raw);
   }
   const m=rangeMonths.find(m=>m.month.selection.period.from===from&&m.month.selection.period.to===to&&m.month.selection.versionId===url.searchParams.get('versionId'));
   if(url.pathname==='/api/history-reporting')return json(m?.response??{state:'unavailable'},m?200:409);
   if(url.pathname==='/api/history-reporting/analysis')return json({state:'unavailable'},503);
   if(url.pathname==='/api/supplemental-reporting'&&options.supplements&&m)return json(browserSupplement(m,url.searchParams.get('kind'),rangeMonths.indexOf(m)));
   if(url.pathname==='/api/xero/cash-readiness'||url.pathname==='/api/supplemental-reporting')return json({state:'unavailable'},503);
   forbiddenRequests.push(url.pathname);return route.abort();
  });
  await page.goto(origin+'/dashboard');await ready(page,'/dashboard');await run(page,requests);assert.deepEqual(forbiddenRequests,[],'No unexpected provider/model/external request');
 });
}
test('historical complete cross-month week uses its own checked range figures and allocated label',()=>scenario({},async page=>{
 await custom(page,'2025-01-27','2025-02-02','Weekly');await page.waitForLoadState('networkidle');
 await page.waitForFunction(()=>document.querySelector('.sv-outcome strong')?.textContent==='£70');
 assert.match(await controls(page).innerText(),/27 Jan 2025.*2 Feb 2025/);
 assert.match(await page.locator('#scout-position').innerText(),/ALLOCATED|allocated/i);
 assert.equal(await page.locator('.sv-outcome strong').first().innerText(),'£70');
 await navigate(page,'/profit-engine');await page.locator('[data-range-chart=weekly] table tbody tr').waitFor({state:'attached'});
 const rows=page.locator('[data-range-chart=weekly] table tbody tr');assert.equal(await rows.count(),1);assert.match(await rows.first().textContent(),/2025-01-27–2025-02-02.*£70.00/);
 await page.locator('[data-range-chart=weekly]').scrollIntoViewIfNeeded();await page.screenshot({path:'/private/tmp/night-scout-weekly-profit-desktop.png',fullPage:true});
 await button(page,'Monthly').click();const monthly=page.locator('[data-range-chart=monthly] table tbody tr');assert.equal(await monthly.count(),2);assert.match(await monthly.first().textContent(),/2025-01-27–2025-01-31.*£50.00/);assert.match(await monthly.last().textContent(),/2025-02-01–2025-02-02.*£20.00/);await button(page,'Weekly').click();
 await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('[data-range-chart=weekly] table tbody tr').count(),1);await page.locator('[data-range-chart=weekly]').scrollIntoViewIfNeeded();await page.screenshot({path:'/private/tmp/night-scout-weekly-profit-mobile.png',fullPage:true});
}));
test('complete multi-month actuals share the selected dates and weighted per-order values across all five pages',()=>scenario({},async page=>{
 await custom(page,'2025-01-01','2025-02-28');await page.waitForLoadState('networkidle');await page.waitForFunction(()=>document.querySelector('.sv-outcome strong')?.textContent==='£180');
 await button(page,'Per order').click();assert.equal(await page.locator('.sv-outcome strong').first().innerText(),'£8.57');
 for(const path of paths.slice(1)){await navigate(page,path);assert.equal(await page.getByLabel('Custom start date',{exact:true}).inputValue(),'2025-01-01');assert.equal(await page.getByLabel('Custom end date',{exact:true}).inputValue(),'2025-02-28');assert.equal(await button(page,'Per order').getAttribute('aria-pressed'),'true');}
 await custom(page,'2025-01-27','2025-01-29');await navigate(page,'/dashboard');await page.waitForFunction(()=>document.querySelector('.sv-outcome strong')?.textContent==='£10.00');
 await page.reload();await ready(page,'/dashboard');assert.equal(await page.getByLabel('Custom start date',{exact:true}).inputValue(),'2025-01-27');assert.equal(await page.locator('.sv-outcome strong').first().innerText(),'£10.00');
}));
test('changed custom range cannot retain the earlier range total while a new response is pending',()=>scenario({delayFrom:'2025-01-28'},async page=>{
 await custom(page,'2025-01-27','2025-02-02');await page.waitForLoadState('networkidle');await page.waitForFunction(()=>document.querySelector('.sv-outcome strong')?.textContent==='£70');
 await custom(page,'2025-01-28','2025-02-02');assert.notEqual(await page.locator('.sv-outcome strong').first().innerText(),'£70');
 await page.waitForLoadState('networkidle');await page.waitForFunction(()=>document.querySelector('.sv-outcome strong')?.textContent==='£60');
}));
test('missing intersecting month refuses range reads; Plan uses no later month beyond a partial ending date',()=>scenario({missing:'2025-02-01'},async(page,requests)=>{
 await custom(page,'2025-01-27','2025-02-02');await page.waitForLoadState('networkidle');assert.equal(await page.locator('.sv-outcome strong').first().innerText(),'—');
 assert.equal(requests.some(r=>r.path==='/api/history-reporting/range'),false);
 await navigate(page,'/plan');assert.equal(await page.getByRole('button',{name:'Save plan',exact:true}).isEnabled(),false);
 assert.equal(requests.some(r=>r.path==='/api/history-reporting'&&r.from==='2025-02-01'),false,'No February baseline read beyond the selected February2 cutoff');
}));

test('accepted monthly cash and acquisition sources reach their actual page figures',()=>scenario({supplements:true},async page=>{
 await custom(page,'2025-01-01','2025-02-28');await navigate(page,'/new-cash-control');
 const bank=page.locator('.nc-kpi').filter({hasText:'Bank cash at selected period end'}).locator('strong');await bank.waitFor();await page.waitForFunction(()=>Array.from(document.querySelectorAll('.nc-kpi')).find(n=>n.textContent.includes('Bank cash at selected period end'))?.querySelector('strong')?.textContent?.startsWith('£1,031'));assert.match(await bank.innerText(),/£1,031(?:\.00)?/);
 await navigate(page,'/new-marketing');await page.waitForLoadState('networkidle');await page.waitForFunction(()=>document.querySelector('main')?.textContent.includes('£0.50'));assert.match(await page.locator('main').innerText(),/£0.50/);
}));
test('partial cash uses dated movements with an explicit timing bridge; conversion uses observed selected sessions',()=>scenario({supplements:true},async page=>{
 await custom(page,'2025-01-27','2025-02-02');await navigate(page,'/new-cash-control');
 await page.locator('[data-cash-component=cost-timing]').waitFor({state:'attached'});assert.equal(await page.locator('[data-cash-component=cost-timing]').getAttribute('data-amount-pence'),'-2832');
 assert.notEqual(await page.locator('.nc-kpi').filter({hasText:'Bank cash at selected period end'}).locator('strong').innerText(),'—');
 await navigate(page,'/new-marketing');await page.getByRole('button',{name:/^Conversion/}).click();await page.waitForLoadState('networkidle');await page.waitForFunction(()=>/1.0+%|1%/.test(document.querySelector('main')?.textContent??''));assert.match(await page.locator('main').innerText(),/1.0+%|1%/);await page.locator('[data-growth-range-chart] table tbody tr').first().waitFor({state:'attached'});assert.ok(await page.locator('[data-growth-range-chart] table tbody tr').count()>0);
}));
