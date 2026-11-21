import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareShopifyDailyReadiness} from './shopify-daily-readiness.mjs';
const now=new Date('2026-10-15T14:00:00Z');
const providerReceipt={domain:'pocketlaunchpad1.myshopify.com',currency:'GBP',partnerDevelopment:true,separateWriterApp:true,sameOrganisation:true,grantedScopes:['read_orders','write_orders'],observedAt:now.toISOString()};
const databaseReceipt={projectRef:'bioalckltvkhlczusdvl',programmeKey:'shopify-staging-20261012',provider:'shopify',target:providerReceipt.domain,scheduleProfile:'daily-20261015-v1',actionCap:4,actionCount:0,enabled:false,stopped:false,restrictedLoginVerified:true,tlsVerified:true,dailyReadinessRpcPresent:true,observedAt:now.toISOString()};
const configuredEnvironmentKeys=['NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL','NIGHT_SCOUT_TEST_WRITER_SHOPIFY_CLIENT_ID','NIGHT_SCOUT_TEST_WRITER_SHOPIFY_CLIENT_SECRET','NODE_EXTRA_CA_CERTS'];
const input={now,providerReceipt,databaseReceipt,configuredEnvironmentKeys};
test('Shopify-only receipts prepare bounded config without Xero consent, token or enablement',()=>{
 const r=prepareShopifyDailyReadiness(input);assert.equal(r.state,'prepared_disabled');assert.equal(r.xeroConsentRequired,false);assert.equal(r.remainingActionCeiling,4);assert.equal(r.remainingNominalPence,24000);assert.equal(r.realChargePence,0);
 for(const k of ['enabled','activationAuthorized','platformResourcesVerified','scheduleInstalled'])assert.equal(r[k],false);
 for(const k of ['providerActions','providerCalls','tokenMints'])assert.equal(r[k],0);
 assert.equal(r.disabledConfig.scheduleProfile,'daily-20261015-v1');assert.equal(r.financialEligibility,'excluded_test_orders');
});
test('wrong targets, unsafe scopes, non-development and stale evidence block preparation',()=>{
 for(const mutation of [{domain:'other.myshopify.com'},{currency:'USD'},{partnerDevelopment:false},{sameOrganisation:false},{separateWriterApp:false},{grantedScopes:['read_orders','write_orders','write_customers']},{grantedScopes:['read_orders','write_orders','write_orders']},{observedAt:'2026-10-15T12:59:59Z'},{observedAt:'2026-10-15T14:00:01Z'}])assert.equal(prepareShopifyDailyReadiness({...input,providerReceipt:{...providerReceipt,...mutation}}).state,'setup_required');
 for(const mutation of [{enabled:true},{actionCount:1},{actionCap:6},{dailyReadinessRpcPresent:false},{tlsVerified:false},{restrictedLoginVerified:false},{scheduleProfile:'original'},{target:'other.myshopify.com'}])assert.equal(prepareShopifyDailyReadiness({...input,databaseReceipt:{...databaseReceipt,...mutation}}).state,'setup_required');
 assert.equal(prepareShopifyDailyReadiness({...input,configuredEnvironmentKeys:[]}).missingEnvironmentKeys.length,4);
});
test('elapsed windows skip without shifting dates, extending hard stop or permitting catch-up',()=>{
 const r=prepareShopifyDailyReadiness({...input,now:new Date('2026-10-15T17:15:00Z')});assert.equal(r.remainingActionCeiling,3);assert.equal(r.remainingWindows[0].date,'2026-10-16');assert.equal(r.hardStop,'2026-10-26T00:00:00.000Z');
 assert.ok(prepareShopifyDailyReadiness({...input,now:new Date('2026-10-18T17:15:00Z')}).blockers.includes('no_remaining_daily_windows'));
});
test('readiness has no secret or operational dependency and malformed evidence cannot cause calls',()=>{
 const source=readFileSync(new URL('./shopify-daily-readiness.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\b(?:fetch|process\.env|mintShopifyWriterToken|createProviderTransport|createRpcLedger)\b/);
 assert.equal(prepareShopifyDailyReadiness({now}).providerCalls,0);assert.equal(prepareShopifyDailyReadiness({now,providerReceipt:{domain:'attacker.example'}}).tokenMints,0);
 assert.throws(()=>prepareShopifyDailyReadiness({now:new Date('invalid')}));
});
test('renewed profile uses fresh identity and GMT daily windows, never shifts expired dates',()=>{
 const now=new Date('2026-10-29T18:16:00Z');
 const result=prepareShopifyDailyReadiness({scheduleProfile:'daily-20261029-v1',now});
 assert.equal(result.disabledConfig.programmeKey,'shopify-staging-20261029');assert.equal(result.remainingWindows.length,6);assert.equal(result.remainingWindows[0].opensAt,'2026-10-30T18:00:00.000Z');assert.equal(result.hardStop,'2026-11-05T00:00:00.000Z');assert.equal(result.activationAuthorized,false);assert.equal(result.enabled,false);
 const expired=prepareShopifyDailyReadiness({scheduleProfile:'daily-20261029-v1',now:new Date('2026-11-05T00:00:00Z')});assert.equal(expired.remainingWindows.length,0);assert.ok(expired.blockers.includes('no_remaining_daily_windows'));
 assert.throws(()=>prepareShopifyDailyReadiness({scheduleProfile:'daily'}));
});
