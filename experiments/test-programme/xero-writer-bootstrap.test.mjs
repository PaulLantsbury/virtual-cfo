import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';
import {activationInstallerSql} from './prepare-activation-installer.mjs';import {createXeroWriterBootstrap} from './xero-writer-bootstrap.mjs';
const owner='90000000-0000-4000-8000-000000000001',store='90000000-0000-4000-8000-000000000002',tenant='90000000-0000-4000-8000-000000000003';
async function setup(){const db=new PGlite();await db.exec(`CREATE TABLE public.store_memberships(user_id uuid,store_id uuid);INSERT INTO public.store_memberships VALUES('${owner}','${store}');`);await db.exec(activationInstallerSql());return db;}
function service(db,extra={}){
 return createXeroWriterBootstrap({enabled:true,projectRef:'bioalckltvkhlczusdvl',ownerId:owner,storeId:store,clientId:'test-writer-id',clientSecret:'synthetic-private-secret',redirectUri:'https://night-scout-xero-staging.onrender.com/api/xero/test-writer/callback',masterKey:'synthetic-master-key-for-writer-32bytes',keyVersion:'writer-v1',pool:db,authenticate:async()=>({userId:owner,isOwner:true}),fetchImpl:async url=>new Response(JSON.stringify(url.endsWith('/token')?{access_token:'synthetic-access-token',refresh_token:'synthetic-refresh-token',scope:'offline_access accounting.invoices accounting.settings.read accounting.contacts.read'}:url.endsWith('/connections')?[{tenantId:tenant,tenantType:'ORGANISATION'}]:{Organisations:[{IsDemoCompany:true,BaseCurrency:'GBP'}]})),...extra});
}
test('owner-member one-time bootstrap seeds isolated encrypted writer and disabled exact demo programme',async()=>{
 const db=await setup();try{
  const s=service(db),start=await s.start('Bearer synthetic-token'),url=new URL(start.url),state=url.searchParams.get('state');
  assert.equal(url.searchParams.get('scope'),'offline_access accounting.invoices accounting.settings.read accounting.contacts.read');
  const result=await s.complete({state,code:'synthetic-code'});assert.deepEqual(result,{state:'writer_connected_programme_disabled'});
  const p=(await db.query('SELECT target,enabled,action_cap FROM staging_test_programme.programmes')).rows[0];assert.equal(p.target,tenant);assert.equal(p.enabled,false);assert.equal(p.action_cap,6);
  const e=(await db.query('SELECT ciphertext,encrypted_dek,version FROM staging_test_programme.writer_envelopes')).rows[0];assert.equal(e.version,1);assert.notEqual(Buffer.from(e.ciphertext).toString(),'synthetic-refresh-token');
  await assert.rejects(s.complete({state,code:'synthetic-code'}));await assert.rejects(s.start('Bearer synthetic-token'));
 }finally{await db.close();}
});
test('wrong owner, removed membership, non-demo and unexpected scopes cannot seed writer',async()=>{
 const db=await setup();try{
  await assert.rejects(service(db,{authenticate:async()=>({userId:tenant,isOwner:true})}).start('Bearer synthetic-token'));
  const s=service(db,{fetchImpl:async url=>new Response(JSON.stringify(url.endsWith('/token')?{access_token:'synthetic-access-token',refresh_token:'synthetic-refresh-token',scope:'offline_access accounting.invoices accounting.settings.read'}:url.endsWith('/connections')?[{tenantId:tenant,tenantType:'ORGANISATION'}]:{Organisations:[{IsDemoCompany:false,BaseCurrency:'GBP'}]}))});
  const state=new URL((await s.start('Bearer synthetic-token')).url).searchParams.get('state');await assert.rejects(s.complete({state,code:'synthetic-code'}));
  assert.equal((await db.query('SELECT count(*) AS n FROM staging_test_programme.writer_envelopes')).rows[0].n,0);
  const broad=service(db,{fetchImpl:async()=>new Response(JSON.stringify({access_token:'synthetic-access-token',refresh_token:'synthetic-refresh-token',scope:'offline_access accounting.transactions'}))}),state3=new URL((await broad.start('Bearer synthetic-token')).url).searchParams.get('state');await assert.rejects(broad.complete({state:state3,code:'synthetic-code'}));
  const original=service(db),state2=new URL((await original.start('Bearer synthetic-token')).url).searchParams.get('state');await db.exec('DELETE FROM public.store_memberships');await assert.rejects(original.complete({state:state2,code:'synthetic-code'}));
 }finally{await db.close();}
});
