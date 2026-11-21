// DISPOSABLE UI FIXTURES ONLY. Fresh isolated headless browser, loopback preview,
// fake Auth/API, no real grants/provider calls/token extraction or live session.
// Cases select only the local compiled UI release export in-browser when needed.
// Repository release switches are never edited by this fixture. Enabled cases use
// actual source unchanged when it is enabled; the off case is explicitly synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.NIGHT_SCOUT_PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.NIGHT_SCOUT_TEST_URL||'http://127.0.0.1:5207';
if(new URL(origin).hostname!=='127.0.0.1'||new URL(origin).protocol!=='http:')throw Error('Loopback fixture preview required');
const a='51000000-0000-4000-8000-000000000001',b='51000000-0000-4000-8000-000000000002',user={id:'61000000-0000-4000-8000-000000000001',email:'fixture@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},identities:[],created_at:'2026-09-01T00:00:00Z'};
const fakeTime=Date.parse('2026-11-21T17:00:00Z');
const token=[{alg:'HS256',typ:'JWT'},{sub:user.id,role:'authenticated',exp:fakeTime/1000+7200},'fictional-signature'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
const session={access_token:token,refresh_token:'fictional-refresh',expires_in:7200,expires_at:fakeTime/1000+7200,token_type:'bearer',user};
const observed={contract:'customer-runtime-attestation-v1',state:'observed',revision:'a'.repeat(40),loginMatches:true,serviceMatches:true,databaseMatches:true,loginRestricted:true,serviceRestricted:true,transactionReadOnly:true,transactionRepeatableRead:true,targetProjectAttested:false};
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:()=>resolve()};};
const reply=(route,value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)}).catch(()=>{});
async function fixture(options,run){
 const browser=await chromium.launch({headless:true,executablePath:process.env.NIGHT_SCOUT_CHROME_PATH}),context=await browser.newContext({viewport:{width:1100,height:900}}),page=await context.newPage();page.setDefaultTimeout(8000);await page.clock.install({time:new Date(fakeTime)});
 const requests=[],errors=[];let overrideCount=0;page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin===origin&&url.pathname.endsWith('/src/lib/runtimeDiagnosticRelease.ts')){const response=await route.fetch(),source=await response.text(),match=source.match(/RUNTIME_DIAGNOSTIC_UI_ENABLED\s*=\s*(true|false)/);assert.ok(match,'Exact UI release export is present');const desired=options.enabled?'true':'false';const changed=source.replace(/RUNTIME_DIAGNOSTIC_UI_ENABLED\s*=\s*(true|false)/,'RUNTIME_DIAGNOSTIC_UI_ENABLED = '+desired);if(match[1]!==desired)overrideCount++;return route.fulfill({response,body:changed});}
  if(url.origin===origin&&url.pathname.startsWith('/api/financial-reviews/')){assert.equal(req.method(),'POST');const body=req.postDataJSON();requests.push({path:url.pathname,body});if(body.runtimeAttestation===true)return options.diagnostic?options.diagnostic(route,body):reply(route,observed);return reply(route,url.pathname.endsWith('/restore')?{status:'restored',scope:body.scope}:{status:'awaiting_independent_coverage_review',batchId:'71000000-0000-4000-8000-000000000001',snapshotDigest:'b'.repeat(64),scope:body.scope,issues:[]});}
  if(url.origin===origin){if(!['GET','HEAD'].includes(req.method()))return route.abort();return route.continue();}
  if(url.hostname!=='night-scout-test.invalid')return route.abort();
  if(url.pathname==='/auth/v1/token')return reply(route,session);
  if(url.pathname==='/auth/v1/user')return reply(route,user);
  if(url.pathname==='/rest/v1/store_memberships')return reply(route,[{store_id:a,stores:{id:a,name:'Fictional Store A'}},...(options.twoStores?[{store_id:b,stores:{id:b,name:'Fictional Store B'}}]:[])]);
  if(url.pathname.startsWith('/rest/v1/rpc/'))return reply(route,0);
  return route.abort();
 });
 try{
  await page.goto(origin+'/login');await page.getByLabel('Email address').fill(user.email);await page.getByLabel('Password',{exact:true}).fill('fictional-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();if(options.twoStores)await page.getByRole('button',{name:'Fictional Store A',exact:true}).click();await page.getByRole('combobox',{name:'Active store'}).waitFor();
  await page.goto(origin+'/financial-review');await page.getByLabel('From',{exact:true}).fill('2026-10-01');await page.getByLabel('To',{exact:true}).fill('2026-10-31');
  await run(page,requests);assert.deepEqual(errors,[]);
 }finally{await context.close();await browser.close();}
}
const check=page=>page.getByRole('button',{name:'Check reporting connection',exact:true});
const panel=page=>page.locator('section[aria-labelledby="runtime-diagnostic-title"]');
const settle=async page=>{await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));};
test('DISPOSABLE explicit off fixture has no diagnostic control; normal prepare and explicit restore stay separate',async()=>fixture({},async(page,requests)=>{
 assert.equal(await check(page).count(),0);await page.getByRole('button',{name:'Prepare review',exact:true}).click();await page.getByRole('heading',{name:'Confirm complete history'}).waitFor();await page.getByLabel('Evidence reference').fill('Fictional retained ledger');await page.getByLabel('What did you check?').fill('Fictional complete period');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Record review and restore figures'}).click();await page.getByRole('status').filter({hasText:'Reviewed figures have been restored'}).waitFor();assert.equal(requests.length,2);assert.ok(requests[0].path.endsWith('/prepare'));assert.ok(requests[1].path.endsWith('/restore'));assert.ok(requests.every(r=>r.body.runtimeAttestation===undefined));
}));
test('DISPOSABLE enabled fixture posts only diagnostic prepare and preserves ready financial review; labelled screenshot',async()=>fixture({enabled:true},async(page,requests)=>{
 await page.getByRole('button',{name:'Prepare review',exact:true}).click();await page.getByRole('heading',{name:'Confirm complete history'}).waitFor();await check(page).click();await panel(page).getByText('The runtime check needs attention.',{exact:false}).waitFor();assert.equal(await page.getByRole('heading',{name:'Confirm complete history'}).count(),1);assert.equal(requests.length,2);const request=requests[1];assert.ok(request.path.endsWith('/prepare'));assert.deepEqual(Object.keys(request.body).sort(),['runtimeAttestation','scope']);assert.deepEqual(request.body.scope,{storeId:a,from:'2026-10-01',to:'2026-10-31'});assert.equal(requests.filter(r=>r.path.endsWith('/restore')).length,0);assert.equal(await page.getByRole('button',{name:'Record review and restore figures'}).isEnabled(),false);
 await panel(page).evaluate(el=>{const label=document.createElement('p');label.textContent='DISPOSABLE SYNTHETIC UI FIXTURE — NOT LIVE';label.style.fontWeight='bold';el.prepend(label);});await panel(page).screenshot({path:process.env.NIGHT_SCOUT_DIAGNOSTIC_FIXTURE_SCREENSHOT||'/private/tmp/night-scout-runtime-diagnostic-fixture.png'});
}));
test('DISPOSABLE server denial is fixed and cannot show configured facts or trigger restoration',async()=>fixture({enabled:true,diagnostic:route=>reply(route,{error:'SECRET server reason'},403)},async(page,requests)=>{
 await check(page).click();await panel(page).getByText('This account is not authorised for the operator runtime check.',{exact:false}).waitFor();assert.equal(await panel(page).locator('dl').count(),0);assert.ok(!(await panel(page).innerText()).includes('SECRET'));assert.equal(requests.length,1);assert.ok(requests[0].path.endsWith('/prepare'));assert.equal(await page.getByRole('heading',{name:'Confirm complete history'}).count(),0);
}));
test('DISPOSABLE period change aborts a pending observation and late source cannot populate the new period',async()=>{
 const gate=deferred(),started=deferred();await fixture({enabled:true,diagnostic:async route=>{started.resolve();await gate.promise;await reply(route,observed);}},async(page,requests)=>{await check(page).click();await started.promise;await page.getByLabel('From',{exact:true}).fill('2026-09-01');await page.getByLabel('To',{exact:true}).fill('2026-09-30');gate.resolve();await settle(page);assert.equal(await panel(page).locator('dl').count(),0);assert.ok(!(await panel(page).innerText()).includes(observed.revision));assert.equal(requests.length,1);});
});
test('DISPOSABLE store change aborts pending observation without retry or cross-company result',async()=>{
 const gate=deferred(),started=deferred();await fixture({enabled:true,twoStores:true,diagnostic:async route=>{started.resolve();await gate.promise;await reply(route,observed);}},async(page,requests)=>{await check(page).click();await started.promise;await page.getByRole('combobox',{name:'Active store'}).selectOption(b);gate.resolve();await settle(page);assert.equal(await panel(page).locator('dl').count(),0);assert.ok(!(await panel(page).innerText()).includes(observed.revision));assert.equal(requests.length,1);assert.equal(requests[0].body.scope.storeId,a);});
});
test('DISPOSABLE cancellation and exact source expiry make no automatic retry or late success',async()=>{
 const gate=deferred(),started=deferred();await fixture({enabled:true,diagnostic:async route=>{started.resolve();await gate.promise;await reply(route,observed);}},async(page,requests)=>{await check(page).click();await started.promise;await page.getByRole('button',{name:'Cancel runtime check'}).click();gate.resolve();await panel(page).getByText('Runtime check cancelled.',{exact:false}).waitFor();assert.equal(await panel(page).locator('dl').count(),0);await page.clock.fastForward(3600000);assert.equal(await check(page).isDisabled(),true);await settle(page);assert.equal(requests.length,1);});
});
test('DISPOSABLE poisoned diagnostic envelope is unavailable and never renders nested secrets',async()=>fixture({enabled:true,diagnostic:route=>reply(route,{...observed,state:{value:'observed',secret:'SECRET nestedstate'},token:'SECRET token'})},async(page,requests)=>{await check(page).click();await panel(page).getByText('Runtime response could not be verified.',{exact:true}).waitFor();assert.equal(await panel(page).locator('dl').count(),0);assert.ok(!(await panel(page).innerText()).includes('SECRET'));assert.equal(requests.length,1);}));

