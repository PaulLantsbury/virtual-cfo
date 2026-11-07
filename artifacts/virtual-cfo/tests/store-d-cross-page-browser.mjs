// Disposable Store D SQL -> real sales RPC/profit service -> real page presenters.
// Browser transport/auth are simulated; no live service, customer data or writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {setup as financeSetup,sql,U} from '../../../experiments/shopify/finance-fixture.mjs';
import {setupProfitStagingFixture,PROFIT_STAGING_IDS as ids} from '../../../experiments/financial-v1/profit-staging-fixture.mjs';
import {createProfitSalesReader} from '../../../experiments/financial-v1/profit-sales-reader.mjs';
import {createProfitReportingService} from '../../../experiments/financial-v1/profit-reporting-service.mjs';
const {chromium}=await import(process.env.NIGHT_SCOUT_PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.NIGHT_SCOUT_TEST_URL||'http://127.0.0.1:5189';
assert.equal(new URL(origin).hostname,'127.0.0.1');
const user={id:U,email:'store-d@example.invalid',aud:'authenticated',role:'authenticated',is_anonymous:false,app_metadata:{provider:'email'},user_metadata:{},identities:[],created_at:'2026-09-08T00:00:00Z'};
const token=[{alg:'HS256',typ:'JWT'},{sub:U,role:'authenticated',exp:2000000000},'synthetic-signature'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
const session={access_token:token,refresh_token:'synthetic-refresh',expires_in:3600,expires_at:2000000000,token_type:'bearer',user};
const months=[
 {from:'2026-02-01',to:'2026-02-28',net:'£140.00',aov:'£70.00',gross:'£80.00',contribution:'£60.00',operating:'£35.00',ebitda:'£40.00'},
 {from:'2026-03-01',to:'2026-03-31',net:'-£70.00',aov:'Unavailable',gross:'-£70.00',contribution:'-£75.00',operating:'-£75.00',ebitda:'-£75.00'},
 {from:'2026-04-01',to:'2026-04-30',net:'£0.00',aov:'Unavailable',gross:'£40.00',contribution:'£40.00',operating:'£40.00',ebitda:'£40.00'},
];
// Values above are the existing approved Store D fixture acceptance results in
// profit-staging-integration.test.mjs, not independent made-up browser responses.
async function fixture(viewport,run){
 const {db}=await financeSetup(undefined,{installIntake:false});let browser;
 try{
 await db.exec(sql('proposals/20260913_profit_evidence.sql'));
 await setupProfitStagingFixture(db,{userId:U,readSales:createProfitSalesReader({userId:U})});
 const service=createProfitReportingService(db,{auth:{getUser:async supplied=>({data:{user:supplied===token?user:null}})}});
 browser=await chromium.launch({headless:true,executablePath:process.env.NIGHT_SCOUT_CHROME_PATH});
 const context=await browser.newContext({viewport:viewport==='mobile'?{width:390,height:844}:{width:1440,height:1000},serviceWorkers:'block'});
 await context.addInitScript(({origin,id})=>{if(location.origin===origin){sessionStorage.setItem('userPlan','pro');const key=`night-scout:sales-reporting:${id}`;if(!sessionStorage.getItem(key))sessionStorage.setItem(key,JSON.stringify({mode:'custom',from:'2026-02-01',to:'2026-02-28'}));}},{origin,id:ids.store});
 const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[],unexpected=[],reads=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());
 const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 try{
 if(url.origin===origin){
 if(url.pathname==='/api/profit-reporting'&&request.method()==='GET'){
 const scope=Object.fromEntries(url.searchParams);assert.equal(scope.storeId,ids.store);reads.push({kind:'profit',...scope});return json(await service.read(scope,request.headers().authorization));}
 if(url.pathname.startsWith('/api/')){unexpected.push(url.pathname);return json({},503);}return route.continue();}
 if(url.hostname!=='night-scout-test.invalid')return route.abort();
 if(url.pathname==='/auth/v1/token')return json(session);
 if(url.pathname==='/auth/v1/user')return json(user);
 if(url.pathname==='/rest/v1/store_memberships'&&request.method()==='GET')return json([{store_id:ids.store,stores:{id:ids.store,name:'Synthetic Store D'}}]);
 if(url.pathname==='/rest/v1/stores'&&request.method()==='GET'){assert.equal(url.searchParams.get('id'),`eq.${ids.store}`);return json({id:ids.store,currency_code:'GBP',timezone:'Europe/London'});}
 if(url.pathname==='/rest/v1/rpc/verified_sales_source'&&request.method()==='POST'){
 const p=request.postDataJSON();assert.equal(p.p_store_id,ids.store);reads.push({kind:'sales',storeId:p.p_store_id,from:p.p_date_from,to:p.p_date_to});
 const data=await db.transaction(async tx=>{await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[U]);await tx.exec('SET LOCAL ROLE authenticated');return (await tx.query('SELECT public.verified_sales_source($1,$2,$3) data',[p.p_store_id,p.p_date_from,p.p_date_to])).rows[0].data;});return json(data);}
 unexpected.push(`${request.method()} ${url.pathname}`);return json({},503);
 }catch(e){errors.push(e.message);return json({error:'Synthetic reporting read failed'},503);}
 });
 await page.goto(origin+'/login');await page.getByLabel('Email address').fill(user.email);await page.getByLabel('Password',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('combobox',{name:'Active store'}).waitFor();
 await run(page,{db,reads});assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 }finally{await browser?.close();await db.close();}
}
async function amount(page,region,label,value){await page.getByRole('region',{name:region,exact:true}).getByRole('group',{name:label,exact:true}).getByText(value==='Unavailable'?/^Unavailable(?: —.*)?$/:value,{exact:true}).waitFor();}
async function checkPages(page,month){
 for(const path of ['/dashboard','/verified-sales','/margin-analysis','/profit-engine']){
 await page.goto(origin+path);await page.getByRole('combobox',{name:'Reporting period',exact:true}).waitFor();
 assert.equal(await page.getByLabel('From',{exact:true}).inputValue(),month.from);assert.equal(await page.getByLabel('To',{exact:true}).inputValue(),month.to);
 assert.equal(await page.getByRole('combobox',{name:'Active store'}).inputValue(),ids.store);
 if(path==='/profit-engine')await amount(page,'Verified profit overview','Sales',month.net);
 else {await amount(page,'Verified sales figures','Net product sales',month.net);await amount(page,'Verified sales figures','Original average order value',month.aov);}
 if(path!=='/verified-sales'){
 const region=path==='/profit-engine'?'Verified profit overview':'Verified profit summary';
 for(const [label,value]of [['Gross profit',month.gross],['Contribution',month.contribution],['Operating profit',month.operating],['EBITDA',month.ebitda]])await amount(page,region,label,value);
 if(month.from==='2026-03-01'&&path!=='/profit-engine')assert.match(await page.getByRole('region',{name:region,exact:true}).innerText(),/Contribution margin: Unavailable.*Operating margin: Unavailable/);
 }
 if(month.from==='2026-03-01'&&['/verified-sales','/margin-analysis'].includes(path))assert.match(await page.getByRole('region',{name:'Verified sales figures',exact:true}).innerText(),/refunds from earlier sales, with no new qualifying orders/);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow');
 }
}
for(const viewport of ['desktop','mobile'])test(`${viewport}: Store D SQL-backed sales and profit agree across four pages, refund month and later restock`,async()=>fixture(viewport,async(page,{reads})=>{
 for(const month of months){await page.getByRole('combobox',{name:'Reporting period',exact:true}).selectOption('custom');await page.getByLabel('From',{exact:true}).fill(month.from);await page.getByLabel('To',{exact:true}).fill(month.to);await checkPages(page,month);}
 for(const month of months)for(const kind of ['sales','profit'])assert.ok(reads.some(r=>r.kind===kind&&r.storeId===ids.store&&r.from===month.from&&r.to===month.to));
}));
test('Store D changed overhead source preserves sales and supported profit across pages without invented zero',async()=>fixture('desktop',async(page,{db})=>{
 await db.query('UPDATE public.overhead_entries SET amount=amount+1 WHERE id=$1',[ids.expenses[1]]);
 await checkPages(page,{...months[0],operating:'Unavailable',ebitda:'Unavailable'});
}));
