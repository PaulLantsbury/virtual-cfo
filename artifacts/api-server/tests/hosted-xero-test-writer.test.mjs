import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdtemp,rm,writeFile} from 'node:fs/promises';import {fileURLToPath,pathToFileURL} from 'node:url';import {join} from 'node:path';
test('hosted writer callback and owner connect mount before readiness and SPA; default off',async()=>{const dir=await mkdtemp(fileURLToPath(new URL('./writer-app-',import.meta.url)));try{
 await writeFile(join(dir,'index.html'),'Synthetic SPA marker');const output=join(dir,'app.mjs');await build({entryPoints:[fileURLToPath(new URL('../src/app.ts',import.meta.url))],outfile:output,bundle:true,platform:'node',format:'esm',external:['express','cors','pino','pino-http','pg','drizzle-orm','@supabase/supabase-js'],logLevel:'silent'});
 const {createApp}=await import(pathToFileURL(output).href);let calls=0;
 for(const enabled of [false,true]){const service=enabled?{start:async bearer=>{assert.equal(bearer,'Bearer synthetic');calls++;return {url:'https://login.xero.com/synthetic'};},complete:async input=>{assert.deepEqual(input,{state:'synthetic',code:'synthetic-code'});calls++;return {state:'writer_connected_programme_disabled'};}}:undefined;
 const app=createApp(undefined,undefined,dir,undefined,undefined,undefined,undefined,service);const server=await new Promise(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));});try{const origin=`http://127.0.0.1:${server.address().port}`;
 const response=await fetch(origin+'/api/xero/test-writer/connect',{method:'POST',headers:{origin:'https://night-scout-xero-staging.onrender.com',authorization:'Bearer synthetic','content-type':'application/json'},body:'{}'});assert.equal(response.status,enabled?200:503);assert.equal(response.headers.get('cache-control'),'no-store');assert.doesNotMatch(await response.text(),/SPA marker/);
 const callback=await fetch(origin+'/api/xero/test-writer/callback?state=synthetic&code=synthetic-code');assert.equal(callback.status,enabled?200:503);assert.doesNotMatch(await callback.text(),/SPA marker/);
 if(enabled)assert.equal((await fetch(origin+'/api/xero/test-writer/connect',{method:'POST',headers:{origin:'https://evil.invalid','content-type':'application/json'},body:'{}'})).status,403);
 }finally{await new Promise(resolve=>server.close(resolve));}}
 assert.equal(calls,2);
 }finally{await rm(dir,{recursive:true,force:true});}});
