// Unmounted fictional component fixture; HTTP loopback only; no remote/API calls.
import test from 'node:test';
import assert from 'node:assert/strict';
const origin=process.env.NIGHT_SCOUT_TEST_URL||'http://127.0.0.1:5191';
if(new URL(origin).hostname!=='127.0.0.1'||new URL(origin).protocol!=='http:')throw Error('HTTP loopback required');
const {chromium}=await import(process.env.NIGHT_SCOUT_PLAYWRIGHT_MODULE||'playwright');
async function fixture(width,run){
 const browser=await chromium.launch({headless:true,executablePath:process.env.NIGHT_SCOUT_CHROME_PATH});const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();const errors=[],blocked=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin||url.pathname.startsWith('/api/')||route.request().method()!=='GET'){blocked.push(url.pathname);return route.abort();}return route.continue();});
 try{await run(page);assert.deepEqual(errors,[]);assert.deepEqual(blocked,[],'No remote/API calls');}finally{await context.close();await browser.close();}
}
const open=(page,scenario)=>page.goto(origin+'/tests/meta-history-fixture.html?scenario='+scenario);
for(const width of [390,1440])test(`DISPOSABLE ${width}px: expiry preserves exact source evidence`,async()=>fixture(width,async page=>{
 await open(page,'current');const region=page.getByRole('region',{name:'Saved Meta spend'});await region.getByRole('status').waitFor();assert.match(await region.getByRole('status').innerText(),/current.*stale/i);
 const before=await region.locator('tbody').innerText();await open(page,'expired');assert.match(await region.getByRole('status').innerText(),/expired.*reconnect.*stale/i);assert.equal(await region.locator('tbody').innerText(),before);
 const rows=region.locator('tbody tr');assert.equal(await rows.nth(0).locator('td').nth(0).innerText(),'1200');assert.equal(await rows.nth(1).locator('td').nth(0).innerText(),'Unknown');await region.getByText('fixture-run-1',{exact:true}).waitFor();await region.getByText('2026-10-03T09:00:00Z',{exact:true}).waitFor();
 await region.getByText(/not a complete-period total/).waitFor();assert.ok(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1));const area=region.getByLabel('Scrollable saved Meta spend evidence');await area.focus();assert.equal(await area.evaluate(el=>el===document.activeElement),true);
 if(width===390){assert.ok(await area.evaluate(el=>el.scrollWidth>el.clientWidth),'Narrow evidence table scrolls instead of crushing amounts');await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('[aria-label="Scrollable saved Meta spend evidence"]').scrollLeft>0);await area.evaluate(el=>{el.scrollLeft=0});}
 if(process.env.NIGHT_SCOUT_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.NIGHT_SCOUT_SCREENSHOT_DIR}/meta-history-${width}.png`,fullPage:true});
}));
test('DISPOSABLE: disconnected superseded revoked and lineage mismatch withhold rows',async()=>fixture(390,async page=>{
 for(const scenario of ['disconnected','superseded','revoked','membership-revoked','wrong-storeId','wrong-accountId','wrong-connectionId','wrong-from','wrong-to','wrong-version']){await open(page,scenario);const region=page.getByRole('region',{name:'Saved Meta spend'});await region.getByText(/Saved spend is withheld/).waitFor();assert.equal(await region.locator('table').count(),0);assert.equal(await region.getByText('1200',{exact:true}).count(),0);assert.equal(await region.getByText('fixture-run-1',{exact:true}).count(),0);}
}));
test('DISPOSABLE: all-unknown evidence is unavailable rather than zero',async()=>fixture(390,async page=>{
 await open(page,'all-unknown');const region=page.getByRole('region',{name:'Saved Meta spend'});await region.getByText('No spend values were reported for this selected period.',{exact:true}).waitFor();assert.equal(await region.getByText(/Reported spend subtotal/).count(),0);assert.deepEqual(await region.locator('tbody tr td:first-of-type').allTextContents(),['Unknown','Unknown']);
}));
test('DISPOSABLE wire: expired actual envelope retains exact historical evidence and unknown freshness',async()=>fixture(390,async page=>{
 await open(page,'wire-current');const region=page.getByRole('region',{name:'Saved Meta spend'});await region.getByRole('status').waitFor();const before=await region.locator('tbody').innerText();await open(page,'wire-expired');assert.match(await region.getByRole('status').innerText(),/expired.*reconnect/i);assert.match(await region.getByRole('status').innerText(),/unknown|not established/i);assert.equal(await region.locator('tbody').innerText(),before);await region.getByText('33333333-3333-4333-8333-333333333333',{exact:true}).waitFor();assert.equal(await region.locator('tbody tr').nth(1).locator('td').nth(0).innerText(),'Unknown');
 for(const scenario of ['wire-disconnected','wire-revoked','wire-wrong-account']){await open(page,scenario);await region.getByText(/Saved spend is withheld/).waitFor();assert.equal(await region.locator('table').count(),0);}
 await open(page,'wire-all-unknown');await region.getByText('No spend values were reported for this selected period.',{exact:true}).waitFor();assert.equal(await region.getByText(/Reported spend subtotal/).count(),0);
}));
