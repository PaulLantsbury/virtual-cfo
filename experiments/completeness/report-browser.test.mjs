import test from 'node:test';import assert from 'node:assert/strict';
const{chromium}=await import(process.env.NIGHT_SCOUT_PLAYWRIGHT_MODULE||'playwright');
test('offline report shows matching and seven difference scenarios without network or write actions',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.NIGHT_SCOUT_CHROME_PATH});try{const page=await browser.newPage(),errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>{network.push(r.request().url());return r.abort();});await page.goto(new URL('./comparison-demo.html',import.meta.url).href);
 assert.equal(await page.getByRole('option').count(),8);assert.equal(await page.getByRole('status').innerText(),'Supplied records match');assert.equal(await page.locator('#rows tr').count(),1);assert.ok((await page.locator('#rows').innerText()).includes('Matches'));
 for(const[id,expected]of [['missing','Not present'],['duplicate','Duplicate transaction'],['amount','£21.00'],['vat','£3.00'],['date','2026-04-01'],['link','order-99'],['identity','Unexpected imported transaction']]){await page.getByLabel('Choose a test case').selectOption(id);assert.equal(await page.getByRole('status').innerText(),'Differences need investigation');assert.ok((await page.locator('#rows').innerText()).includes(expected),id);assert.equal(await page.getByText('Completeness is not approved.',{exact:true}).count(),1);}
 await page.getByLabel('Choose a test case').selectOption('amount');if(process.env.NIGHT_SCOUT_REPORT_SCREENSHOT)await page.screenshot({path:process.env.NIGHT_SCOUT_REPORT_SCREENSHOT,fullPage:true});
 assert.equal(await page.getByRole('button').count(),0);assert.equal(await page.locator('input[type=file]').count(),0);assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 }finally{await browser.close();}
});
