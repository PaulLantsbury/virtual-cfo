import {mkdtemp,writeFile,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
import {INTAKE_TARGET as target} from './intake-runtime.mjs';
import {checkDevelopmentConnection} from './check-development-connection.mjs';
const failure='Shopify source readiness unavailable; no source mutation or database import was attempted.';
/** Read-only full-history capacity check using the existing collector identity.
 * No scheduler, claim, DB connection or financial attestation. Private config
 * is removed after every outcome. Source errors never expose arbitrary text.
 */
export async function checkCloudShopifySource({env=process.env}={}, {check=checkDevelopmentConnection}={}){
 let directory;
 try{
  const bounded=(s,max)=>typeof s==='string'&&s.length>0&&s.length<=max&&!/[\x00-\x20\x7f]/.test(s);
  if(env.NIGHT_SCOUT_STAGING_PROJECT_REF!==target.projectRef||!bounded(env.NIGHT_SCOUT_SHOPIFY_CLIENT_ID,256)||!bounded(env.NIGHT_SCOUT_SHOPIFY_CLIENT_SECRET,4096))throw Error(failure);
  directory=await mkdtemp(join(tmpdir(),'night-scout-source-'));await chmod(directory,0o700);
  const configPath=join(directory,'shopify.json');
  await writeFile(configPath,JSON.stringify({...target,clientId:env.NIGHT_SCOUT_SHOPIFY_CLIENT_ID,clientSecret:env.NIGHT_SCOUT_SHOPIFY_CLIENT_SECRET}),{mode:0o600,flag:'wx'});
  const r=await check({configPath,readOrders:true});
  if(r?.status!=='order_summaries_read'||r.ordersCollected!==true||!r.capacity)throw Error(failure);
  const result={event:'shopify_source_readiness',state:'source_summaries_read',projectRef:target.projectRef,storeId:target.storeId,sourceMutationAttempted:false,databaseWriteAttempted:false,financialVerification:'not_assessed'};
  for(const key of ['sourceOrderCount','testOrderCount','sourceRefundCount','reviewFlagCount','pageCount']){if(!Number.isSafeInteger(r[key])||r[key]<0)throw Error(failure);result[key]=r[key];}
  if(r.pageCount<1||r.pageCount>100||r.testOrderCount>r.sourceOrderCount)throw Error(failure);
  const c=r.capacity;
  if(c.pageLimit!==100||c.timeoutMs!==60000||!Number.isSafeInteger(c.collectionDurationMs)||c.collectionDurationMs<0||c.remainingPageCapacity!==100-r.pageCount||c.fourteenDayAdditionalOrderCap!==10||c.hasTrialPageHeadroom!==(r.pageCount+10<=100))throw Error(failure);
  result.capacity={pageLimit:100,timeoutMs:60000,collectionDurationMs:c.collectionDurationMs,remainingPageCapacity:c.remainingPageCapacity,fourteenDayAdditionalOrderCap:10,hasTrialPageHeadroom:c.hasTrialPageHeadroom};
  return result;
 }catch{throw Error(failure);}finally{if(directory)try{await rm(directory,{recursive:true,force:true});}catch{throw Error(failure);}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length!==2)throw Error(failure);console.log(JSON.stringify(await checkCloudShopifySource()));}catch{console.error(failure);process.exitCode=1;}}
