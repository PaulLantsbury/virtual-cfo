// Disposable historical import/review/profit SQL -> real RPC/service -> page presenters.
// Browser transport/auth are simulated; no live service, customer data or writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {U} from '../../../experiments/shopify/finance-fixture.mjs';
import {historicalProfitFixture,HISTORICAL_PROFIT_IDS as ids} from '../../../experiments/financial-v1/historical-profit-fixture.mjs';
import {createProfitReportingService} from '../../../experiments/financial-v1/profit-reporting-service.mjs';
const {chromium}=await import(process.env.NIGHT_SCOUT_PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.NIGHT_SCOUT_TEST_URL||'http://127.0.0.1:5189';
assert.equal(new URL(origin).hostname,'127.0.0.1');
const user={id:U,email:'historical@example.invalid',aud:'authenticated',role:'authenticated',is_anonymous:false,app_metadata:{provider:'email'},user_metadata:{},identities:[],created_at:'2026-09-08T00:00:00Z'};
const token=[{alg:'HS256',typ:'JWT'},{sub:U,role:'authenticated',exp:2000000000},'synthetic-signature'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
const session={access_token:token,refresh_token:'synthetic-refresh',expires_in:3600,expires_at:2000000000,token_type:'bearer',user};
const months=[
 {from:'2025-08-01',to:'2025-08-31',net:'£480.00',aov:'£80.00',gross:'£300.00',contribution:'£248.00',operating:'£218.00',ebitda:'£224.00',refund:'-£0.00',recovery:'£0.00'},
 {from:'2026-02-01',to:'2026-02-28',net:'£460.00',aov:'£80.00',gross:'£280.00',contribution:'£227.00',operating:'£197.00',ebitda:'£203.00',refund:'-£20.00',recovery:'£0.00'},
 {from:'2026-04-01',to:'2026-04-30',net:'£720.00',aov:'£80.00',gross:'£465.00',contribution:'£387.00',operating:'£357.00',ebitda:'£363.00',refund:'-£0.00',recovery:'£15.00'},
 {from:'2026-08-01',to:'2026-08-31',net:'£960.00',aov:'£80.00',gross:'£600.00',contribution:'£496.00',operating:'£466.00',ebitda:'£472.00',refund:'-£0.00',recovery:'£0.00'},
 {from:'2026-09-01',to:'2026-09-17',net:'£480.00',aov:'£80.00',gross:'Unavailable',contribution:'Unavailable',operating:'Unavailable',ebitda:'Unavailable',partial:true,refund:'-£0.00',recovery:'Unavailable'},
];
// Independent hand-worked expectations, shared with neither fixture nor calculator.
// Existing deduction formatting displays negative zero for no refunds.
// Custom periods do not render automatic YoY comparisons: the two August checks
// verify the source figures only, not a nonexistent trend feature.
async function fixture(viewport,run){
 const history=await historicalProfitFixture(),{db}=history;let browser;
 assert.equal(history.userId,U);
 try{
 const service=createProfitReportingService(db,{auth:{getUser:async supplied=>({data:{user:supplied===token?user:null}})}});
 browser=await chromium.launch({headless:true,executablePath:process.env.NIGHT_SCOUT_CHROME_PATH});
 const context=await browser.newContext({viewport:viewport==='mobile'?{width:390,height:844}:{width:1440,height:1000},serviceWorkers:'block'});
 await context.addInitScript(({origin,id})=>{if(location.origin===origin){sessionStorage.setItem('userPlan','pro');const key=`night-scout:sales-reporting:${id}`;if(!sessionStorage.getItem(key))sessionStorage.setItem(key,JSON.stringify({mode:'custom',from:'2025-08-01',to:'2025-08-31'}));}},{origin,id:ids.store});
 const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[],unexpected=[],reads=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());
 const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 try{
 if(url.origin===origin){
 if(url.pathname==='/api/profit-reporting'&&request.method()==='GET'){
 const scope=Object.fromEntries(url.searchParams);assert.equal(scope.storeId,ids.store);assert.equal(scope.currency,'GBP');assert.ok(months.some(m=>!m.partial&&m.from===scope.from&&m.to===scope.to),'Exact complete profit scope');reads.push({kind:'profit',...scope});return json(await service.read(scope,request.headers().authorization));}
 if(url.pathname.startsWith('/api/')){unexpected.push(url.pathname);return json({},503);}return route.continue();}
 // Known static font request stays offline; unexpected service traffic fails.
 if(url.hostname==='fonts.googleapis.com'&&request.method()==='GET')return route.fulfill({status:200,contentType:'text/css',body:''});
 if(url.hostname!=='night-scout-test.invalid'){unexpected.push(`external ${url.hostname}`);return route.abort();}
 if(url.pathname==='/auth/v1/token'&&request.method()==='POST')return json(session);
 if(url.pathname==='/auth/v1/user'&&request.method()==='GET')return json(user);
 if(url.pathname==='/rest/v1/store_memberships'&&request.method()==='GET')return json([{store_id:ids.store,stores:{id:ids.store,name:'Synthetic Historical Store'}}]);
 if(url.pathname==='/rest/v1/stores'&&request.method()==='GET'){assert.equal(url.searchParams.get('id'),`eq.${ids.store}`);return json({id:ids.store,currency_code:'GBP',timezone:'Europe/London'});}
 if(url.pathname==='/rest/v1/rpc/verified_sales_source'&&request.method()==='POST'){
 const p=request.postDataJSON();assert.equal(p.p_store_id,ids.store);assert.ok(months.some(m=>m.from===p.p_date_from&&m.to===p.p_date_to),'Exact sales scope');reads.push({kind:'sales',storeId:p.p_store_id,from:p.p_date_from,to:p.p_date_to});
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
 await page.evaluate(({store,month})=>sessionStorage.setItem(`night-scout:sales-reporting:${store}`,JSON.stringify({mode:'custom',from:month.from,to:month.to})),{store:ids.store,month});
 for(const path of ['/dashboard','/verified-sales','/margin-analysis','/profit-engine']){
 await page.goto(origin+path);await page.getByRole('combobox',{name:'Reporting period',exact:true}).waitFor();
 assert.equal(await page.getByLabel('From',{exact:true}).inputValue(),month.from);assert.equal(await page.getByLabel('To',{exact:true}).inputValue(),month.to);
 assert.equal(await page.getByRole('combobox',{name:'Active store'}).inputValue(),ids.store);
 if(path==='/profit-engine')await amount(page,'Verified profit overview','Sales',month.net);
 else {await amount(page,'Verified sales figures','Net product sales',month.net);await amount(page,'Verified sales figures','Original average order value',month.aov);}
 if(path!=='/verified-sales'){
 const region=path==='/profit-engine'?'Verified profit overview':'Verified profit summary';
 for(const [label,value]of [['Gross profit',month.gross],['Contribution',month.contribution],['Operating profit',month.operating],['EBITDA',month.ebitda]])await amount(page,region,label,value);
 if(month.partial)assert.match(await page.getByRole('region',{name:path==='/profit-engine'?'Profit reporting status':region,exact:true}).innerText(),/requires one complete calendar month/);
 }
 if(path==='/profit-engine'){
 const table=page.getByRole('table',{name:'Verified profit bridge'});
 for(const [label,value]of [['Product refunds',month.refund],['Saleable stock cost recovery',month.recovery]])await table.getByRole('row').filter({has:page.getByRole('rowheader',{name:new RegExp(`^${label}`)})}).getByRole('cell',{name:value,exact:true}).waitFor();
 }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow');
 }
}
for(const viewport of ['desktop','mobile'])test(`${viewport}: historical imported SQL reporting agrees across four pages and partial profit stays withheld`,async()=>fixture(viewport,async(page,{reads})=>{
 for(const month of months)await checkPages(page,month);
 for(const month of months)for(const kind of month.partial?['sales']:['sales','profit'])assert.ok(reads.some(r=>r.kind===kind&&r.storeId===ids.store&&r.from===month.from&&r.to===month.to));
 assert.ok(!reads.some(r=>r.kind==='profit'&&r.from==='2026-09-01'),'Partial profit must not request a complete-month API');
}));
