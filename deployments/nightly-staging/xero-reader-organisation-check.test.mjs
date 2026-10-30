import test from 'node:test';import assert from 'node:assert/strict';
import {createStagingXeroReaderOrganisationCheck} from './xero-reader-organisation-check.mjs';
import {encryptStagingEnvelope} from './xero-refresh-runtime.mjs';
const connectionId='11111111-1111-4111-8111-111111111111',mappingVersionId='22222222-2222-4222-8222-222222222222',tenantId='33333333-3333-4333-8333-333333333333',keyVersion='staging-v1';
const scopes='openid profile email accounting.settings.read accounting.reports.profitandloss.read accounting.reports.balancesheet.read accounting.reports.trialbalance.read accounting.reports.banksummary.read offline_access';
const env={NIGHT_SCOUT_RUNTIME_ENV:'staging',NIGHT_SCOUT_XERO_STAGING_REFRESH_ENABLED:'true',NIGHT_SCOUT_XERO_STAGING_PROJECT_REF:'bioalckltvkhlczusdvl',NIGHT_SCOUT_XERO_REPORT_FROM:'2026-09-01',NIGHT_SCOUT_XERO_REPORT_TO:'2026-09-25',NIGHT_SCOUT_XERO_CURRENCY:'GBP',NIGHT_SCOUT_INTAKE_DATABASE_URL:'postgresql://night_scout_import_login:synthetic-password@db.bioalckltvkhlczusdvl.supabase.co:5432/postgres',NIGHT_SCOUT_STAGING_CA_PEM:`-----BEGIN CERTIFICATE-----\n${'A'.repeat(120)}\n-----END CERTIFICATE-----`,NIGHT_SCOUT_XERO_CLIENT_ID:'12345678-1234-1234-1234-123456789abc',NIGHT_SCOUT_XERO_CLIENT_SECRET:'synthetic-secret-material-at-least-32-bytes',NIGHT_SCOUT_XERO_ENVELOPE_MASTER_KEY:'m'.repeat(43),NIGHT_SCOUT_XERO_ENVELOPE_KEY_VERSION:keyVersion};
const response=organisation=>new Response(JSON.stringify({Organisations:[organisation]}));
function harness({organisation=response({IsDemoCompany:true,BaseCurrency:'GBP',Name:'PRIVATE NAME',OrganisationID:'PRIVATE ID',EmailAddress:'PRIVATE EMAIL'}),connections=new Response(JSON.stringify([{tenantId}])),released=true}={}){
 const envelope=encryptStagingEnvelope(env.NIGHT_SCOUT_XERO_ENVELOPE_MASTER_KEY,{connectionId,tenantId,keyVersion},'synthetic-refresh-token-at-least-16'),sql=[],http=[];
 const lease=new Date(Date.now()+120000).toISOString();
 const query=async(q,params)=>{sql.push({q,params});
  if(q.includes('worker_get_single_connection_preflight_job'))return {rows:[{connection_id:connectionId,mapping_version_id:mappingVersionId}]};
  if(q.includes('worker_get_refresh_context'))return {rows:[{connection_id:connectionId,mapping_version_id:mappingVersionId,tenant_id:tenantId,key_version:keyVersion,algorithm:'AES-256-GCM',version:4,ciphertext:envelope.ciphertext,encrypted_dek:envelope.encryptedDek,lease_expires_at:null}]};
  if(q.includes('worker_acquire_refresh_lease'))return {rows:[{lease_expires_at:lease}]};
  if(q.includes('worker_store_refresh_envelope_leased'))return {rows:[{rotated:true}]};
  if(q.includes('worker_record_connection_preflight'))return {rows:[{recorded:true}]};
  if(q.includes('worker_release_refresh_lease'))return {rows:[{released}]};
  throw Error('private database URI/token must never appear');
 };
 const fetchImpl=async(url,options)=>{http.push({url:String(url),options});
  if(String(url)==='https://identity.xero.com/connect/token')return new Response(JSON.stringify({access_token:'synthetic-private-access-token',refresh_token:'synthetic-private-refreshed-token',scope:scopes}));
  if(String(url)==='https://api.xero.com/connections')return connections;
  if(String(url)==='https://api.xero.com/api.xro/2.0/Organisation')return organisation;
  throw Error('private unexpected provider URL');
 };
 return {sql,http,query,fetchImpl,run:options=>createStagingXeroReaderOrganisationCheck({env,query,fetchImpl,...options})()};
}

