import {mkdir,readFile,writeFile,readdir,lstat} from 'node:fs/promises';import {createHash} from 'node:crypto';import {resolve,join,dirname,sep} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
const source=dirname(fileURLToPath(import.meta.url)),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const XERO_GENERATION_MODULES=Object.freeze(['xero-generation-entry.mjs','run-provider-test-programme.mjs','provider-write-plan.mjs','provider-transport.mjs','provider-rpc-ledger.mjs','shopify-writer-token.mjs','writer-database-identity.mjs','writer-oauth-scopes.mjs','writer-envelope-crypto.mjs','xero-generation-token-runtime.mjs','xero-writer-refresh.mjs']);
const originalImport="import { decryptStagingEnvelope, encryptStagingEnvelope, refreshXeroCredential } from '../../deployments/nightly-staging/xero-refresh-runtime.mjs';";
const isolatedImport="import { decryptStagingEnvelope, encryptStagingEnvelope, refreshXeroCredential } from './xero-generation-token-runtime.mjs';";
/** Relocate only this import. All durable refresh/rotation/stop behavior is unchanged. */
export function isolateXeroRefreshImport(text){
 if(typeof text!=='string'||!text.startsWith(originalImport)||text.split(originalImport).length!==2)throw Error('Review writer refresh import before packaging');
 const result=text.replace(originalImport,isolatedImport);if(result.includes('../../deployments/')||result.includes('artifacts/'))throw Error('Unexpected external writer import');return result;
}
/** Local files only: does not read environment/secrets, install, schedule or connect. */
export async function prepareXeroGenerationDeployment(target){
 if(typeof target!=='string'||!target)throw Error('Separate generator output required');const output=resolve(target);
 if(output===source||source.startsWith(output+sep)||output===sep)throw Error('Separate generator output required');
 const auxiliary=['operator-package.manifest.json','package.json','pnpm-lock.yaml','deployment-boundary.json','source-provenance.json','xero-programme.example.json'];
 const allowed=new Set([...XERO_GENERATION_MODULES,...auxiliary,'node_modules']);let existing=[];
 try{if((await lstat(output)).isSymbolicLink())throw Error('Unsafe generator output');existing=await readdir(output);}catch(error){if(error.code!=='ENOENT')throw error;}
 if(existing.some(name=>!allowed.has(name)))throw Error('Generator output contains unrelated files');
 for(const name of existing){const entry=await lstat(join(output,name));if(entry.isSymbolicLink()||(name==='node_modules'?!entry.isDirectory():!entry.isFile()))throw Error('Unsafe generator output');}
 const manifest=JSON.parse(await readFile(join(source,'xero-generation.manifest.json'),'utf8')),provenance=JSON.parse(await readFile(join(source,'xero-generation-lock-provenance.json'),'utf8')),lock=await readFile(join(source,'xero-generation-pnpm-lock.yaml'));
 if(manifest.private!==true||manifest.type!=='module'||manifest.engines?.node!=='>=24 <25'||JSON.stringify(manifest.dependencies)!==JSON.stringify({pg:'8.20.0'})||JSON.stringify(provenance.dependencies)!==JSON.stringify(manifest.dependencies)||sha(lock)!==provenance.lockSha256||sha(await readFile(join(source,'../../pnpm-lock.yaml')))!==provenance.sourceSha256)throw Error('Review isolated generator lock provenance');
 const modules=await Promise.all(XERO_GENERATION_MODULES.map(async name=>{const original=await readFile(join(source,name),'utf8'),text=name==='xero-writer-refresh.mjs'?isolateXeroRefreshImport(original):original;return {name,original,text};}));
 await mkdir(output,{recursive:true});for(const {name,text} of modules)await writeFile(join(output,name),text);
 await writeFile(join(output,'operator-package.manifest.json'),JSON.stringify(manifest,null,2)+'\n');await writeFile(join(output,'package.json'),JSON.stringify(manifest,null,2)+'\n');await writeFile(join(output,'pnpm-lock.yaml'),lock);
 await writeFile(join(output,'source-provenance.json'),JSON.stringify(Object.fromEntries(modules.map(({name,original,text})=>[name,{sourceSha256:sha(original),packagedSha256:sha(text),transform:name==='xero-writer-refresh.mjs'?'relocate_token_primitive_import_only':'none'}])),null,2)+'\n');
 await writeFile(join(output,'deployment-boundary.json'),JSON.stringify({purpose:'isolated_xero_test_generation_only',generationEnabledByPackage:false,scheduleInstalled:false,customerAppIncluded:false,readerRuntimeIncluded:false,consentServerIncluded:false,sharedUnusedShopifyTokenAdapterIncluded:true,shopifyCredentialsRequired:false,dependencySnapshots:provenance.snapshotCount,programmeKey:'xero-staging-20261030',scheduleProfile:'daily-xero-20261030-v1',startsAt:'2026-10-30T00:00:00.000Z',endsAt:'2026-11-06T00:00:00.000Z',actionCap:7,unitPostedPence:1000,realPaymentPence:0,proposalApprovedByPackage:false},null,2)+'\n');
 // Deliberately not executable: actual IDs/code must come from verified consent proof.
 await writeFile(join(output,'xero-programme.example.json'),JSON.stringify({provider:'xero',target:null,startMonday:'2026-10-26',programmeKey:'xero-staging-20261030',scheduleProfile:'daily-xero-20261030-v1',contactId:null,accountCode:null,financialMode:'posted_demo_only'},null,2)+'\n');
 return Object.freeze({state:'xero_generation_deployment_prepared',modules:modules.length,dependencySnapshots:provenance.snapshotCount,output,generationEnabled:false,scheduleInstalled:false});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const r=await prepareXeroGenerationDeployment(process.argv[2]);process.stdout.write(JSON.stringify({state:r.state,modules:r.modules,dependencySnapshots:r.dependencySnapshots,generationEnabled:false,scheduleInstalled:false})+'\n');}catch{process.stderr.write('Xero generation deployment preparation unavailable\n');process.exitCode=1;}}
