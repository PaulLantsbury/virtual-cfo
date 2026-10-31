import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';
import {createXeroReaderContextProofSource,isXeroReaderContextProofSource,XERO_READER_CONTEXT_SQL,XERO_DEMO_READER_CONTEXT_SQL,XERO_DEMO_BINDING_STORE_ID} from './xero-reader-context-proof.mjs';
const owner='90000000-0000-4000-8000-000000000001',store='90000000-0000-4000-8000-000000000002',tenant='90000000-0000-4000-8000-000000000003',connection='90000000-0000-4000-8000-000000000004';
const now=()=>new Date('2026-10-30T12:00:00Z'),identity=async()=>({ownerId:owner,storeId:store,authenticated:true});
const safe={tenant_id:tenant,store_id:store,context_role:'existing_authorized_audit',outcome:'connected',phase:'organisation',reason:'ok',tenant_visible:true,matches_current_credential:true,latest_time_unambiguous:true,checked_at:'2026-10-30T11:55:00Z'};
test('independent authentication is mandatory before one exact SELECT, with no raw credential fields',async()=>{
 let queryCalls=0;const source=createXeroReaderContextProofSource({authenticateContext:identity,query:async(sql,args)=>{queryCalls++;assert.equal(sql,XERO_READER_CONTEXT_SQL);assert.deepEqual(args,[owner,store]);return {rows:[safe]};},now});
 assert.equal(isXeroReaderContextProofSource(source),true);assert.equal(isXeroReaderContextProofSource({read:source.read}),false);const r=await source.read({ownerId:owner,storeId:store});assert.equal(r.target,tenant);assert.equal(r.connected,true);assert.equal(queryCalls,1);assert.equal(r.provenance,'authenticated_read_context_current_preflight_v1');assert.doesNotMatch(JSON.stringify(r),/ciphertext|password|credential_version|existing_authorized_audit/);
 const denied=createXeroReaderContextProofSource({authenticateContext:async()=>({ownerId:tenant,storeId:store,authenticated:true}),query:async()=>{throw Error('must not query');},now});await assert.rejects(denied.read({ownerId:owner,storeId:store}));
 assert.throws(()=>createXeroReaderContextProofSource({}));
});
test('wrong role/store, ambiguous/missing, stale/failed/future or stale-version metadata is unavailable',async()=>{
 for(const rows of [[],[safe,safe],[{...safe,context_role:'night_scout_test_writer'}],[{...safe,context_role:'authenticated'}],[{...safe,store_id:tenant}],[{...safe,checked_at:'2026-10-30T10:00:00Z'}],[{...safe,checked_at:'2026-10-30T12:01:00Z'}],[{...safe,outcome:'failed'}],[{...safe,matches_current_credential:false}],[{...safe,latest_time_unambiguous:false}],[{...safe,tenant_visible:null}]]){
 const source=createXeroReaderContextProofSource({authenticateContext:identity,query:async()=>({rows}),now});await assert.rejects(source.read({ownerId:owner,storeId:store}),/^Error: Xero reader context proof unavailable$/);}
});
async function fixture(){const db=new PGlite();await db.exec(`CREATE SCHEMA xero_v1;CREATE TABLE public.store_memberships(user_id uuid,store_id uuid);CREATE TABLE xero_v1.connections(id uuid,store_id uuid,tenant_id text,retired_at timestamptz);CREATE TABLE xero_v1.credential_envelopes(connection_id uuid,version integer);CREATE TABLE xero_v1.connection_preflight_evidence(id uuid,connection_id uuid,outcome text,phase text,reason text,tenant_visible boolean,checked_at timestamptz,credential_version integer);INSERT INTO public.store_memberships VALUES('${owner}','${store}');INSERT INTO xero_v1.connections VALUES('${connection}','${store}','${tenant}',NULL);INSERT INTO xero_v1.credential_envelopes VALUES('${connection}',2);INSERT INTO xero_v1.connection_preflight_evidence VALUES('90000000-0000-4000-8000-000000000005','${connection}','connected','organisation','ok',true,'2026-10-30T11:55:00Z',2);`);return db;}
test('actual SELECT binds store membership/current reader and rejects latest failure, retired or ambiguous source',async()=>{
 const db=await fixture();try{const source=createXeroReaderContextProofSource({authenticateContext:identity,query:(sql,args)=>db.query(sql,args),now});assert.equal((await source.read({ownerId:owner,storeId:store})).target,tenant);
 await db.exec("INSERT INTO xero_v1.connection_preflight_evidence VALUES('90000000-0000-4000-8000-000000000006','"+connection+"','failed','connection','reconnect_required',false,'2026-10-30T11:55:00Z',2)");await assert.rejects(source.read({ownerId:owner,storeId:store}));
 await db.exec("DELETE FROM xero_v1.connection_preflight_evidence WHERE outcome='failed';UPDATE xero_v1.credential_envelopes SET version=3");await assert.rejects(source.read({ownerId:owner,storeId:store}));
 await db.exec('UPDATE xero_v1.credential_envelopes SET version=2;DELETE FROM public.store_memberships');await assert.rejects(source.read({ownerId:owner,storeId:store}));
 }finally{await db.close();}
});

