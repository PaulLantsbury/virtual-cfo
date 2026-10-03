import test from 'node:test';
import assert from 'node:assert/strict';
import {createStagingXeroConnectionPreflight} from './xero-connection-preflight.mjs';
import {encryptStagingEnvelope,hasRequiredXeroScopes} from './xero-refresh-runtime.mjs';

const connectionId='11111111-1111-4111-8111-111111111111',mappingVersionId='22222222-2222-4222-8222-222222222222',tenantId='33333333-3333-4333-8333-333333333333',keyVersion='staging-v1';
const scopes='openid profile email accounting.settings.read accounting.reports.profitandloss.read accounting.reports.balancesheet.read accounting.reports.trialbalance.read accounting.reports.banksummary.read offline_access';
const env=Object.freeze({NIGHT_SCOUT_RUNTIME_ENV:'staging',NIGHT_SCOUT_XERO_STAGING_REFRESH_ENABLED:'true',NIGHT_SCOUT_XERO_STAGING_PROJECT_REF:'bioalckltvkhlczusdvl',NIGHT_SCOUT_XERO_REPORT_FROM:'2026-09-01',NIGHT_SCOUT_XERO_REPORT_TO:'2026-09-25',NIGHT_SCOUT_XERO_CURRENCY:'GBP',NIGHT_SCOUT_INTAKE_DATABASE_URL:'postgresql://night_scout_import_login:password@db.bioalckltvkhlczusdvl.supabase.co:5432/postgres',NIGHT_SCOUT_STAGING_CA_PEM:`-----BEGIN CERTIFICATE-----\n${'A'.repeat(120)}\n-----END CERTIFICATE-----`,NIGHT_SCOUT_XERO_CLIENT_ID:'12345678-1234-1234-1234-123456789abc',NIGHT_SCOUT_XERO_CLIENT_SECRET:'x'.repeat(32),NIGHT_SCOUT_XERO_ENVELOPE_MASTER_KEY:'m'.repeat(43),NIGHT_SCOUT_XERO_ENVELOPE_KEY_VERSION:keyVersion});

function harness({connections=new Response(JSON.stringify([{tenantId}]),{status:200}),organisation=new Response(JSON.stringify({Organisations:[{}]}),{status:200}),released=true}={}){
 const envelope=encryptStagingEnvelope(env.NIGHT_SCOUT_XERO_ENVELOPE_MASTER_KEY,{connectionId,tenantId,keyVersion},'refresh-token-that-is-long-enough'),calls=[];
 const lease=new Date(Date.now()+120_000).toISOString();
 const query=async(sql,params)=>{calls.push({sql,params});if(sql.includes('worker_get_single_connection_preflight_job'))return {rows:[{connection_id:connectionId,mapping_version_id:mappingVersionId}]};if(sql.includes('worker_get_refresh_context'))return {rows:[{connection_id:connectionId,tenant_id:tenantId,mapping_version_id:mappingVersionId,ciphertext:envelope.ciphertext,encrypted_dek:envelope.encryptedDek,key_version:keyVersion,algorithm:'AES-256-GCM',version:4,lease_expires_at:null}]};if(sql.includes('worker_acquire_refresh_lease'))return {rows:[{lease_expires_at:lease}]};if(sql.includes('worker_store_refresh_envelope_leased'))return {rows:[{rotated:true}]};if(sql.includes('worker_record_connection_preflight'))return {rows:[{recorded:true}]};if(sql.includes('worker_release_refresh_lease'))return {rows:[{released}]};throw Error('unexpected SQL');};
 const fetchImpl=async url=>{if(String(url)==='https://identity.xero.com/connect/token')return new Response(JSON.stringify({access_token:'access-token-that-is-long-enough',refresh_token:'next-refresh-token-that-is-long-enough',scope:scopes}),{status:200});if(String(url)==='https://api.xero.com/connections')return connections;if(String(url).endsWith('/Organisation'))return organisation;throw Error('unexpected URL');};
 return {calls,query,fetchImpl,lease};
}

test('connection preflight rotates under an exact lease, proves capability, persists a safe receipt, and never consumes accounting evidence',async()=>{
 const h=harness(),out=await createStagingXeroConnectionPreflight({env,query:h.query,fetchImpl:h.fetchImpl})();
 assert.deepEqual(out,{event:'xero_connection_preflight',state:'connected',phase:'organisation',reason:'ok'});
 const sql=h.calls.map(call=>call.sql).join('\n');assert.doesNotMatch(sql,/worker_get_single_refresh_job|accounting_evidence|retry_author/i);
 assert.match(sql,/worker_get_single_connection_preflight_job/);assert.match(sql,/worker_get_refresh_context/);assert.match(sql,/worker_store_refresh_envelope_leased/);assert.match(sql,/worker_record_connection_preflight/);assert.match(sql,/worker_release_refresh_lease/);
 const receipt=h.calls.find(call=>call.sql.includes('worker_record_connection_preflight'));
 assert.deepEqual(receipt.params,[connectionId,5,'connected','organisation','ok',null,true,h.lease]);
 const release=h.calls.find(call=>call.sql.includes('worker_release_refresh_lease'));assert.deepEqual(release.params,[connectionId,5,h.lease]);
 assert.doesNotMatch(JSON.stringify(out),new RegExp(`${connectionId}|${tenantId}|access-token|refresh-token`));
});

