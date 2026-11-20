import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';

test('customer app rejects retired writer endpoints even with old enable flags and excludes writer code',async()=>{
 const dir=await mkdtemp(fileURLToPath(new URL('./writer-isolation-',import.meta.url)));
 const previous=process.env.NIGHT_SCOUT_XERO_TEST_WRITER_BOOTSTRAP_ENABLED;
 process.env.NIGHT_SCOUT_XERO_TEST_WRITER_BOOTSTRAP_ENABLED='true';
 try {
  await writeFile(join(dir,'index.html'),'Synthetic SPA marker');const output=join(dir,'app.mjs');
  const result=await build({entryPoints:[fileURLToPath(new URL('../src/app.ts',import.meta.url))],outfile:output,bundle:true,metafile:true,platform:'node',format:'esm',external:['express','cors','pino','pino-http','pg','drizzle-orm','@supabase/supabase-js'],logLevel:'silent'});
  assert.ok(Object.keys(result.metafile.inputs).every(path=>!path.includes('experiments/test-programme')));
  const {createApp}=await import(pathToFileURL(output).href);
  const app=createApp(undefined,undefined,dir);const server=await new Promise(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));});
  try {
   const origin=`http://127.0.0.1:${server.address().port}`;
   for(const [path,method] of [['connect','POST'],['callback?state=synthetic&code=synthetic','GET'],['','GET']]){
    const response=await fetch(`${origin}/api/xero/test-writer/${path}`,{method,headers:{origin:'https://night-scout-xero-staging.onrender.com'}});
    assert.equal(response.status,404);assert.equal(response.headers.get('cache-control'),'no-store');
    assert.deepEqual(await response.json(),{error:'endpoint_unavailable'});assert.equal(response.headers.has('location'),false);
   }
  } finally {await new Promise(resolve=>server.close(resolve));}
  const index=await readFile(new URL('../src/index.ts',import.meta.url),'utf8');
  assert.doesNotMatch(index,/createXeroTestWriterRuntime|xeroTestWriter|NIGHT_SCOUT_TEST_PROGRAMME|NIGHT_SCOUT_TEST_WRITER/);
 } finally {
  if(previous===undefined)delete process.env.NIGHT_SCOUT_XERO_TEST_WRITER_BOOTSTRAP_ENABLED;else process.env.NIGHT_SCOUT_XERO_TEST_WRITER_BOOTSTRAP_ENABLED=previous;
  await rm(dir,{recursive:true,force:true});
 }
});

test('main frontend and API entrypoint bundle graphs contain no writer module or credential configuration',async()=>{
 for(const entry of ['../src/index.ts','../../virtual-cfo/src/pages/settings.tsx']) {
  const result=await build({entryPoints:[fileURLToPath(new URL(entry,import.meta.url))],bundle:true,write:false,metafile:true,platform:'node',format:'esm',packages:'external',logLevel:'silent',define:{__NIGHT_SCOUT_BUILD_REVISION__:'"synthetic"'}});
  assert.ok(Object.keys(result.metafile.inputs).every(path=>!path.includes('test-programme')&&!/xero.?test.?writer/i.test(path)));
  for(const output of result.outputFiles)assert.doesNotMatch(output.text,/NIGHT_SCOUT_XERO_TEST_WRITER|NIGHT_SCOUT_TEST_WRITER_ENVELOPE|NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL|accounting\.transactions(?!\.read)|write_orders|orderCreate\(/);
 }
});
