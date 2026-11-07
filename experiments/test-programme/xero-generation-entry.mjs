import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
import {main,prepareBoundedProgramme} from './run-provider-test-programme.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const identity=Object.freeze({provider:'xero',programmeKey:'xero-staging-20261030',scheduleProfile:'daily-xero-20261030-v1',startMonday:'2026-10-26',financialMode:'posted_demo_only'});
const foreignServiceKey=key=>/^NIGHT_SCOUT_(?:XERO_|REVIEW_|INTAKE_)/.test(key)||key.startsWith('NIGHT_SCOUT_TEST_WRITER_OPERATOR_')||key.startsWith('NIGHT_SCOUT_')&&key.includes('SHOPIFY');
const unavailable=()=>({event:'provider_test_programme',state:'configuration-or-provider-unavailable',provider:'xero'});
/** This entry is the only executable package start; never accepts a provider switch.
 * Disabled/unbound startup needs no IDs, secrets, dependencies or network calls.
 */
export async function runXeroGeneration({env=process.env,run=main}={}){
 try{
  if(Object.keys(env).some(foreignServiceKey))throw Error();
  const file=env.NIGHT_SCOUT_TEST_PROGRAMME_CONFIG_FILE;
  if(!file){if(env.NIGHT_SCOUT_TEST_PROGRAMME_ENABLED==='true')throw Error();return {event:'provider_test_programme',state:'prepared-disabled',provider:'xero',programmeKey:identity.programmeKey,actions:7,configurationBound:false};}
  const config=JSON.parse(readFileSync(file,'utf8'));
  if(Object.entries(identity).some(([key,value])=>config[key]!==value)||!UUID.test(config.target??'')||!UUID.test(config.contactId??''))throw Error();
  const programme=prepareBoundedProgramme(config);
  if(programme.cap!==7||programme.startsAt!=='2026-10-30T00:00:00.000Z'||programme.endsAt!=='2026-11-06T00:00:00.000Z')throw Error();
  if(env.NIGHT_SCOUT_TEST_PROGRAMME_ENABLED!=='true')return {event:'provider_test_programme',state:'prepared-disabled',provider:'xero',programmeKey:identity.programmeKey,actions:programme.plans.length,configurationBound:true};
  // Shared runner retains all exact project/target/posted-demo, real clock,
  // restricted-role, daily-RPC, encrypted-refresh and durable claim gates.
  return await run({env});
 }catch{return unavailable();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const result=await runXeroGeneration();process.stdout.write(JSON.stringify(result)+'\n');if(['uncertain-stop','reconciliation-required','configuration-or-provider-unavailable'].includes(result.state))process.exitCode=1;}
