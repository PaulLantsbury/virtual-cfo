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
   const settings=await fetch(`${base}/settings`,{headers:{accept:'text/html'}});assert.equal(settings.status,200);assert.match(await settings.text(),/Night Scout staging/);
   const api=await fetch(`${base}/api/not-a-route`,{headers:{accept:'text/html'}});assert.equal(api.status,404);assert.doesNotMatch(await api.text(),/Night Scout staging/);
  }finally{await new Promise(resolve=>server.close(resolve));}
 }finally{await rm(root,{recursive:true,force:true});}
});
