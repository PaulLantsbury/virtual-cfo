import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
import {prepareOperatorDeployment} from './prepare-operator-deployment.mjs';import {runShopifyOperator} from './shopify-operator-entry.mjs';
test('standalone deployment contains frozen integrity lock and runs Shopify disabled without customer app or Xero credentials',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ns-isolated-operator-'));
 try{await prepareOperatorDeployment(dir);const lock=await readFile(join(dir,'pnpm-lock.yaml'),'utf8');assert.match(lock,/lockfileVersion: '9.0'/);assert.match(lock,/sha512-/);assert.doesNotMatch(lock,/link:|workspace:|artifacts\//);
 const runner=await readFile(join(dir,'run-provider-test-programme.mjs'),'utf8');assert.doesNotMatch(runner,/artifacts\/api-server/);assert.match(runner,/await import\('\.\/xero-writer-refresh.mjs'\)/);
 const out=execFileSync(process.execPath,[join(dir,'shopify-operator-entry.mjs')],{env:{PATH:process.env.PATH,NIGHT_SCOUT_TEST_PROGRAMME_CONFIG_FILE:join(dir,'shopify-programme.json')},encoding:'utf8'});
 assert.deepEqual(JSON.parse(out),{event:'provider_test_programme',state:'prepared-disabled',provider:'shopify',actions:4});
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Shopify entry rejects provider or target switches before invoking runner',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ns-operator-config-'));try{for(const config of [{provider:'xero',target:'synthetic'},{provider:'shopify',target:'other.myshopify.com'}]){
 const path=join(dir,'config.json');await writeFile(path,JSON.stringify(config));let called=false;const out=await runShopifyOperator({env:{NIGHT_SCOUT_TEST_PROGRAMME_CONFIG_FILE:path},run:async()=>{called=true;}});assert.equal(called,false);assert.equal(out.state,'configuration-or-provider-unavailable');
 }}finally{await rm(dir,{recursive:true,force:true});}
});
test('renewed profile requires explicit packaging opt-in and runs disabled with seven actions',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ns-renewed-operator-'));try{
 await prepareOperatorDeployment(dir,{scheduleProfile:'daily-20261029-v1'});
 const config=JSON.parse(await readFile(join(dir,'shopify-programme.json'),'utf8'));assert.equal(config.programmeKey,'shopify-staging-20261029');assert.equal(config.startMonday,'2026-10-26');
 const out=execFileSync(process.execPath,[join(dir,'shopify-operator-entry.mjs')],{env:{PATH:process.env.PATH,NIGHT_SCOUT_TEST_PROGRAMME_CONFIG_FILE:join(dir,'shopify-programme.json')},encoding:'utf8'});
 assert.deepEqual(JSON.parse(out),{event:'provider_test_programme',state:'prepared-disabled',provider:'shopify',actions:7});
 await assert.rejects(prepareOperatorDeployment(dir,{scheduleProfile:'unbounded'}));
 }finally{await rm(dir,{recursive:true,force:true});}
});
