// DISPOSABLE FIXTURES ONLY. Run against a loopback frontend built with
// VITE_SUPABASE_URL=https://night-scout-test.invalid and a fictional anon key.
// New isolated headless browser context; never attaches to a user's browser.
// Every non-loopback request is mocked or blocked; no provider/DB writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedBrowserMonth} from './reviewed-pages.test-fixture.ts';
import {HISTORY_EDITION} from '../src/lib/v11/history-supported.ts';
const origin=process.env.NIGHT_SCOUT_TEST_URL||'http://127.0.0.1:5187';
if(new URL(origin).hostname!=='127.0.0.1'||new URL(origin).protocol!=='http:')throw Error('Explicit HTTP loopback preview required');
const {chromium}=await import(process.env.NIGHT_SCOUT_PLAYWRIGHT_MODULE||'playwright');
const months=['2025-01-01','2025-02-01','2025-03-01'].map(reviewedBrowserMonth);
const store=months[0].month.selection.storeId;
const otherStore='d7500000-0000-4000-8000-000000000008';
const user={id:'60000000-0000-4000-8000-000000000001',email:'fixture@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},identities:[],created_at:'2026-09-08T00:00:00Z'};
const token=[{alg:'HS256',typ:'JWT'},{sub:user.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},'fictional-signature'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
const session={access_token:token,refresh_token:'fictional-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
const listing={contract:'history-availability-v2',verification:'sealed-candidates-only',requiresReadValidation:true,storeId:store,currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor:'2024-11-01',months:months.map(({month:m})=>({from:m.selection.period.from,to:m.selection.period.to,snapshotId:m.selection.versionId,versionId:m.selection.versionId,versions:[{versionId:m.selection.versionId,status:'selected',kind:'base'}]}))};
async function fixture(options,run){
 const browser=await chromium.launch({headless:true,executablePath:process.env.NIGHT_SCOUT_CHROME_PATH});
 const context=await browser.newContext({viewport:options.viewport||{width:390,height:844}}),page=await context.newPage(),errors=[];
 page.setDefaultTimeout(8000);
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(url.origin===origin&&url.pathname.startsWith('/api/')){
   options.requests?.push(url.pathname);
   assert.equal(request.method(),'GET','Fixture backend accepts reads only');
   if(url.pathname==='/api/history-reporting/months')return json(url.searchParams.get('storeId')===store?listing:{...listing,storeId:otherStore,months:[]});
   const item=months.find(m=>m.month.selection.period.from===url.searchParams.get('from'));
   if(!item||url.searchParams.get('storeId')!==store||url.searchParams.get('versionId')!==item.month.selection.versionId)return json({state:'unavailable'},409);
   if(url.pathname==='/api/history-reporting')return json(item.response);
   if(url.pathname==='/api/supplemental-reporting'){
    if(options.failSupplementOnce===item.month.selection.period.from){
     options.failSupplementOnce=null;
     return json({state:'unavailable'},503);
    }
    const payload=structuredClone(item.acquisition);if(options.legacy)delete payload.customerActivity;
    return json({contract:'reviewed-supplement-v1',state:'supported',kind:'acquisition',sourceBasis:'synthetic-local',snapshotId:'90000000-0000-4000-8000-000000000001',financialVersionId:item.month.selection.versionId,salesRevision:item.response.salesRevision,costRevision:item.response.costRevision,scope:payload.scope,observedAt:'2026-11-20T12:00:00Z',payload});
   }
   return json({error:'Unexpected fixture API'},404);
  }
  if(url.origin===origin){if(!['GET','HEAD'].includes(request.method()))return route.abort();return route.continue();}
  if(url.hostname!=='night-scout-test.invalid')return route.abort();
  if(url.pathname==='/auth/v1/token')return json(session);
  if(url.pathname==='/auth/v1/user')return json(user);
  if(url.pathname==='/rest/v1/store_memberships')return json(options.nonMember?[]:[{store_id:store,stores:{id:store,name:'DISPOSABLE BROWSER FIXTURE — NOT LIVE'}},...(options.secondStore?[{store_id:otherStore,stores:{id:otherStore,name:'SECOND DISPOSABLE FIXTURE — NOT LIVE'}}]:[])]);
  return route.abort();
 });
 try{
  await page.addInitScript(()=>sessionStorage.setItem('userPlan','pro'));
  await page.goto(origin+'/login');await page.getByLabel('Email address').fill(user.email);await page.getByLabel('Password',{exact:true}).fill('fictional-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();if(options.secondStore)await page.getByRole('button',{name:'DISPOSABLE BROWSER FIXTURE — NOT LIVE',exact:true}).click();if(options.nonMember)await page.getByRole('heading',{name:'Your account is not linked to a store yet'}).waitFor();else await page.getByRole('combobox',{name:'Active store'}).waitFor();
  await run(page,context);assert.deepEqual(errors,[]);
 }finally{await context.close();await browser.close();}
}
test('DISPOSABLE: Marketing exact earlier-month comparison and legacy optional activity gaps',async()=>fixture({legacy:true},async page=>{
 await page.goto(origin+'/new-marketing');await page.getByLabel('Growth reviewed month',{exact:true}).selectOption('2025-03-01');await page.getByLabel('Growth evidence version',{exact:true}).selectOption('version-2');
 await page.getByLabel('Growth comparison month',{exact:true}).selectOption('2025-02-01');await page.getByLabel('Growth comparison evidence version',{exact:true}).selectOption('version-1');
 await page.getByText('Earlier reviewed month: 2025-02-01–2025-02-28',{exact:false}).first().waitFor();
 await page.locator('.gm-tabs button').filter({hasText:'Retention'}).click();
 await page.getByText('Customer activity breakdown unavailable for this previously published summary.',{exact:false}).waitFor();
 assert.ok(await page.getByRole('region',{name:'Reviewed customer activity comparison'}).count());
 assert.ok(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1),'390px has no page overflow');
}));
test('DISPOSABLE: Plan discloses a failed constituent and restores the baseline after retry',async()=>fixture({failSupplementOnce:'2025-02-01'},async page=>{
 await page.goto(origin+'/plan');await page.getByLabel('Plan reviewed month',{exact:true}).selectOption('2025-03-01');await page.getByLabel('Plan evidence version',{exact:true}).selectOption('version-2');
 const failure=page.getByRole('alert').filter({hasText:'A matched acquisition source could not be read.'});
 await failure.waitFor();
 assert.equal(await page.getByLabel('Bring existing customers back',{exact:false}).count(),0);
 const evidence=page.locator('#plan-evidence');
 await evidence.getByText('Explore the Numbers · baseline sources and recovery',{exact:true}).click();
 const sourceRow=evidence.getByRole('row').filter({hasText:'2025-02-01–2025-02-28'});
 await sourceRow.getByText('Accepted financial month',{exact:true}).waitFor();
 await sourceRow.getByText('The matched acquisition source could not be read.',{exact:false}).waitFor();
 assert.ok(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1),'390px has no page overflow with source evidence expanded');
 const retryBox=await failure.getByRole('button',{name:'Retry acquisition sources'}).boundingBox();
 assert.ok(retryBox&&retryBox.x>=0&&retryBox.x+retryBox.width<=390,'Mobile recovery button stays inside the viewport');
 if(process.env.NIGHT_SCOUT_SCREENSHOT_DIR)await page.screenshot({path:process.env.NIGHT_SCOUT_SCREENSHOT_DIR+'/mobile-plan-evidence.png',fullPage:true});
 await failure.getByRole('button',{name:'Retry acquisition sources'}).click();
 const repeat=page.getByRole('checkbox',{name:'Bring existing customers back'});
 await repeat.waitFor();
 assert.equal(await repeat.isDisabled(),true);
}));
test('DISPOSABLE: Plan preserves paid-first population and blocks unsupported repeat lever',async()=>fixture({},async page=>{
 await page.goto(origin+'/plan');await page.getByLabel('Plan reviewed month',{exact:true}).selectOption('2025-03-01');await page.getByLabel('Plan evidence version',{exact:true}).selectOption('version-2');
 const repeat=page.getByRole('checkbox',{name:'Bring existing customers back'});await repeat.waitFor();assert.equal(await repeat.isDisabled(),true);
 await page.getByText('Other orders include organic first, guest and unknown orders',{exact:false}).waitFor();
 assert.equal(await page.getByText('2.00% becomes',{exact:false}).count(),0,'No unsourced absolute conversion baseline');
 assert.ok(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1),'390px has no page overflow');
}));

