import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,mkdir,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareWorkerExport,workerArtifactManifests} from './prepare-export.mjs';
const source=fileURLToPath(new URL('../../',import.meta.url)),target='bioalckltvkhlczusdvl';
async function fixture(){const dir=await mkdtemp(join(tmpdir(),'night-scout-worker-export-'));await mkdir(join(dir,'lib/db'),{recursive:true});for(const file of ['package.json','pnpm-workspace.yaml','.npmrc','pnpm-lock.yaml','lib/db/package.json'])await cp(join(source,file),join(dir,file));await cp(join(source,'deployments/nightly-staging/replit-worker.toml'),join(dir,'.replit'));return dir;}
test('narrows only exported workspace and installation policy; preserves manifests, catalogs and frozen lock',async()=>{const dir=await fixture();try{const names=['package.json','lib/db/package.json','pnpm-lock.yaml'],before=await Promise.all(names.map(n=>readFile(join(dir,n),'utf8')));const ws=await readFile(join(dir,'pnpm-workspace.yaml'),'utf8');await prepareWorkerExport(dir,target);const changed=await readFile(join(dir,'pnpm-workspace.yaml'),'utf8');assert.ok(changed.startsWith('packages:\n  - lib/db\n\n'));assert.equal(changed.slice(changed.indexOf('autoInstallPeers:')),ws.slice(ws.indexOf('autoInstallPeers:')));assert.deepEqual(await Promise.all(names.map(n=>readFile(join(dir,n),'utf8'))),before);const npm=await readFile(join(dir,'.npmrc'),'utf8');for(const value of ['production=true','ignore-scripts=true','frozen-lockfile=true','ci=true'])assert.ok(npm.includes(value));await prepareWorkerExport(dir,target);assert.equal(await readFile(join(dir,'.npmrc'),'utf8'),npm);}finally{await rm(dir,{recursive:true,force:true});}});
test('refuses unacknowledged, Git checkout and website exports before writes',async()=>{const dir=await fixture();try{await assert.rejects(prepareWorkerExport(dir,'wrong'),/confirmation/);await mkdir(join(dir,'.git'));await assert.rejects(prepareWorkerExport(dir,target),/Git checkout/);await rm(join(dir,'.git'),{recursive:true});await writeFile(join(dir,'.replit'),'deploymentTarget = "autoscale"');await assert.rejects(prepareWorkerExport(dir,target),/scheduled-worker/);assert.equal(await readFile(join(dir,'pnpm-workspace.yaml'),'utf8'),await readFile(join(source,'pnpm-workspace.yaml'),'utf8'));}finally{await rm(dir,{recursive:true,force:true});}});
test('removes all website deployment manifests only from export, preserves website source, and is repeatable',async()=>{
 const dir=await fixture();const names=['api-server','virtual-cfo','mockup-sandbox'];
 const originals=await Promise.all(names.map(name=>readFile(join(source,'artifacts',name,'.replit-artifact/artifact.toml'),'utf8')));
 try{
  for(let i=0;i<names.length;i++){
   const base=join(dir,'artifacts',names[i]);await mkdir(join(base,'.replit-artifact'),{recursive:true});
   await writeFile(join(base,'.replit-artifact/artifact.toml'),originals[i]);await writeFile(join(base,'source.txt'),'preserve application');
  }
  assert.equal((await workerArtifactManifests(dir)).length,3);
  assert.equal((await prepareWorkerExport(dir,target)).artifactManifestsRemoved,3);
  assert.deepEqual(await workerArtifactManifests(dir),[]);
  assert.equal((await prepareWorkerExport(dir,target)).artifactManifestsRemoved,0);
  for(let i=0;i<names.length;i++){
   assert.equal(await readFile(join(dir,'artifacts',names[i],'source.txt'),'utf8'),'preserve application');
   assert.equal(await readFile(join(source,'artifacts',names[i],'.replit-artifact/artifact.toml'),'utf8'),originals[i]);
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('rejects nested checkout exports and linked artifact paths before mutating files',async()=>{
 const dir=await fixture();const outside=await mkdtemp(join(tmpdir(),'night-scout-artifact-outside-'));
 try{
  await writeFile(join(outside,'artifact.toml'),'preserve external');
  await mkdir(join(dir,'artifacts/example'),{recursive:true});await symlink(outside,join(dir,'artifacts/example/.replit-artifact'));
  await assert.rejects(prepareWorkerExport(dir,target),/linked export/);
  assert.equal(await readFile(join(outside,'artifact.toml'),'utf8'),'preserve external');
  assert.equal(await readFile(join(dir,'pnpm-workspace.yaml'),'utf8'),await readFile(join(source,'pnpm-workspace.yaml'),'utf8'));
  await mkdir(join(dir,'.git'));await mkdir(join(dir,'nested'));
  await assert.rejects(prepareWorkerExport(join(dir,'nested'),target),/Git checkout/);
 }finally{await rm(dir,{recursive:true,force:true});await rm(outside,{recursive:true,force:true});}
});
test('ignores unrelated runtime links and supports exports without artifacts',async()=>{
 const dir=await fixture();
 try{
  await mkdir(join(dir,'.runtime'));await symlink('/unavailable-runtime-target',join(dir,'.runtime/cache'));
  assert.deepEqual(await workerArtifactManifests(dir),[]);
  assert.equal((await prepareWorkerExport(dir,target)).artifactManifestsRemoved,0);
  await mkdir(join(dir,'artifacts/example/.replit-artifact'),{recursive:true});
  await writeFile(join(dir,'artifacts/example/.replit-artifact/artifact.toml'),'kind = "api"');
  assert.equal((await prepareWorkerExport(dir,target)).artifactManifestsRemoved,1);
  assert.deepEqual(await workerArtifactManifests(dir),[]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('rejects linked artifacts root and linked manifest files',async()=>{
 const dir=await fixture();const outside=await mkdtemp(join(tmpdir(),'night-scout-linked-artifacts-'));
 try{
  await writeFile(join(outside,'artifact.toml'),'preserve external');
  await symlink(outside,join(dir,'artifacts'));
  await assert.rejects(prepareWorkerExport(dir,target),/linked export/);
  await rm(join(dir,'artifacts'));await mkdir(join(dir,'artifacts/example/.replit-artifact'),{recursive:true});
  await symlink(join(outside,'artifact.toml'),join(dir,'artifacts/example/.replit-artifact/artifact.toml'));
  await assert.rejects(prepareWorkerExport(dir,target),/linked export/);
  assert.equal(await readFile(join(outside,'artifact.toml'),'utf8'),'preserve external');
  assert.equal(await readFile(join(dir,'pnpm-workspace.yaml'),'utf8'),await readFile(join(source,'pnpm-workspace.yaml'),'utf8'));
 }finally{await rm(dir,{recursive:true,force:true});await rm(outside,{recursive:true,force:true});}
});
