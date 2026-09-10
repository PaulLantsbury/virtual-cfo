import test from 'node:test';
import assert from 'node:assert/strict';
import {listenLocalReview} from '../review-local-server.mjs';
test('local review composition rejects other origins and serves no unrelated API routes',async()=>{
 let calls=0;const local=await listenLocalReview({port:0,frontendOrigin:'http://localhost:3000',service:{prepare:async()=>{calls++;return {status:'blocked'};},restore:async()=>{}}});
 const url=`http://127.0.0.1:${local.port}`;
 try{
 const request=origin=>fetch(url+'/api/financial-reviews/prepare',{method:'POST',headers:{origin,authorization:'Bearer synthetic','content-type':'application/json'},body:JSON.stringify({scope:{storeId:'90000000-0000-4000-8000-000000000001',from:'2026-08-01',to:'2026-08-31'}})});
 assert.equal((await request('https://unrelated.invalid')).status,403);assert.equal(calls,0);
 assert.equal((await request('http://localhost:3000')).status,200);assert.equal(calls,1);
 assert.equal((await fetch(url+'/api/dashboard')).status,404);
 }finally{await local.close();}
});
test('non-local origins are rejected before listening',async()=>{
 await assert.rejects(listenLocalReview({port:0,frontendOrigin:'https://remote.invalid'}),/Invalid local/);
});
