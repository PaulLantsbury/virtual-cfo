import {mkdir,readFile,writeFile,readdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join,dirname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const source=dirname(fileURLToPath(import.meta.url)),root=resolve(source,'../..');
export const DEMO_CONSENT_MODULES=Object.freeze(['reader-consent-server.mjs','reader-consent-runtime.mjs','operator-owner-page.mjs','operator-origin.mjs','demo-envelope-crypto.mjs','demo-database-identity.mjs']);
const sourcePaths={'reader-consent-server.mjs':'experiments/xero-demo/reader-consent-server.mjs','reader-consent-runtime.mjs':'experiments/xero-demo/reader-consent-runtime.mjs','operator-owner-page.mjs':'experiments/test-programme/operator-owner-page.mjs','operator-origin.mjs':'experiments/test-programme/operator-origin.mjs','demo-envelope-crypto.mjs':'deployments/demo-staging/demo-envelope-crypto.mjs','demo-database-identity.mjs':'deployments/demo-staging/demo-database-identity.mjs'};
const sha=value=>createHash('sha256').update(value).digest('hex'),sorted=value=>JSON.stringify(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
export async function prepareDemoReaderConsentDeployment(target){
 if(typeof target!=='string'||!target)throw Error('Separate Demo consent output required');const output=resolve(target);
 if(output===source||source.startsWith(output+sep)||output===sep||output===root||root.startsWith(output+sep))throw Error('Separate Demo consent output required');
 const allowed=new Set([...DEMO_CONSENT_MODULES,'demo-reader-package.manifest.json','package.json','pnpm-lock.yaml','deployment-boundary.json','node_modules']);
 let entries=[];try{if((await lstat(output)).isSymbolicLink())throw Error('Unsafe Demo output');entries=await readdir(output);}catch(error){if(error.code!=='ENOENT')throw error;}
 if(entries.some(name=>!allowed.has(name)))throw Error('Unrelated Demo output files');for(const name of entries){const stat=await lstat(join(output,name));if(stat.isSymbolicLink()||(name==='node_modules'?!stat.isDirectory():!stat.isFile()))throw Error('Unsafe Demo output');}
 const manifest=JSON.parse(await readFile(join(source,'demo-reader-package.manifest.json'),'utf8')),provenance=JSON.parse(await readFile(join(root,'experiments/test-programme/xero-consent-lock-provenance.json'),'utf8')),lock=await readFile(join(root,'experiments/test-programme/xero-consent-operator-pnpm-lock.yaml')),rootLock=await readFile(join(root,'pnpm-lock.yaml'));
 if(manifest.private!==true||manifest.type!=='module'||manifest.engines?.node!=='>=24 <25'||sorted(manifest.dependencies)!==sorted(provenance.dependencies)||sha(lock)!==provenance.lockSha256||sha(rootLock)!==provenance.sourceSha256)throw Error('Review Demo dependency provenance');
 const modules=await Promise.all(DEMO_CONSENT_MODULES.map(async name=>[name,await readFile(join(root,sourcePaths[name]),'utf8')]));
 // Fixed relocation only; no alternate source/runtime composition is generated.
 const relocate=text=>text.replaceAll("'../test-programme/operator-origin.mjs'","'./operator-origin.mjs'").replaceAll("'../test-programme/operator-owner-page.mjs'","'./operator-owner-page.mjs'").replaceAll("'../../deployments/demo-staging/demo-envelope-crypto.mjs'","'./demo-envelope-crypto.mjs'").replaceAll("'../../deployments/demo-staging/demo-database-identity.mjs'","'./demo-database-identity.mjs'");
 await mkdir(output,{recursive:true});for(const [name,text] of modules)await writeFile(join(output,name),relocate(text));
 await writeFile(join(output,'demo-reader-package.manifest.json'),JSON.stringify(manifest,null,2)+'\n');await writeFile(join(output,'package.json'),JSON.stringify(manifest,null,2)+'\n');await writeFile(join(output,'pnpm-lock.yaml'),lock);
 await writeFile(join(output,'deployment-boundary.json'),JSON.stringify({purpose:'isolated_demo_reader_consent_only',modules:DEMO_CONSENT_MODULES.length,node:'24',healthPath:'/health',generationEnabled:false,providerWritesIncluded:false,schedulerIncluded:false,readerJobIncluded:false,customerAppIncluded:false,dependencySnapshots:provenance.snapshotCount,lockSha256:sha(lock),sourceLockSha256:sha(rootLock)},null,2)+'\n');return {state:'demo_reader_consent_deployment_prepared',modules:DEMO_CONSENT_MODULES.length,dependencySnapshots:provenance.snapshotCount,output};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const result=await prepareDemoReaderConsentDeployment(process.argv[2]);process.stdout.write(JSON.stringify({state:result.state,modules:result.modules,dependencySnapshots:result.dependencySnapshots})+'\n');}catch{process.stderr.write('Demo reader consent package unavailable\n');process.exitCode=1;}}