for(const [status,reason] of [[401,'unauthorized'],[403,'forbidden'],[429,'rate_limited'],[503,'upstream_unavailable']])test(`connections HTTP ${status} is ${reason} without a success receipt`,async()=>{
 const h=harness({connections:new Response('provider-private-body',{status})}),out=await createStagingXeroConnectionPreflight({env,query:h.query,fetchImpl:h.fetchImpl})();
 assert.deepEqual(out,{event:'xero_connection_preflight',state:'failed',phase:'connection',reason});
 assert.equal(h.calls.some(call=>call.sql.includes('worker_record_connection_preflight')),false);
 assert.doesNotMatch(JSON.stringify(out),/provider-private-body/);
});

test('only an absent pinned tenant means reconnect required',async()=>{
 const h=harness({connections:new Response(JSON.stringify([{tenantId:'44444444-4444-4444-8444-444444444444'}]),{status:200})}),out=await createStagingXeroConnectionPreflight({env,query:h.query,fetchImpl:h.fetchImpl})();
 assert.deepEqual(out,{event:'xero_connection_preflight',state:'failed',phase:'connection',reason:'reconnect_required'});
 assert.equal(h.calls.some(call=>call.sql.includes('worker_record_connection_preflight')),false);
});

test('connection transport failures remain a bounded network diagnostic',async()=>{
 const h=harness();
 const fetchImpl=async url=>String(url)==='https://api.xero.com/connections'?Promise.reject(Error('private network detail')):h.fetchImpl(url);
 const out=await createStagingXeroConnectionPreflight({env,query:h.query,fetchImpl})();
 assert.deepEqual(out,{event:'xero_connection_preflight',state:'failed',phase:'connection',reason:'network_failure'});
 assert.doesNotMatch(JSON.stringify(out),/private network detail/);
 assert.equal(h.calls.some(call=>call.sql.includes('worker_record_connection_preflight')),false);
});

test('organisation capability is independently classified and cannot create a success receipt',async()=>{
 const h=harness({organisation:new Response('private',{status:403})}),out=await createStagingXeroConnectionPreflight({env,query:h.query,fetchImpl:h.fetchImpl})();
 assert.deepEqual(out,{event:'xero_connection_preflight',state:'failed',phase:'organisation',reason:'forbidden'});
 assert.equal(h.calls.some(call=>call.sql.includes('worker_record_connection_preflight')),false);
});

test('a false exact-lease release prevents a connected receipt from being reported to the operator',async()=>{
 const h=harness({released:false});await assert.rejects(createStagingXeroConnectionPreflight({env,query:h.query,fetchImpl:h.fetchImpl})(),/unavailable/);
});

test('scope validation accepts only the canonical retained read-only allowlist',()=>{
 assert.equal(hasRequiredXeroScopes(scopes),true);
 for(const raw of [`${scopes} accounting.transactions.read`,`${scopes} accounting.settings`,`${scopes} offline_access`,scopes.replace('accounting.settings.read','')])assert.equal(hasRequiredXeroScopes(raw),false);
});

test('oversized connection bodies fail safely without parsing or persistence',async()=>{
 const h=harness({connections:new Response(JSON.stringify([{tenantId,padding:'x'.repeat(70_000)}]),{status:200})}),out=await createStagingXeroConnectionPreflight({env,query:h.query,fetchImpl:h.fetchImpl})();
 assert.deepEqual(out,{event:'xero_connection_preflight',state:'failed',phase:'connection',reason:'malformed_response'});
 assert.equal(h.calls.some(call=>call.sql.includes('worker_record_connection_preflight')),false);
});

test('database discovery must return two opaque UUIDs before context is read',async()=>{
 const h=harness();
 const query=async(sql,params)=>sql.includes('worker_get_single_connection_preflight_job')
  ?{rows:[{connection_id:'not-a-uuid',mapping_version_id:mappingVersionId}]}
  :h.query(sql,params);
 await assert.rejects(createStagingXeroConnectionPreflight({env,query,fetchImpl:h.fetchImpl})(),/unavailable/);
 assert.equal(h.calls.some(call=>call.sql.includes('worker_get_refresh_context')),false);
});
