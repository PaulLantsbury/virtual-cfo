import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup,sql,U} from '../shopify/finance-fixture.mjs';
import {harness,demoEnv,accounts,mapping,tenant} from './test-fixtures.mjs';
import {DEMO_STORE} from './reader-consent-runtime.mjs';
import {decryptDemoEnvelope} from '../../deployments/demo-staging/demo-envelope-crypto.mjs';
import {createXeroOwnerSessionBindingReader} from '../test-programme/xero-reader-context-proof.mjs';

test('fresh two-phase consent reaches actual isolated SQL, compatible crypto and member mapping binding',async()=>{
 const {db}=await setup();let h;
 const admin=()=>db.exec('SET SESSION AUTHORIZATION postgres; RESET ROLE');
 const at='2026-10-30T12:00:00.000Z';
 try{
  await db.exec(sql('proposals/shopify-intake-2026-09-17.sql'));
  await db.query('INSERT INTO public.store_memberships VALUES($1,$2)',[U,'56d92f8a-746e-4b4f-b408-81fc98c4aa17']);
  await db.exec('CREATE ROLE night_scout_import_login LOGIN NOINHERIT CONNECTION LIMIT 1 PASSWORD NULL');
  for(const name of ['20260918_apply_xero_staging.sql','20260918_grant_xero_worker_access.sql','20260918_grant_xero_bootstrap_access.sql','20260924_bind_xero_bootstrap_connection_id.sql','20260925_xero_single_refresh_job.sql','20261003_xero_connection_preflight_evidence.sql','20261003_xero_connection_preflight_job.sql'])await db.exec(sql('staging/'+name));
  // Disposable fixture clock only. No operational CLI/host/server time is changed.
  await db.exec(`CREATE FUNCTION public.demo_journey_clock() RETURNS timestamptz LANGUAGE sql STABLE AS $$SELECT '${at}'::timestamptz$$`);
  const proposed=readFileSync(new URL('../../db-migrations/proposals/xero-demo-isolation-2026-10-30.sql',import.meta.url),'utf8');
  const fixed=proposed.replaceAll('clock_timestamp()','public.demo_journey_clock()').replaceAll('transaction_timestamp()','public.demo_journey_clock()').replaceAll('now()','public.demo_journey_clock()').replaceAll('current_date',"(public.demo_journey_clock() AT TIME ZONE 'Europe/London')::date");
  await db.exec(fixed);
  async function memberRpc(name){
   await admin();await db.exec('BEGIN');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[U]);await db.exec('SET LOCAL ROLE authenticated');return (await db.query(`SELECT public.${name}($1) AS result`,[DEMO_STORE])).rows[0].result;}finally{await db.exec('ROLLBACK');}
  }
  h=harness({env:{NIGHT_SCOUT_DEMO_READER_OWNER_ID:U},claims:{sub:U},userId:U,startTime:at,
   fetch:async url=>url.endsWith('/rpc/xero_demo_reader_status_v1')?new Response(JSON.stringify(await memberRpc('xero_demo_reader_status_v1'))):undefined,
   query:async(statement,args)=>{if(statement==='BEGIN'){await admin();await db.exec('SET SESSION AUTHORIZATION night_scout_demo_bootstrap_login');}return db.query(statement,args);}
  });
  const started=await h.retainStart();
  const result=await h.runtime.service.complete({state:started.retainedState,code:'synthetic-fresh-retained-code'});
  assert.equal(result.state,'demo_reader_connected');assert.equal(result.storeId,DEMO_STORE);assert.equal(result.readerHealthVerified,false);assert.equal(result.generationEnabled,false);
  await admin();
  const envelope=(await db.query('SELECT * FROM xero_demo_v1.credential_envelopes WHERE connection_id=$1',[result.connectionId])).rows[0];
  const plain=decryptDemoEnvelope(demoEnv.NIGHT_SCOUT_DEMO_READER_ENVELOPE_MASTER_KEY,{connectionId:result.connectionId,tenantId:tenant,keyVersion:envelope.key_version,ciphertext:envelope.ciphertext,encryptedDek:envelope.encrypted_dek});
  assert.equal(plain.toString('utf8'),'synthetic-demo-refresh-token-2');plain.fill(0);
  const status=await memberRpc('xero_demo_reader_status_v1');assert.equal(status.bindingState,'active');assert.equal(status.mappingState,'current');assert.equal(status.mappingEffectiveFrom,'2026-10-01');assert.deepEqual(status.revenueAccountIds,[accounts[0].AccountID]);assert.equal(status.latestSupportedPeriod,null);
  const reader=createXeroOwnerSessionBindingReader({authUrl:demoEnv.NIGHT_SCOUT_REVIEW_AUTH_URL,publicKey:demoEnv.NIGHT_SCOUT_REVIEW_PUBLIC_KEY,authenticateOwner:async()=>({userId:U,isOwner:true}),bindingTransport:'demo-public-binding-rpc-v1',selectedRevenueAccountId:mapping.revenue[0],now:()=>new Date(at),fetchImpl:async url=>{
   if(url.endsWith('xero_demo_reader_status_v1'))return new Response(JSON.stringify(await memberRpc('xero_demo_reader_status_v1')));
   assert.ok(url.endsWith('xero_demo_member_active_tenant_binding_v1'));
   await admin();await db.exec('BEGIN');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[U]);await db.exec('SET LOCAL ROLE authenticated');return new Response(JSON.stringify((await db.query('SELECT * FROM public.xero_demo_member_active_tenant_binding_v1($1)',[DEMO_STORE])).rows));}finally{await db.exec('ROLLBACK');}
  }});
  const binding=await reader.read({authorization:'Bearer synthetic-owner-session',ownerId:U,storeId:DEMO_STORE});assert.equal(binding.target,tenant);assert.equal(binding.revenueAccountBindingVerified,true);assert.equal(binding.readerHealthVerified,false);
  await admin();assert.equal((await db.query('SELECT count(*)::int n FROM xero_v1.connections')).rows[0].n,0);assert.equal((await db.query('SELECT count(*)::int n FROM xero_demo_v1.accounting_evidence')).rows[0].n,0);
 }finally{await h?.runtime.close();await admin();await db.close();}
});
