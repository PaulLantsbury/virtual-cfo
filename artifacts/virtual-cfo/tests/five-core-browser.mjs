// Five-core visual review: fictional auth/evidence; no hosted browser/session.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,origin} from './meta-display-browser-fixture.mjs';
const pages=[
 ['scout','/dashboard','Scout’s View','Scout reviewed month','Scout evidence version'],
 ['profit','/profit-engine','Profit Engine','Reporting month','Evidence version'],
 ['growth','/new-marketing','Growth & Marketing','Growth reviewed month','Growth evidence version'],
 ['cash','/new-cash-control','Cash Control','Cash reference month','Cash reference evidence version'],
 ['plan','/plan','Plan','Plan reviewed month','Plan evidence version'],
];
for(const [name,path,title,month,version] of pages)test('FIVE CORE: '+name+' desktop/mobile hierarchy and Explore the Numbers',async()=>{
 for(const width of [390,1440]){const metaRequests=[];await fixture({viewport:{width,height:1000},metaRequests},async page=>{
  await page.goto(origin+path);await page.getByRole('heading',{name:title,exact:true,level:1}).waitFor();
  const monthControl=page.getByRole('combobox',{name:new RegExp('^'+month+'(?:$|\\s)')}),versionControl=page.getByRole('combobox',{name:new RegExp('^'+version+'(?:$|\\s)')});
  await monthControl.locator('option[value="2025-03-01"]').waitFor({state:'attached'});await monthControl.selectOption('2025-03-01');await versionControl.selectOption('version-2');await page.waitForLoadState('networkidle');
  await page.evaluate(()=>{for(const el of document.querySelectorAll('*'))if(el.scrollTop)el.scrollTop=0;window.scrollTo(0,0);});
  assert.ok(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1),'No page horizontal overflow');
  const heading=await page.getByRole('heading',{name:title,exact:true,level:1}).boundingBox();assert.ok(heading&&heading.y>=0&&heading.y<1000,'Page purpose visible in first viewport');
  const explore=page.getByRole('link',{name:/^Explore the Numbers/}).first();await explore.waitFor();
  if(process.env.NIGHT_SCOUT_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.NIGHT_SCOUT_SCREENSHOT_DIR}/${name}-${width}-top.png`});
  const target=await explore.getAttribute('href');assert.ok(target?.startsWith('#'));const evidence=page.locator(target);assert.equal(await evidence.count(),1,'Explore has one unique destination');const before=await evidence.boundingBox();await explore.click();await evidence.waitFor();assert.equal(new URL(page.url()).hash,target);const after=await evidence.boundingBox();assert.ok(after&&after.y<1000&&(!before||after.y<before.y||before.y<1000),'Explore actually reaches source evidence');
  await evidence.evaluate(el=>{if(el.tagName==='DETAILS')el.open=true;for(const detail of el.querySelectorAll('details'))detail.open=true;});
  const summary=evidence.locator('summary').first(),focus=await summary.count()?summary:evidence;await focus.evaluate(el=>{const main=el.closest('main');if(main)main.scrollTop+=el.getBoundingClientRect().top-main.getBoundingClientRect().top-16;else el.scrollIntoView({block:'start'});});
  assert.match(await evidence.innerText(),/evidence|source|financial|unavailable/i);
  if(process.env.NIGHT_SCOUT_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.NIGHT_SCOUT_SCREENSHOT_DIR}/${name}-${width}-evidence.png`});
  assert.equal(metaRequests.length,0,'Default-off five-core review makes no Meta requests');
 });}
});
