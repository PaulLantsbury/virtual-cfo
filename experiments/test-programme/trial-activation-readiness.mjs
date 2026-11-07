import {validWriterScopes} from './writer-oauth-scopes.mjs';
import {prepareBoundedProgramme} from './run-provider-test-programme.mjs';

const SHOP='pocketlaunchpad1.myshopify.com';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dates=Object.freeze(['2026-10-12','2026-10-13','2026-10-17','2026-10-19','2026-10-20','2026-10-24']);
const baseKeys=['NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL','NIGHT_SCOUT_TEST_PROGRAMME_CONFIG_FILE','NODE_EXTRA_CA_CERTS'];
const writerKeys={shopify:['NIGHT_SCOUT_TEST_WRITER_SHOPIFY_CLIENT_ID','NIGHT_SCOUT_TEST_WRITER_SHOPIFY_CLIENT_SECRET'],xero:['NIGHT_SCOUT_TEST_WRITER_XERO_CLIENT_ID','NIGHT_SCOUT_TEST_WRITER_XERO_CLIENT_SECRET','NIGHT_SCOUT_TEST_WRITER_ENVELOPE_MASTER_KEY','NIGHT_SCOUT_TEST_WRITER_ENVELOPE_KEY_VERSION']};
const fresh=(observedAt,now)=>typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt))&&Date.parse(observedAt)<=now.valueOf()&&now.valueOf()-Date.parse(observedAt)<=24*3600000;
function shopifyEvidence(value,now){
 const scopes=value?.grantedScopes;
 return fresh(value?.observedAt,now)&&value.domain===SHOP&&value.currency==='GBP'&&value.partnerDevelopment===true&&value.separateWriterApp===true
  &&Array.isArray(scopes)&&scopes.length<=3&&new Set(scopes).size===scopes.length&&scopes.includes('read_orders')&&scopes.includes('write_orders')&&scopes.every(scope=>['read_orders','write_orders','read_all_orders'].includes(scope));
}
function xeroEvidence(value,now){
 return fresh(value?.observedAt,now)&&UUID.test(value.tenantId??'')&&value.baseCurrency==='GBP'&&value.isDemoCompany===true&&value.separateWriterApp===true
  &&value.writerConsentState==='writer_connected_programme_disabled'&&validWriterScopes(value.grantedScopes)
  &&UUID.test(value.contactId??'')&&value.contactIsExistingSynthetic===true&&typeof value.accountCode==='string'&&/^[A-Za-z0-9_-]{1,20}$/.test(value.accountCode)&&value.accountIsNonStockRevenue===true;
}

/** Preparation only: never reads secrets, fetches providers, enables rows or installs a schedule.
 * Evidence inputs must come from the separate writer's authenticated provider checks.
 * They are not write authority; the existing executor re-verifies the provider target.
 */
export function prepareOriginalTrialActivation({provider,evidence,configuredEnvironmentKeys=[],now=new Date()}={}){
 if(!['shopify','xero'].includes(provider)||!(now instanceof Date)||!Number.isFinite(now.valueOf())||!Array.isArray(configuredEnvironmentKeys)||configuredEnvironmentKeys.some(key=>typeof key!=='string'))throw Error('Invalid trial readiness input');
 const current=now.valueOf();
 const windows=dates.map(date=>({date,opensAt:`${date}T17:00:00.000Z`,closesAt:`${date}T17:15:00.000Z`}));
 const remaining=windows.filter(window=>Date.parse(window.closesAt)>current);
 const missed=windows.filter(window=>Date.parse(window.closesAt)<=current).map(window=>window.date);
 const environmentKeys=new Set(configuredEnvironmentKeys);
 const missingEnvironmentKeys=[...baseKeys,...writerKeys[provider]].filter(key=>!environmentKeys.has(key));
 const verified=provider==='shopify'?shopifyEvidence(evidence,now):xeroEvidence(evidence,now);
 const blockers=[];
 if(!remaining.length)blockers.push('original_trial_has_no_remaining_windows');
 if(!verified)blockers.push(provider==='shopify'?'fresh_separate_development_writer_evidence_required':'fresh_separate_gbp_demo_writer_consent_and_invoice_bindings_required');
 if(missingEnvironmentKeys.length)blockers.push('secure_writer_configuration_incomplete');
 let disabledConfig=null;
 if(verified){
  disabledConfig={provider,target:provider==='shopify'?SHOP:evidence.tenantId,startMonday:'2026-10-12',programmeKey:`${provider}-staging-20261012`,...(provider==='xero'?{contactId:evidence.contactId,accountCode:evidence.accountCode,financialMode:'posted_demo_only'}:{})};
  // Reuse the actual runner's shape and bounded amount checks, never a divergent plan.
  prepareBoundedProgramme(disabledConfig);
 }
 return Object.freeze({state:blockers.length?'setup_required':'prepared_disabled',provider,enabled:false,scheduleInstalled:false,providerActions:0,
  startMonday:'2026-10-12',hardStop:'2026-10-26T00:00:00.000Z',originalActionCap:6,remainingWindows:remaining,missedDates:missed,noCatchUp:true,
  remainingActionCeiling:remaining.length,remainingNominalPence:remaining.length*(provider==='shopify'?6000:1000),
  financialEligibility:provider==='shopify'?'excluded_test_orders':'posted_demo_only_no_payment',
  configurationPresenceOnly:true,platformResourcesVerified:false,activationAuthorized:false,postedDemoActivationApprovalVerified:false,
  missingEnvironmentKeys,blockers,disabledConfig});
}
