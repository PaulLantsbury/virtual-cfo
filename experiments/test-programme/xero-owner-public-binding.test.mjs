import test from 'node:test';import assert from 'node:assert/strict';
import {createXeroOwnerSessionBindingReader,isXeroOwnerSessionBindingReceipt} from './xero-reader-context-proof.mjs';
const owner='90000000-0000-4000-8000-000000000001',store='90000000-0000-4000-8000-000000000002',tenant='90000000-0000-4000-8000-000000000003';
const config={authUrl:'https://bioalckltvkhlczusdvl.supabase.co',publicKey:'sb_publishable_'+'a'.repeat(24),authenticateOwner:async()=>({userId:owner,isOwner:true}),now:()=>new Date('2026-10-30T12:00:00Z'),bindingTransport:'public-binding-rpc-v1'};
test('explicit public metadata RPC transport uses current bearer, exact store body and no private schema or health claim',async()=>{
 const calls=[],reader=createXeroOwnerSessionBindingReader({...config,fetchImpl:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify([{store_id:store,tenant_id:tenant}]));}});
 const result=await reader.read({authorization:'Bearer synthetic-owner-session',ownerId:owner,storeId:store});
 assert.equal(calls.length,1);const {url,options}=calls[0];assert.equal(url,config.authUrl+'/rest/v1/rpc/xero_member_active_tenant_binding_v1');assert.equal(options.method,'POST');assert.equal(options.headers['Accept-Profile'],'public');assert.equal(options.headers['Content-Profile'],'public');assert.equal(options.headers.Authorization,'Bearer synthetic-owner-session');assert.deepEqual(JSON.parse(options.body),{p_store_id:store});assert.equal(options.redirect,'error');
 assert.equal(result.provenance,'authenticated_owner_public_rpc_binding_v1');assert.equal(result.tenantBindingVerified,true);assert.equal(result.readerHealthVerified,false);assert.equal(result.connected,undefined);assert.equal(result.expiresAt,'2026-10-30T12:10:00.000Z');assert.equal(isXeroOwnerSessionBindingReceipt(result),true);assert.equal(isXeroOwnerSessionBindingReceipt({...result}),false);assert.doesNotMatch(JSON.stringify(result),/Bearer|publishable|credential|ciphertext/);
});
test('missing RPC, denied owner, wrong/extra/ambiguous metadata fail without schema or credential fallback',async()=>{
 for(const response of [()=>new Response('{}',{status:404}),()=>new Response('{}',{status:403}),()=>new Response(JSON.stringify([])),()=>new Response(JSON.stringify([{store_id:store,tenant_id:tenant},{store_id:store,tenant_id:owner}])),()=>new Response(JSON.stringify([{store_id:owner,tenant_id:tenant}])),()=>new Response(JSON.stringify([{store_id:store,tenant_id:tenant,connected:true}])),()=>new Response('x'.repeat(8193))]){
  let calls=0;const reader=createXeroOwnerSessionBindingReader({...config,fetchImpl:async()=>{calls++;return response();}});await assert.rejects(reader.read({authorization:'Bearer synthetic-owner-session',ownerId:owner,storeId:store}),/^Error: Xero reader context proof unavailable$/);assert.equal(calls,1);
 }
 let called=false;const denied=createXeroOwnerSessionBindingReader({...config,authenticateOwner:async()=>({userId:tenant,isOwner:false}),fetchImpl:async()=>{called=true;}});await assert.rejects(denied.read({authorization:'Bearer synthetic-owner-session',ownerId:owner,storeId:store}));assert.equal(called,false);
 assert.throws(()=>createXeroOwnerSessionBindingReader({...config,bindingTransport:'auto-fallback'}));
});