import {createXeroOwnerSessionBindingReader,isXeroOwnerSessionBindingReceipt} from './xero-reader-context-proof.mjs';
const bindingConfig={authUrl:'https://bioalckltvkhlczusdvl.supabase.co',publicKey:'sb_publishable_'+'a'.repeat(24),authenticateOwner:async()=>({userId:owner,isOwner:true}),now};
test('existing owner bearer reads only its exact active tenant via existing RLS, with no health inference',async()=>{
 const calls=[],reader=createXeroOwnerSessionBindingReader({...bindingConfig,fetchImpl:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify([{store_id:store,tenant_id:tenant}]));}});
 const r=await reader.read({authorization:'Bearer synthetic-owner-session',ownerId:owner,storeId:store});assert.equal(r.target,tenant);assert.equal(r.tenantBindingVerified,true);assert.equal(r.readerHealthVerified,false);assert.equal(r.connected,undefined);assert.equal(r.expiresAt,'2026-10-30T12:10:00.000Z');assert.equal(isXeroOwnerSessionBindingReceipt(r),true);assert.equal(isXeroOwnerSessionBindingReceipt({...r}),false);assert.doesNotMatch(JSON.stringify(r),/Bearer|synthetic-owner-session|publishable/);
 const u=new URL(calls[0].url);assert.equal(u.origin,bindingConfig.authUrl);assert.equal(u.pathname,'/rest/v1/connections');assert.equal(u.searchParams.get('select'),'store_id,tenant_id');assert.equal(u.searchParams.get('store_id'),'eq.'+store);assert.equal(u.searchParams.get('retired_at'),'is.null');assert.equal(u.searchParams.get('limit'),'2');assert.equal(calls[0].options.headers['Accept-Profile'],'xero_v1');assert.equal(calls[0].options.headers.Authorization,'Bearer synthetic-owner-session');assert.equal(calls[0].options.method,'GET');
});
test('owner RLS path fails closed for unexposed schema, denied/ambiguous/wrong-store or excess payload',async()=>{
 const cases=[async()=>new Response('{"code":"PGRST106"}',{status:406}),async()=>new Response('{}',{status:403}),async()=>new Response(JSON.stringify([])),async()=>new Response(JSON.stringify([{store_id:store,tenant_id:tenant},{store_id:store,tenant_id:owner}])),async()=>new Response(JSON.stringify([{store_id:tenant,tenant_id:tenant}])),async()=>new Response('x'.repeat(8193)),async()=>{throw Error('private service key must not leak');}];
 for(const fetchImpl of cases){const reader=createXeroOwnerSessionBindingReader({...bindingConfig,fetchImpl});await assert.rejects(reader.read({authorization:'Bearer synthetic-owner-session',ownerId:owner,storeId:store}),/^Error: Xero reader context proof unavailable$/);}
 let calls=0;const denied=createXeroOwnerSessionBindingReader({...bindingConfig,authenticateOwner:async()=>({userId:tenant,isOwner:true}),fetchImpl:async()=>{calls++;}});await assert.rejects(denied.read({authorization:'Bearer synthetic-owner-session',ownerId:owner,storeId:store}));assert.equal(calls,0);
 const privileged=['x',Buffer.from(JSON.stringify({role:'service_role',ref:'bioalckltvkhlczusdvl'})).toString('base64url'),'x'].join('.');assert.throws(()=>createXeroOwnerSessionBindingReader({...bindingConfig,publicKey:privileged}));
});

test('isolated Demo proof executes actual Demo SELECT and cannot use matching legacy rows',async()=>{
 const demo=XERO_DEMO_BINDING_STORE_ID,db=await fixture();
 try {
  await db.exec(`CREATE SCHEMA xero_demo_v1; CREATE TABLE xero_demo_v1.connections (LIKE xero_v1.connections); CREATE TABLE xero_demo_v1.credential_envelopes (LIKE xero_v1.credential_envelopes); CREATE TABLE xero_demo_v1.connection_preflight_evidence (LIKE xero_v1.connection_preflight_evidence); INSERT INTO public.store_memberships VALUES ('${owner}','${demo}'); INSERT INTO xero_v1.connections VALUES ('${connection}','${demo}','${tenant}',NULL);`);
  const auth=async()=>({ownerId:owner,storeId:demo,authenticated:true});let used;
  const source=createXeroReaderContextProofSource({readerSchema:'demo',authenticateContext:auth,query:(sql,args)=>{used=sql;return db.query(sql,args);},now});
  await assert.rejects(source.read({ownerId:owner,storeId:demo}));assert.equal(used,XERO_DEMO_READER_CONTEXT_SQL);
  await db.exec(`INSERT INTO xero_demo_v1.connections VALUES ('${connection}','${demo}','${tenant}',NULL); INSERT INTO xero_demo_v1.credential_envelopes VALUES ('${connection}',2); INSERT INTO xero_demo_v1.connection_preflight_evidence VALUES ('90000000-0000-4000-8000-000000000005','${connection}','connected','organisation','ok',true,'2026-10-30T11:55:00Z',2);`);
  const proof=await source.read({ownerId:owner,storeId:demo});assert.equal(proof.target,tenant);assert.equal(proof.provenance,'authenticated_demo_read_context_current_preflight_v1');
  await db.exec('UPDATE xero_demo_v1.credential_envelopes SET version=3');await assert.rejects(source.read({ownerId:owner,storeId:demo}));
  const legacy=createXeroReaderContextProofSource({authenticateContext:auth,query:()=>{throw Error('must not query');},now});await assert.rejects(legacy.read({ownerId:owner,storeId:demo}));
  const wrong=createXeroReaderContextProofSource({readerSchema:'demo',authenticateContext:identity,query:()=>{throw Error('must not query');},now});await assert.rejects(wrong.read({ownerId:owner,storeId:store}));
 } finally {await db.close();}
});