const handoff=()=>new URLSearchParams({reviewStore:store,reviewFrom:'2025-03-01',reviewTo:'2025-03-31',reviewVersion:'version-2',compareFrom:'2025-02-01',compareTo:'2025-02-28',compareVersion:'version-1'});
const control=(page,label)=>page.getByRole('combobox',{name:new RegExp('^'+label+'(?:$|\\s)')});
async function expectValue(page,label,value){await page.waitForFunction(({label,value})=>{const labels=[...document.querySelectorAll('label')];const l=labels.find(l=>l.textContent?.trim().startsWith(label));return l?.querySelector('select')?.value===value;},{label,value});assert.equal(await control(page,label).inputValue(),value);}
test('DISPOSABLE: Profit handoff restores distinct exact scopes after async availability; explicit clearing stays cleared',async()=>fixture({},async page=>{
 await page.goto(origin+'/profit-engine?'+handoff());
 await expectValue(page,'Reporting month','2025-03-01');await expectValue(page,'Evidence version','version-2');
 await page.locator('.np-comparison-controls summary').click();
 await expectValue(page,'Comparison month','2025-02-01');await expectValue(page,'Comparison evidence version','version-1');
 await page.locator('.np-period-caption').filter({hasText:'2025-03-01 – 2025-03-31'}).waitFor();
 await control(page,'Reporting month').selectOption('');
 await expectValue(page,'Reporting month','');await expectValue(page,'Evidence version','');
 await page.getByRole('button',{name:'Per order',exact:true}).click();
 await expectValue(page,'Reporting month','');await page.getByText('No supported month selected.',{exact:false}).waitFor();
}));
test('DISPOSABLE: foreign company and absent exact handoff version never select substitute evidence',async()=>fixture({},async page=>{
 for(const change of [p=>p.set('reviewStore',otherStore),p=>p.set('reviewVersion','unadvertised-version')]){
  const params=handoff();change(params);await page.goto(origin+'/profit-engine?'+params);
  await control(page,'Reporting month').locator('option[value="2025-03-01"]').waitFor({state:'attached'});
  await expectValue(page,'Reporting month','');await expectValue(page,'Evidence version','');
  await page.getByText('No supported month selected.',{exact:false}).waitFor();
 }
}));
test('DISPOSABLE: company switch and return cannot replay original URL handoff',async()=>fixture({secondStore:true},async page=>{
 await page.goto(origin+'/profit-engine?'+handoff());await expectValue(page,'Reporting month','2025-03-01');await expectValue(page,'Evidence version','version-2');
 await page.getByRole('combobox',{name:'Active store'}).selectOption(otherStore);
 await expectValue(page,'Reporting month','');await page.getByText('No supported month selected.',{exact:false}).waitFor();
 await page.getByRole('combobox',{name:'Active store'}).selectOption(store);
 await control(page,'Reporting month').locator('option[value="2025-03-01"]').waitFor({state:'attached'});
 await expectValue(page,'Reporting month','');await expectValue(page,'Evidence version','');
}));

