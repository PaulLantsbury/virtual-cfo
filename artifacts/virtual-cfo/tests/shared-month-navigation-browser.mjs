import fs from 'node:fs';
// LOCAL DISPOSABLE FIXTURES ONLY. No signed-in user browser, provider or DB.
// Uses the existing all-external-requests-blocked authentication fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,origin,store,otherStore,user} from './cfo-comparison-browser-fixture.mjs';
import {reviewedBrowserMonth} from './reviewed-pages.test-fixture.ts';
import {HISTORY_EDITION} from '../src/lib/v11/history-supported.ts';
const fixtureMonths=Array.from({length:12},(_,index)=>{
 const date=new Date(Date.UTC(2025,10+index,1));
 return reviewedBrowserMonth(date.toISOString().slice(0,10),index);
});
const listing={contract:'history-availability-v2',verification:'sealed-candidates-only',requiresReadValidation:true,storeId:store,currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor:'2024-11-01',months:fixtureMonths.map(({month:m})=>({from:m.selection.period.from,to:m.selection.period.to,snapshotId:m.selection.versionId,versionId:m.selection.versionId,versions:[{versionId:m.selection.versionId,status:'selected',kind:'base'}]}))};
const routes=['/dashboard','/profit-engine','/new-marketing','/new-cash-control','/plan'];
const priorSelectors={'/dashboard':'select[aria-label="Scout comparison month"]','/profit-engine':'select[aria-label="Profit comparison month"]','/new-marketing':'select[aria-label="Growth comparison month"]'};
const monthTo=from=>new Date(Date.UTC(Number(from.slice(0,4)),Number(from.slice(5,7)),0)).toISOString().slice(0,10);
async function choose(page,path,value,prior=false){
 if(prior){
  const control=page.locator(priorSelectors[path]).first();await control.waitFor({state:'attached'});
  const detail=control.locator('xpath=ancestor::details[1]');if(await detail.count()&&await detail.getAttribute('open')===null)await detail.locator('summary').first().click();
  await control.selectOption(value);
 }else{
  const controls=page.locator('section[aria-label="Reporting controls"]');
  await controls.getByRole('button',{name:'Custom',exact:true}).click();
  await page.getByLabel('Custom start date',{exact:true}).fill(value);
  await page.getByLabel('Custom end date',{exact:true}).fill(monthTo(value));
  await page.getByRole('button',{name:'Apply dates',exact:true}).click();
 }
 await hasMonth(page,path,value,prior);
}
async function hasMonth(page,path,value,prior=false){
 if(prior){
  const selector=priorSelectors[path];await page.waitForFunction(({selector,value})=>document.querySelector(selector)?.value===value,{selector,value});
 }else if(value){
  await page.waitForFunction(value=>document.querySelector('input[aria-label="Custom start date"]')?.value===value,value);
 }else{
  await page.waitForFunction(()=>[...document.querySelectorAll('section[aria-label="Reporting controls"] button')].some(b=>b.textContent==='Last month'&&b.getAttribute('aria-pressed')==='true'));
 }
 await page.waitForLoadState('networkidle');
 if(prior)assert.equal(await page.locator(priorSelectors[path]).first().inputValue(),value);
 else if(value)assert.equal(await page.getByLabel('Custom start date',{exact:true}).inputValue(),value,'Custom choice survives completion of page loading');
 else assert.equal(await page.locator('section[aria-label="Reporting controls"]').getByRole('button',{name:'Last month',exact:true}).getAttribute('aria-pressed'),'true','New company/account gets its own automatic preset');
}
async function navigate(page,path){
 const mobileMenu=page.getByRole('button',{name:'Open navigation',exact:true});
 if(await mobileMenu.isVisible())await mobileMenu.click();
 await page.locator(`nav[aria-label="Main navigation"] a[href="${path}"]:visible`).first().click();
 await page.waitForURL(url=>url.pathname===path);
}
async function scenario(options,run){
 const requests=[],forbiddenRequests=[];
 return fixture({...options,viewport:options.viewport??{width:1440,height:1000},requests,forbiddenRequests},async(page,context)=>{
  await context.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url());assert.equal(url.origin,origin);assert.equal(req.method(),'GET');
   const json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
   requests.push(url.pathname);
   if(url.pathname==='/api/xero/cash-readiness')return json({state:'unavailable'},503);
   if(url.pathname==='/api/history-reporting/months')return json(url.searchParams.get('storeId')===store?listing:{...listing,storeId:otherStore,months:[]});
   const m=fixtureMonths.find(m=>m.month.selection.period.from===url.searchParams.get('from'));
   if(!m||url.searchParams.get('storeId')!==store||url.searchParams.get('versionId')!==m.month.selection.versionId)return json({state:'unavailable'},409);
   if(url.pathname==='/api/history-reporting')return json(m.response);
   if(url.pathname==='/api/history-reporting/analysis')return json({state:'unavailable'},503);
   if(url.pathname==='/api/supplemental-reporting'&&url.searchParams.get('kind')==='acquisition')return json({contract:'reviewed-supplement-v1',state:'supported',kind:'acquisition',sourceBasis:'synthetic-local',snapshotId:'90000000-0000-4000-8000-000000000001',financialVersionId:m.month.selection.versionId,salesRevision:m.response.salesRevision,costRevision:m.response.costRevision,scope:m.acquisition.scope,observedAt:'2026-11-20T12:00:00Z',payload:m.acquisition});
   // No fake cash/source fallback: selection can persist while optional evidence is unavailable.
   return json({state:'unavailable'},503);
  });
  await run(page,context);
  assert.deepEqual(forbiddenRequests,[],'No provider/model/external requests');
  assert.ok(requests.every(p=>['/api/history-reporting/months','/api/history-reporting','/api/history-reporting/analysis','/api/supplemental-reporting','/api/xero/cash-readiness'].includes(p)),'Only existing mocked reporting reads: '+JSON.stringify([...new Set(requests)]));
 });
}
test('shared reporting month survives all five page links, reverse updates and reload',async()=>scenario({},async page=>{
 await page.goto(origin+'/dashboard');await choose(page,'/dashboard','2026-10-01');
 for(const path of routes.slice(1)){await navigate(page,path);await hasMonth(page,path,'2026-10-01');if(path==='/plan')await page.locator('.pv-plan-controls').waitFor();}
 await navigate(page,'/new-marketing');await choose(page,'/new-marketing','2026-01-01');
 for(const path of ['/new-cash-control','/plan','/dashboard','/profit-engine']){await navigate(page,path);await hasMonth(page,path,'2026-01-01');}
 await page.reload();await hasMonth(page,'/profit-engine','2026-01-01');
}));
test('comparison stays distinct and newer custom dates defeat an old deep link',async()=>scenario({},async page=>{
 await page.goto(origin+'/dashboard');await choose(page,'/dashboard','2026-10-01');await choose(page,'/dashboard','2026-01-01',true);
 await navigate(page,'/profit-engine');await hasMonth(page,'/profit-engine','2026-10-01');await hasMonth(page,'/profit-engine','2026-01-01',true);
 await navigate(page,'/new-marketing');await hasMonth(page,'/new-marketing','2026-10-01');await hasMonth(page,'/new-marketing','2026-01-01',true);await choose(page,'/new-marketing','2025-12-01',true);
 await navigate(page,'/dashboard');await hasMonth(page,'/dashboard','2026-10-01');await hasMonth(page,'/dashboard','2025-12-01',true);
 await choose(page,'/dashboard','2026-01-01');
 const old=fixtureMonths.at(-1).month.selection;
 await page.goto(origin+'/profit-engine?'+new URLSearchParams({reviewStore:store,reviewFrom:old.period.from,reviewTo:old.period.to,reviewVersion:old.versionId}));
 await hasMonth(page,'/profit-engine','2026-01-01');await page.waitForLoadState('networkidle');await hasMonth(page,'/profit-engine','2026-01-01');
 await page.reload();await hasMonth(page,'/profit-engine','2026-01-01');
}));
test('company and account changes do not inherit another identity reporting month',async()=>scenario({secondStore:true},async(page,context)=>{
 await page.goto(origin+'/dashboard');await choose(page,'/dashboard','2026-01-01');
 await page.getByRole('combobox',{name:'Active store'}).selectOption(otherStore);await hasMonth(page,'/dashboard','');
 await page.getByRole('combobox',{name:'Active store'}).selectOption(store);await hasMonth(page,'/dashboard','2026-01-01');
 const second={...user,id:'60000000-0000-4000-8000-000000000002',email:'second-fixture@example.invalid'};
 const tokenFor=u=>[{alg:'HS256',typ:'JWT'},{sub:u.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},'fictional-signature'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
 let current=second;
 await context.route('https://night-scout-test.invalid/auth/v1/user',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(current)}));
 const replaceSession=async u=>page.evaluate(async token=>{const {supabase}=await import('/src/lib/supabase.ts');const {error}=await supabase.auth.setSession({access_token:token,refresh_token:'fictional-refresh'});if(error)throw error;},tokenFor(u));
 await replaceSession(second);await page.getByRole('button',{name:'DISPOSABLE BROWSER FIXTURE — NOT LIVE',exact:true}).click();await hasMonth(page,'/dashboard','');
 current=user;await replaceSession(user);await hasMonth(page,'/dashboard','2026-01-01');
}));

