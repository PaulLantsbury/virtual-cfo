import {mkdir,readFile,writeFile,copyFile,readdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join,dirname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const source=dirname(fileURLToPath(import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const XERO_CONSENT_MODULES=Object.freeze(['operator-consent-server.mjs','operator-owner-page.mjs','operator-origin.mjs','xero-test-writer-runtime.ts','xero-writer-bootstrap.mjs','xero-writer-bootstrap-router.mjs','writer-database-identity.mjs','writer-envelope-crypto.mjs','writer-oauth-scopes.mjs','xero-writer-source-proof.mjs','xero-reader-context-proof.mjs']);
/** File preparation only: no installs, servers, environment reads, secrets or provider calls. */
export async function prepareXeroConsentDeployment(target){
 if(typeof target!=='string'||!target)throw Error('Separate operator output required');
 const output=resolve(target);
 if(output===source||source.startsWith(output+sep)||output===sep)throw Error('Separate operator output required');
 const allowedOutputs=new Set([...XERO_CONSENT_MODULES,'operator-package.manifest.json','package.json','pnpm-lock.yaml','deployment-boundary.json','node_modules']);
 let existing=[];try{if((await lstat(output)).isSymbolicLink())throw Error('Unsafe consent output entry');existing=await readdir(output);}catch(error){if(error.code!=='ENOENT')throw error;}
 if(existing.some(name=>!allowedOutputs.has(name)))throw Error('Consent output contains unrelated files');
 // Reject symlinks, including an existing node_modules link back into the customer app.
 for(const name of existing){const entry=await lstat(join(output,name));if(entry.isSymbolicLink()||(name==='node_modules'?!entry.isDirectory():!entry.isFile()))throw Error('Unsafe consent output entry');}
 const manifest=JSON.parse(await readFile(join(source,'operator-package.manifest.json'),'utf8'));
 const provenance=JSON.parse(await readFile(join(source,'xero-consent-lock-provenance.json'),'utf8'));
 const lock=await readFile(join(source,'xero-consent-operator-pnpm-lock.yaml'));
 const rootLock=await readFile(join(source,'../../pnpm-lock.yaml'));
 const sorted=value=>JSON.stringify(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
 if(manifest.private!==true||manifest.type!=='module'||manifest.engines?.node!=='>=24 <25'||sorted(manifest.dependencies)!==sorted(provenance.dependencies)||sha(lock)!==provenance.lockSha256||sha(rootLock)!==provenance.sourceSha256)throw Error('Review isolated operator lock provenance');
 // Validate all inputs before creating output, so a missing UI module cannot leave a
 // seemingly complete package behind. No test fixtures or writer runner are included.
 await Promise.all(XERO_CONSENT_MODULES.map(name=>readFile(join(source,name))));
 await mkdir(output,{recursive:true});
 for(const name of XERO_CONSENT_MODULES)await copyFile(join(source,name),join(output,name));
 await writeFile(join(output,'operator-package.manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 await writeFile(join(output,'package.json'),JSON.stringify({...manifest,scripts:{start:'node --experimental-strip-types operator-consent-server.mjs'}},null,2)+'\n');
 await writeFile(join(output,'pnpm-lock.yaml'),lock);
 await writeFile(join(output,'deployment-boundary.json'),JSON.stringify({purpose:'isolated_xero_owner_consent_only',generationEnabled:false,scheduleInstalled:false,providerWriteRunnerIncluded:false,customerAppIncluded:false,dependencySnapshots:provenance.snapshotCount,node:'24',healthPath:'/health',operatorOrigin:'must_be_explicit_separate_HTTPS_origin'},null,2)+'\n');
 return Object.freeze({state:'xero_consent_deployment_prepared',modules:XERO_CONSENT_MODULES.length,dependencySnapshots:provenance.snapshotCount,output,generationEnabled:false,scheduleInstalled:false});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const result=await prepareXeroConsentDeployment(process.argv[2]);process.stdout.write(JSON.stringify({state:result.state,modules:result.modules,dependencySnapshots:result.dependencySnapshots,generationEnabled:false,scheduleInstalled:false})+'\n');}
 catch{process.stderr.write('Xero consent deployment preparation unavailable\n');process.exitCode=1;}
}
