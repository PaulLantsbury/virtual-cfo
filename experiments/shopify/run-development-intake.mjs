import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {INTAKE_TARGET,initialiseIntakeRuntime,intakeConnectionOptions} from './intake-runtime.mjs';
import {createShopifyCredentialProvider} from './credential-provider.mjs';
const failure='Development intake outcome unconfirmed; inspect configuration and candidate state before retrying. No financial approval was performed.';
const usage='Usage: node experiments/shopify/run-development-intake.mjs --config <private-file> [--check | --record --confirm-target <project/store>]';
async function privateConfig(path){
 const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const stat=await file.stat();if(!stat.isFile()||(stat.mode&0o077)!==0||stat.uid!==process.getuid()||stat.size>16384)throw Error(failure);const data=JSON.parse(await file.readFile('utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw Error(failure);return data;}finally{await file.close();}
}
export function parseIntakeArguments(args){
 let configPath,mode,confirmTarget;
 for(let i=0;i<args.length;i++){
 if(args[i]==='--config'&&configPath===undefined&&args[i+1]&&!args[i+1].startsWith('--'))configPath=args[++i];
 else if(['--check','--record'].includes(args[i])&&mode===undefined)mode=args[i].slice(2);
 else if(args[i]==='--confirm-target'&&confirmTarget===undefined&&args[i+1]&&!args[i+1].startsWith('--'))confirmTarget=args[++i];
 else throw Error(usage);
 }
 mode??='check';
 if(!configPath||(mode==='record'&&confirmTarget!==`${INTAKE_TARGET.projectRef}/${INTAKE_TARGET.storeId}`)||(mode==='check'&&confirmTarget!==undefined))throw Error(usage);
 return {configPath,mode,confirmTarget};
}
export async function runDevelopmentIntake({configPath,mode='check',confirmTarget},{createPool,fetchImpl=globalThis.fetch,initialise=initialiseIntakeRuntime}={}){
 let runtime,provider;
 try{
 if(!['check','record'].includes(mode)||(mode==='record'&&confirmTarget!==`${INTAKE_TARGET.projectRef}/${INTAKE_TARGET.storeId}`)||(mode==='check'&&confirmTarget!==undefined))throw Error(failure);
 const config=await privateConfig(configPath);const options=intakeConnectionOptions(config);
 // First exercise is deliberately at most one month; source collection still
 // covers full available history so refunds against older orders are not lost.
 if((Date.parse(options.scope.to)-Date.parse(options.scope.from))/86400000>=31)throw Error(failure);
 const shop=await privateConfig(config.shopifyConfigPath);
 const matches=value=>['domain','shopId','currency','timezone'].every(k=>value[k]===INTAKE_TARGET[k]);
 if(!matches(shop))throw Error(failure);
 provider=createShopifyCredentialProvider({domain:INTAKE_TARGET.domain,fetchImpl,loadCredentials:async()=>{const latest=await privateConfig(config.shopifyConfigPath);if(!matches(latest))throw Error(failure);return {clientId:latest.clientId,clientSecret:latest.clientSecret};}});
 if(!createPool){const require=createRequire(new URL('../../lib/db/package.json',import.meta.url));const {Pool}=require('pg');createPool=options=>new Pool(options);}
 runtime=await initialise(config,{createPool,resolveCredential:provider.resolveCredential,fetchImpl});
 if(mode==='check')return {status:'intake_configuration_checked',projectRef:INTAKE_TARGET.projectRef,storeId:INTAKE_TARGET.storeId,from:options.scope.from,to:options.scope.to,candidateWriteAttempted:false,shopifyAuthenticationChecked:false,financeImported:false,coverageCertified:false};
 return await runtime.run({confirmTarget,maxPages:100});
 }catch{throw Error(failure);}finally{provider?.invalidate();try{await runtime?.close();}catch{throw Error(failure);}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const receipt=await runDevelopmentIntake(parseIntakeArguments(process.argv.slice(2)));process.stdout.write(`${JSON.stringify(receipt,null,2)}\n`);}
 catch{process.stderr.write(`${failure}\n${usage}\n`);process.exitCode=1;}
}