test('period, view, amounts and comparison remain one shared choice across all five pages',async()=>scenario({},async page=>{
 await page.goto(origin+'/dashboard');await choose(page,'/dashboard','2026-10-01');
 const controls=()=>page.locator('section[aria-label="Reporting controls"]');
 await controls().getByRole('button',{name:'6 months',exact:true}).click();
 await controls().getByRole('button',{name:'Monthly',exact:true}).click();
 await controls().getByRole('button',{name:'Per order',exact:true}).click();
 await controls().getByRole('button',{name:'Last year',exact:true}).click();
 for(const path of routes.slice(1)){
  await navigate(page,path);
  for(const name of ['6 months','Monthly','Per order','Last year'])assert.equal(await controls().getByRole('button',{name,exact:true}).getAttribute('aria-pressed'),'true',`${path}: ${name}`);
 }
 await controls().getByRole('button',{name:'Last week',exact:true}).click();
 await controls().getByRole('button',{name:'Total',exact:true}).click();
 await navigate(page,'/dashboard');
 for(const name of ['Last week','Weekly','Total','Last year'])assert.equal(await controls().getByRole('button',{name,exact:true}).getAttribute('aria-pressed'),'true');
 await page.waitForLoadState('networkidle');
 await page.waitForFunction(()=>document.querySelector('.sv-outcome strong')?.textContent==='—');
 assert.equal(await page.locator('.sv-outcome strong').first().innerText(),'—','Unsupported weekly figures never retain old monthly totals');
 await page.reload();
 assert.equal(await controls().getByRole('button',{name:'Last week',exact:true}).getAttribute('aria-pressed'),'true');
 assert.equal(await controls().getByRole('button',{name:'Weekly',exact:true}).getAttribute('aria-pressed'),'true');
}));

