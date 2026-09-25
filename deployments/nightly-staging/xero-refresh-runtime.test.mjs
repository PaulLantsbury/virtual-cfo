import test from 'node:test';
import assert from 'node:assert/strict';
import {createStagingXeroRefreshJob,decryptStagingEnvelope,encryptStagingEnvelope} from './xero-refresh-runtime.mjs';

const binding={connectionId:'11111111-1111-4111-8111-111111111111',tenantId:'tenant-test',keyVersion:'staging-v1'};
test('AES-GCM envelope completes encryption before reading its authentication tag',()=>{
 const envelope=encryptStagingEnvelope('m'.repeat(43),binding,'refresh-token-that-is-long-enough');
 assert.equal(decryptStagingEnvelope('m'.repeat(43),{...binding,...envelope}).toString('utf8'),'refresh-token-that-is-long-enough');
});
test('AES-GCM envelope is bound to connection, tenant, key version and master material',()=>{
 const envelope=encryptStagingEnvelope('m'.repeat(43),binding,'refresh-token-that-is-long-enough');
 for(const changed of [{...binding,connectionId:'other'},{...binding,tenantId:'other'},{...binding,keyVersion:'other'}])assert.throws(()=>decryptStagingEnvelope('m'.repeat(43),{...changed,...envelope}),/unavailable/);
 assert.throws(()=>decryptStagingEnvelope('n'.repeat(43),{...binding,...envelope}),/unavailable/);
 const tampered=Buffer.from(envelope.ciphertext);tampered[tampered.length-1]^=1;
 assert.throws(()=>decryptStagingEnvelope('m'.repeat(43),{...binding,...envelope,ciphertext:tampered}),/unavailable/);
});

