// Disposable local fixtures. All external traffic is mocked/blocked by the existing harness.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,origin,months,store} from './cfo-comparison-browser-fixture.mjs';
const observedAt='2026-11-20T12:00:00Z';
let bank=100000;
const cashFixtures=months.map((item,index)=>{
 const {from,to}=item.month.selection.period,ebitda=item.month.amounts.ebitda;
 const workingCapital={stock:-5000,debtors:-100,providerSettlements:-50,supplierCredit:200,other:-20};
 const operatingCash=ebitda+Object.values(workingCapital).reduce((a,b)=>a+b,0),opening=bank,bankMovements={taxAndInterest:-100,investing:0,financing:0,other:0};bank=opening+operatingCash-100;
 const sourceRevision=String(index+1).repeat(64),mappingVersion='fictional-cash-map-v1';
 const evidence={contract:'eligible-cash-v1',storeId:store,currency:'GBP',timezone:'Europe/London',from,to,state:'reviewed',sourceRevision,mappingVersion,observedAt,invalidated:false,coverage:{accountsComplete:true,workingCapitalComplete:true,bankMovementsComplete:true,internalTransfersExcluded:true},accounts:[{id:'fictional-bank',included:true,unrestricted:true,openingDate:from,closingDate:to,opening,closing:bank}],ebitda,workingCapital,operatingCash,bankMovements,unsettledProviderFunds:200};
 const payload={evidence,source:{contract:'synthetic-cash-journal-v1',sourceBasis:'synthetic-model',profile:'uk-gifts-v2',anchor:'2024-11-01',from,to,sourceRevision,mappingVersion,sourcePrefixHash:'a'.repeat(64),bankLedgerHash:'b'.repeat(64)}};
 return {item,evidence,raw:{contract:'reviewed-supplement-v1',state:'supported',kind:'cash',sourceBasis:'synthetic-local',snapshotId:`90000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,financialVersionId:item.month.selection.versionId,salesRevision:item.response.salesRevision,costRevision:item.response.costRevision,scope:{storeId:store,currency:'GBP',timezone:'Europe/London',from,to},observedAt,payload}};
});
async function scenario(options,run){
 const forbiddenRequests=[];
 return fixture({viewport:options.viewport??{width:1440,height:1000},forbiddenRequests},async(page,context)=>{
  await context.route('**/api/supplemental-reporting*',async route=>{
   const req=route.request(),url=new URL(req.url());assert.equal(url.origin,origin);assert.equal(req.method(),'GET');
   const item=months.find(m=>m.month.selection.period.from===url.searchParams.get('from'));
   const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(!item||url.searchParams.get('versionId')!==item.month.selection.versionId)return json({state:'unavailable'},409);
   if(options.pending&&url.searchParams.get('kind')===options.pending.kind&&url.searchParams.get('from')===options.pending.from)await options.pending.wait;
   if(url.searchParams.get('kind')==='cash')return options.missingCash?json({state:'unavailable'},503):json(cashFixtures.find(m=>m.item===item).raw);
   const payload=item.acquisition;
   return json({contract:'reviewed-supplement-v1',state:'supported',kind:'acquisition',sourceBasis:'synthetic-local',snapshotId:'90000000-0000-4000-8000-000000000010',financialVersionId:item.month.selection.versionId,salesRevision:item.response.salesRevision,costRevision:item.response.costRevision,scope:payload.scope,observedAt,payload});
  });
  await run(page,context);assert.deepEqual(forbiddenRequests,[]);
 });
}
const noPageOverflow=async page=>assert.ok(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1),'No page-wide horizontal overflow');
const savedShot=async(page,name)=>{if(process.env.NIGHT_SCOUT_SCREENSHOT_DIR){const path=process.env.NIGHT_SCOUT_SCREENSHOT_DIR+'/'+name;await page.screenshot({path:path+'.png',fullPage:true});const panel=page.locator(name.startsWith('cash')?'.nc-main-bridge':'.pv-preview').first();if(await panel.count())await panel.screenshot({path:path+'-panel.png'});}};
for(const width of [1440,390])test(`Plan missing baseline retains the complete workspace with disabled inputs ${width}px`,async()=>scenario({viewport:{width,height:1000}},async page=>{
 await page.goto(origin+'/plan');await page.waitForLoadState('networkidle');
 const frame=page.locator('.pv-baseline-pending');await frame.waitFor();assert.equal(await frame.locator('.pv-lever').count(),6);assert.equal(await frame.locator('.pv-edit').count(),6);assert.equal(await frame.locator('.pv-empty-chart').count(),2);
 assert.equal(await frame.getByRole('button',{name:'Save plan',exact:true}).isDisabled(),true);
 for(const field of await frame.locator('.pv-pending-inputs input').all())assert.equal(await field.isDisabled(),true);
 assert.ok((await frame.locator('.pv-placeholder-value').allTextContents()).every(text=>text==='—'));
 await page.getByRole('group',{name:'Amounts',exact:true}).getByRole('button',{name:'Per order',exact:true}).click();assert.equal(await frame.locator('.pv-plan-controls').getByRole('button',{name:'Per order',exact:true}).getAttribute('aria-pressed'),'true');
 await noPageOverflow(page);await savedShot(page,'plan-missing-'+width);
}));
test('Plan loading retains its workspace, then the supported baseline restores the original editable model',async()=>{
 let release;const wait=new Promise(resolve=>release=resolve);
 await scenario({pending:{kind:'acquisition',from:'2025-02-01',wait}},async page=>{
  await page.goto(origin+'/plan');await page.getByRole('combobox',{name:'Plan reviewed month',exact:true}).selectOption('2025-03-01');
  const frame=page.locator('.pv-baseline-pending');await frame.locator('.pv-placeholder-value').first().getByText('Loading…',{exact:true}).waitFor();assert.equal(await frame.getByRole('button',{name:'Save plan',exact:true}).isDisabled(),true);
  release();await page.waitForFunction(()=>!document.querySelector('.pv-baseline-pending'));
  await page.getByRole('heading',{name:'Build a plan you can actually test',exact:true}).waitFor();assert.equal(await page.getByRole('combobox',{name:'Plan ahead',exact:true}).isEnabled(),true);
  await page.getByRole('group',{name:'Amounts',exact:true}).getByRole('button',{name:'Per order',exact:true}).click();assert.equal(await page.locator('.pv-plan-controls').getByRole('button',{name:'Per order',exact:true}).getAttribute('aria-pressed'),'true');
  await savedShot(page,'plan-supported');
 });
});
for(const width of [1440,390])test(`Cash restores a signed, reconciled bridge and matched trend without dividing bank cash ${width}px`,async()=>scenario({viewport:{width,height:1000}},async page=>{
 await page.goto(origin+'/new-cash-control');await page.getByRole('combobox',{name:'Cash reference month',exact:true}).selectOption('2025-03-01');
 const bridge=page.getByRole('img',{name:'Profit (EBITDA) to operating cash reconciliation. Exact signed amounts follow.',exact:true});await bridge.waitFor();
 const values=await bridge.locator('g[data-cash-component]').evaluateAll(rows=>rows.map(row=>({id:row.dataset.cashComponent,amount:Number(row.dataset.amountPence)})));
 assert.equal(values.length,7);assert.equal(values[0].amount,1400);assert.equal(values.at(-1).amount,-3570);assert.equal(values.slice(0,-1).reduce((s,v)=>s+v.amount,0),values.at(-1).amount);
 const bank=page.locator('.nc-kpi').filter({hasText:'Bank cash at selected month end'}).locator('strong');assert.equal(await bank.textContent(),'£892.90');
 await page.getByRole('group',{name:'Amounts',exact:true}).getByRole('button',{name:'Per order',exact:true}).click();assert.equal(await bank.textContent(),'£892.90');
 await page.getByRole('heading',{name:'Your CFO cash review plan',exact:true}).waitFor();assert.equal(await page.locator('.nc-linked .np-plan-card').count(),3);
 await page.getByRole('img',{name:/Monthly EBITDA and matched operating cash/}).waitFor();assert.ok((await page.locator('.nc-kpi strong').allTextContents()).every(text=>!text.includes('Unavailable')));
 await noPageOverflow(page);await savedShot(page,'cash-supported-'+width);
}));
test('Cash distinguishes pending data from missing numeric data while preserving the graphical layout',async()=>{
 let release;const wait=new Promise(resolve=>release=resolve);
 await scenario({missingCash:true,pending:{kind:'cash',from:'2025-03-01',wait}},async page=>{
  await page.goto(origin+'/new-cash-control');await page.getByRole('combobox',{name:'Cash reference month',exact:true}).selectOption('2025-03-01');
  const bank=page.locator('.nc-kpi').filter({hasText:'Bank cash at selected month end'}).locator('strong');await bank.getByText('Loading…',{exact:true}).waitFor();assert.equal(await page.locator('.nc-chart-placeholder').count(),2);
  release();await page.waitForFunction(()=>[...document.querySelectorAll('.nc-kpi')].filter(card=>!card.textContent.includes('Profit (EBITDA)')).every(card=>card.querySelector('strong')?.textContent==='—'));assert.equal(await page.locator('.nc-kpi').filter({hasText:'Profit (EBITDA)'}).locator('strong').textContent(),'£14.00','Supported profit survives missing cash');
  assert.equal(await page.getByRole('img',{name:'Profit (EBITDA) to operating cash reconciliation. Exact signed amounts follow.',exact:true}).count(),0);
  assert.equal(await page.locator('.nc-linked .np-plan-card').count(),3);await noPageOverflow(page);await savedShot(page,'cash-missing');
 });
});
