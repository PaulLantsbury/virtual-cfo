import {prepareBoundedProgramme} from './run-provider-test-programme.mjs';
const target='pocketlaunchpad1.myshopify.com';
const secretNames=['NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL','NIGHT_SCOUT_TEST_WRITER_SHOPIFY_CLIENT_ID','NIGHT_SCOUT_TEST_WRITER_SHOPIFY_CLIENT_SECRET','NODE_EXTRA_CA_CERTS'];
const profile='daily-20261015-v1';
const fresh=(at,now)=>typeof at==='string'&&Number.isFinite(Date.parse(at))&&Date.parse(at)<=now.valueOf()&&now.valueOf()-Date.parse(at)<=3600000;
/** Local preparation only. Inputs are non-secret receipts, never operational authority.
 * No environment values, token mint, provider request, database call or scheduler imports.
 */
export function prepareShopifyDailyReadiness({providerReceipt,databaseReceipt,configuredEnvironmentKeys=[],now=new Date()}={}){
 if(!(now instanceof Date)||!Number.isFinite(now.valueOf())||!Array.isArray(configuredEnvironmentKeys)||configuredEnvironmentKeys.some(k=>typeof k!=='string'))throw Error('Invalid readiness input');
 const disabledConfig={provider:'shopify',target,startMonday:'2026-10-12',programmeKey:'shopify-staging-20261012',scheduleProfile:profile};
 const programme=prepareBoundedProgramme(disabledConfig);
 const remainingWindows=programme.plans.map(({date})=>({date,opensAt:`${date}T17:00:00.000Z`,closesAt:`${date}T17:15:00.000Z`})).filter(w=>Date.parse(w.closesAt)>now.valueOf());
 const scopes=providerReceipt?.grantedScopes;
 const sourceEvidence=providerReceipt?.domain===target&&providerReceipt.currency==='GBP'&&providerReceipt.partnerDevelopment===true&&providerReceipt.separateWriterApp===true&&providerReceipt.sameOrganisation===true&&fresh(providerReceipt.observedAt,now)
 &&Array.isArray(scopes)&&scopes.length===new Set(scopes).size&&scopes.includes('read_orders')&&scopes.includes('write_orders')&&scopes.every(s=>['read_orders','write_orders','read_all_orders'].includes(s));
 const db=databaseReceipt;
 const databaseEvidence=db?.projectRef==='bioalckltvkhlczusdvl'&&db.programmeKey===disabledConfig.programmeKey&&db.target===target&&db.provider==='shopify'&&db.scheduleProfile===profile&&db.actionCap===4&&db.actionCount===0&&db.enabled===false&&db.stopped===false&&db.restrictedLoginVerified===true&&db.tlsVerified===true&&db.dailyReadinessRpcPresent===true&&fresh(db.observedAt,now);
 const keys=new Set(configuredEnvironmentKeys),missingEnvironmentKeys=secretNames.filter(k=>!keys.has(k));
 const blockers=[];
 if(!sourceEvidence)blockers.push('fresh_separate_same_organisation_development_writer_receipt_required');
 if(!databaseEvidence)blockers.push('fresh_restricted_disabled_shopify_daily_profile_receipt_required');
 if(missingEnvironmentKeys.length)blockers.push('secure_writer_configuration_names_missing');
 if(!remainingWindows.length)blockers.push('no_remaining_daily_windows');
 return Object.freeze({state:blockers.length?'setup_required':'prepared_disabled',provider:'shopify',target,enabled:false,providerActions:0,providerCalls:0,tokenMints:0,scheduleInstalled:false,
 activationAuthorized:false,platformResourcesVerified:false,configurationPresenceOnly:true,xeroConsentRequired:false,
 remainingWindows,remainingActionCeiling:remainingWindows.length,remainingNominalPence:remainingWindows.length*6000,realChargePence:0,noCatchUp:true,
 financialEligibility:'excluded_test_orders',hardStop:programme.endsAt,missingEnvironmentKeys,blockers,disabledConfig});
}
