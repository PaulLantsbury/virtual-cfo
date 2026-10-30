// Synthetic test fixture only. Never copied into deployment output.
import assert from 'node:assert/strict';import {readDemoReaderConfig} from './demo-config.mjs';import {encryptDemoEnvelope,DEMO_STORE_ID} from './demo-envelope-crypto.mjs';
export const connection='90000000-0000-4000-8000-000000000001',mappingId='90000000-0000-4000-8000-000000000002',tenant='90000000-0000-4000-8000-000000000003',evidenceId='90000000-0000-4000-8000-000000000004';
export const scopes='accounting.settings.read accounting.reports.profitandloss.read accounting.reports.balancesheet.read accounting.reports.trialbalance.read accounting.reports.banksummary.read offline_access';
export const clock=()=>new Date('2026-10-30T12:00:00Z');
export function demoEnv(){return {NIGHT_SCOUT_RUNTIME_ENV:'staging',NIGHT_SCOUT_DEMO_XERO_REFRESH_ENABLED:'true',NIGHT_SCOUT_DEMO_XERO_PROJECT_REF:'bioalckltvkhlczusdvl',NIGHT_SCOUT_DEMO_XERO_STORE_ID:DEMO_STORE_ID,NIGHT_SCOUT_DEMO_XERO_PERIOD_MODE:'daily_completed_period',NIGHT_SCOUT_DEMO_XERO_CURRENCY:'GBP',NIGHT_SCOUT_DEMO_XERO_CLIENT_ID:'ABCD0123'.repeat(4),NIGHT_SCOUT_DEMO_XERO_CLIENT_SECRET:'synthetic-demo-reader-client-secret',NIGHT_SCOUT_DEMO_XERO_ENVELOPE_MASTER_KEY:'synthetic-new-demo-only-master-key-material',NIGHT_SCOUT_DEMO_XERO_ENVELOPE_KEY_VERSION:'demo-v1',NIGHT_SCOUT_DEMO_XERO_EXPECTED_TENANT_ID:tenant,NIGHT_SCOUT_DEMO_XERO_DATABASE_URL:'postgresql://night_scout_demo_import_login.bioalckltvkhlczusdvl:synthetic-password@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',NIGHT_SCOUT_DEMO_XERO_CA_PEM:'-----BEGIN CERTIFICATE-----\n'+'A'.repeat(120)+'\n-----END CERTIFICATE-----'};}
const row=(id,value)=>({RowType:'Row',Cells:[{Value:id,Attributes:[{Id:'account',Value:id}]},{Value:value}]});
export function fixture(options={}){
 const env=demoEnv(),config=readDemoReaderConfig(env,clock),mapping={revenue:['sales'],processingFee:['fees'],advertising:['ads'],software:['software'],includedCash:['bank']},identity={connectionId:connection,tenantId:tenant,keyVersion:'demo-v1'};
 const encrypted=encryptDemoEnvelope(env.NIGHT_SCOUT_DEMO_XERO_ENVELOPE_MASTER_KEY,identity,'synthetic-prior-demo-refresh-token'),events=[],sql=[],writes=[],preflights=[];
 const db={version:1,lease:null,...encrypted};let orgReads=0;
 const context=()=>({store_id:DEMO_STORE_ID,connection_id:connection,mapping_version_id:mappingId,tenant_id:tenant,key_version:'demo-v1',algorithm:'AES-256-GCM',version:db.version,lease_expires_at:db.lease,mapping,ciphertext:db.ciphertext,encrypted_dek:db.encryptedDek,...options.context});
 const query=async(q,args)=>{sql.push({q,args});assert.match(q,/xero_demo_v1\./);assert.doesNotMatch(q,/\bxero_v1\.|staging_test_programme|UPDATE|DELETE|INSERT|GRANT|DROP/);
  if(q.includes('worker_get_single_'))return {rows:options.noJob?[]:[{connection_id:connection,mapping_version_id:mappingId}]};
  if(q.includes('worker_get_refresh_context'))return {rows:[context()]};
  if(q.includes('worker_acquire_refresh_lease')){db.lease=options.badLease??new Date(Date.now()+300000);events.push('lease');return {rows:[{lease_expires_at:db.lease}]};}
  if(q.includes('worker_store_refresh_envelope_leased')){assert.equal(args[5],db.version);assert.equal(args[7],db.lease);db.ciphertext=args[1];db.encryptedDek=args[2];db.version=args[6];events.push('rotate');return {rows:[{rotated:options.refuseRotation!==true}]};}
  if(q.includes('worker_record_connection_preflight')){preflights.push(args);events.push('preflight-'+args[2]);return {rows:[{recorded:true}]};}
  if(q.includes('worker_record_accounting_evidence_leased')){assert.equal(args[16],db.version);assert.equal(args[17],db.lease);writes.push(args);events.push('evidence-'+args[6]);db.lease=null;return {rows:[{evidence_id:evidenceId}]};}
  if(q.includes('worker_get_latest_supported_evidence'))return {rows:options.prior?[options.prior]:[]};
  if(q.includes('worker_release_refresh_lease')){assert.equal(args[1],db.version);assert.equal(args[2],db.lease);db.lease=null;events.push('release');return {rows:[{released:true}]};}
  if(q.includes('worker_record_credential_refresh_failure'))return {rows:[]};throw Error('Unexpected synthetic SQL');
 };
 const report=(id,name,rows)=>({Reports:[{ReportID:id,ReportName:name,ReportDate:config.scope.to,Rows:rows}]});
 const fetchImpl=async(url,opts)=>{const u=String(url);events.push(u.endsWith('/token')?'token':u.includes('/Organisation')?'organisation':u.includes('/connections')?'connections':'report');
  if(u==='https://identity.xero.com/connect/token')return new Response(JSON.stringify({access_token:'synthetic-demo-access-token',refresh_token:'synthetic-rotated-demo-refresh-token',scope:options.scopes??scopes}));
  assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');assert.equal(opts.headers['xero-tenant-id']??opts.headers['Xero-tenant-id'],u.endsWith('/connections')?undefined:tenant);
  if(u.endsWith('/connections'))return new Response(JSON.stringify(options.noTenant?[]:[{tenantId:tenant,tenantType:'ORGANISATION'}]));
  if(u.includes('/Organisation')){orgReads++;return new Response(JSON.stringify(options.arrayLikeOrg?{Organisations:{0:{IsDemoCompany:true,BaseCurrency:'GBP'},length:1}}:{Organisations:[{IsDemoCompany:options.demo!==false&&!(options.secondOrgNonDemo&&orgReads>1),BaseCurrency:options.currency??'GBP'}]}));}
  if(options.reportFailure)return new Response('{}',{status:503});
  if(u.includes('ProfitAndLoss'))return new Response(JSON.stringify(report('ProfitAndLoss','Profit and Loss',[row('sales','80.00'),row('fees','-3.00'),row('ads','-20.00'),row('software','-5.00')])));
  if(u.includes('BalanceSheet'))return new Response(JSON.stringify(report('BalanceSheet','Balance Sheet',options.missingCash?[]:[row('bank','103.20')])));
  if(u.includes('TrialBalance'))return new Response(JSON.stringify(report('TrialBalance','Trial Balance',[])));
  if(u.includes('BankSummary'))return new Response(JSON.stringify(report('BankSummary','Bank Summary',[])));
  if(u.endsWith('/Accounts'))return new Response(JSON.stringify({Accounts:[{AccountID:'bank',Type:'BANK',Status:'ACTIVE',CurrencyCode:'GBP'}]}));throw Error('Unexpected synthetic URL');
 };
 return {env,config,mapping,identity,db,events,sql,writes,preflights,query,fetchImpl,clock};
}