test('actual API demo flag/currency are returned without organisation identity or extra calls; usual preflight writes remain',async()=>{
 const h=harness(),result=await h.run();
 assert.equal(result.organisationVerified,true);assert.equal(result.isDemoCompany,true);assert.equal(result.currency,'GBP');assert.equal(result.readOnlySourceCheck,true);assert.equal(result.readerCredentialRotationMayWrite,true);assert.equal(result.accountingCollectionAttempted,false);
 assert.deepEqual(result.readerPreflight,{state:'connected',phase:'organisation',reason:'ok'});
 assert.deepEqual(h.http.map(x=>x.url),['https://identity.xero.com/connect/token','https://api.xero.com/connections','https://api.xero.com/api.xro/2.0/Organisation']);
 assert.equal(h.http[2].options.method,'GET');assert.equal(h.http.every(x=>x.options.redirect==='error'&&x.options.signal instanceof AbortSignal),true);
 assert.ok(h.sql.some(x=>x.q.includes('worker_store_refresh_envelope_leased')));assert.ok(h.sql.some(x=>x.q.includes('worker_record_connection_preflight')));assert.ok(h.sql.some(x=>x.q.includes('worker_release_refresh_lease')));
 assert.doesNotMatch(h.sql.map(x=>x.q).join(' '),/accounting_evidence|worker_get_single_refresh_job|retry_author/);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE|synthetic-private|33333333|11111111|password|ciphertext|Name|Email/);
});
test('false demo flag is a genuine non-demo fact; other valid ISO currency remains safe and explicit',async()=>{
 const h=harness({organisation:response({IsDemoCompany:false,BaseCurrency:'USD',Name:'Demo Company'})}),r=await h.run();
 assert.equal(r.organisationVerified,true);assert.equal(r.isDemoCompany,false);assert.equal(r.currency,'USD');
});
test('missing or nonboolean demo/currency leaves facts unavailable while normal connection preflight can still pass',async()=>{
 for(const data of [{BaseCurrency:'GBP'},{IsDemoCompany:'true',BaseCurrency:'GBP'},{IsDemoCompany:true},{IsDemoCompany:true,BaseCurrency:'private currency'},{IsDemoCompany:true,BaseCurrency:'AAA'}]){
  const h=harness({organisation:response(data)}),r=await h.run();assert.equal(r.organisationVerified,false);assert.equal(r.isDemoCompany,null);assert.equal(r.currency,null);assert.equal(r.readerPreflight.state,'connected');
 }
});
test('ambiguous/malformed/oversized organisation and unsuccessful preflight cannot produce demo confirmation',async()=>{
 for(const organisation of [new Response(JSON.stringify({Organisations:[{IsDemoCompany:true,BaseCurrency:'GBP'},{}]})),new Response('private malformed body'),new Response(JSON.stringify({Organisations:[{IsDemoCompany:true,BaseCurrency:'GBP',padding:'x'.repeat(262145)}]}))]){
  const r=await harness({organisation}).run();assert.equal(r.organisationVerified,false);assert.equal(r.isDemoCompany,null);assert.equal(r.readerPreflight.state,'failed');
 }
 const h=harness({connections:new Response('PRIVATE ERROR',{status:403})}),r=await h.run();assert.equal(r.organisationVerified,false);assert.equal(r.isDemoCompany,null);assert.equal(r.readerPreflight.reason,'forbidden');assert.equal(h.http.length,2);
});
test('redirect evidence and timed-out observation fail closed without changing the original valid preflight body',async()=>{
 const redirected=response({IsDemoCompany:true,BaseCurrency:'GBP'});Object.defineProperty(redirected,'redirected',{value:true});
 const r=await harness({organisation:redirected}).run();assert.equal(r.organisationVerified,false);
 const original=response({IsDemoCompany:true,BaseCurrency:'GBP'});original.clone=()=>new Response(new ReadableStream({start(){},cancel(){}}));
 const h=harness({organisation:original}),timed=await h.run({observationTimeoutMs:5});assert.equal(timed.organisationVerified,false);assert.equal(timed.readerPreflight.state,'connected');
});
test('lease-release/configuration failures stay sanitised and no retry/accounting run is attempted',async()=>{
 const h=harness({released:false});await assert.rejects(h.run(),/^Error: Xero reader organisation check unavailable$/);assert.equal(h.http.length,3);
 for(const options of [{observationTimeoutMs:0},{observationTimeoutMs:30001},{query:null}])assert.throws(()=>createStagingXeroReaderOrganisationCheck({env,query:h.query,fetchImpl:h.fetchImpl,...options}));
 let called=false;await assert.rejects(createStagingXeroReaderOrganisationCheck({env:{...env,NIGHT_SCOUT_XERO_STAGING_PROJECT_REF:'wrong'},query:async()=>{called=true;},fetchImpl:h.fetchImpl})());assert.equal(called,false);
});
