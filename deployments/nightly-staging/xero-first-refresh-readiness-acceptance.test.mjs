import test from 'node:test';
import assert from 'node:assert/strict';
import {createXeroMerchantReadinessRuntime} from '../../artifacts/api-server/src/lib/xero-merchant-readiness-runtime.ts';
import {createStagingXeroRefreshJob,encryptStagingEnvelope} from './xero-refresh-runtime.mjs';

const storeId='11111111-1111-4111-8111-111111111111';
const userId='22222222-2222-4222-8222-222222222222';
const connectionId='33333333-3333-4333-8333-333333333333';
const mappingVersionId='44444444-4444-4444-8444-444444444444';
const tenantId='55555555-5555-4555-8555-555555555555';
const projectRef='bioalckltvkhlczusdvl';
const mapping={revenue:['sales'],processingFee:['fees'],advertising:['ads'],software:['software'],includedCash:['bank']};
const masterKey='m'.repeat(43),keyVersion='staging-v1';
const workerEnv=Object.freeze({
 NIGHT_SCOUT_RUNTIME_ENV:'staging',NIGHT_SCOUT_XERO_STAGING_REFRESH_ENABLED:'true',
 NIGHT_SCOUT_XERO_STAGING_PROJECT_REF:projectRef,NIGHT_SCOUT_XERO_STAGING_CONNECTION_ID:connectionId,
 NIGHT_SCOUT_XERO_STAGING_MAPPING_VERSION_ID:mappingVersionId,NIGHT_SCOUT_XERO_REPORT_FROM:'2026-09-01',
 NIGHT_SCOUT_XERO_REPORT_TO:'2026-09-25',NIGHT_SCOUT_XERO_CURRENCY:'GBP',
 NIGHT_SCOUT_INTAKE_DATABASE_URL:`postgresql://night_scout_import_login:password@db.${projectRef}.supabase.co:5432/postgres`,
 NIGHT_SCOUT_STAGING_CA_PEM:`-----BEGIN CERTIFICATE-----\n${'A'.repeat(120)}\n-----END CERTIFICATE-----`,
 NIGHT_SCOUT_XERO_CLIENT_ID:'66666666-6666-4666-8666-666666666666',NIGHT_SCOUT_XERO_CLIENT_SECRET:'s'.repeat(32),
 NIGHT_SCOUT_XERO_ENVELOPE_MASTER_KEY:masterKey,NIGHT_SCOUT_XERO_ENVELOPE_KEY_VERSION:keyVersion,
 NIGHT_SCOUT_XERO_STAGING_MAPPING_JSON:JSON.stringify(mapping)
});
const readinessEnv=Object.freeze({
 NIGHT_SCOUT_XERO_MERCHANT_READINESS_ENABLED:'true',NIGHT_SCOUT_RUNTIME_ENV:'staging',
 NIGHT_SCOUT_XERO_STAGING_PROJECT_REF:projectRef,VITE_SUPABASE_URL:`https://${projectRef}.supabase.co`,
 VITE_SUPABASE_ANON_KEY:'public-key-material-value'
});
const row=(id,value)=>({RowType:'Row',Cells:[{Value:id,Attributes:[{Id:'account',Value:id}]},{Value:value}]});
const report=(id,name,rows)=>({Reports:[{ReportID:id,ReportName:name,ReportDate:'2026-09-25',Rows:rows}]});
const reports={
 Organisation:{Organisations:[{BaseCurrency:'GBP'}]},
 ProfitAndLoss:report('ProfitAndLoss','Profit and Loss',[row('sales','80.00'),row('fees','-3.00'),row('ads','-20.00'),row('software','-5.00')]),
 BalanceSheet:report('BalanceSheet','Balance Sheet',[row('bank','103.20')]),
 TrialBalance:report('TrialBalance','Trial Balance',[]),BankSummary:report('BankSummary','Bank Summary',[])
};

