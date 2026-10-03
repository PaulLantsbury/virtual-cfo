import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createShopifyCredentialProvider} from './credential-provider.mjs';
import {verifyShopifyConnection} from './verify-connection.mjs';
import {createShopifyReader} from './client.mjs';
import {collectShopifyOrders} from './collect.mjs';

const message='Shopify development check failed; verify the private configuration, app access and connection. No database import was attempted.';
async function readPrivateConfiguration(path){
 if(typeof path!=='string'||!path)throw new Error(message);
 const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const stat=await file.stat();
  if(!stat.isFile()||(stat.mode&0o077)!==0||stat.uid!==process.getuid()||stat.size>16384)throw new Error(message);
  const value=JSON.parse(await file.readFile('utf8'));
  if(!value||Array.isArray(value)||typeof value!=='object')throw new Error(message);
  return value;
 }finally{await file.close();}
}

/** Explicit private file only; no environment/default store fallback. Reads
 * Shopify context and optionally bounded order summaries, never database data.
 * Returns only allowlisted metadata/counts, never source records or credentials.
 */
export async function checkDevelopmentConnection({configPath,readOrders=false,fetchImpl=globalThis.fetch}={}){
 let provider;
 try{
  if(typeof readOrders!=='boolean')throw new Error(message);
  const config=await readPrivateConfiguration(configPath);
  const connection=Object.freeze({domain:config.domain,shopId:config.shopId,currency:config.currency,timezone:config.timezone});
  provider=createShopifyCredentialProvider({domain:connection.domain,fetchImpl,loadCredentials:async()=>{
   const latest=await readPrivateConfiguration(configPath);
   if(['domain','shopId','currency','timezone'].some(key=>latest[key]!==connection[key]))throw new Error(message);
   return {clientId:latest.clientId,clientSecret:latest.clientSecret};
  }});
  const verified=await verifyShopifyConnection({connection,resolveCredential:provider.resolveCredential,fetchImpl});
  if(!readOrders)return verified;
  const read=createShopifyReader({domain:connection.domain,accessToken:await provider.resolveCredential(connection),fetchImpl});
  const extracted=await collectShopifyOrders(read,connection);
  if(['domain','shopId','currency','timezone'].some(key=>extracted.settings[key]!==connection[key]))throw new Error(message);
  return {...verified,status:'order_summaries_read',ordersCollected:true,
   sourceOrderCount:extracted.orders.length,testOrderCount:extracted.orders.filter(order=>order.test).length,
   sourceRefundCount:extracted.orders.reduce((sum,order)=>sum+order.refunds.length,0),
   reviewFlagCount:extracted.review.length,pageCount:extracted.pages.length,
   financialEligibilityAssessed:false,detailMappingCompleted:false,
   limitations:['NOT_SNAPSHOT_ISOLATED','SUMMARY_ONLY','SOURCE_RECONCILIATION_PENDING']};
 }catch{throw new Error(message);}finally{provider?.invalidate();}
}

export function parseDevelopmentCheckArguments(args){
 let configPath,readOrders=false;
 for(let i=0;i<args.length;i++){
  if(args[i]==='--config'&&configPath===undefined&&args[i+1]&&!args[i+1].startsWith('--'))configPath=args[++i];
  else if(args[i]==='--read-orders'&&!readOrders)readOrders=true;
  else throw new Error('Usage: node experiments/shopify/check-development-connection.mjs --config <private-file> [--read-orders]');
 }
 if(!configPath)throw new Error('Usage: node experiments/shopify/check-development-connection.mjs --config <private-file> [--read-orders]');
 return {configPath,readOrders};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const result=await checkDevelopmentConnection(parseDevelopmentCheckArguments(process.argv.slice(2)));process.stdout.write(`${JSON.stringify(result,null,2)}\n`);}
 catch{process.stderr.write(`${message}\nUsage: node experiments/shopify/check-development-connection.mjs --config <private-file> [--read-orders]\n`);process.exitCode=1;}
}
