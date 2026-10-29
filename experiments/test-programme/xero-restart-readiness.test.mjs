import test from 'node:test';import assert from 'node:assert/strict';
import {prepareXeroRestartReadiness} from './xero-restart-readiness.mjs';
import {prepareBoundedProgramme,verifyDailyProfile,main} from './run-provider-test-programme.mjs';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
const tenant='90000000-0000-4000-8000-000000000003',contact='90000000-0000-4000-8000-000000000004';
const now=new Date('2026-10-29T18:00:00Z'),at='2026-10-29T17:55:00Z';
const source={tenantId:tenant,baseCurrency:'GBP',isDemoCompany:true,separateWriterApp:true,writerConsentState:'writer_connected_programme_disabled',grantedScopes:'offline_access accounting.invoices accounting.settings.read accounting.contacts.read',contactId:contact,contactIsExistingSynthetic:true,accountCode:'200',accountIsActiveNonStockRevenue:true,observedAt:at};
const db={projectRef:'bioalckltvkhlczusdvl',programmeKey:'xero-staging-20261030',provider:'xero',target:tenant,startsAt:'2026-10-30T00:00:00.000Z',endsAt:'2026-11-06T00:00:00.000Z',actionCap:7,actionCount:0,enabled:false,stopped:false,restrictedLoginVerified:true,tlsVerified:true,restartReadinessRpcPresent:true,writerEnvelopePresent:true,writerEnvelopeIdle:true,writerEnvelopeTenant:tenant,observedAt:at};
const operator={origin:'https://operator.example.test',separateWriterApp:true,authenticatedOwnerOnly:true,generationEnabled:false,observedAt:at};
const reader={provider:'xero',target:tenant,connected:true,observedAt:at};
const keys=['NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL','NODE_EXTRA_CA_CERTS','NIGHT_SCOUT_TEST_WRITER_XERO_CLIENT_ID','NIGHT_SCOUT_TEST_WRITER_XERO_CLIENT_SECRET','NIGHT_SCOUT_TEST_WRITER_ENVELOPE_MASTER_KEY','NIGHT_SCOUT_TEST_WRITER_ENVELOPE_KEY_VERSION'];
const input={now,providerReceipt:source,databaseReceipt:db,operatorReceipt:operator,readerReceipt:reader,configuredEnvironmentKeys:keys};
test('complete synthetic receipts prepare an explicitly unapproved disabled seven-day programme',()=>{
 const r=prepareXeroRestartReadiness(input);assert.equal(r.state,'prepared_disabled');assert.equal(r.enabled,false);assert.equal(r.activationAuthorized,false);assert.equal(r.proposalOnly,true);assert.equal(r.postedDemoActivationApprovalVerified,false);assert.equal(r.providerCalls,0);assert.equal(r.credentialRefreshes,0);assert.equal(r.realPaymentPence,0);assert.equal(r.remainingPostedPence,7000);assert.equal(r.remainingWindows.length,7);assert.equal(r.disabledConfig.programmeKey,'xero-staging-20261030');
 const p=prepareBoundedProgramme(r.disabledConfig);assert.equal(p.startsAt,'2026-10-30T00:00:00.000Z');assert.equal(p.endsAt,'2026-11-06T00:00:00.000Z');assert.equal(p.cap,7);assert.equal(new Set(p.plans.map(p=>p.plan.actionKey)).size,7);assert.equal(p.plans.every(p=>p.plan.body.Invoices[0].Status==='AUTHORISED'&&p.plan.body.Invoices[0].LineItems[0].UnitAmount===10),true);
});
test('missing/stale, wrong tenant, non-demo, broad scopes, unsafe operator and envelope states block',()=>{
 const mutations=[{providerReceipt:undefined},{providerReceipt:{...source,observedAt:'2026-10-28T18:00:00Z'}},{providerReceipt:{...source,isDemoCompany:false}},{providerReceipt:{...source,baseCurrency:'USD'}},{providerReceipt:{...source,grantedScopes:source.grantedScopes+' accounting.transactions'}},{providerReceipt:{...source,grantedScopes:'offline_access accounting.invoices accounting.settings.read'}},{providerReceipt:{...source,contactIsExistingSynthetic:false}},{providerReceipt:{...source,accountIsActiveNonStockRevenue:false}},{databaseReceipt:{...db,writerEnvelopeIdle:false}},{databaseReceipt:{...db,writerEnvelopeTenant:contact}},{databaseReceipt:{...db,enabled:true}},{databaseReceipt:{...db,actionCount:1}},{databaseReceipt:{...db,restartReadinessRpcPresent:false}},{operatorReceipt:{...operator,origin:'https://night-scout-xero-staging.onrender.com'}},{operatorReceipt:{...operator,authenticatedOwnerOnly:false}},{configuredEnvironmentKeys:[]}];
 for(const mutation of mutations)assert.equal(prepareXeroRestartReadiness({...input,...mutation}).state,'setup_required');
 const wrongReader=prepareXeroRestartReadiness({...input,readerReceipt:{...reader,target:contact}});assert.equal(wrongReader.readerMatches,false);assert.ok(wrongReader.blockers.includes('matching_demo_reader_required_for_accounting_acceptance'));
});
test('missed dates never catch up or renew and partial windows expire exactly',()=>{
 const r=prepareXeroRestartReadiness({...input,now:new Date('2026-11-01T18:15:00Z')});assert.equal(r.remainingWindows.length,4);assert.equal(r.remainingWindows[0].opensAt,'2026-11-02T18:00:00.000Z');
 const expired=prepareXeroRestartReadiness({...input,now:new Date('2026-11-06T00:00:00Z')});assert.equal(expired.remainingWindows.length,0);assert.ok(expired.blockers.includes('proposed_trial_expired_no_automatic_renewal'));assert.equal(expired.hardStop,'2026-11-06T00:00:00.000Z');
});
test('new runtime profile is Xero-only, exact identity, and invokes dedicated DB gate',async()=>{
 const config=prepareXeroRestartReadiness(input).disabledConfig,p=prepareBoundedProgramme(config);
 for(const change of [{provider:'shopify'},{programmeKey:'xero-staging-20261012'},{financialMode:'draft_only'},{startMonday:'2026-11-02'},{scheduleProfile:'daily-xero'}])assert.throws(()=>prepareBoundedProgramme({...config,...change}));
 let sql;await verifyDailyProfile({programme:p,pool:{query:async s=>{sql=s;return {rows:[{ready:true}]};}}});assert.match(sql,/xero_daily_20261030_ready/);
 await assert.rejects(verifyDailyProfile({programme:p,pool:{query:async()=>({rows:[{ready:false}]})}}));
 const dir=mkdtempSync(join(tmpdir(),'ns-xero-restart-'));try{const file=join(dir,'config.json');writeFileSync(file,JSON.stringify(config));const env={NIGHT_SCOUT_TEST_PROGRAMME_CONFIG_FILE:file};assert.deepEqual(await main({env}),{event:'provider_test_programme',state:'prepared-disabled',provider:'xero',actions:7});
 Object.assign(env,{NIGHT_SCOUT_TEST_PROGRAMME_ENABLED:'true',NIGHT_SCOUT_TEST_PROGRAMME_PROJECT_REF:'bioalckltvkhlczusdvl',NIGHT_SCOUT_TEST_PROGRAMME_TARGET:tenant,NIGHT_SCOUT_TEST_PROGRAMME_VERIFIED_TEST_TARGET:'true',NIGHT_SCOUT_TEST_WRITER_POSTED_DEMO_APPROVED:'true'});for(const at of ['2026-10-29T18:00:00Z','2026-10-30T18:15:00Z','2026-11-06T18:00:00Z'])assert.equal((await main({env,now:new Date(at)})).state,'outside-generation-window');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