test('DISPOSABLE: duplicate or incomplete-calendar URL contexts show warnings and select no substitute',async()=>fixture({},async page=>{
 for(const change of [p=>p.append('reviewFrom','2025-03-01'),p=>p.set('reviewFrom','2025-03-02'),p=>p.set('reviewTo','2025-03-30'),p=>p.append('compareVersion','version-1')]){
  const p=handoff();change(p);await page.goto(origin+'/profit-engine?'+p);
  await control(page,'Reporting month').locator('option[value="2025-03-01"]').waitFor({state:'attached'});
  await expectValue(page,'Reporting month','');await expectValue(page,'Evidence version','');
  await page.getByRole('alert').filter({hasText:'linked reporting context is unavailable'}).waitFor();
 }
}));
test('DISPOSABLE: unavailable comparison never prevents valid current context or picks another earlier version',async()=>fixture({},async page=>{
 const p=handoff();p.set('compareVersion','missing-version');await page.goto(origin+'/profit-engine?'+p);
 await expectValue(page,'Reporting month','2025-03-01');await expectValue(page,'Evidence version','version-2');await page.locator('.np-comparison-controls summary').click();
 await expectValue(page,'Comparison month','');await expectValue(page,'Comparison evidence version','');await page.getByRole('alert').filter({hasText:'linked earlier-month comparison is unavailable'}).waitFor();
}));
test('DISPOSABLE: Marketing receives current link context only; comparison remains explicit page choice',async()=>fixture({},async page=>{
 await page.goto(origin+'/new-marketing?tab=retention&'+handoff());
 await page.waitForFunction(()=>document.querySelector('[aria-label="Growth reviewed month"]')?.value==='2025-03-01');assert.equal(await page.getByLabel('Growth reviewed month',{exact:true}).inputValue(),'2025-03-01');
 assert.equal(await page.getByLabel('Growth evidence version',{exact:true}).inputValue(),'version-2');assert.equal(await page.getByLabel('Growth comparison month',{exact:true}).inputValue(),'');assert.equal(await page.getByLabel('Growth comparison evidence version',{exact:true}).inputValue(),'');
 await page.getByText('No connected comparison selected',{exact:false}).first().waitFor();
}));
test('DISPOSABLE: Plan and explicit fictional Profit mode cannot inherit a verified URL baseline',async()=>fixture({},async page=>{
 await page.goto(origin+'/plan?'+handoff());await page.getByLabel('Plan reviewed month',{exact:true}).locator('option[value="2025-03-01"]').waitFor({state:'attached'});assert.equal(await page.getByLabel('Plan reviewed month',{exact:true}).inputValue(),'');
 await page.getByRole('heading',{name:'Choose the historical baseline ending month.'}).waitFor();
 await page.goto(origin+'/profit-engine?'+handoff());await expectValue(page,'Reporting month','2025-03-01');
 const sample=page.getByRole('button',{name:/sample/i}).first();await sample.click();await page.locator('.np-sample-unlinked').waitFor();
 assert.equal(await control(page,'Reporting month').count(),0,'Explicit sample mode has no reviewed reporting selector');await page.getByText('Sample nonnegative flows only.',{exact:false}).first().waitFor();
}));


