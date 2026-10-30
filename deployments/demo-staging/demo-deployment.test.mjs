import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm,mkdir,writeFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {prepareDemoReaderDeployment,DEMO_READER_MODULES} from './prepare-demo-reader-deployment.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const sha=b=>createHash('sha256').update(b).digest('hex');
test('frozen independent package has exact source closure, provenance and credential-free disabled real CLI entry points',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'demo-package-')),out=join(parent,'build');
 try{
  const result=await prepareDemoReaderDeployment(out);assert.equal(result.modules,19);
  const provenance=JSON.parse(await readFile(join(out,'source-provenance.json')));
  assert.deepEqual(Object.keys(provenance).sort(),[...DEMO_READER_MODULES,'deployments/demo-staging/demo-reader.manifest.json'].sort());
  for(const file of DEMO_READER_MODULES){
   const body=await readFile(join(out,file));assert.equal(sha(body),provenance[file]);assert.equal(sha(body),sha(await readFile(join(root,file))));
   execFileSync(process.execPath,['--check',join(out,file)],{stdio:'pipe'});
   for(const match of body.toString().matchAll(/(?:from\s*|import\s*\()(['"])(\.[^'"]+)\1/g)){
    const target=resolve(dirname(join(out,file)),match[2]);assert.ok(DEMO_READER_MODULES.some(f=>join(out,f)===target),`${file} imports unpackaged ${match[2]}`);
   }
  }
  const boundary=JSON.parse(await readFile(join(out,'deployment-boundary.json')));for(const key of ['refreshEnabledByPackage','scheduleInstalled','providerBusinessWritesIncluded','customerAppIncluded','writerRuntimeIncluded','oldReaderRuntimeIncluded','hostingAutoCancelled'])assert.equal(boundary[key],false);
  assert.equal(boundary.intakeHardStop,'2026-11-06T03:00:00.000Z');
  const lock=await readFile(join(out,'pnpm-lock.yaml'));assert.equal(sha(lock),JSON.parse(await readFile(join(root,'deployments/demo-staging/demo-reader-lock-provenance.json'))).lockSha256);
  assert.deepEqual((await readdir(out)).sort(),['deployment-boundary.json','deployments','experiments','package.json','pnpm-lock.yaml','source-provenance.json']);
  for(const entry of ['run-demo-refresh','run-demo-preflight','run-demo-daily-cron']){
   const receipt=JSON.parse(execFileSync(process.execPath,[join(out,`deployments/demo-staging/${entry}.mjs`)],{env:{PATH:process.env.PATH},encoding:'utf8'}));assert.equal(receipt.state,'disabled');
  }
 }finally{await rm(parent,{recursive:true,force:true});}
});
test('dirty output and symlinks rejected before copies; no inherited secret or foreign runner survives preparation',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'demo-package-dirty-'));
 try{
  for(const forbidden of ['.env','run-provider-test-programme.mjs','deployments/foreign.mjs']){
   const out=join(parent,forbidden.replaceAll('/','-'));await mkdir(dirname(join(out,forbidden)),{recursive:true});await writeFile(join(out,forbidden),'synthetic sentinel');
   await assert.rejects(prepareDemoReaderDeployment(out));assert.equal(await readFile(join(out,forbidden),'utf8'),'synthetic sentinel');await assert.rejects(readFile(join(out,'package.json')));
  }
  const out=join(parent,'link');await symlink(root,out);await assert.rejects(prepareDemoReaderDeployment(out));
  await assert.rejects(prepareDemoReaderDeployment(root));
 }finally{await rm(parent,{recursive:true,force:true});}
});
