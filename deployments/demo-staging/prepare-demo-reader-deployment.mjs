import {mkdir,readFile,readdir,lstat,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {resolve,join,dirname,relative,sep} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
const source=dirname(fileURLToPath(import.meta.url)),root=resolve(source,'../..'),sha=value=>createHash('sha256').update(value).digest('hex');
export const DEMO_READER_MODULES=Object.freeze([
 ...['demo-intake-window','demo-envelope-crypto','demo-config','demo-database-identity','demo-query-port','demo-source-primitives','demo-preflight','demo-refresh','run-demo-refresh','run-demo-preflight','run-demo-daily-cron','demo-readiness'].map(n=>'deployments/demo-staging/'+n+'.mjs'),
 'deployments/nightly-staging/xero-completed-periods.mjs','deployments/nightly-staging/xero-cron-window.mjs',
 ...['read-only-period-snapshot','staging-refresh-orchestrator','account-mapping-contract','selected-account-totals','accounting-reader-contract','evidence-summary'].map(n=>'experiments/xero/'+n+'.mjs')
]);
/** File preparation only. Copies fixed source closure, never config/secrets/fixtures. */
export async function prepareDemoReaderDeployment(target){
 if(typeof target!=='string'||!target)throw Error('Separate demo output required');const output=resolve(target);if(output===root||root.startsWith(output+sep)||output===source||source.startsWith(output+sep)||output===sep)throw Error('Separate demo output required');
 const manifestPath='deployments/demo-staging/demo-reader.manifest.json',files=[...DEMO_READER_MODULES,manifestPath,'package.json','pnpm-lock.yaml','source-provenance.json','deployment-boundary.json'],allowedFiles=new Set(files),dirs=new Set();for(const f of files){let d=dirname(f);while(d!=='.'){dirs.add(d);d=dirname(d);}}
 async function check(dir,base=''){let entries;try{if((await lstat(dir)).isSymbolicLink())throw Error('Unsafe demo output');entries=await readdir(dir,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return;throw e;}
  for(const e of entries){const path=base?base+'/'+e.name:e.name;if(e.isSymbolicLink())throw Error('Unsafe demo output');if(path==='node_modules'&&e.isDirectory())continue;if(e.isFile()&&allowedFiles.has(path))continue;if(e.isDirectory()&&dirs.has(path)){await check(join(dir,e.name),path);continue;}throw Error('Demo output contains unrelated files');}
 }
 await check(output);
 const manifest=JSON.parse(await readFile(join(root,manifestPath),'utf8')),lock=await readFile(join(source,'demo-reader-pnpm-lock.yaml')),proof=JSON.parse(await readFile(join(source,'demo-reader-lock-provenance.json'),'utf8'));
 if(manifest.private!==true||manifest.type!=='module'||manifest.engines?.node!=='>=24 <25'||JSON.stringify(manifest.dependencies)!==JSON.stringify({pg:'8.20.0'})||sha(lock)!==proof.lockSha256||sha(await readFile(join(root,'pnpm-lock.yaml')))!==proof.sourceSha256)throw Error('Review demo reader lock provenance');
 const modules=await Promise.all([...DEMO_READER_MODULES,manifestPath].map(async name=>({name,body:await readFile(join(root,name))})));
 for(const {name,body} of modules){await mkdir(dirname(join(output,name)),{recursive:true});await writeFile(join(output,name),body);}
 await writeFile(join(output,'package.json'),JSON.stringify(manifest,null,2)+'\n');await writeFile(join(output,'pnpm-lock.yaml'),lock);
 await writeFile(join(output,'source-provenance.json'),JSON.stringify(Object.fromEntries(modules.map(({name,body})=>[name,sha(body)])),null,2)+'\n');
 await writeFile(join(output,'deployment-boundary.json'),JSON.stringify({purpose:'isolated_gbp_demo_reader',projectRef:'bioalckltvkhlczusdvl',storeId:'f59e3a44-7106-4df8-9c08-52da30c9de30',schema:'xero_demo_v1',login:'night_scout_demo_import_login',serviceRole:'night_scout_demo_import_service',refreshEnabledByPackage:false,scheduleInstalled:false,providerBusinessWritesIncluded:false,customerAppIncluded:false,writerRuntimeIncluded:false,oldReaderRuntimeIncluded:false,sharedPeriodAndCalculationHelpersOnly:true,writerTenantMatchNotInferred:true,intakeStart:'2026-10-30T00:00:00.000Z',intakeHardStop:'2026-11-06T03:00:00.000Z',hostingAutoCancelled:false,dependencySnapshots:14},null,2)+'\n');
 return {state:'demo_reader_deployment_prepared',modules:DEMO_READER_MODULES.length,dependencySnapshots:14,output,refreshEnabled:false,scheduleInstalled:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const r=await prepareDemoReaderDeployment(process.argv[2]);process.stdout.write(JSON.stringify({state:r.state,modules:r.modules,dependencySnapshots:r.dependencySnapshots,refreshEnabled:false,scheduleInstalled:false})+'\n');}catch{process.stderr.write('Demo reader deployment preparation unavailable\n');process.exitCode=1;}}