test('Plan keeps the full workspace visible while baseline inputs are missing',async()=>scenario({},async page=>{
 await page.goto(origin+'/plan');await choose(page,'/plan','2024-11-01');
 await page.getByRole('heading',{name:'Compare the levers. Choose what to test.',exact:true}).waitFor();
 await page.getByRole('heading',{name:'Build a plan you can actually test',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Save plan',exact:true}).isEnabled(),false);
 assert.equal(await page.getByRole('link',{name:/Explore the Numbers/}).count(),0,'No top-level Explore jump button');
 assert.ok(await page.locator('.pv-placeholder-value').count()>0);
}));


const pageHeadings={'/dashboard':'Scout’s View','/profit-engine':'Profit Engine','/new-marketing':'Growth & Marketing','/new-cash-control':'Cash Control','/plan':'Plan'};
async function readyRestoredPage(page,path,from){
 const name=pageHeadings[path];
 // Plan can replace its pending frame when the source check finishes, while
 // auth revalidation can briefly replace the entire route. Wait for THIS page's
 // heading and settled shared control rather than any transient h1.
 await page.waitForFunction(({path,name,from})=>location.pathname===path
  &&document.querySelector('main h1')?.textContent?.trim()===name
  &&document.querySelector('input[aria-label="Custom start date"]')?.value===from
  &&document.querySelector('.connected-reporting-context')?.getAttribute('aria-busy')==='false',
  {path,name,from});
 const heading=page.getByRole('heading',{level:1,name,exact:true});
 await heading.waitFor({state:'visible'});
 // A trial action performs Playwright's retrying actionability/scroll checks
 // without sending a click; if a pending frame detaches, it resolves the new
 // heading with the same exact route identity instead of skipping the check.
 await heading.click({trial:true});
 assert.equal(await heading.textContent(),name,`${path}: settled route heading`);
 assert.equal(await page.getByLabel('Custom start date',{exact:true}).inputValue(),from,`${path}: settled shared custom date`);
}

test('restored primary pages remain usable at desktop and mobile widths without header jump buttons',async()=>{
 for(const width of [1440,390])await scenario({viewport:{width,height:width===390?844:1000}},async page=>{
  await page.goto(origin+'/dashboard');await choose(page,'/dashboard','2026-10-01');
  for(const path of routes){
   if(!page.url().endsWith(path))await navigate(page,path);
   await hasMonth(page,path,'2026-10-01');
   await readyRestoredPage(page,path,'2026-10-01');
   assert.equal(await page.getByRole('link',{name:/Explore the Numbers/}).count(),0,`${path}: header jump link removed`);
   assert.equal(await page.locator('section[aria-label="Reporting controls"]').count(),1,`${path}: one shared control group`);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
   assert.equal(overflow,false,`${path}: no document-width overflow at ${width}px`);
   if(process.env.NIGHT_SCOUT_RESTORATION_SHOTS){
    fs.mkdirSync(process.env.NIGHT_SCOUT_RESTORATION_SHOTS,{recursive:true,mode:0o700});
    await readyRestoredPage(page,path,'2026-10-01');
    await page.screenshot({path:process.env.NIGHT_SCOUT_RESTORATION_SHOTS+'/'+path.slice(1)+'-'+width+'.png'});
   }
  }
 });
});
