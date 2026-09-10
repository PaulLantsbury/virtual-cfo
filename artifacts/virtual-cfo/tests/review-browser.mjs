// Run against a loopback Vite preview configured with fake Supabase URL/key.
// All non-preview requests are mocked or blocked. No real accounts are created.
import test from 'node:test';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.NIGHT_SCOUT_PLAYWRIGHT_MODULE || 'playwright');
const origin=process.env.NIGHT_SCOUT_TEST_URL || 'http://127.0.0.1:5187';
if(new URL(origin).hostname!=='127.0.0.1')throw new Error('Loopback preview required');
const a='50000000-0000-0000-0000-000000000001',b='50000000-0000-0000-0000-000000000002';
const user={id:'60000000-0000-0000-0000-000000000001',email:'test@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},identities:[],created_at:'2026-09-08T00:00:00Z'};
const token=[{alg:'HS256',typ:'JWT'},{sub:user.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},'signature'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
const session={access_token:token,refresh_token:'test-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
async function fixture(options,run){
 const browser=await chromium.launch({headless:true,executablePath:process.env.NIGHT_SCOUT_CHROME_PATH});
 const context=await browser.newContext();const page=await context.newPage();const errors=[],metrics=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===origin&&url.pathname.startsWith('/api/financial-reviews/'))return options.review(route);
  if(url.origin===origin)return route.continue();
  if(url.hostname!=='night-scout-test.invalid')return route.abort();
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(url.pathname==='/auth/v1/token')return options.badLogin?json({error_code:'invalid_credentials',msg:'Invalid credentials'},400):json(session);
  if(url.pathname==='/auth/v1/user')return json(user);
  if(url.pathname==='/auth/v1/signup')return json({user,session:null});
  if(url.pathname==='/auth/v1/logout')return options.logoutError?json({message:'offline'},500):route.fulfill({status:204});
  if(url.pathname==='/rest/v1/store_memberships')return options.membershipError?json({message:'missing table'},404):json((options.stores??[]).map(id=>({store_id:id,stores:{id,name:id===a?'Store A':'Store B'}})));
  if(url.pathname.startsWith('/rest/v1/rpc/')){metrics.push(request.postDataJSON());return json(0);}
  return json({message:'unexpected request'},400);
 });
 try{await run(page,metrics);assert.deepEqual(errors,[]);}finally{await context.close();await browser.close();}
}
const login=async page=>{await page.goto(origin+'/login');await page.getByLabel('Email address').fill('test@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();};


const openReview=async page=>{await login(page);await page.getByRole('combobox',{name:'Active store'}).waitFor();await page.goto(origin+'/financial-review');await page.getByLabel('From',{exact:true}).fill('2026-08-01');await page.getByLabel('To',{exact:true}).fill('2026-08-31');};
const response=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
const packet=scope=>({scope,status:'awaiting_independent_coverage_review',batchId:'70000000-0000-4000-8000-000000000001',snapshotDigest:'a'.repeat(64),issues:[]});
test('review form requires independent evidence and records exact reviewed period',async()=>{
 const requests=[];
 await fixture({stores:[a],review:route=>{const body=route.request().postDataJSON();requests.push(body);return response(route,route.request().url().endsWith('/prepare')?packet(body.scope):{status:'restored',scope:body.scope,auditId:'synthetic'});}},async page=>{
  await openReview(page);await page.getByRole('button',{name:'Prepare review',exact:true}).click();await page.getByRole('heading',{name:'Confirm complete history'}).waitFor();
  const restore=page.getByRole('button',{name:'Record review and restore figures'});assert.equal(await restore.isEnabled(),false);
  await page.getByLabel('Evidence reference').fill('Synthetic complete ledger');await page.getByLabel('What did you check?').fill('Original orders, later refunds and exclusions checked.');
  assert.equal(await restore.isEnabled(),false);await page.getByRole('checkbox').check();assert.equal(await restore.isEnabled(),true);
  if(process.env.NIGHT_SCOUT_REVIEW_SCREENSHOT)await page.screenshot({path:process.env.NIGHT_SCOUT_REVIEW_SCREENSHOT,fullPage:true});
  await restore.click();await page.getByRole('status').filter({hasText:'Reviewed figures have been restored'}).waitFor();assert.equal(await restore.count(),0);
  assert.equal(requests.length,2);assert.equal(requests[1].scope.storeId,a);assert.equal(requests[1].scope.from,'2026-08-01');assert.equal(requests[1].coverageConfirmed,true);
 });
});
test('unavailable and blocked reviews never offer restoration',async()=>{
 for(const blocked of [false,true])await fixture({stores:[a],review:route=>response(route,blocked?{...packet(route.request().postDataJSON().scope),status:'blocked',issues:[{reason:'financial_event_mismatch'}]}:{error:'not configured'},blocked?200:503)},async page=>{
  await openReview(page);await page.getByRole('button',{name:'Prepare review',exact:true}).click();await page.getByRole('status').filter({hasText:blocked?'does not yet reconcile':'service is unavailable'}).waitFor();assert.equal(await page.getByRole('button',{name:'Record review and restore figures'}).count(),0);
 });
});
test('changing dates clears approval and stale restoration response requires new review',async()=>{
 await fixture({stores:[a],review:route=>response(route,route.request().url().endsWith('/prepare')?packet(route.request().postDataJSON().scope):{error:'stale'},route.request().url().endsWith('/prepare')?200:409)},async page=>{
  await openReview(page);await page.getByRole('button',{name:'Prepare review',exact:true}).click();await page.getByRole('heading',{name:'Confirm complete history'}).waitFor();
  await page.getByLabel('From',{exact:true}).fill('2026-08-02');assert.equal(await page.getByRole('checkbox').count(),0);
  await page.getByRole('button',{name:'Prepare review',exact:true}).click();await page.getByRole('heading',{name:'Confirm complete history'}).waitFor();
  await page.getByLabel('Evidence reference').fill('Synthetic');await page.getByLabel('What did you check?').fill('All history');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Record review and restore figures'}).click();
  await page.getByRole('status').filter({hasText:'evidence has changed'}).waitFor();assert.equal(await page.getByRole('checkbox').count(),0);
 });
});
test('missing API returning HTML shows a safe unavailable state',async()=>{
 await fixture({stores:[a],review:route=>route.fulfill({status:200,contentType:'text/html',body:'<html>frontend fallback</html>'})},async page=>{
  await openReview(page);await page.getByRole('button',{name:'Prepare review',exact:true}).click();
  await page.getByRole('status').filter({hasText:'review service is unavailable'}).waitFor();assert.equal(await page.getByRole('checkbox').count(),0);
 });
});
test('transaction evidence shows original sale and later refunds without enabling approval',async()=>{
 const rows=[['sale','2026-02-15',9000,1800,10800],['refund','2026-03-05',-2000,-400,-2400],['refund','2026-04-06',-2000,-400,-2400]].map(([type,date,productExVat,vat,cash],i)=>({id:String(i),orderId:'gid://shopify/Order/1',type,date,currency:'GBP',productExVat,shippingExVat:0,vat,cash}));
 await fixture({stores:[a],review:route=>response(route,{...packet(route.request().postDataJSON().scope),transactionEvidence:{rows,totalEvents:3,timezone:'Europe/London'}})},async page=>{
 await openReview(page);await page.getByLabel('From',{exact:true}).fill('2026-02-01');await page.getByLabel('To',{exact:true}).fill('2026-02-28');await page.getByRole('button',{name:'Prepare review',exact:true}).click();
 await page.getByRole('heading',{name:'Imported transactions — awaiting review'}).waitFor();const table=page.getByRole('table',{name:'Imported sales and refunds'});
 assert.equal(await table.getByRole('row').count(),4);assert.equal(await table.getByText('Outside selected period').count(),2);
 assert.ok((await table.innerText()).includes('£90.00'));assert.equal(await table.getByText('-£20.00',{exact:true}).count(),2);assert.equal(await table.getByText('-£4.00',{exact:true}).count(),2);
 assert.equal(await page.getByRole('button',{name:'Record review and restore figures'}).isEnabled(),false);
 await page.getByLabel('From',{exact:true}).fill('2026-03-01');assert.equal(await table.count(),0);
 });
});
