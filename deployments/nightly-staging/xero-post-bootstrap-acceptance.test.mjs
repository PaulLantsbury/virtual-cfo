import test from 'node:test';
import assert from 'node:assert/strict';
import {createStagingXeroRefreshJob,decryptStagingEnvelope,encryptStagingEnvelope} from './xero-refresh-runtime.mjs';

const connectionId='11111111-1111-4111-8111-111111111111',mappingVersionId='22222222-2222-4222-8222-222222222222',tenantId='33333333-3333-4333-8333-333333333333';
const mapping={revenue:['sales'],processingFee:['fees'],advertising:['ads'],software:['software'],includedCash:['bank']};
const master='m'.repeat(43),keyVersion='staging-v1';
const env=Object.freeze({NIGHT_SCOUT_RUNTIME_ENV:'staging',NIGHT_SCOUT_XERO_STAGING_REFRESH_ENABLED:'true',NIGHT_SCOUT_XERO_STAGING_PROJECT_REF:'bioalckltvkhlczusdvl',NIGHT_SCOUT_XERO_STAGING_CONNECTION_ID:connectionId,NIGHT_SCOUT_XERO_STAGING_MAPPING_VERSION_ID:mappingVersionId,NIGHT_SCOUT_XERO_REPORT_FROM:'2026-09-01',NIGHT_SCOUT_XERO_REPORT_TO:'2026-09-24',NIGHT_SCOUT_XERO_CURRENCY:'GBP',NIGHT_SCOUT_INTAKE_DATABASE_URL:'postgresql://night_scout_import_login:password@db.bioalckltvkhlczusdvl.supabase.co:5432/postgres',NIGHT_SCOUT_STAGING_CA_PEM:`-----BEGIN CERTIFICATE-----\n${'A'.repeat(120)}\n-----END CERTIFICATE-----`,NIGHT_SCOUT_XERO_CLIENT_ID:'44444444-4444-4444-8444-444444444444',NIGHT_SCOUT_XERO_CLIENT_SECRET:'s'.repeat(32),NIGHT_SCOUT_XERO_ENVELOPE_MASTER_KEY:master,NIGHT_SCOUT_XERO_ENVELOPE_KEY_VERSION:keyVersion,NIGHT_SCOUT_XERO_STAGING_MAPPING_JSON:JSON.stringify(mapping)});
const row=(id,value)=>({RowType:'Row',Cells:[{Value:id,Attributes:[{Id:'account',Value:id}]},{Value:value}]});
const report=(id,name,rows)=>({Reports:[{ReportID:id,ReportName:name,ReportDate:'2026-09-24',Rows:rows}]});
const responses={
 Organisation:{Organisations:[{BaseCurrency:'GBP'}]},
 ProfitAndLoss:report('ProfitAndLoss','Profit and Loss',[row('sales','80.00'),row('fees','-3.00'),row('ads','-20.00'),row('software','-50.00')]),
 BalanceSheet:report('BalanceSheet','Balance Sheet',[row('bank','103.20')]),
 TrialBalance:report('TrialBalance','Trial Balance',[]),
 BankSummary:report('BankSummary','Bank Summary',[]),
};

test('post-bootstrap worker refreshes, rotates and persists bounded supported evidence',async()=>{
 const initial=encryptStagingEnvelope(master,{connectionId,tenantId,keyVersion},'initial-refresh-token-long-enough');
 const db={version:1,ciphertext:initial.ciphertext,encryptedDek:initial.encryptedDek,lease:null,evidence:[],audits:[]};
 const lease=new Date(Date.now()+300_000);let refreshes=0,reportReads=0;
 const query=async(sql,params)=>{
  if(sql.includes('worker_get_single_refresh_job'))return {rows:db.evidence.length===0?[{connection_id:connectionId,mapping_version_id:mappingVersionId}]:[]};
  if(sql.includes('worker_get_refresh_context'))return {rows:[{connection_id:connectionId,tenant_id:tenantId,mapping_version_id:mappingVersionId,mapping,ciphertext:db.ciphertext,encrypted_dek:db.encryptedDek,key_version:keyVersion,algorithm:'AES-256-GCM',version:db.version,lease_expires_at:db.lease}]};
  if(sql.includes('worker_acquire_refresh_lease')){assert.equal(params[1],1);assert.equal(params[2],300);db.lease=lease;return {rows:[{lease_expires_at:lease}]};}
  if(sql.includes('worker_store_refresh_envelope_leased')){assert.equal(params[5],1);assert.equal(params[6],2);assert.equal(params[7],lease);db.ciphertext=params[1];db.encryptedDek=params[2];db.version=2;db.audits.push('credential_rotated');return {rows:[{rotated:true}]};}
  if(sql.includes('worker_record_accounting_evidence_leased')){assert.equal(db.lease,lease);assert.equal(params[16],2);assert.equal(params[17],lease);db.evidence.push(params.slice(0,16));db.lease=null;return {rows:[{evidence_id:'evidence-1'}]};}
  if(sql.includes('worker_get_latest_supported_evidence'))return {rows:[]};
  if(sql.includes('worker_record_credential_refresh_failure')){db.audits.push(params[1]);return {rows:[{}]};}
  if(sql.includes('worker_release_refresh_lease'))throw Error('successful rotation must clear the lease atomically');
  throw Error(`unexpected SQL: ${sql}`);
 };
 const fetchImpl=async url=>{
  const value=String(url);
  if(value==='https://identity.xero.com/connect/token'){refreshes+=1;return new Response(JSON.stringify({access_token:'access-token-long-enough',refresh_token:'rotated-refresh-token-long-enough'}),{status:200});}
  const name=Object.keys(responses).find(key=>value.includes(key));assert.ok(name,`unexpected Xero URL ${value}`);reportReads+=1;return new Response(JSON.stringify(responses[name]),{status:200});
 };
 const result=await createStagingXeroRefreshJob({env,query,fetchImpl,now:()=> '2026-09-25T02:00:00.000Z'})();
 assert.deepEqual(result,{state:'supported',projectRef:'bioalckltvkhlczusdvl',scope:{from:'2026-09-01',to:'2026-09-24',currency:'GBP'}});
 assert.equal(refreshes,1);assert.equal(reportReads,5);assert.equal(db.version,2);assert.equal(db.lease,null);assert.deepEqual(db.audits,['credential_rotated']);
 assert.equal(decryptStagingEnvelope(master,{connectionId,tenantId,keyVersion,ciphertext:db.ciphertext,encryptedDek:db.encryptedDek}).toString(),'rotated-refresh-token-long-enough');
 assert.equal(db.evidence.length,1);const saved=db.evidence[0];
 assert.deepEqual(saved.slice(0,11),[connectionId,mappingVersionId,'2026-09-01','2026-09-24','GBP',false,'supported',null,'2026-09-24','2026-09-25T02:00:00.000Z',saved[10]]);assert.match(saved[10],/^[a-f0-9]{64}$/);
 assert.deepEqual(saved.slice(11),[8000,-300,-2000,-5000,10320]);
 assert.doesNotMatch(JSON.stringify(db.evidence),/access-token|refresh-token|Reports|ProfitAndLoss/);
 await assert.rejects(createStagingXeroRefreshJob({env,query,fetchImpl})(),/invalid/);
 assert.equal(refreshes,1);assert.equal(reportReads,5);assert.equal(db.version,2);assert.equal(db.evidence.length,1);
});
