import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';

test('actual hosted app mounts profit reporting with trusted service and fails closed without configuration',async()=>{
 const dir=await mkdtemp(fileURLToPath(new URL('./.profit-app-',import.meta.url)));
 try{
  const output=join(dir,'app.mjs');
  await build({entryPoints:[fileURLToPath(new URL('../src/app.ts',import.meta.url))],outfile:output,bundle:true,platform:'node',format:'esm',external:['express','cors','pino','pino-http','pg','drizzle-orm','@supabase/supabase-js'],logLevel:'silent'});
  const {createApp}=await import(pathToFileURL(output).href);
  const scope={storeId:'90000000-0000-4000-8000-000000000004',from:'2026-02-01',to:'2026-02-28',currency:'GBP'};
  let calls=0;
  for(const configured of [false,true]){
   const service=configured?{read:async(received,authorization)=>{calls++;assert.deepEqual({...received},scope);assert.equal(authorization,'Bearer synthetic');return {state:'unavailable',reason:'No sealed profit evidence is available for this month'};}}:undefined;
   const app=createApp(undefined,undefined,undefined,undefined,service);
   const server=await new Promise(resolve=>{const value=app.listen(0,'127.0.0.1',()=>resolve(value));});
   try{
    const url=`http://127.0.0.1:${server.address().port}/api/profit-reporting?${new URLSearchParams(scope)}`;
    const response=await fetch(url,{headers:{authorization:'Bearer synthetic'}});
    assert.equal(response.status,configured?200:503);
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal((await response.json())[configured?'state':'error'],configured?'unavailable':'Profit reporting is not configured');
    if(configured)assert.equal((await fetch(url)).status,401);
   }finally{await new Promise(resolve=>server.close(resolve));}
  }
  assert.equal(calls,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