const mapping={revenue:['sales'],processingFee:['fees'],advertising:['ads'],software:['software'],includedCash:['cash']};
const env=Object.freeze({NIGHT_SCOUT_RUNTIME_ENV:'staging',NIGHT_SCOUT_XERO_STAGING_REFRESH_ENABLED:'true',NIGHT_SCOUT_XERO_STAGING_PROJECT_REF:'bioalckltvkhlczusdvl',NIGHT_SCOUT_XERO_STAGING_CONNECTION_ID:binding.connectionId,NIGHT_SCOUT_XERO_STAGING_MAPPING_VERSION_ID:'22222222-2222-4222-8222-222222222222',NIGHT_SCOUT_XERO_REPORT_FROM:'2026-09-01',NIGHT_SCOUT_XERO_REPORT_TO:'2026-09-18',NIGHT_SCOUT_XERO_CURRENCY:'GBP',NIGHT_SCOUT_INTAKE_DATABASE_URL:'postgresql://night_scout_import_login:password@db.bioalckltvkhlczusdvl.supabase.co:5432/postgres',NIGHT_SCOUT_STAGING_CA_PEM:`-----BEGIN CERTIFICATE-----\n${'A'.repeat(120)}\n-----END CERTIFICATE-----`,NIGHT_SCOUT_XERO_CLIENT_ID:'12345678-1234-1234-1234-123456789abc',NIGHT_SCOUT_XERO_CLIENT_SECRET:'x'.repeat(32),NIGHT_SCOUT_XERO_ENVELOPE_MASTER_KEY:'m'.repeat(43),NIGHT_SCOUT_XERO_ENVELOPE_KEY_VERSION:binding.keyVersion,NIGHT_SCOUT_XERO_STAGING_MAPPING_JSON:JSON.stringify(mapping)});
function harness({contextMapping=mapping,keyVersion=binding.keyVersion,leaseExpiresAt=null,acquire=true,latest=[]}={}){
 const envelope=encryptStagingEnvelope(env.NIGHT_SCOUT_XERO_ENVELOPE_MASTER_KEY,binding,'refresh-token-that-is-long-enough'),calls=[];
 const leaseToken=new Date(Date.now()+120_000);
 const query=async(sql,params)=>{calls.push({sql,params});if(sql.includes('worker_get_single_refresh_job'))return {rows:[{connection_id:binding.connectionId,mapping_version_id:env.NIGHT_SCOUT_XERO_STAGING_MAPPING_VERSION_ID}]};if(sql.includes('worker_get_refresh_context'))return {rows:[{connection_id:binding.connectionId,tenant_id:binding.tenantId,mapping_version_id:env.NIGHT_SCOUT_XERO_STAGING_MAPPING_VERSION_ID,mapping:contextMapping,ciphertext:envelope.ciphertext,encrypted_dek:envelope.encryptedDek,key_version:keyVersion,algorithm:'AES-256-GCM',version:1,lease_expires_at:leaseExpiresAt}]};if(sql.includes('worker_acquire_refresh_lease'))return {rows:[{lease_expires_at:acquire?leaseToken:null}]};if(sql.includes('worker_release_refresh_lease'))return {rows:[{released:true}]};if(sql.includes('worker_store_refresh_envelope_leased'))return {rows:[{rotated:true}]};if(sql.includes('worker_record_accounting_evidence_leased'))return {rows:[{evidence_id:'33333333-3333-4333-8333-333333333333'}]};if(sql.includes('worker_get_latest_supported_evidence'))return {rows:latest};return {rows:[{}]};};
 return {calls,query};
}
const invalidGrant=async url=>{assert.equal(url,'https://identity.xero.com/connect/token');return {ok:false,status:400};};
test('requires the persisted mapping and key version and does not contact Xero on mismatch',async()=>{
 for(const options of [{contextMapping:{...mapping,revenue:[]}},{keyVersion:'other'},{leaseExpiresAt:new Date(Date.now()+60_000)}]){const h=harness(options),job=createStagingXeroRefreshJob({env,query:h.query,fetchImpl:()=>{throw Error('must not fetch')}});await assert.rejects(job(),/invalid/);assert.equal(h.calls.length,2);}
});
test('does no refresh, audit, evidence or stale work when the atomic lease is denied',async()=>{
 const h=harness({acquire:false,latest:[{source_fingerprint:'a'.repeat(64)}]}),job=createStagingXeroRefreshJob({env,query:h.query,fetchImpl:()=>{throw Error('must not fetch')}});
 await assert.rejects(job(),/invalid/);assert.equal(h.calls.filter(call=>/refresh_failure|accounting_evidence|latest_supported/.test(call.sql)).length,0);assert.equal(h.calls.some(call=>call.sql.includes('worker_release_refresh_lease')),false);
});
test('audits invalid grants safely and records a value-free failed refresh under the pre-rotation fence',async()=>{
 const h=harness(),result=await createStagingXeroRefreshJob({env,query:h.query,fetchImpl:invalidGrant,now:()=> '2026-09-19T02:00:00.000Z'})();
 assert.equal(result.state,'failed');assert.equal(h.calls.filter(call=>call.sql.includes('worker_record_credential_refresh_failure')).length,1);assert.ok(h.calls.filter(call=>call.sql.includes('worker_record_credential_refresh_failure')).every(call=>call.params[1]==='invalid_grant'));
 const evidence=h.calls.find(call=>call.sql.includes('worker_record_accounting_evidence_leased'));assert.equal(evidence.params[6],'failed');assert.equal(evidence.params[7],'source_refresh_failed');assert.ok(evidence.params.slice(10,16).every(value=>value===null));assert.equal(evidence.params[16],1);
 assert.equal(h.calls.filter(call=>call.sql.includes('worker_release_refresh_lease')).length,0);
});
test('returns stale only for exact persisted supported evidence after refresh failure',async()=>{
 const prior={report_as_of:'2026-09-18',source_fingerprint:'a'.repeat(64),booked_revenue_minor:'100',processing_fee_minor:'-2',advertising_minor:'-3',software_minor:'-4',included_cash_minor:'91'};
 const h=harness({latest:[prior]}),result=await createStagingXeroRefreshJob({env,query:h.query,fetchImpl:invalidGrant,now:()=> '2026-09-19T02:00:00.000Z'})();
 assert.equal(result.state,'stale');assert.equal(result.scope.to,'2026-09-18');assert.equal(h.calls.filter(call=>call.sql.includes('worker_release_refresh_lease')).length,0);
});
test('a fenced rotation retains ownership through terminal evidence and report failure cannot refresh twice',async()=>{
 const h=harness();let tokenCalls=0;
 const fetchImpl=async url=>{if(url==='https://identity.xero.com/connect/token'){tokenCalls+=1;return {ok:true,json:async()=>({access_token:'access-token-that-is-long-enough',refresh_token:'next-refresh-token-that-is-long-enough'})};}throw Error('report unavailable');};
 const result=await createStagingXeroRefreshJob({env,query:h.query,fetchImpl,now:()=> '2026-09-19T02:00:00.000Z'})();
 assert.equal(result.state,'failed');assert.equal(tokenCalls,1);assert.equal(h.calls.filter(call=>call.sql.includes('worker_store_refresh_envelope_leased')).length,1);const evidence=h.calls.find(call=>call.sql.includes('worker_record_accounting_evidence_leased'));assert.equal(evidence.params[16],2);assert.equal(h.calls.filter(call=>call.sql.includes('worker_release_refresh_lease')).length,0);
});
