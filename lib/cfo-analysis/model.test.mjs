import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelPilot } from './model.mjs';
const expected = { companyId:'test',storeId:'test',currency:'GBP',timeZone:'Europe/London',from:'2026-10-01',to:'2026-10-31',selectionVersion:'1',asOf:'2026-11-27T12:00:00Z',access:'allowed',formulaVersion:'profit-evidence-v1' };
test('default-off does not request a credential or send anything', async () => {
  const pilot = createModelPilot({ transport:()=>{throw Error('must not call');}, getApiKey:()=>{throw Error('must not read');} });
  const result = await pilot(null,expected);
  assert.equal(result.model.status,'fallback');
  assert.equal(result.model.reason,'disabled');
});
test('enabled invalid evidence never leaves the server', async () => {
  const pilot = createModelPilot({approval:{enabled:true,approvalId:'offline-test-only',model:'mock',expiresAt:9999999999999,maxCalls:1,maxCostUsd:0.1,inputUsdPerMillion:1,outputUsdPerMillion:1},transport:()=>{throw Error('must not call');},getApiKey:()=>{throw Error('must not read');}});
  const result = await pilot(null,expected);
  assert.equal(result.model.reason,'evidence-unavailable');
});
import { makeSampleCase } from '../../experiments/cfo-engine-samples/fixtures.mjs';
const approval = {enabled:true,approvalId:'mock-only',model:'mock',expiresAt:9999999999999,maxCalls:2,maxCostUsd:0.1,inputUsdPerMillion:1,outputUsdPerMillion:1};
const response = text => ({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text}]}]})});
const normal = makeSampleCase('normal');
test('valid selection sends only minimal aggregates and preserves canonical prose',async()=>{
 let captured;
 const pilot=createModelPilot({approval,getApiKey:()=> 'offline-fake',transport:async(url,init)=>{captured={url,body:JSON.parse(init.body)};return response(JSON.stringify({factKeys:['netProductSales']}));}});
 const result=await pilot(normal.input,normal.expected);
 assert.equal(result.model.status,'selected');
 assert.equal(captured.url,'https://api.openai.com/v1/responses');
 assert.equal(captured.body.store,false);
 assert.equal(captured.body.max_output_tokens,256);
 assert.deepEqual(Object.keys(JSON.parse(captured.body.input)),['currency','facts']);
 assert(!captured.body.input.includes('fictional-ledger'));
 assert(!captured.body.input.includes(normal.input.scope.companyId));
});
for(const text of ['Spend more now','{}','{"factKeys":["unknown"]}','{"factKeys":["netProductSales"],"advice":"Spend"}','{"factKeys":["netProductSales","netProductSales"]}']) test(`unsafe response falls back: ${text}`,async()=>{
 const pilot=createModelPilot({approval,getApiKey:()=> 'fake',transport:async()=>response(text)});
 assert.equal((await pilot(normal.input,normal.expected)).model.status,'fallback');
});
test('refusal falls back',async()=>{
 const pilot=createModelPilot({approval,getApiKey:()=> 'fake',transport:async()=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'refusal',refusal:'no'}]}]})})});
 assert.equal((await pilot(normal.input,normal.expected)).model.reason,'invalid-response');
});
test('cap applies to attempts including failures',async()=>{
 let calls=0;const pilot=createModelPilot({approval:{...approval,maxCalls:1},getApiKey:()=> 'fake',transport:async()=>{calls++;throw Error('failure');}});
 await pilot(normal.input,normal.expected);
 assert.equal((await pilot(normal.input,normal.expected)).model.reason,'call-limit');assert.equal(calls,1);
});
for(const [name,overrides,reason] of [['budget',{maxCostUsd:0.000001},'budget-limit'],['expiry',{expiresAt:1},'disabled']]) test(name,async()=>{
 const pilot=createModelPilot({approval:{...approval,...overrides},getApiKey:()=>{throw Error('no read');}});
 assert.equal((await pilot(normal.input,normal.expected)).model.reason,reason);
});
test('stale never requests model',async()=>{
 const f=makeSampleCase('stale');const pilot=createModelPilot({approval,getApiKey:()=>{throw Error('no read');}});
 assert.equal((await pilot(f.input,f.expected)).model.reason,'evidence-unavailable');
});
test('key exceptions fall back',async()=>{
 const pilot=createModelPilot({approval,getApiKey:()=>{throw Error('secret failure');}});
 assert.equal((await pilot(normal.input,normal.expected)).model.reason,'credential-unavailable');
});
test('model wrapper excludes extra nested scope fields from output and fake request',async()=>{
 const s=makeSampleCase('normal');s.input.scope.privateExtra={sentinel:'PRIVATE_SCOPE_SENTINEL'};
 for(const enabled of [false,true]){
  let captured='';
  const pilot=createModelPilot({approval:enabled?approval:null,getApiKey:()=> 'offline-fake',transport:async(_url,init)=>{captured=init.body;return response('{"factKeys":["netProductSales"]}');}});
  const result=await pilot(s.input,s.expected);
  assert.doesNotMatch(JSON.stringify(result)+captured,/PRIVATE_SCOPE_SENTINEL|privateExtra/);
  assert.equal(result.analysis.status,'ready');
 }
});
