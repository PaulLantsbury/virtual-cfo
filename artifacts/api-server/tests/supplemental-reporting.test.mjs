import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import http from 'node:http';
import {createSupplementalReportingRouter} from '../src/routes/supplemental-reporting.ts';
const edition='synthetic-history-v2-2026-11',storeId='d7500000-0000-4000-8000-000000000009',versionId='22222222-2222-4222-8222-222222222222';
const scope={storeId,currency:'GBP',from:'2025-01-01',to:'2025-01-31',edition,versionId,kind:'cash'};
async function run(service,callback){const app=express();app.use('/history',createSupplementalReportingRouter(service));const server=http.createServer(app);await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});try{await callback(async(query=scope,{path='',authorization='Bearer valid'}={})=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/history${path}?${new URLSearchParams(query)}`,{headers:authorization?{authorization}:{}});return {status:r.status,body:await r.json(),cache:r.headers.get('cache-control')};});}finally{await new Promise(resolve=>server.close(resolve));}}

test('supplemental endpoint is disabled by default and never browser cached',()=>run(undefined,async request=>{const r=await request();assert.equal(r.status,503);assert.equal(r.cache,'no-store');}));
test('requires exact bearer, GBP, complete month/version/kind and no operator parameters',()=>{let calls=0;return run({read:async()=>{calls++;return {state:'unavailable'};}},async request=>{
 assert.equal((await request(scope,{authorization:''})).status,401);
 for(const q of [{...scope,currency:'USD'},{...scope,versionId:''},{...scope,kind:'bank-write'},{...scope,to:'2025-02-28'},{...scope,connection:'private'}])assert.equal((await request(q)).status,400);
 assert.equal(calls,0);
});});
test('returns only exact trusted result; rejects wrong business/version and hides internal errors',async()=>{
 await run({read:async(s,a,v,kind)=>({state:'supported',contract:'reviewed-supplement-v1',kind,financialVersionId:v.versionId,scope:{...s,timezone:'Europe/London'},payload:{}})},async request=>assert.equal((await request()).status,200));
 await run({read:async()=>({state:'supported',scope:{storeId:'other'}})},async request=>assert.equal((await request()).status,503));
 for(const [message,status] of [['Reviewer sign-in required',401],['Supplemental store membership required',403],['private SQL and connection secret',503]])await run({read:async()=>{throw Error(message);}},async request=>{const r=await request();assert.equal(r.status,status);assert.doesNotMatch(JSON.stringify(r.body),/SQL|secret|connection/);});
});
