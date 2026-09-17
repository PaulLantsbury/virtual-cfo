import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,chmod,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {INTAKE_TARGET as target} from './intake-runtime.mjs';
import {parseIntakeArguments,runDevelopmentIntake} from './run-development-intake.mjs';
const confirmTarget=`${target.projectRef}/${target.storeId}`;
async function fixture(){const dir=await mkdtemp(join(tmpdir(),'night-scout-intake-'));const shop=join(dir,'shop.json'),configPath=join(dir,'intake.json');const config={projectRef:target.projectRef,databaseUrl:`postgres://night_scout_intake_login:synthetic@db.${target.projectRef}.supabase.co/postgres`,scope:{storeId:target.storeId,shopId:target.shopId,from:'2026-09-17',to:'2026-09-17'},shopifyConfigPath:shop};await writeFile(shop,JSON.stringify({...target,clientId:'synthetic',clientSecret:'private-secret'}),{mode:0o600});await writeFile(configPath,JSON.stringify(config),{mode:0o600});return {dir,configPath,shop,config,close:()=>rm(dir,{recursive:true,force:true})};}
test('operator defaults to check; record requires exact acknowledgement and rejects ambiguous flags',()=>{
 assert.equal(parseIntakeArguments(['--config','private']).mode,'check');assert.equal(parseIntakeArguments(['--record','--config','private','--confirm-target',confirmTarget]).mode,'record');
 for(const args of [[],['--config','private','--record'],['--config','private','--check','--record'],['--config','private','--confirm-target',confirmTarget],['--config','private','--record','--confirm-target','wrong']])assert.throws(()=>parseIntakeArguments(args),/Usage/);
});
test('check initialises but never runs, exchanges credential or reports connection health',async()=>{
 const f=await fixture();try{let ran=false,closed=false;const receipt=await runDevelopmentIntake({configPath:f.configPath},{createPool:()=>{},fetchImpl:()=>assert.fail(),initialise:async()=>({run:()=>{ran=true;},close:async()=>{closed=true;}})});assert.equal(ran,false);assert.equal(closed,true);assert.equal(receipt.candidateWriteAttempted,false);assert.equal(receipt.shopifyAuthenticationChecked,false);assert.ok(!JSON.stringify(receipt).includes('private-secret'));}finally{await f.close();}
});
test('record passes explicit target and page bound; uncertain exception is sanitised and closes runtime',async()=>{
 const f=await fixture();try{let closed=false;await assert.rejects(runDevelopmentIntake({configPath:f.configPath,mode:'record',confirmTarget},{createPool:()=>{},initialise:async()=>({run:async args=>{assert.deepEqual(args,{confirmTarget,maxPages:100});throw Error('private-secret');},close:async()=>{closed=true;}})}),e=>e.message.includes('unconfirmed')&&!e.message.includes('private-secret'));assert.equal(closed,true);}finally{await f.close();}
});
test('unsafe file permissions, symlinks, broad periods and wrong Shop identity fail before initialisation',async()=>{
 const f=await fixture();const deps={initialise:()=>assert.fail()};try{
 await chmod(f.configPath,0o644);await assert.rejects(runDevelopmentIntake({configPath:f.configPath},deps),/unconfirmed/);await chmod(f.configPath,0o600);
 const link=join(f.dir,'link');await symlink(f.configPath,link);await assert.rejects(runDevelopmentIntake({configPath:link},deps),/unconfirmed/);
 await writeFile(f.configPath,JSON.stringify({...f.config,scope:{...f.config.scope,to:'2026-12-01'}}));await assert.rejects(runDevelopmentIntake({configPath:f.configPath},deps),/unconfirmed/);
 await writeFile(f.configPath,JSON.stringify(f.config));await writeFile(f.shop,JSON.stringify({...target,domain:'other.myshopify.com'}));await assert.rejects(runDevelopmentIntake({configPath:f.configPath},deps),/unconfirmed/);
 }finally{await f.close();}
});
