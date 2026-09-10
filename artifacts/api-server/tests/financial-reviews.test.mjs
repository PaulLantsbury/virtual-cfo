import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import {createFinancialReviewRouter} from '../src/routes/financial-reviews.ts';
import {restorationFixture} from '../../../experiments/shopify/restoration-fixture.mjs';
import {createReviewerService} from '../../../experiments/shopify/reviewer-auth.mjs';
import {U,B} from '../../../experiments/shopify/finance-fixture.mjs';
const scope={storeId:'90000000-0000-4000-8000-000000000001',from:'2026-08-01',to:'2026-08-31'};
async function server(service,fn){
 const app=express();app.use('/reviews',createFinancialReviewRouter(service));
 const s=http.createServer(app);await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',resolve);});
 const request=async(path,body,{authorization='Bearer synthetic-token',contentType='application/json',raw=false}={})=>{
  const response=await fetch(`http://127.0.0.1:${s.address().port}/reviews/${path}`,{method:'POST',headers:{...(authorization?{authorization}:{}),'content-type':contentType},body:raw?body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
  return {status:response.status,cache:response.headers.get('cache-control'),text:await response.text()};
 };
 try{await fn(request);}finally{await new Promise(r=>s.close(r));}
}
test('unconfigured review endpoint cannot access a service',async()=>{
 await server(undefined,async request=>{const r=await request('restore',{});assert.equal(r.status,503);assert.equal(r.cache,'no-store');});
});
test('invalid input, credentials, media type and oversized JSON stop before service calls',async()=>{
 let calls=0;const service={prepare:async()=>{calls++;},restore:async()=>{calls++;}};
 await server(service,async request=>{
  assert.equal((await request('prepare',{scope},{authorization:''})).status,401);
  assert.equal((await request('prepare',{scope:{...scope,from:'2026-02-30'}})).status,400);
  assert.equal((await request('prepare',{scope,reviewerId:'forged'})).status,400);
  assert.equal((await request('prepare',{scope},{contentType:'text/plain'})).status,415);
  assert.equal((await request('prepare','{"private":"secret",',{raw:true})).status,400);
  const oversized=await request('prepare',{scope,extra:'sensitive'.repeat(3000)});assert.equal(oversized.status,413);assert.ok(!oversized.text.includes('sensitive'));
 });assert.equal(calls,0);
});
test('known failures are mapped safely without leaking internal details',async()=>{
 for(const [error,status] of [[new Error('Reviewer sign-in could not be verified'),401],[new Error('Reviewer is not authorised for this store'),403],[new Error('Review snapshot changed; prepare a new review'),409],[new Error('SQL password=private-token'),503]]){
  await server({prepare:async()=>{throw error;},restore:async()=>{}},async request=>{
   const r=await request('prepare',{scope});assert.equal(r.status,status);assert.ok(!r.text.includes('private-token'));assert.equal(r.cache,'no-store');
  });
 }
});
test('HTTP review uses verified identity and restricted database service through restoration',async()=>{
 const {db,read}=await restorationFixture();try{
 await db.exec('SET ROLE night_scout_review_service');
 let verified=0;
 const service=createReviewerService(db,{auth:{getUser:async token=>{assert.equal(token,'synthetic-token');verified++;return {data:{user:{id:U,is_anonymous:false}},error:null};}}});
 await server(service,async request=>{
  assert.equal((await request('prepare',{scope:{...scope,storeId:B}})).status,403);
  const packetResponse=await request('prepare',{scope});assert.equal(packetResponse.status,200);const packet=JSON.parse(packetResponse.text);assert.equal(packet.snapshot,undefined);
  const body={scope,batchId:packet.batchId,snapshotDigest:packet.snapshotDigest,coverageConfirmed:true,evidenceRef:'synthetic-review',completenessStatement:'Synthetic complete history independently reviewed.'};
  assert.equal((await request('restore',{...body,reviewerId:'forged'})).status,400);
  assert.equal((await request('restore',body)).status,200);
  assert.equal((await request('restore',body)).status,409);
 });
 assert.equal(verified,4);
 await db.exec('RESET ROLE');assert.equal((await read()).netProductSales,12300);
 }finally{await db.close();}
});

test('missing candidate data gives a distinct safe action instead of a stale-review loop',async()=>{
 await server({prepare:async()=>{throw new Error('Store or candidate period missing');},restore:async()=>{}},async request=>{
  const r=await request('prepare',{scope});assert.equal(r.status,409);assert.equal(JSON.parse(r.text).code,'REVIEW_DATA_MISSING');
 });
});
