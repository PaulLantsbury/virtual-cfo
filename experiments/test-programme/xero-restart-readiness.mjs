import {validWriterScopes} from './writer-oauth-scopes.mjs';
import {operatorOrigin} from './operator-origin.mjs';
import {prepareBoundedProgramme} from './run-provider-test-programme.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const XERO_RESTART_PROPOSAL=Object.freeze({programmeKey:'xero-staging-20261030',scheduleProfile:'daily-xero-20261030-v1',startMonday:'2026-10-26',startsAt:'2026-10-30T00:00:00.000Z',endsAt:'2026-11-06T00:00:00.000Z',actionCap:7,unitPence:1000});
const names=Object.freeze(['NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL','NODE_EXTRA_CA_CERTS','NIGHT_SCOUT_TEST_WRITER_XERO_CLIENT_ID','NIGHT_SCOUT_TEST_WRITER_XERO_CLIENT_SECRET','NIGHT_SCOUT_TEST_WRITER_ENVELOPE_MASTER_KEY','NIGHT_SCOUT_TEST_WRITER_ENVELOPE_KEY_VERSION']);
const fresh=(at,now)=>typeof at==='string'&&Number.isFinite(Date.parse(at))&&Date.parse(at)<=now.valueOf()&&now.valueOf()-Date.parse(at)<=3600000;
/** Pure preparation: caller-supplied receipts are not authentication or activation authority.
 * No provider reads, credential refresh, SQL, schedules or environment values are consumed.
 */
export function prepareXeroRestartReadiness({providerReceipt,databaseReceipt,operatorReceipt,readerReceipt,configuredEnvironmentKeys=[],now=new Date()}={}){
 if(!(now instanceof Date)||!Number.isFinite(now.valueOf())||!Array.isArray(configuredEnvironmentKeys)||configuredEnvironmentKeys.some(k=>typeof k!=='string'))throw Error('Invalid Xero readiness input');
 const p=XERO_RESTART_PROPOSAL,source=providerReceipt,db=databaseReceipt,operator=operatorReceipt;
 let isolatedOperator=false;try{isolatedOperator=operator?.separateWriterApp===true&&operator.authenticatedOwnerOnly===true&&operator.generationEnabled===false&&fresh(operator.observedAt,now)&&operatorOrigin(operator.origin)===operator.origin;}catch{}
 const providerVerified=!!(source&&fresh(source.observedAt,now)&&UUID.test(source.tenantId??'')&&source.baseCurrency==='GBP'&&source.isDemoCompany===true&&source.separateWriterApp===true&&source.writerConsentState==='writer_connected_programme_disabled'&&validWriterScopes(source.grantedScopes)&&source.grantedScopes.split(' ').includes('accounting.contacts.read')&&UUID.test(source.contactId??'')&&source.contactIsExistingSynthetic===true&&typeof source.accountCode==='string'&&/^[A-Za-z0-9_-]{1,20}$/.test(source.accountCode)&&source.accountIsActiveNonStockRevenue===true);
 const disabledConfig=providerVerified?{provider:'xero',target:source.tenantId,startMonday:p.startMonday,programmeKey:p.programmeKey,scheduleProfile:p.scheduleProfile,contactId:source.contactId,accountCode:source.accountCode,financialMode:'posted_demo_only'}:null;
 const programme=disabledConfig?prepareBoundedProgramme(disabledConfig):null;
 const dates=Array.from({length:7},(_,i)=>new Date(Date.parse(p.startsAt)+i*86400000).toISOString().slice(0,10));
 const remainingWindows=dates.map(date=>({date,opensAt:`${date}T18:00:00.000Z`,closesAt:`${date}T18:15:00.000Z`})).filter(w=>Date.parse(w.closesAt)>now.valueOf());
 const databaseVerified=!!(providerVerified&&db&&fresh(db.observedAt,now)&&db.projectRef==='bioalckltvkhlczusdvl'&&db.programmeKey===p.programmeKey&&db.provider==='xero'&&db.target===source.tenantId&&db.startsAt===p.startsAt&&db.endsAt===p.endsAt&&db.actionCap===p.actionCap&&db.actionCount===0&&db.enabled===false&&db.stopped===false&&db.restrictedLoginVerified===true&&db.tlsVerified===true&&db.restartReadinessRpcPresent===true&&db.writerEnvelopePresent===true&&db.writerEnvelopeIdle===true&&db.writerEnvelopeTenant===source.tenantId);
 const readerMatches=!!(providerVerified&&readerReceipt&&fresh(readerReceipt.observedAt,now)&&readerReceipt.provider==='xero'&&readerReceipt.target===source.tenantId&&readerReceipt.connected===true);
 const keys=new Set(configuredEnvironmentKeys),missingEnvironmentKeys=names.filter(k=>!keys.has(k));
 const blockers=[];
 if(!isolatedOperator)blockers.push('fresh_isolated_owner_authenticated_consent_host_required');
 if(!providerVerified)blockers.push('fresh_separate_gbp_demo_consent_contact_and_revenue_account_proof_required');
 if(!databaseVerified)blockers.push('fresh_restricted_disabled_restart_binding_and_idle_writer_envelope_required');
 if(!readerMatches)blockers.push('matching_demo_reader_required_for_accounting_acceptance');
 if(missingEnvironmentKeys.length)blockers.push('secure_writer_configuration_names_missing');
 if(!remainingWindows.length)blockers.push('proposed_trial_expired_no_automatic_renewal');
 return Object.freeze({state:blockers.length?'setup_required':'prepared_disabled',provider:'xero',proposalOnly:true,activationAuthorized:false,postedDemoActivationApprovalVerified:false,enabled:false,scheduleInstalled:false,providerCalls:0,providerActions:0,credentialRefreshes:0,configurationPresenceOnly:true,platformResourcesVerified:false,programmeKey:p.programmeKey,hardStop:p.endsAt,remainingWindows,remainingActionCeiling:remainingWindows.length,remainingPostedPence:remainingWindows.length*p.unitPence,realPaymentPence:0,noCatchUp:true,financialEligibility:'posted_demo_revenue_and_receivables_no_cash',readerMatches,missingEnvironmentKeys,blockers,disabledConfig,plannedActions:programme?.plans.length??0});
}
