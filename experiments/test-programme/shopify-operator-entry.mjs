import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
import {main} from './run-provider-test-programme.mjs';
export async function runShopifyOperator({env=process.env,run=main}={}){
 try{
  const config=JSON.parse(readFileSync(env.NIGHT_SCOUT_TEST_PROGRAMME_CONFIG_FILE,'utf8'));
  if(config.provider!=='shopify'||config.target!=='pocketlaunchpad1.myshopify.com')throw Error();
  // Never allow a provider switch or Xero consent prerequisite in this service.
  return await run({env});
 }catch{return {event:'provider_test_programme',state:'configuration-or-provider-unavailable',provider:'shopify'};}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=await runShopifyOperator();process.stdout.write(JSON.stringify(result)+'\n');
 if(['uncertain-stop','reconciliation-required','configuration-or-provider-unavailable'].includes(result.state))process.exitCode=1;
}