test('DISPOSABLE: desktop Profit keeps exact evidence and Explore the Numbers visible',async()=>fixture({viewport:{width:1440,height:1000}},async page=>{
 await page.goto(origin+'/profit-engine?'+handoff());await expectValue(page,'Reporting month','2025-03-01');await expectValue(page,'Evidence version','version-2');
 await page.getByRole('link',{name:'Explore the Numbers ↓',exact:true}).click();
 assert.equal(new URL(page.url()).hash,'#np-linked-evidence');
 await page.locator('#np-linked-evidence').waitFor();
 assert.ok(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1),'Desktop has no page overflow');
 if(process.env.NIGHT_SCOUT_SCREENSHOT_DIR)await page.screenshot({path:process.env.NIGHT_SCOUT_SCREENSHOT_DIR+'/desktop-profit-evidence.png',fullPage:true});
}));
test('DISPOSABLE: supported Profit alias retains exact context and fragment while inert markers are filtered',async()=>fixture({},async page=>{
 const p=handoff();p.set('acceptance','release');
 await page.goto(origin+'/new-profit?'+p+'#np-linked-evidence');await expectValue(page,'Reporting month','2025-03-01');await expectValue(page,'Evidence version','version-2');
 const url=new URL(page.url());assert.equal(url.pathname,'/profit-engine');assert.equal(url.hash,'#np-linked-evidence');assert.equal(url.searchParams.has('acceptance'),false);
 for(const [key,value] of handoff())assert.equal(url.searchParams.get(key),value);
 await page.locator('.np-comparison-controls summary').click();await expectValue(page,'Comparison month','2025-02-01');await expectValue(page,'Comparison evidence version','version-1');
}));
test('DISPOSABLE: legacy Plan aliases keep fixed destination precedence',async()=>fixture({},async page=>{
 for(const [alias,tab,legacy] of [['/opportunities','opportunities',null],['/scenario-lab','planner','1']]){
  const p=handoff();p.set('tab','wrong');p.set('legacy','0');p.set('acceptance','release');await page.goto(origin+alias+'?'+p+'#plan-evidence');
  await page.waitForURL(url=>url.pathname==='/plan');const url=new URL(page.url());assert.equal(url.searchParams.get('tab'),tab);assert.equal(url.searchParams.get('legacy'),legacy);assert.equal(url.searchParams.has('acceptance'),false);assert.equal(url.hash,'#plan-evidence');
  for(const [key,value] of handoff())assert.equal(url.searchParams.get(key),value);
 }
}));
test('DISPOSABLE: authenticated non-member sees no protected reporting or substitute values',async()=>{
 const requests=[];await fixture({nonMember:true,requests},async page=>{
  for(const path of ['/dashboard','/profit-engine?'+handoff(),'/plan','/new-cash-control']){
   await page.goto(origin+path);await page.getByRole('heading',{name:'Your account is not linked to a store yet'}).waitFor();assert.equal(await page.getByRole('combobox',{name:'Active store'}).count(),0);
  }
  assert.deepEqual(requests,[],'No reporting requests before member access');
 });
});
test('DISPOSABLE INVESTIGATION: two-tab exact URL context and shared store preference after revalidation',async()=>fixture({secondStore:true},async(page,context)=>{
 await page.goto(origin+'/profit-engine?'+handoff());await expectValue(page,'Reporting month','2025-03-01');await expectValue(page,'Evidence version','version-2');await page.locator('.np-comparison-controls summary').click();await expectValue(page,'Comparison month','2025-02-01');
 const second=await context.newPage();await second.goto(origin+'/profit-engine');await second.getByRole('combobox',{name:'Active store'}).waitFor();
 await expectValue(second,'Reporting month','');await expectValue(page,'Reporting month','2025-03-01');
 console.log('CROSS_TAB after second tab opens',JSON.stringify(await page.locator('.np-comparison-controls').evaluate(el=>({open:el.open,values:[...el.querySelectorAll('select')].map(s=>s.value)}))));
 await page.locator('.np-comparison-controls').evaluate(el=>{el.open=true});await expectValue(page,'Comparison month','2025-02-01');
 await second.getByRole('combobox',{name:'Active store'}).selectOption(otherStore);await expectValue(second,'Reporting month','');
 assert.equal(await page.getByRole('combobox',{name:'Active store'}).inputValue(),store);await page.locator('.np-comparison-controls').evaluate(el=>{el.open=true});await expectValue(page,'Comparison month','2025-02-01');
 // Explicit page reload revalidates membership and the shared store preference.
 // This is a controlled observation, not a promise of cross-tab persistence.
 await page.reload();await page.getByRole('combobox',{name:'Active store'}).waitFor();assert.equal(await page.getByRole('combobox',{name:'Active store'}).inputValue(),otherStore);await expectValue(page,'Reporting month','');
 await page.getByText('No supported month selected.',{exact:false}).waitFor();await second.close();
}));

