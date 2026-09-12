import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createServer} from 'vite';
import {localReviewProxy} from '../review-proxy.mjs';
test('review proxy is explicit, loopback only, and refuses invalid destinations',()=>{
 assert.equal(localReviewProxy({}),undefined);
 for(const value of ['', '0','65536','3000','https://example.com','4000/path','04000','4000?token=x'])
  assert.throws(()=>localReviewProxy({PORT:'3000',NIGHT_SCOUT_LOCAL_REVIEW_API_PORT:value}));
 const options=Object.values(localReviewProxy({NIGHT_SCOUT_LOCAL_REVIEW_API_PORT:'4001'}))[0];
 assert.equal(options.target,'http://127.0.0.1:4001');
});
test('same-origin review request forwards bearer/body only on the review route',async()=>{
 const received=[];
 const api=http.createServer(async(req,res)=>{
  let body='';for await(const chunk of req)body+=chunk;
  received.push({url:req.url,auth:req.headers.authorization,body});
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:'blocked'}));
 });
 await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
 let vite;
 try{
  vite=await createServer({configFile:false,logLevel:'silent',server:{host:'127.0.0.1',port:0,proxy:localReviewProxy({NIGHT_SCOUT_LOCAL_REVIEW_API_PORT:String(api.address().port)})}});
  await vite.listen();const origin=`http://127.0.0.1:${vite.httpServer.address().port}`;
  const response=await fetch(origin+'/api/financial-reviews/prepare',{method:'POST',headers:{authorization:'Bearer synthetic-test-token','content-type':'application/json'},body:'{"scope":{}}'});
  assert.deepEqual(await response.json(),{status:'blocked'});
  assert.deepEqual(received,[{url:'/api/financial-reviews/prepare',auth:'Bearer synthetic-test-token',body:'{"scope":{}}'}]);
  await fetch(origin+'/api/financial-reviews-other');
  assert.equal(received.length,1);
 }finally{await vite?.close();await new Promise(resolve=>api.close(resolve));}
});
