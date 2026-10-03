import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import express from 'express';
import {mountStagingSpa} from '../src/lib/mount-staging-spa.ts';

test('hosted staging artifact serves Settings SPA while API paths remain API-only',async()=>{
 const root=await mkdtemp(join(tmpdir(),'night-scout-xero-spa-'));
 try{
  await writeFile(join(root,'index.html'),'<!doctype html><title>Night Scout staging</title>');
  const app=express();app.use('/api',(_req,res)=>res.status(404).json({error:'not found'}));mountStagingSpa(app,root);const server=await new Promise(resolve=>{const value=app.listen(0,'127.0.0.1',()=>resolve(value));});
  try{
   const base=`http://127.0.0.1:${server.address().port}`;
   const settings=await fetch(`${base}/settings`,{headers:{accept:'text/html'}});assert.equal(settings.status,200);assert.match(await settings.text(),/Night Scout staging/);const rootResponse=await fetch(base);assert.equal(rootResponse.status,200);assert.match(await rootResponse.text(),/Night Scout staging/);
   const api=await fetch(`${base}/api/not-a-route`,{headers:{accept:'text/html'}});assert.equal(api.status,404);assert.doesNotMatch(await api.text(),/Night Scout staging/);
  }finally{await new Promise(resolve=>server.close(resolve));}
 }finally{await rm(root,{recursive:true,force:true});}
});

test('separately packaged SPA leaves a data-free API-root readiness response',async()=>{
 const rootDir=await mkdtemp(join(tmpdir(),'night-scout-static-owned-by-sidecar-'));const app=express();app.use('/api',(_req,res)=>res.status(404).json({error:'not found'}));mountStagingSpa(app,rootDir);const server=await new Promise(resolve=>{const value=app.listen(0,'127.0.0.1',()=>resolve(value));});
 try{
  const base=`http://127.0.0.1:${server.address().port}`;const root=await fetch(base);assert.equal(root.status,200);assert.equal(await root.text(),'Night Scout staging ready');assert.equal(root.headers.get('cache-control'),'no-store');
  const api=await fetch(`${base}/api/not-a-route`);assert.equal(api.status,404);const settings=await fetch(`${base}/settings`);assert.equal(settings.status,404);const post=await fetch(base,{method:'POST'});assert.equal(post.status,404);
 }finally{await new Promise(resolve=>server.close(resolve));await rm(rootDir,{recursive:true,force:true});}
});