// Investigation only: log local page-state behavior rather than define a new
// persistence contract. Signed-in hosted cause remains unconfirmed.
test('DISPOSABLE INVESTIGATION: manually selected comparison is inspected across a second tab',async()=>fixture({},async(page,context)=>{
 await page.goto(origin+'/profit-engine');await control(page,'Reporting month').locator('option[value="2025-03-01"]').waitFor({state:'attached'});
 await control(page,'Reporting month').selectOption('2025-03-01');await control(page,'Evidence version').selectOption('version-2');await page.locator('.np-comparison-controls summary').click();await control(page,'Comparison month').selectOption('2025-02-01');await control(page,'Comparison evidence version').selectOption('version-1');
 const snapshot=()=>page.locator('body').evaluate(()=>({store:document.querySelector('[aria-label="Active store"]')?.value,selectors:[...document.querySelectorAll('.np-controls select')].map(s=>s.value),comparisonOpen:document.querySelector('.np-comparison-controls')?.open}));
 const before=await snapshot();const second=await context.newPage();await second.goto(origin+'/profit-engine');await second.getByRole('combobox',{name:'Active store'}).waitFor();await page.getByRole('combobox',{name:'Active store'}).waitFor();
 const after=await snapshot();console.log('CROSS_TAB manual-selection investigation',JSON.stringify({before,after}));
 assert.equal(after.store,store,'Opening same-session tab must not introduce foreign company evidence');
 await page.locator('.np-comparison-controls').evaluate(el=>{el.open=true});
 const current=await control(page,'Reporting month').inputValue(),comparison=await control(page,'Comparison month').inputValue();
 assert.ok(['','2025-03-01'].includes(current),'No substitute current month');assert.ok(['','2025-02-01'].includes(comparison),'No substitute comparison month');await second.close();
}));
