import test from 'node:test';
import assert from 'node:assert/strict';
import {createXeroOwnerSessionBindingReader,isXeroOwnerSessionBindingReceipt,XERO_DEMO_BINDING_STORE_ID as store} from './xero-reader-context-proof.mjs';
const owner='90000000-0000-4000-8000-000000000001',tenant='90000000-0000-4000-8000-000000000002',account='90000000-0000-4000-8000-000000000003';
const config={authUrl:'https://bioalckltvkhlczusdvl.supabase.co',publicKey:'sb_publishable_'+'a'.repeat(24),authenticateOwner:async()=>({userId:owner,isOwner:true}),now:()=>new Date('2026-10-30T12:00:00Z'),bindingTransport:'demo-public-binding-rpc-v1',selectedRevenueAccountId:account};
const status={storeId:store,tenantId:tenant,bindingState:'active',mappingState:'current',mappingVersion:1,mappingEffectiveFrom:'2026-10-30',revenueAccountIds:[account],readerHealth:{state:'connected',checkedAt:'2026-10-30T11:59:00Z',matchesCurrentCredential:true},latestSupportedPeriod:null};
const input={authorization:'Bearer synthetic-owner-session',ownerId:owner,storeId:store};
test('demo binding reads only dedicated member RPCs and proves selected current revenue mapping with fresh independently authenticated health',async()=>{
 const calls=[],reader=createXeroOwnerSessionBindingReader({...config,fetchImpl:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(url.endsWith('xero_demo_reader_status_v1')?status:[{store_id:store,tenant_id:tenant}]));}});
 const receipt=await reader.read(input);assert.equal(calls.length,2);assert.deepEqual(calls.map(x=>new URL(x.url).pathname),['/rest/v1/rpc/xero_demo_member_active_tenant_binding_v1','/rest/v1/rpc/xero_demo_reader_status_v1']);
 for(const {options} of calls){assert.equal(options.method,'POST');assert.equal(options.redirect,'error');assert.equal(options.headers['Accept-Profile'],'public');assert.equal(options.headers.Authorization,input.authorization);assert.deepEqual(JSON.parse(options.body),{p_store_id:store});}
 assert.equal(isXeroOwnerSessionBindingReceipt(receipt),true);assert.equal(isXeroOwnerSessionBindingReceipt({...receipt}),false);assert.equal(receipt.target,tenant);assert.equal(receipt.mappedRevenueAccountId,account);assert.equal(receipt.revenueAccountBindingVerified,true);assert.equal(receipt.readerHealthVerified,true);assert.equal(receipt.connected,undefined);assert.equal(receipt.provenance,'authenticated_owner_demo_rpc_binding_v1');assert.equal(receipt.expiresAt,'2026-10-30T12:10:00.000Z');assert.doesNotMatch(JSON.stringify(receipt),/Bearer|publishable|checkedAt|latestSupportedPeriod/);
});
test('demo transport refuses another store or absent/invalid selected account before any network capability',async()=>{
 let calls=0;const reader=createXeroOwnerSessionBindingReader({...config,fetchImpl:async()=>{calls++;throw Error('must not run');}});
 await assert.rejects(reader.read({...input,storeId:tenant}),/proof unavailable/);assert.equal(calls,0);
 for(const value of [undefined,null,'arbitrary',account+'\n'])assert.throws(()=>createXeroOwnerSessionBindingReader({...config,selectedRevenueAccountId:value}));
});
test('unavailable or conflicting demo status/mapping fails without a legacy transport fallback',async()=>{
 const bad=[null,{}, {...status,storeId:owner},{...status,tenantId:owner},{...status,bindingState:'ambiguous'},{...status,mappingState:'review_required'},{...status,mappingState:'unavailable'},{...status,mappingVersion:0},{...status,mappingVersion:'1'},{...status,mappingEffectiveFrom:'2026-10-31'},{...status,mappingEffectiveFrom:'2026-02-30'},{...status,revenueAccountIds:[]},{...status,revenueAccountIds:[tenant]},{...status,revenueAccountIds:[account,account]},{...status,revenueAccountIds:[account,'invalid']},{...status,revenueAccountIds:[account,...Array(100).fill(tenant)]}];
 for(const value of bad){const calls=[],reader=createXeroOwnerSessionBindingReader({...config,fetchImpl:async url=>{calls.push(url);return new Response(JSON.stringify(calls.length===1?[{store_id:store,tenant_id:tenant}]:value));}});await assert.rejects(reader.read(input),/proof unavailable/);assert.equal(calls.length,2);assert.equal(calls.every(url=>url.includes('/rpc/xero_demo_')),true);}
 for(const response of [()=>new Response('{}',{status:404}),()=>new Response('x'.repeat(8193)),()=>({ok:true,redirected:true,headers:new Headers(),body:null})]){let calls=0;const reader=createXeroOwnerSessionBindingReader({...config,fetchImpl:async()=>++calls===1?new Response(JSON.stringify([{store_id:store,tenant_id:tenant}])):response()});await assert.rejects(reader.read(input));assert.equal(calls,2);}
});
test('Demo member health requires fresh current-credential evidence; binding alone remains disabled-setup evidence',async()=>{
 for(const readerHealth of [undefined,{}, {...status.readerHealth,state:'failed'},{...status.readerHealth,matchesCurrentCredential:false},{...status.readerHealth,checkedAt:'2026-10-30T10:59:59Z'},{...status.readerHealth,checkedAt:'2026-10-30T12:00:01Z'},{...status.readerHealth,checkedAt:null}]){
  const reader=createXeroOwnerSessionBindingReader({...config,fetchImpl:async url=>new Response(JSON.stringify(url.endsWith('xero_demo_reader_status_v1')?{...status,readerHealth}:[{store_id:store,tenant_id:tenant}]))});
  const receipt=await reader.read(input);assert.equal(receipt.tenantBindingVerified,true);assert.equal(receipt.readerHealthVerified,false);assert.equal(receipt.readerHealthObservedAt,undefined);
 }
 const reader=createXeroOwnerSessionBindingReader({...config,fetchImpl:async url=>new Response(JSON.stringify(url.endsWith('xero_demo_reader_status_v1')?{...status,readerHealth:{...status.readerHealth,checkedAt:'2026-10-30T11:01:00Z'}}:[{store_id:store,tenant_id:tenant}]))});
 assert.equal((await reader.read(input)).expiresAt,'2026-10-30T12:01:00.000Z');
});
