import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import router from '../src/routes/opportunities.ts';

test('unconfigured opportunity API refuses anonymous and forged identity requests without upstream access',async()=>{
 const app=express();app.use('/api/opportunities',router);
 const server=http.createServer(app);
 const oldFetch=globalThis.fetch;let upstreamCalls=0;
 globalThis.fetch=async()=>{upstreamCalls++;throw new Error('Upstream access must not occur');};
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  for(const headers of [{},{authorization:'Bearer forged','x-store-id':'another-store'}]){
   const result=await new Promise((resolve,reject)=>{
    http.get({hostname:'127.0.0.1',port:server.address().port,path:'/api/opportunities?store_id=another-store',headers},res=>{
     let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(body)}));
    }).on('error',reject);
   });
   assert.deepEqual(result,{status:503,body:{error:'Authenticated store access is not configured'}});
  }
  assert.equal(upstreamCalls,0);
 }finally{globalThis.fetch=oldFetch;await new Promise(resolve=>server.close(resolve));}
});
