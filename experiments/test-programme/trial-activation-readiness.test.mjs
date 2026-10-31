import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareOriginalTrialActivation} from './trial-activation-readiness.mjs';
const now=new Date('2026-10-15T16:00:00Z');
const base=['NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL','NIGHT_SCOUT_TEST_PROGRAMME_CONFIG_FILE','NODE_EXTRA_CA_CERTS'];
const keys={shopify:[...base,'NIGHT_SCOUT_TEST_WRITER_SHOPIFY_CLIENT_ID','NIGHT_SCOUT_TEST_WRITER_SHOPIFY_CLIENT_SECRET'],xero:[...base,'NIGHT_SCOUT_TEST_WRITER_XERO_CLIENT_ID','NIGHT_SCOUT_TEST_WRITER_XERO_CLIENT_SECRET','NIGHT_SCOUT_TEST_WRITER_ENVELOPE_MASTER_KEY','NIGHT_SCOUT_TEST_WRITER_ENVELOPE_KEY_VERSION']};
const shop={observedAt:now.toISOString(),domain:'pocketlaunchpad1.myshopify.com',currency:'GBP',partnerDevelopment:true,separateWriterApp:true,grantedScopes:['read_orders','write_orders']};
const xero={observedAt:now.toISOString(),tenantId:'90000000-0000-4000-8000-000000000001',baseCurrency:'GBP',isDemoCompany:true,separateWriterApp:true,writerConsentState:'writer_connected_programme_disabled',grantedScopes:'offline_access accounting.invoices accounting.settings.read',contactId:'90000000-0000-4000-8000-000000000002',contactIsExistingSynthetic:true,accountCode:'200',accountIsNonStockRevenue:true};
test('Thursday plan retains original six cap/hard stop, skips missed windows and prepares four remaining actions per provider',()=>{
 for(const [provider,evidence] of [['shopify',shop],['xero',xero]]){
  const result=prepareOriginalTrialActivation({provider,evidence,configuredEnvironmentKeys:keys[provider],now});
  assert.equal(result.state,'prepared_disabled');assert.equal(result.enabled,false);assert.equal(result.providerActions,0);assert.equal(result.scheduleInstalled,false);
  assert.equal(result.platformResourcesVerified,false);assert.equal(result.activationAuthorized,false);assert.equal(result.postedDemoActivationApprovalVerified,false);
  assert.deepEqual(result.missedDates,['2026-10-12','2026-10-13']);assert.deepEqual(result.remainingWindows.map(w=>w.date),['2026-10-17','2026-10-19','2026-10-20','2026-10-24']);
  assert.equal(result.originalActionCap,6);assert.equal(result.hardStop,'2026-10-26T00:00:00.000Z');assert.equal(result.noCatchUp,true);
  assert.equal(result.remainingNominalPence,provider==='xero'?4000:24000);assert.equal(result.disabledConfig.startMonday,'2026-10-12');
 }
});
test('provider proof cannot be substituted by reader credentials, trial account, stale data, wrong scope or inferred invoice bindings',()=>{
 for(const change of [{partnerDevelopment:false},{domain:'other.myshopify.com'},{separateWriterApp:false},{grantedScopes:['read_orders']},{grantedScopes:['read_orders','write_orders','write_products']},{observedAt:'2026-10-13T16:00:00Z'},{observedAt:'2026-10-16T16:00:00Z'}])assert.equal(prepareOriginalTrialActivation({provider:'shopify',evidence:{...shop,...change},now}).disabledConfig,null);
 for(const change of [{isDemoCompany:false},{baseCurrency:'USD'},{separateWriterApp:false},{writerConsentState:'reader_connected'},{contactIsExistingSynthetic:false},{accountIsNonStockRevenue:false},{grantedScopes:'offline_access accounting.transactions accounting.settings.read'},{tenantId:'invalid'}])assert.equal(prepareOriginalTrialActivation({provider:'xero',evidence:{...xero,...change},now}).disabledConfig,null);
});
test('configuration presence reports names only and never makes absent provider proof ready',()=>{
 const missing=prepareOriginalTrialActivation({provider:'xero',evidence:xero,now});assert.equal(missing.state,'setup_required');assert.deepEqual(missing.missingEnvironmentKeys,keys.xero);
 const proofAbsent=prepareOriginalTrialActivation({provider:'shopify',configuredEnvironmentKeys:keys.shopify,now});assert.equal(proofAbsent.state,'setup_required');assert.equal(proofAbsent.disabledConfig,null);assert.equal(proofAbsent.configurationPresenceOnly,true);
});
test('no catch-up at window close, no extension after trial, and immutable original config dates',()=>{
 const due=prepareOriginalTrialActivation({provider:'shopify',evidence:shop,now:new Date('2026-10-17T17:14:59Z')});assert.equal(due.remainingActionCeiling,4);
 const closed=prepareOriginalTrialActivation({provider:'shopify',evidence:shop,now:new Date('2026-10-17T17:15:00Z')});assert.equal(closed.remainingActionCeiling,3);
 const ended=prepareOriginalTrialActivation({provider:'xero',evidence:xero,now:new Date('2026-10-26T00:00:00Z')});assert.equal(ended.remainingActionCeiling,0);assert.ok(ended.blockers.includes('original_trial_has_no_remaining_windows'));assert.equal(ended.enabled,false);
});
