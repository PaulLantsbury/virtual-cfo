// Synthetic signed-in walkthrough only. The shared fixture blocks external traffic.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,storeId} from './shared-sales-fixture.mjs';
const handle='synthetic_discovery_handle_123456789';
const directory=[['200','Sales','REVENUE'],['404','Card processing','OVERHEADS'],['405','Advertising','OVERHEADS'],['406','Software','OVERHEADS'],['090','Current bank','BANK']].map(([code,name,type],index)=>({id:`90000000-0000-0000-0000-00000000000${index+1}`,code,name,type,status:'ACTIVE'}));
const readiness={storeId,connection:null,evidenceState:null,evidenceRetrievedAt:null};
const options={profitRespond:()=>({data:{state:'unavailable',reason:'Synthetic unavailable profit'}})};
for(const viewport of ['desktop','mobile'])test(`${viewport}: bootstrap search keeps selections, explains conflicts and shows complete review`,()=>fixture({...options,viewport},async(page,{origin})=>{
 await page.route('**/api/xero/merchant-readiness*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(readiness)}));
 await page.route('**/rest/v1/rpc/shopify_connection_status',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({state:'not_configured',storeId,latestAttempt:null,candidate:{state:'not_assessed'},financialVerification:'not_assessed'})}));
 await page.route(`**/api/xero/staging/discovery/${handle}`,route=>{assert.match(route.request().headers().authorization,/^Bearer /);return route.fulfill({contentType:'application/json',body:JSON.stringify({handle,status:'ready',selectionHandle:'synthetic_selection_handle_123456789',tenant:{id:'a0000000-0000-0000-0000-000000000001',name:'Synthetic Xero organisation'},accounts:directory})});});
 await page.goto(`${origin}/settings?xeroDiscovery=${handle}`);
 const search=page.getByRole('searchbox',{name:'Find an account'});await search.waitFor();
 const save=page.getByRole('button',{name:'Save mapping and connect Xero',exact:true});assert.equal(await save.isDisabled(),true);
 const fees=page.getByRole('group',{name:'Processing fees (0 selected)'});await fees.getByLabel('404 — Card processing',{exact:false}).check();
 await search.fill('200');
 await page.getByRole('group',{name:'Booked revenue (0 selected)'}).getByLabel('200 — Sales',{exact:false}).check();
 assert.equal(await page.getByRole('group',{name:'Processing fees (1 selected)'}).getByLabel('404 — Card processing',{exact:false}).isVisible(),true);
 await search.fill('404');const advertising=page.getByRole('group',{name:'Advertising (0 selected)'});assert.equal(await advertising.getByLabel('404 — Card processing',{exact:false}).isDisabled(),true);assert.match(await advertising.innerText(),/Selected in Processing fees; remove it there to move it/);
 await search.fill('nothing-matches');assert.equal(await page.getByText('No accounts match your search in this category.',{exact:true}).count(),3);
 await search.fill('');
 await page.getByRole('group',{name:'Advertising (0 selected)'}).getByLabel('405 — Advertising',{exact:false}).check();
 await page.getByRole('group',{name:'Software (0 selected)'}).getByLabel('406 — Software',{exact:false}).check();
 await page.getByRole('group',{name:'Included cash (0 selected)'}).getByLabel('090 — Current bank',{exact:false}).check();
 const summary=page.getByRole('region',{name:'Mapping selection summary'});assert.match(await summary.innerText(),/200 — Sales/);assert.match(await summary.innerText(),/404 — Card processing/);assert.equal(await save.isEnabled(),true);
 await page.getByLabel('Mapping effective date').fill('2026-09-02');assert.equal(await save.isDisabled(),true);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 // No connect button is clicked: this walkthrough never initiates consent or persistence.
}));
test('connected evidence copy does not regress to first-refresh warning',()=>fixture(options,async(page,{origin})=>{
 await page.route('**/api/xero/merchant-readiness*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({...readiness,connection:{status:'active',scopeVersion:'read-only-v1',createdAt:'2026-08-01T00:00:00Z',lastSuccessAt:'2026-08-31T02:00:00Z',lastFailureAt:null,mappingReviewRequired:false},evidenceState:'ready',evidenceRetrievedAt:'2026-08-31T02:00:00Z'})}));
 await page.route('**/rest/v1/rpc/shopify_connection_status',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({state:'not_configured',storeId,latestAttempt:null,candidate:{state:'not_assessed'},financialVerification:'not_assessed'})}));
 await page.goto(origin+'/settings');await page.getByRole('heading',{name:'Xero connected',exact:true}).waitFor();const region=page.getByRole('region',{name:'Xero staging discovery'});assert.match(await region.innerText(),/Editing the saved mapping is not available/);assert.doesNotMatch(await region.innerText(),/until the first successful refresh/);
}));
