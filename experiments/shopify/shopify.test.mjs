import test from 'node:test';
import assert from 'node:assert/strict';
import {createShopifyReader} from './client.mjs';
import {collectShopifyOrders} from './collect.mjs';
import {API_VERSION} from './queries.mjs';
import {expected,contextFixture,orderFixture,pageFixture} from './fixtures.mjs';
const response=(body,status=200,version=API_VERSION)=>new Response(JSON.stringify(body),{status,headers:{'x-shopify-api-version':version}});
const options={now:()=>new Date('2026-04-01T12:00:00Z')};
function fakeReader(pages,{contexts=[contextFixture(),contextFixture()]}={}){
 let i=0,c=0;return async (operation)=>operation==='context'?contexts[c++]:pages[i++];
}
test('HTTP reader and full-history collector work together over multiple synthetic pages',async()=>{
 const replies=[contextFixture(),pageFixture([orderFixture()],'next'),pageFixture([orderFixture(2)]),contextFixture()];const requests=[];
 const read=createShopifyReader({...expected,accessToken:'synthetic-token',fetchImpl:async(url,init)=>{requests.push({url,...init,body:JSON.parse(init.body)});return response({data:replies.shift()});}});
 const r=await collectShopifyOrders(read,expected,options);
 assert.equal(r.orders.length,2);assert.equal(r.coverageCertified,false);assert.equal(r.status,'extracted_for_mapping');assert.equal(r.review.length,0);
 assert.equal(requests[2].body.variables.after,'next');
 assert.ok(requests.every(r=>r.url.endsWith('/2026-07/graphql.json')&&r.redirect==='error'&&!/mutation/.test(r.body.query)));
 assert.ok(!requests[1].body.query.includes('created_at:'));assert.equal(r.orders[0].refunds[0].transactions.nodes[0].status,'SUCCESS');
 assert.ok(!JSON.stringify(r).includes('synthetic-token'));
});
test('wrong shop or missing history scope stops before fetching orders',async()=>{
 for(const ctx of [{...contextFixture(),shop:{...contextFixture().shop,id:'gid://shopify/Shop/2'}},{...contextFixture(),currentAppInstallation:{accessScopes:[{handle:'read_orders'}]}}]){
 let calls=0;await assert.rejects(()=>collectShopifyOrders(async()=>{calls++;return ctx;},expected,options));assert.equal(calls,1);
 }
});
test('partial nested transaction results never return a completed extraction',async()=>{
 for(const alter of [o=>o.transactionsCount.count=3,o=>o.transactionsCount.precision='AT_LEAST',o=>o.refunds[0].transactions.pageInfo.hasNextPage=true]){
 const order=orderFixture();alter(order);await assert.rejects(()=>collectShopifyOrders(fakeReader([pageFixture([order])]),expected,options),/Incomplete/);
 }
});
test('duplicate orders and repeated cursors or page limits stop extraction',async()=>{
 await assert.rejects(()=>collectShopifyOrders(fakeReader([pageFixture([orderFixture()],'x'),pageFixture([orderFixture()])]),expected,options),/Duplicate/);
 await assert.rejects(()=>collectShopifyOrders(fakeReader([pageFixture([orderFixture()],'x'),pageFixture([orderFixture(2)],'x')]),expected,options),/advance/);
 await assert.rejects(()=>collectShopifyOrders(fakeReader([pageFixture([orderFixture()],'x')]),expected,{...options,maxPages:1}),/page limit/);
});
test('pending and failed refunds and edited orders are retained for explicit review',async()=>{
 for(const status of ['PENDING','FAILURE']){
 const o=orderFixture();o.edited=true;o.refunds[0].transactions.nodes[0].status=status;
 const r=await collectShopifyOrders(fakeReader([pageFixture([o])]),expected,options);
 assert.deepEqual(r.review.map(r=>r.reason),['ORDER_ADJUSTMENT_REVIEW','REFUND_PAYMENT_REVIEW']);assert.equal(r.coverageCertified,false);
 }
});
test('settings changed during extraction and malformed data are rejected',async()=>{
 const end=contextFixture();end.shop.ianaTimezone='UTC';
 await assert.rejects(()=>collectShopifyOrders(fakeReader([pageFixture([])],{contexts:[contextFixture(),end]}),expected,options),/settings changed/);
 await assert.rejects(()=>collectShopifyOrders(fakeReader([{}]),expected,options),/Malformed/);
});
test('throttling is bounded and retries the same read request',async()=>{
 let count=0;const sleeps=[];
 const read=createShopifyReader({...expected,accessToken:'synthetic-token',sleep:async ms=>sleeps.push(ms),fetchImpl:async()=>++count===1?response({},429):response({data:contextFixture()})});
 await read('context');assert.equal(count,2);assert.equal(sleeps.length,1);
 count=0;const blocked=createShopifyReader({...expected,accessToken:'synthetic-token',sleep:async()=>{},fetchImpl:async()=>{count++;return response({errors:[{extensions:{code:'THROTTLED'}}]});}});
 await assert.rejects(()=>blocked('context'),/GraphQL/);assert.equal(count,3);
});
test('access errors, partial GraphQL errors and version fallback never leak raw errors or token',async()=>{
 for(const reply of [response({},403),response({data:contextFixture(),errors:[{message:'sensitive upstream message'}]}),response({data:contextFixture()},200,'2026-10'),response(null)]){
 const read=createShopifyReader({...expected,accessToken:'synthetic-token',fetchImpl:async()=>reply});
 await assert.rejects(()=>read('context'),error=>!error.message.includes('sensitive')&&!error.message.includes('synthetic-token'));
 }
});
test('unsafe destinations, unknown operations and cancelled runs make no request',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw new Error('unexpected');};
 for(const domain of ['https://example.com','fixture.myshopify.com.evil.com','a.myshopify.com/path'])assert.throws(()=>createShopifyReader({domain,accessToken:'fixture',fetchImpl}));
 const read=createShopifyReader({...expected,accessToken:'fixture',fetchImpl});
 await assert.rejects(()=>read('refundCreate'));const ctrl=new AbortController();ctrl.abort();await assert.rejects(()=>read('context',{},ctrl.signal));assert.equal(calls,0);
});
test('duplicate order transactions and currency mismatch are rejected',async()=>{
 const a=orderFixture();a.transactions[1]=structuredClone(a.transactions[0]);
 await assert.rejects(()=>collectShopifyOrders(fakeReader([pageFixture([a])]),expected,options),/Duplicate/);
 const b=orderFixture();b.currencyCode='USD';
 await assert.rejects(()=>collectShopifyOrders(fakeReader([pageFixture([b])]),expected,options),/currency/);
});
