import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile,rm,mkdir,copyFile,appendFile,access,writeFile,symlink} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve,dirname} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {prepareXeroConsentDeployment,XERO_CONSENT_MODULES} from './prepare-xero-consent-deployment.mjs';
const source=dirname(fileURLToPath(import.meta.url)),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
test('consent-only package contains its own frozen dependencies and no customer/writer runner',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ns-xero-consent-'));try{
 const result=await prepareXeroConsentDeployment(dir);assert.equal(result.modules,9);assert.equal(result.dependencySnapshots,92);assert.equal(result.generationEnabled,false);assert.equal(result.scheduleInstalled,false);
 const names=await readdir(dir);assert.deepEqual(names.sort(),[...XERO_CONSENT_MODULES,'operator-package.manifest.json','package.json','pnpm-lock.yaml','deployment-boundary.json'].sort());
 const manifest=JSON.parse(await readFile(join(dir,'package.json'),'utf8'));assert.equal(manifest.private,true);assert.equal(manifest.type,'module');assert.equal(manifest.engines.node,'>=24 <25');assert.equal(manifest.scripts.start,'node --experimental-strip-types operator-consent-server.mjs');assert.deepEqual(manifest.dependencies,{express:'5.2.1',pg:'8.20.0','@supabase/supabase-js':'2.100.1'});
 const lock=await readFile(join(dir,'pnpm-lock.yaml'),'utf8');assert.match(lock,/lockfileVersion: '9.0'/);assert.match(lock,/autoInstallPeers: false/);assert.match(lock,/sha512-/);assert.doesNotMatch(lock,/(?:^|[\s'"])(?:link|workspace|file|catalog):/m);
 const provenance=JSON.parse(await readFile(join(source,'xero-consent-lock-provenance.json'),'utf8'));assert.equal(sha(lock),provenance.lockSha256);assert.equal(sha(await readFile(join(source,'../../pnpm-lock.yaml'))),provenance.sourceSha256);assert.equal(provenance.packageCount,92);
 assert.equal(names.some(name=>/\.env|programme\.json|test\.mjs|run-provider|xero-writer-refresh|shopify/.test(name)),false);
 const boundary=JSON.parse(await readFile(join(dir,'deployment-boundary.json'),'utf8'));assert.equal(boundary.providerWriteRunnerIncluded,false);assert.equal(boundary.customerAppIncluded,false);assert.equal(boundary.healthPath,'/health');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('all local imports stay inside copied consent tree and every module parses independently',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ns-xero-graph-'));try{await prepareXeroConsentDeployment(dir);
 for(const name of XERO_CONSENT_MODULES){const body=await readFile(join(dir,name),'utf8');for(const match of body.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){
 const specifier=match[1];if(specifier.startsWith('node:'))continue;assert.ok(specifier.startsWith('./'),'No repository/app import: '+name);assert.ok(XERO_CONSENT_MODULES.includes(specifier.slice(2)),'Copied local dependency: '+specifier);
 }execFileSync(process.execPath,['--check',join(dir,name)],{stdio:'pipe'});}
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('packager rejects source/ancestor output paths without touching repository',async()=>{
 for(const path of [undefined,'',source,resolve(source,'..'),resolve(source,'../..'),'/'])await assert.rejects(prepareXeroConsentDeployment(path));
});

test('tampered isolated or source lock fails before producing a deployable tree',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ns-xero-lock-'));try{
 const fakeSource=join(dir,'experiments/test-programme');await mkdir(fakeSource,{recursive:true});
 for(const name of ['prepare-xero-consent-deployment.mjs','operator-package.manifest.json','xero-consent-lock-provenance.json','xero-consent-operator-pnpm-lock.yaml'])await copyFile(join(source,name),join(fakeSource,name));
 await copyFile(join(source,'../../pnpm-lock.yaml'),join(dir,'pnpm-lock.yaml'));
 const helper=await import(pathToFileURL(join(fakeSource,'prepare-xero-consent-deployment.mjs')).href);
 await appendFile(join(fakeSource,'xero-consent-operator-pnpm-lock.yaml'),'\n# unexpected lock edit\n');await assert.rejects(helper.prepareXeroConsentDeployment(join(dir,'output')),/Review isolated operator lock provenance/);await assert.rejects(access(join(dir,'output')));
 await copyFile(join(source,'xero-consent-operator-pnpm-lock.yaml'),join(fakeSource,'xero-consent-operator-pnpm-lock.yaml'));await appendFile(join(dir,'pnpm-lock.yaml'),'\n# source lock changed\n');await assert.rejects(helper.prepareXeroConsentDeployment(join(dir,'output')),/Review isolated operator lock provenance/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('reused unrelated or symlinked output refuses before overwriting any files',async()=>{
 for(const forbidden of ['run-provider-test-programme.mjs','shopify-programme.json','.env']){const dir=await mkdtemp(join(tmpdir(),'ns-xero-dirty-'));try{await writeFile(join(dir,forbidden),'preserve synthetic sentinel');await assert.rejects(prepareXeroConsentDeployment(dir),/unrelated files/);assert.deepEqual(await readdir(dir),[forbidden]);assert.equal(await readFile(join(dir,forbidden),'utf8'),'preserve synthetic sentinel');}finally{await rm(dir,{recursive:true,force:true});}}
 const dir=await mkdtemp(join(tmpdir(),'ns-xero-linked-'));try{await symlink(source,join(dir,'node_modules'),'dir');await assert.rejects(prepareXeroConsentDeployment(dir),/Unsafe consent output entry/);}finally{await rm(dir,{recursive:true,force:true});}
});
