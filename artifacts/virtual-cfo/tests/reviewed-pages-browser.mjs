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
const user={id:'60000000-0000-4000-8000-000000000001',email:'fixture@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},identities:[],created_at:'2026-09-08T00:00:00Z'};
const token=[{alg:'HS256',typ:'JWT'},{sub:user.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},'fictional-signature'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
const session={access_token:token,refresh_token:'fictional-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
const listing={contract:'history-availability-v2',verification:'sealed-candidates-only',requiresReadValidation:true,storeId:store,currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor:'2024-11-01',months:months.map(({month:m})=>({from:m.selection.period.from,to:m.selection.period.to,snapshotId:m.selection.versionId,versionId:m.selection.versionId,versions:[{versionId:m.selection.versionId,status:'selected',kind:'base'}]}))};
async function fixture(options,run){
 const browser=await chromium.launch({headless:true,executablePath:process.env.NIGHT_SCOUT_CHROME_PATH});
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
 page.setDefaultTimeout(8000);
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(url.origin===origin&&url.pathname.startsWith('/api/')){
   assert.equal(request.method(),'GET','Fixture backend accepts reads only');
   if(url.pathname==='/api/history-reporting/months')return json(listing);
   const item=months.find(m=>m.month.selection.period.from===url.searchParams.get('from'));
   if(!item||url.searchParams.get('storeId')!==store||url.searchParams.get('versionId')!==item.month.selection.versionId)return json({state:'unavailable'},409);
   if(url.pathname==='/api/history-reporting')return json(item.response);
   if(url.pathname==='/api/supplemental-reporting'){
    if(options.missingSupplement===item.month.selection.period.from)return json({state:'unavailable'},503);
    const payload=structuredClone(item.acquisition);if(options.legacy)delete payload.customerActivity;
    return json({contract:'reviewed-supplement-v1',state:'supported',kind:'acquisition',sourceBasis:'synthetic-local',snapshotId:'90000000-0000-4000-8000-000000000001',financialVersionId:item.month.selection.versionId,salesRevision:item.response.salesRevision,costRevision:item.response.costRevision,scope:payload.scope,observedAt:'2026-11-20T12:00:00Z',payload});
   }
   return json({error:'Unexpected fixture API'},404);
  }
  if(url.origin===origin){if(!['GET','HEAD'].includes(request.method()))return route.abort();return route.continue();}
  if(url.hostname!=='night-scout-test.invalid')return route.abort();
  if(url.pathname==='/auth/v1/token')return json(session);
  if(url.pathname==='/auth/v1/user')return json(user);
  if(url.pathname==='/rest/v1/store_memberships')return json([{store_id:store,stores:{id:store,name:'DISPOSABLE BROWSER FIXTURE — NOT LIVE'}}]);
  return route.abort();
 });
 try{
  await page.addInitScript(()=>sessionStorage.setItem('userPlan','pro'));
  await page.goto(origin+'/login');await page.getByLabel('Email address').fill(user.email);await page.getByLabel('Password',{exact:true}).fill('fictional-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('combobox',{name:'Active store'}).waitFor();
  await run(page);assert.deepEqual(errors,[]);
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
test('DISPOSABLE: Plan needs all three supplements; never substitutes sample baseline',async()=>fixture({missingSupplement:'2025-02-01'},async page=>{
 await page.goto(origin+'/plan');await page.getByLabel('Plan reviewed month',{exact:true}).selectOption('2025-03-01');await page.getByLabel('Plan evidence version',{exact:true}).selectOption('version-2');
 await page.getByRole('heading',{name:'Plan baseline unavailable'}).waitFor();assert.equal(await page.getByLabel('Bring existing customers back',{exact:false}).count(),0);
}));
test('DISPOSABLE: Plan preserves paid-first population and blocks unsupported repeat lever',async()=>fixture({},async page=>{
 await page.goto(origin+'/plan');await page.getByLabel('Plan reviewed month',{exact:true}).selectOption('2025-03-01');await page.getByLabel('Plan evidence version',{exact:true}).selectOption('version-2');
 const repeat=page.getByRole('checkbox',{name:'Bring existing customers back'});await repeat.waitFor();assert.equal(await repeat.isDisabled(),true);
 await page.getByText('Other orders include organic first, guest and unknown orders',{exact:false}).waitFor();
 assert.equal(await page.getByText('2.00% becomes',{exact:false}).count(),0,'No unsourced absolute conversion baseline');
 assert.ok(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1),'390px has no page overflow');
}));