test('bootstrap-persisted connection becomes ready only after the first bounded refresh',async()=>{
 const envelope=encryptStagingEnvelope(masterKey,{connectionId,tenantId,keyVersion},'bootstrap-refresh-token-long-enough');
 const db={version:1,ciphertext:envelope.ciphertext,encryptedDek:envelope.encryptedDek,lease:null,evidence:[]},events=[];
 const readiness=()=>({storeId,connection:{status:'active',scopeVersion:'read-only-v1',createdAt:'2026-09-25T15:30:00.000Z',lastSuccessAt:db.evidence.length?'2026-09-25T16:00:00.000Z':null,lastFailureAt:null,mappingReviewRequired:false},evidenceState:db.evidence.length?'ready':'unavailable',evidenceRetrievedAt:db.evidence.length?'2026-09-25T16:00:00.000Z':null});
 const read=async bearer=>{const runtime=createXeroMerchantReadinessRuntime(readinessEnv,{createAuthClient:()=>({auth:{getUser:async token=>token==='valid'?{data:{user:{id:userId}},error:null}:{data:{},error:{message:'bad'}}}}),fetchImpl:async(_url,options)=>{assert.equal(options.headers.authorization,`Bearer ${bearer}`);return new Response(JSON.stringify(readiness()),{status:200});}});const identity=await runtime.authenticate(`Bearer ${bearer}`);return runtime.service.read(identity,storeId);};
 assert.equal((await read('valid')).evidenceState,'unavailable');
 const lease=new Date(Date.now()+300_000);
 const query=async(sql,params)=>{
  if(sql.includes('worker_get_single_refresh_job'))return {rows:[{connection_id:connectionId,mapping_version_id:mappingVersionId}]};
  if(sql.includes('worker_get_refresh_context'))return {rows:[{connection_id:connectionId,tenant_id:tenantId,mapping_version_id:mappingVersionId,mapping,ciphertext:db.ciphertext,encrypted_dek:db.encryptedDek,key_version:keyVersion,algorithm:'AES-256-GCM',version:db.version,lease_expires_at:db.lease}]};
  if(sql.includes('worker_acquire_refresh_lease')){db.lease=lease;events.push('lease_acquired');return {rows:[{lease_expires_at:lease}]};}
  if(sql.includes('worker_store_refresh_envelope_leased')){assert.equal(db.lease,lease);assert.equal(params[5],1);assert.equal(params[6],2);assert.equal(params[7],lease);db.ciphertext=params[1];db.encryptedDek=params[2];db.version=2;events.push('credential_rotated_fence_retained');return {rows:[{rotated:true}]};}
  if(sql.includes('worker_record_accounting_evidence_leased')){assert.equal(db.lease,lease);assert.equal(params[16],2);assert.equal(params[17],lease);db.evidence.push(params.slice(0,16));db.lease=null;events.push('evidence_persisted_fence_cleared');return {rows:[{evidence_id:'evidence-1'}]};}
  if(sql.includes('worker_get_latest_supported_evidence'))return {rows:[]};
  throw Error(`unexpected SQL: ${sql}`);
 };
 const fetchImpl=async url=>{const value=String(url);if(value==='https://identity.xero.com/connect/token'){events.push('provider_token_refresh');return new Response(JSON.stringify({access_token:'access-token-long-enough',refresh_token:'rotated-refresh-token-long-enough'}),{status:200});}const name=Object.keys(reports).find(key=>value.includes(key));assert.ok(name,`unexpected Xero URL ${value}`);assert.equal(db.lease,lease,'the durable fence must remain held for every report read');events.push(`provider_report_${name}`);return new Response(JSON.stringify(reports[name]),{status:200});};
 const outcome=await createStagingXeroRefreshJob({env:workerEnv,query,fetchImpl,now:()=> '2026-09-25T16:00:00.000Z'})();
 assert.equal(outcome.state,'supported');assert.equal(db.version,2);assert.equal(db.lease,null);assert.equal(db.evidence.length,1);
 assert.equal(events[0],'lease_acquired');assert.equal(events[1],'provider_token_refresh');assert.equal(events[2],'credential_rotated_fence_retained');assert.equal(events.at(-1),'evidence_persisted_fence_cleared');assert.equal(events.filter(event=>event.startsWith('provider_report_')).length,5);
 const saved=db.evidence[0];assert.deepEqual(saved.slice(11),[8000,-300,-2000,-500,10320]);
 const after=await read('valid');assert.equal(after.connection.status,'active');assert.equal(after.connection.mappingReviewRequired,false);assert.equal(after.evidenceState,'ready');assert.equal(after.evidenceRetrievedAt,'2026-09-25T16:00:00.000Z');
 assert.doesNotMatch(JSON.stringify(after),/tenant|mappingVersion|credential|token|booked|revenue|cash/i);
});
