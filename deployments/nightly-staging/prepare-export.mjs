import {readFile,writeFile,realpath,lstat,readdir,unlink} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
const target='bioalckltvkhlczusdvl';
const exists=async path=>{try{await lstat(path);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
/** Do not follow links while discovering deployment metadata in an export. */
export async function workerArtifactManifests(root){
 const found=[];
 async function walk(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
   if(['node_modules','.git'].includes(entry.name))continue;
   const path=join(directory,entry.name);
   if(entry.isSymbolicLink())throw Error('Refusing linked export paths');
   if(entry.isDirectory())await walk(path);
   else if(entry.name==='artifact.toml'&&dirname(path).endsWith('/.replit-artifact')){
    if(!entry.isFile())throw Error('Expected regular artifact manifest');
    found.push(path);
   }
  }
 }
 await walk(root);return found.sort();
}
/** Operates only on an explicitly acknowledged, separate scheduled-worker export. */
export async function prepareWorkerExport(directory,confirmation){
 if(confirmation!==target)throw Error('Explicit staging export confirmation required');
 const root=await realpath(directory);
 for(let parent=root;;parent=dirname(parent)){
  if(await exists(join(parent,'.git')))throw Error('Refusing Git checkout; prepare a separate worker export');
  if(dirname(parent)===parent)break;
 }
 for(const name of ['.replit','pnpm-workspace.yaml','.npmrc','pnpm-lock.yaml','package.json','lib/db/package.json'])if(!(await lstat(join(root,name))).isFile())throw Error('Expected regular export files');
 const deployment=await readFile(join(root,'.replit'),'utf8');
 if(!deployment.includes('deploymentTarget = "scheduled"')||!deployment.includes(`--confirm-target ${target}/56d92f8a-746e-4b4f-b408-81fc98c4aa17`)||deployment.includes('futkktdebdygsdrcknpr'))throw Error('Expected separate staging scheduled-worker configuration');
 const workspace=await readFile(join(root,'pnpm-workspace.yaml'),'utf8');
 if(!/^packages:\n(?:  - [^\n]+\n)+\n/.test(workspace))throw Error('Unexpected workspace layout');
 const narrowed=workspace.replace(/^packages:\n(?:  - [^\n]+\n)+\n/,'packages:\n  - lib/db\n\n');
 const npmrc=await readFile(join(root,'.npmrc'),'utf8');
 const retained=npmrc.split('\n').filter(line=>!/^\s*(production|ignore-scripts|frozen-lockfile|confirm-modules-purge|ci)\s*=/.test(line)).join('\n').trimEnd();
 const manifests=await workerArtifactManifests(root);
 // Replit artifact discovery overrides the scheduled run command when these
 // website manifests survive an export. Remove metadata only, never app code.
 for(const manifest of manifests)await unlink(manifest);
 await writeFile(join(root,'pnpm-workspace.yaml'),narrowed);
 await writeFile(join(root,'.npmrc'),`${retained}\nproduction=true\nignore-scripts=true\nfrozen-lockfile=true\nci=true\n`);
 return {state:'staging_export_prepared',workspace:'lib/db',productionOnly:true,lifecycleScripts:false,lockfile:'unchanged',artifactManifestsRemoved:manifests.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);
 if(args.length!==4||args[0]!=='--export-dir'||args[2]!=='--confirm-staging-export')throw Error('Use --export-dir PATH --confirm-staging-export PROJECT');
 console.log(JSON.stringify(await prepareWorkerExport(args[1],args[3])));
}
