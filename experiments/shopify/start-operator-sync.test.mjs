import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseOperatorArguments,startOperatorSync} from './start-operator-sync.mjs';
import {INTAKE_TARGET as target} from './intake-runtime.mjs';
test('operator launcher arguments require private config/access file and valid port',()=>{
 assert.deepEqual(parseOperatorArguments(['--config','private.json','--access-file','access.txt']),{configPath:'private.json',accessFile:'access.txt',port:5190});
 for(const args of [[],['--config','a'],['--config','a','--access-file','b','--port','80'],['--config','a','--access-file','b','--host','0.0.0.0']])assert.throws(()=>parseOperatorArguments(args));
});
test('startup is read-only and stores private access link; manual run stays pinned',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'night-scout-operator-'));let closeCount=0;
 try{
 const configPath=join(dir,'config.json'),accessFile=join(dir,'access.txt');
 await writeFile(configPath,JSON.stringify({projectRef:target.projectRef,databaseUrl:`postgresql://night_scout_intake_login:synthetic@db.${target.projectRef}.supabase.co/postgres`,scope:{storeId:target.storeId,shopId:target.shopId,from:'2026-09-17',to:'2026-09-17'}}),{mode:0o600});
 const calls=[];let contract;
 const deps={check:async args=>{calls.push(args);return{};},inspect:async args=>({configPath:args.configPath}),createService:args=>(contract=args,{}),startServer:async()=>({url:'http://127.0.0.1:5190/#capability=synthetic',close:async()=>{closeCount++;}})};
 const running=await startOperatorSync({configPath,accessFile},deps);
 assert.deepEqual(calls,[{configPath,mode:'check'}]);assert.equal((await stat(accessFile)).mode&0o777,0o600);
 assert.equal(await readFile(accessFile,'utf8'),'http://127.0.0.1:5190/#capability=synthetic\n');
 await contract.runIntake();assert.deepEqual(calls[1],{configPath,mode:'record',confirmTarget:`${target.projectRef}/${target.storeId}`});
 await assert.rejects(startOperatorSync({configPath,accessFile},deps));
 await running.close();assert.equal(closeCount,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('durable history is opt-in, fails closed without schema and releases its pool/access file',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'night-scout-journal-'));
 try{
 const configPath=join(dir,'config'),accessFile=join(dir,'access');
 await writeFile(configPath,JSON.stringify({projectRef:target.projectRef,databaseUrl:`postgresql://night_scout_intake_login:synthetic@db.${target.projectRef}.supabase.co/postgres`,scope:{storeId:target.storeId,shopId:target.shopId,from:'2026-09-17',to:'2026-09-17'}}),{mode:0o600});
 assert.equal(parseOperatorArguments(['--config',configPath,'--access-file',accessFile,'--durable-history']).durableHistory,true);
 let ended=0,started=0;
 await assert.rejects(startOperatorSync({configPath,accessFile,durableHistory:true},{check:async()=>({}),createPool:()=>({connect:async()=>({query:async sql=>{if(sql.startsWith('SELECT id'))throw Error('private detail');return {rows:[]};},release:()=>{}}),end:async()=>{ended++;}}),startServer:async()=>{started++;}}),e=>!e.message.includes('private detail'));
 assert.equal(ended,1);assert.equal(started,0);await assert.rejects(stat(accessFile));
 }finally{await rm(dir,{recursive:true,force:true});}
});
