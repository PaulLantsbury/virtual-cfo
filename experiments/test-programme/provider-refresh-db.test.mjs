import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {encryptStagingEnvelope,decryptStagingEnvelope} from '../../deployments/nightly-staging/xero-refresh-runtime.mjs';
import {withRefreshedXeroWriter} from './xero-writer-refresh.mjs';
import {createRpcLedger} from './provider-rpc-ledger.mjs';
const target='90000000-0000-4000-8000-000000000002',connection='90000000-0000-4000-8000-000000000003',master='synthetic-writer-master-key-only-32bytes',old='synthetic-original-refresh-token',fresh='synthetic-rotated-refresh-token';
async function setup(){
 const db=new PGlite();
 await db.exec(readFileSync(new URL('./provider-ledger-proposal.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('./provider-access-proposal.sql',import.meta.url),'utf8'));
 await db.query("INSERT INTO staging_test_programme.programmes VALUES('x','xero','bioalckltvkhlczusdvl',$1,now()-interval '1 hour',now()+interval '1 day',6,true,false)",[target]);
 const envelope=encryptStagingEnvelope(master,{connectionId:connection,tenantId:target,keyVersion:'writer-v1'},old);
 await db.query("INSERT INTO staging_test_programme.writer_envelopes(programme_key,connection_id,tenant_id,ciphertext,encrypted_dek,key_version,algorithm,version) VALUES('x',$1,$2,$3,$4,'writer-v1','AES-256-GCM',1)",[connection,target,envelope.ciphertext,envelope.encryptedDek]);
 return db;
}
test('separate writer refresh rotates encrypted credential before use; exact lease cannot replay',async()=>{
 const db=await setup();
 try{
  let consumed=false;
  const result=await withRefreshedXeroWriter({pool:db,programmeKey:'x',target,masterKey:master,keyVersion:'writer-v1',clientId:'synthetic-id',clientSecret:'synthetic-secret',
   fetchImpl:async(url,opts)=>{assert.equal(url,'https://identity.xero.com/connect/token');assert.equal(opts.redirect,'error');return new Response(JSON.stringify({access_token:'synthetic-access-token',refresh_token:fresh,scope:'offline_access accounting.invoices accounting.settings.read'}));},
   consume:async token=>{consumed=true;assert.equal(token,'synthetic-access-token');const r=(await db.query('SELECT * FROM staging_test_programme.writer_envelopes')).rows[0];assert.equal(r.version,2);return 'consumed';}});
  assert.equal(result,'consumed');assert.equal(consumed,true);
  const r=(await db.query('SELECT * FROM staging_test_programme.writer_envelopes')).rows[0];
  const plain=decryptStagingEnvelope(master,{connectionId:connection,tenantId:target,keyVersion:'writer-v1',ciphertext:Buffer.from(r.ciphertext),encryptedDek:Buffer.from(r.encrypted_dek)});assert.equal(plain.toString(),fresh);plain.fill(0);
  await db.exec('SET ROLE night_scout_test_writer_service');
  await assert.rejects(db.query('SELECT * FROM staging_test_programme.writer_envelopes'));
  const ledger=createRpcLedger({pool:db,programmeKey:'x'}),input={key:`ns-${'a'.repeat(40)}`,payloadDigest:'a'.repeat(64),provider:'xero',target,cap:6};
  assert.equal((await ledger.claim(input)).state,'claimed');
  assert.equal((await ledger.claim(input)).state,'existing');
  await ledger.markSubmitted(input.key);await ledger.confirm(input.key,'source-id');
  await assert.rejects(ledger.confirm(input.key,'source-id'));
  await db.exec('RESET ROLE');
 }finally{await db.close();}
});
test('uncertain refresh stops programme, keeps encrypted claim, never consumes or retries',async()=>{
 const db=await setup();try{
  let calls=0;
  const options={pool:db,programmeKey:'x',target,masterKey:master,keyVersion:'writer-v1',clientId:'synthetic-id',clientSecret:'synthetic-secret',fetchImpl:async()=>{calls++;throw new Error('raw-secret');},consume:async()=>assert.fail('must not consume')};
  await assert.rejects(withRefreshedXeroWriter(options),{message:'XERO_TEST_WRITER_UNAVAILABLE'});
  await assert.rejects(withRefreshedXeroWriter(options),{message:'XERO_TEST_WRITER_UNAVAILABLE'});assert.equal(calls,1);
  const p=(await db.query('SELECT stopped FROM staging_test_programme.programmes')).rows[0];assert.equal(p.stopped,true);
  const r=(await db.query('SELECT refresh_claim,version FROM staging_test_programme.writer_envelopes')).rows[0];assert.ok(r.refresh_claim);assert.equal(r.version,1);
 }finally{await db.close();}
});
test('unexpected writer scope saves rotation then stops without provider writes',async()=>{
 const db=await setup();try{
  await assert.rejects(withRefreshedXeroWriter({pool:db,programmeKey:'x',target,masterKey:master,keyVersion:'writer-v1',clientId:'synthetic-id',clientSecret:'synthetic-secret',fetchImpl:async()=>new Response(JSON.stringify({access_token:'synthetic-access-token',refresh_token:fresh,scope:'offline_access accounting.transactions'})),consume:async()=>assert.fail('must not consume')}));
  assert.equal((await db.query('SELECT version FROM staging_test_programme.writer_envelopes')).rows[0].version,2);
  assert.equal((await db.query('SELECT stopped FROM staging_test_programme.programmes')).rows[0].stopped,true);
 }finally{await db.close();}
});
