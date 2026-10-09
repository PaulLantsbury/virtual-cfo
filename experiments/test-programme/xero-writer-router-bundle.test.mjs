import test from 'node:test';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';import {readFileSync,mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {pathToFileURL} from 'node:url';
import {createXeroWriterBootstrapRouter} from './xero-writer-bootstrap-router.mjs';
const require=createRequire(new URL('../../artifacts/api-server/package.json',import.meta.url));
const express=require('express');
test('router module has no import-time Express/path resolution and uses injected host ports',()=>{
 const source=readFileSync(new URL('./xero-writer-bootstrap-router.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/createRequire|require\(|from\s+['"]express|import\.meta\.url/);
 assert.equal(typeof createXeroWriterBootstrapRouter({express}).use,'function');
 assert.equal(typeof createXeroWriterBootstrapRouter({express,service:{start:async()=>({url:'https://login.xero.com/'}),complete:async()=>({state:'writer_connected_programme_disabled'})}}).use,'function');
 assert.throws(()=>createXeroWriterBootstrapRouter(),/host ports required/);
});
test('relocated bundled router imports and creates enabled/disabled routes outside repository',async()=>{
 const esbuild=require('esbuild'),dir=mkdtempSync(join(tmpdir(),'night-scout-router-bundle-'));
 try{
  const outfile=join(dir,'index.mjs');await esbuild.build({entryPoints:[new URL('./xero-writer-bootstrap-router.mjs',import.meta.url).pathname],outfile,bundle:true,platform:'node',format:'esm',logLevel:'silent'});
  const bundled=await import(pathToFileURL(outfile).href);
  assert.equal(typeof bundled.createXeroWriterBootstrapRouter({express}).use,'function');
  assert.equal(typeof bundled.createXeroWriterBootstrapRouter({express,service:{start(){},complete(){}}}).use,'function');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
