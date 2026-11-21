import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {INTAKE_TARGET as target,intakeConnectionOptions,intakeDatabase} from './intake-runtime.mjs';
import {runDevelopmentIntake} from './run-development-intake.mjs';
import {createShopifyCredentialProvider} from './credential-provider.mjs';
import {collectCustomerIdentities} from './collect-customer-identities.mjs';
import {recordCustomerIdentityObservations} from './customer-identity-writer.mjs';
const failure='Customer identifier collection unavailable or outcome unconfirmed. Inspect stored observations before retrying; no automatic retry or financial approval was performed.';
async function privateConfig(path){const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const s=await file.stat();if(!s.isFile()||(s.mode&0o077)!==0||s.uid!==process.getuid()||s.size>16384)throw Error(failure);return JSON.parse(await file.readFile('utf8'));}finally{await file.close();}}
export function parseIdentityArguments(args){
 let configPath,mode,confirmTarget;
 for(let i=0;i<args.length;i++){
 if(args[i]==='--config'&&!configPath&&args[i+1]&&!args[i+1].startsWith('--'))configPath=args[++i];
 else if(['--check','--record'].includes(args[i])&&!mode)mode=args[i].slice(2);
 else if(args[i]==='--confirm-target'&&!confirmTarget&&args[i+1])confirmTarget=args[++i];
 else throw Error(failure);
 }
 mode??='check';if(!configPath||mode==='record'&&confirmTarget!==`${target.projectRef}/${target.storeId}`||mode==='check'&&confirmTarget!==undefined)throw Error(failure);
 return {configPath,mode,confirmTarget};
}
export async function runDevelopmentCustomerIdentity({configPath,mode='check',confirmTarget},{createPool,fetchImpl=globalThis.fetch,check=runDevelopmentIntake,collect=collectCustomerIdentities,record=recordCustomerIdentityObservations}={}){
 let pool,provider;
 try{
 if(!['check','record'].includes(mode)||mode==='record'&&confirmTarget!==`${target.projectRef}/${target.storeId}`||mode==='check'&&confirmTarget!==undefined)throw Error(failure);
 const config=await privateConfig(configPath),options=intakeConnectionOptions(config);
 await check({configPath,mode:'check'});
 if(!createPool){const require=createRequire(new URL('../../lib/db/package.json',import.meta.url));const {Pool}=require('pg');createPool=o=>new Pool(o);}
 pool=createPool(options.pool);const db=intakeDatabase(pool);
 await db.transaction(async tx=>{const {rows}=await tx.query("SELECT has_table_privilege(current_user,'shopify_identity_v1.order_observations','SELECT') AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['identity_collection_version','store_id','shop_id','shopify_order_id','shopify_customer_id','source_order_updated_at','observed_at']) col WHERE NOT has_column_privilege(current_user,'shopify_identity_v1.order_observations',col,'INSERT')) AS allowed, (has_table_privilege(current_user,'shopify_identity_v1.order_observations','UPDATE,DELETE,TRUNCATE') OR has_any_column_privilege(current_user,'shopify_identity_v1.order_observations','UPDATE')) AS unsafe");if(rows.length!==1||rows[0].allowed!==true||rows[0].unsafe!==false)throw Error(failure);});
 if(mode==='check')return {status:'identity_storage_configuration_checked',storeId:target.storeId,shopifyIdentityAccessChecked:false,observationWriteAttempted:false};
 const matches=shop=>['domain','shopId','currency','timezone'].every(k=>shop[k]===target[k]);
 const shop=await privateConfig(config.shopifyConfigPath);if(!matches(shop))throw Error(failure);
 provider=createShopifyCredentialProvider({domain:target.domain,fetchImpl,loadCredentials:async()=>{const latest=await privateConfig(config.shopifyConfigPath);if(!matches(latest))throw Error(failure);return {clientId:latest.clientId,clientSecret:latest.clientSecret};}});
 const collected=await collect({connection:target,storeId:target.storeId,resolveCredential:provider.resolveCredential,fetchImpl,maxPages:10});
 if(collected?.status!=='identity_observations_collected'||collected.storeId!==target.storeId||collected.shopId!==target.shopId||!Array.isArray(collected.observations))throw Error(failure);
 const result=await record(db,collected.observations);
 return {status:'identity_observations_recorded',storeId:target.storeId,observationsCollected:collected.observations.length,observationsInserted:result.insertedCount,observationsReplayed:result.replayCount,financialDataChanged:false,customerMetricsDerived:false};
 }catch{throw Error(failure);}finally{provider?.invalidate();try{await pool?.end();}catch{throw Error(failure);}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await runDevelopmentCustomerIdentity(parseIdentityArguments(process.argv.slice(2)))));}catch{console.error(failure);process.exitCode=1;}}
