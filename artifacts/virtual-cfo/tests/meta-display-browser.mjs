import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,origin,store,otherStore} from './meta-display-browser-fixture.mjs';
import {savedReport} from './meta-display-report.fixture.ts';
const reader=page=>page.getByRole('region',{name:'Saved Meta spend reader',exact:true});
const saved=page=>page.getByRole('region',{name:'Saved Meta spend',exact:true});
const prepare=async(page,from='2026-10-01',to='2026-10-02')=>{await page.goto(origin+'/new-marketing');await reader(page).waitFor();await page.getByLabel('Meta spend from',{exact:true}).fill(from);await page.getByLabel('Meta spend to',{exact:true}).fill(to);};
const load=page=>page.getByRole('button',{name:'Load saved spend',exact:true}).click();
const fulfill=(route,report,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(report)});
const noAmount=async page=>{assert.equal(await saved(page).count(),0);assert.equal(await reader(page).getByText('1200',{exact:true}).count(),0);};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
if(process.env.NIGHT_SCOUT_META_EXPECT_ENABLED!=='true'){
 test('DEFAULT OFF: real Growth page mounts no Meta reader and sends no Meta request',async()=>{
  const requests=[];await fixture({metaRequests:requests},async page=>{await page.goto(origin+'/new-marketing');await page.getByLabel('Growth reviewed month',{exact:true}).waitFor();assert.equal(await reader(page).count(),0);await page.getByRole('link',{name:/Explore the Numbers/}).first().click();assert.equal(requests.length,0);});
 });
}else{
 test('OPT IN: actual Growth hook only explicitly reads saved GET; expiry preserves original evidence on mobile and desktop',async()=>{
  for(const width of [390,1440]){let calls=0;const requests=[];await fixture({viewport:{width,height:1000},metaRequests:requests,meta:(route,url)=>{assert.equal(url.pathname,'/api/meta-ads/spend');return fulfill(route,savedReport({expired:++calls===2}));}},async page=>{
   await prepare(page);assert.equal(calls,0);await load(page);await saved(page).waitFor();const before=await saved(page).locator('tbody').innerText();await load(page);await saved(page).getByRole('status').filter({hasText:/expired/}).waitFor();assert.equal(await saved(page).locator('tbody').innerText(),before);assert.match(await saved(page).getByRole('status').innerText(),/unknown/);assert.equal(requests.length,2);assert.ok(requests.every(r=>r.method==='GET'&&r.headers.authorization?.startsWith('Bearer ')));await reader(page).getByText('Explore the Numbers · saved Meta source',{exact:true}).click();await reader(page).getByText(/not independently selected/).waitFor();assert.ok(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1));
   for(const label of ['Meta spend from','Meta spend to']){const box=await page.getByLabel(label,{exact:true}).boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=width,'Date input remains within viewport');}
   const button=await page.getByRole('button',{name:'Load saved spend',exact:true}).boundingBox();assert.ok(button&&button.x>=0&&button.x+button.width<=width,'Load button remains within viewport');
   await page.getByLabel('Meta spend from',{exact:true}).scrollIntoViewIfNeeded();if(process.env.NIGHT_SCOUT_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.NIGHT_SCOUT_SCREENSHOT_DIR}/meta-reader-${width}.png`});
  });}
 });
 test('actual hook withholds unavailable and every wrong report scope/account without previous-value fallback',async()=>{
  let response=savedReport(),status=200;const requests=[];await fixture({metaRequests:requests,meta:route=>fulfill(route,response,status)},async page=>{
   await prepare(page);await load(page);await saved(page).waitFor();
   const changes=[v=>v.storeId=otherStore,v=>v.from='2026-09-01',v=>v.to='2026-11-01',v=>v.account.providerAccountId='654321',v=>v.lineage.connectionId='invalid',v=>v.lineage.version='invalid'];
   for(const change of changes){response=savedReport();change(response);await load(page);await reader(page).getByRole('status').filter({hasText:/unavailable/}).waitFor();await noAmount(page);}
   status=403;await load(page);await reader(page).getByRole('status').filter({hasText:/unavailable/}).waitFor();await noAmount(page);assert.equal(requests.length,8,'No automatic retry of denied request');
  });
 });
 test('unknown day and all-unknown saved report never become zero',async()=>{
  const report=savedReport();report.evidenceAvailability='unavailable';report.days=report.days.map(d=>({...d,coverageState:'not_collected',spendMinor:null,observedAt:null,runId:null,runStatus:null,runStartedAt:null}));await fixture({meta:route=>fulfill(route,report)},async page=>{await prepare(page);await load(page);await saved(page).getByText('No spend values were reported for this selected period.',{exact:true}).waitFor();assert.equal(await saved(page).getByText(/subtotal/).count(),0);assert.deepEqual(await saved(page).locator('tbody tr td:first-of-type').allTextContents(),['Unknown','Unknown']);});
 });
 test('real hook discards late old-period response after date edit and new request',async()=>{
  const arrived=deferred(),release=deferred(),delivered=deferred();let calls=0;await fixture({meta:async(route,url)=>{if(++calls===1){arrived.resolve();await release.promise;await fulfill(route,savedReport()).catch(()=>{});delivered.resolve();return;}return fulfill(route,savedReport({from:url.searchParams.get('from'),to:url.searchParams.get('to'),amount:'9900'}));}},async page=>{
   await prepare(page);await load(page);await arrived.promise;await page.getByLabel('Meta spend from',{exact:true}).fill('2026-10-02');await noAmount(page);await load(page);await saved(page).getByText('9900',{exact:true}).waitFor();release.resolve();await delivered.promise;await page.evaluate(()=>new Promise(requestAnimationFrame));await saved(page).getByText('9900',{exact:true}).waitFor();assert.equal(await saved(page).getByText('1200',{exact:true}).count(),0);
  });
 });
 test('real hook discards pending response after company switch and route unmount',async()=>{
  for(const change of ['store','route']){const arrived=deferred(),release=deferred(),delivered=deferred();const requests=[];await fixture({secondStore:true,metaRequests:requests,meta:async route=>{arrived.resolve();await release.promise;await fulfill(route,savedReport()).catch(()=>{});delivered.resolve();}},async page=>{
   await prepare(page);await load(page);await arrived.promise;if(change==='store'){await page.getByRole('combobox',{name:'Active store'}).selectOption(otherStore);await page.getByLabel('Meta spend from',{exact:true}).waitFor();assert.equal(await page.getByLabel('Meta spend from',{exact:true}).inputValue(),'');}else{await page.goto(origin+'/dashboard');await page.goto(origin+'/new-marketing');await reader(page).waitFor();}
   release.resolve();await delivered.promise;await page.evaluate(()=>new Promise(requestAnimationFrame));await noAmount(page);assert.equal(requests.length,1);assert.equal(await page.getByLabel('Meta spend from',{exact:true}).inputValue(),'');
  });}
 });
 test('membership revalidation hides accepted cache and rejects pending late evidence',async()=>{
  for(const pending of [false,true]){const arrived=deferred(),release=deferred();const options={meta:async route=>{arrived.resolve();if(pending)await release.promise;return fulfill(route,savedReport()).catch(()=>{});}};await fixture(options,async page=>{
   await prepare(page);await load(page);await arrived.promise;if(!pending)await saved(page).waitFor();options.nonMember=true;await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.getByRole('heading',{name:'Your account is not linked to a store yet'}).waitFor();release.resolve();assert.equal(await reader(page).count(),0);assert.equal(await saved(page).count(),0);
  });}
 });
 test('sample mode and invalid period do not request Meta history',async()=>{
  const requests=[];await fixture({metaRequests:requests},async page=>{await prepare(page,'2026-10-02','2026-10-01');assert.equal(await page.getByRole('button',{name:'Load saved spend',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'View fictional design',exact:true}).click();assert.equal(await reader(page).count(),0);assert.equal(requests.length,0);});
 });
}
