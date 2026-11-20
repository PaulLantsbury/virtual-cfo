// Caller-supplied metadata only: no environment values, provider calls, database access or activation.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const required=Object.freeze({consent:['NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL','NODE_EXTRA_CA_CERTS','NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_ID','NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_SECRET','NIGHT_SCOUT_TEST_WRITER_ENVELOPE_MASTER_KEY','NIGHT_SCOUT_TEST_WRITER_ENVELOPE_KEY_VERSION','NIGHT_SCOUT_RUNTIME_ENV','NIGHT_SCOUT_TEST_PROGRAMME_PROJECT_REF','NIGHT_SCOUT_TEST_WRITER_OPERATOR_ORIGIN','NIGHT_SCOUT_REVIEW_AUTH_URL','NIGHT_SCOUT_REVIEW_PUBLIC_KEY','NIGHT_SCOUT_XERO_STAGING_OWNER_ID','NIGHT_SCOUT_XERO_STAGING_STORE_ID','NIGHT_SCOUT_XERO_TEST_WRITER_REDIRECT_URI','NIGHT_SCOUT_XERO_TEST_WRITER_EXPECTED_TENANT_ID','NIGHT_SCOUT_XERO_TEST_WRITER_READER_BINDING_TRANSPORT','NIGHT_SCOUT_XERO_TEST_WRITER_PROOF_CONTACT_ID','NIGHT_SCOUT_XERO_TEST_WRITER_PROOF_ACCOUNT_ID','NIGHT_SCOUT_XERO_TEST_WRITER_PROOF_SYNTHETIC_CONTACT_CONFIRMED_ID','NIGHT_SCOUT_XERO_TEST_WRITER_PROOF_NON_STOCK_ACCOUNT_CONFIRMED_ID'],generation:['NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL','NODE_EXTRA_CA_CERTS','NIGHT_SCOUT_TEST_WRITER_XERO_CLIENT_ID','NIGHT_SCOUT_TEST_WRITER_XERO_CLIENT_SECRET','NIGHT_SCOUT_TEST_WRITER_ENVELOPE_MASTER_KEY','NIGHT_SCOUT_TEST_WRITER_ENVELOPE_KEY_VERSION','NIGHT_SCOUT_TEST_PROGRAMME_CONFIG_FILE','NIGHT_SCOUT_TEST_PROGRAMME_PROJECT_REF','NIGHT_SCOUT_TEST_PROGRAMME_TARGET']});
const counts=['programmeCount','envelopeCount','actionCount','consentStateCount','activeProgrammeCount','unresolvedActionCount'];
export function inspectDemoWriterEvidence({reader,inventory,expectedBinding,configuredNames={},now=new Date()}={}) {
 if (!(now instanceof Date) || !Number.isFinite(now.valueOf())) throw Error('Invalid clock');
 for (const host of ['consent','generation']) if (configuredNames[host] !== undefined && (!Array.isArray(configuredNames[host]) || configuredNames[host].some(x=>typeof x!=='string'))) throw Error('Expected configuration names only');
 const fresh=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&Date.parse(x)<=now.valueOf()&&now.valueOf()-Date.parse(x)<=3600000;
 const bindingMatches=!!(expectedBinding&&['tenantId','storeId','revenueAccountId'].every(k=>uuid(expectedBinding[k]))&&reader&&fresh(reader.observedAt)&&reader.tenantId===expectedBinding.tenantId&&reader.storeId===expectedBinding.storeId&&reader.revenueAccountId===expectedBinding.revenueAccountId&&reader.connected===true&&reader.mappingCurrent===true);
 const inventoryValid=!!(inventory&&fresh(inventory.observedAt)&&counts.every(k=>Number.isSafeInteger(inventory[k])&&inventory[k]>=0));
 const unused=inventoryValid&&counts.every(k=>inventory[k]===0);
 const missingConfiguration=Object.fromEntries(Object.entries(required).map(([host,names])=>[host,names.filter(name=>!new Set(configuredNames[host]??[]).has(name))]));
 const blockers=[];
 if(!bindingMatches) blockers.push('fresh_exact_demo_reader_and_current_revenue_mapping_required');
 if(!inventoryValid) blockers.push('fresh_complete_writer_inventory_required');
 else if(!unused) blockers.push('existing_writer_records_require_operator_review_before_retargeting');
 if(Object.values(missingConfiguration).some(x=>x.length)) blockers.push('private_writer_configuration_names_missing');
 return {state:blockers.length?'inspection_incomplete':'evidence_only',bindingMatches,inventoryValid,unused,missingConfiguration,blockers,configurationPresenceOnly:true,credentialValidityVerified:false,activationAuthorized:false,providerCalls:0,databaseWrites:0};
}