test('DISPOSABLE shared busy state blocks ordinary review actions during diagnostic and explicit restore alone can restore',async()=>{
 const gate=deferred(),started=deferred();await fixture({enabled:true,diagnostic:async route=>{started.resolve();await gate.promise;await reply(route,observed);}},async(page,requests)=>{
  await page.getByRole('button',{name:'Prepare review',exact:true}).click();await page.getByRole('heading',{name:'Confirm complete history'}).waitFor();await page.getByLabel('Evidence reference').fill('Fictional source');await page.getByLabel('What did you check?').fill('Fictional complete history');await page.getByRole('checkbox').check();const restore=page.getByRole('button',{name:'Record review and restore figures'});assert.equal(await restore.isEnabled(),true);
  await check(page).click();await started.promise;assert.equal(await restore.isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Prepare review',exact:true}).isDisabled(),true);await restore.evaluate(el=>el.click());assert.equal(requests.filter(r=>r.path.endsWith('/restore')).length,0);
  gate.resolve();await panel(page).getByText('The runtime check needs attention.',{exact:false}).waitFor();assert.equal(await restore.isEnabled(),true);assert.equal(await check(page).isDisabled(),true,'A dispatched page-session attempt does not rearm');assert.equal(requests.length,2);await restore.click();await page.getByRole('status').filter({hasText:'Reviewed figures have been restored'}).waitFor();assert.equal(requests.length,3);assert.ok(requests[2].path.endsWith('/restore'));assert.equal(requests[2].body.runtimeAttestation,undefined);
 });
});

test('DISPOSABLE a fully confirmed observation loses all success/current-confirmation presentation after source expiry',async()=>fixture({enabled:true,diagnostic:route=>reply(route,{...observed,targetProjectAttested:true})},async(page,requests)=>{
 await check(page).click();await panel(page).getByText('All listed checks were observed.',{exact:false}).waitFor();assert.equal(await panel(page).locator('dl').count(),1);await page.clock.fastForward(3600000);await panel(page).getByText('The temporary runtime check has expired.',{exact:false}).waitFor();assert.equal(await panel(page).locator('dl').count(),0);assert.ok(!(await panel(page).innerText()).includes('All listed checks were observed.'));assert.ok(!(await panel(page).innerText()).includes(observed.revision));assert.equal(await check(page).isDisabled(),true);assert.equal(requests.length,1);
}));
