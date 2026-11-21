import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';import {fileURLToPath,pathToFileURL} from 'node:url';import {join} from 'node:path';
test('composed saved mapping route precedes readiness and cannot fall through to the hosted SPA',async()=>{
 const dir=await mkdtemp(fileURLToPath(new URL('./saved-mapping-app-',import.meta.url)));
 try{
  await writeFile(join(dir,'index.html'),'<html><body>Synthetic SPA marker</body></html>');
  const output=join(dir,'app.mjs');await build({entryPoints:[fileURLToPath(new URL('../src/app.ts',import.meta.url))],outfile:output,bundle:true,platform:'node',format:'esm',external:['express','cors','pino','pino-http','pg','drizzle-orm','@supabase/supabase-js'],logLevel:'silent'});
  const {createApp}=await import(pathToFileURL(output).href),storeId='11111111-1111-4111-8111-111111111111';let calls=0;
  for(const configured of [false,true]){
   const dependencies=configured?{authenticate:async bearer=>{assert.equal(bearer,'Bearer synthetic');return {userId:'verified'};},read:async(identity,id)=>{calls++;assert.deepEqual(identity,{userId:'verified'});assert.equal(id,storeId);return {storeId,state:'mapping_unavailable',mapping:null};}}:undefined;
   // Readiness intentionally disabled: metadata must use its independently composed boundary.
   const app=createApp(undefined,undefined,dir,undefined,undefined,undefined,dependencies);
   const instance=await new Promise(resolve=>{const v=app.listen(0,'127.0.0.1',()=>resolve(v));});
   try{
    const origin=`http://127.0.0.1:${instance.address().port}`,url=`${origin}/api/xero/saved-mapping?storeId=${storeId}`;
    const response=await fetch(url,{headers:{authorization:'Bearer synthetic',accept:'text/html'}});assert.equal(response.status,configured?200:503);assert.equal(response.headers.get('cache-control'),'private, no-store');
    const body=await response.json();assert.deepEqual(body,configured?{storeId,state:'mapping_unavailable',mapping:null}:{error:'Saved Xero mapping unavailable'});
    if(configured)assert.equal((await fetch(url)).status,401);
    assert.match(await (await fetch(origin+'/settings')).text(),/Synthetic SPA marker/);
   }finally{await new Promise(resolve=>instance.close(resolve));}
  }
  assert.equal(calls,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
