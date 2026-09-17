import {readFile,writeFile,realpath,lstat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const target='bioalckltvkhlczusdvl';
const exists=async path=>{try{await lstat(path);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
/** Operates only on an explicitly acknowledged, separate scheduled-worker export. */
export async function prepareWorkerExport(directory,confirmation){
 if(confirmation!==target)throw Error('Explicit staging export confirmation required');
 const root=await realpath(directory);
 if(await exists(join(root,'.git')))throw Error('Refusing Git checkout; prepare a separate worker export');
 for(const name of ['.replit','pnpm-workspace.yaml','.npmrc','pnpm-lock.yaml','package.json','lib/db/package.json'])if(!(await lstat(join(root,name))).isFile())throw Error('Expected regular export files');
 const deployment=await readFile(join(root,'.replit'),'utf8');
 if(!deployment.includes('deploymentTarget = "scheduled"')||!deployment.includes(`--confirm-target ${target}/56d92f8a-746e-4b4f-b408-81fc98c4aa17`)||deployment.includes('futkktdebdygsdrcknpr'))throw Error('Expected separate staging scheduled-worker configuration');
 const workspace=await readFile(join(root,'pnpm-workspace.yaml'),'utf8');
 if(!/^packages:\n(?:  - [^\n]+\n)+\n/.test(workspace))throw Error('Unexpected workspace layout');
 const narrowed=workspace.replace(/^packages:\n(?:  - [^\n]+\n)+\n/,'packages:\n  - lib/db\n\n');
 const npmrc=await readFile(join(root,'.npmrc'),'utf8');
 const retained=npmrc.split('\n').filter(line=>!/^\s*(production|ignore-scripts|frozen-lockfile|confirm-modules-purge|ci)\s*=/.test(line)).join('\n').trimEnd();
 await writeFile(join(root,'pnpm-workspace.yaml'),narrowed);
 await writeFile(join(root,'.npmrc'),`${retained}\nproduction=true\nignore-scripts=true\nfrozen-lockfile=true\nci=true\n`);
 return {state:'staging_export_prepared',workspace:'lib/db',productionOnly:true,lifecycleScripts:false,lockfile:'unchanged'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);
 if(args.length!==4||args[0]!=='--export-dir'||args[2]!=='--confirm-staging-export')throw Error('Use --export-dir PATH --confirm-staging-export PROJECT');
 console.log(JSON.stringify(await prepareWorkerExport(args[1],args[3])));
}
