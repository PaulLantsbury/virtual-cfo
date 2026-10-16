// Real loopback HTTP + actual coordinator; callbacks are synthetic, with no DB/network credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {createOperatorSyncService} from './operator-sync-service.mjs';
import {startOperatorSyncServer} from './operator-sync-server.mjs';
import {INTAKE_TARGET as target} from './intake-runtime.mjs';
const scope={storeId:target.storeId,from:'2026-09-17',to:'2026-09-17'};
const batchId='60000000-0000-4000-8000-000000000001';
const candidate=()=>({...scope,projectRef:target.projectRef,status:'current_unverified',observedAt:'2026-09-17T15:00:00Z',retainedBatchCount:1,batchId,mappingState:'mapped_for_review',orderCount:1,refundCount:1,mappedEventCount:0,exclusions:[{reason:'TEST_ORDER',count:1}],coverageCertified:false,candidateWriteAttempted:false,financialImportStatus:'not_assessed',reviewRequired:true,secret:'never-expose-inspection'});
const receipt=()=>({...scope,status:'replay',batchId,mappingState:'mapped_for_review',coverageCertified:false,financeImported:false,reviewRequired:true,secret:'never-expose-receipt'});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function call(server,{path='/api/status',method='GET',headers={},body}={}){
 const url=new URL(server.url),capability=new URLSearchParams(url.hash.slice(1)).get('capability');
 return new Promise((resolve,reject)=>{const req=httpRequest(new URL(path,url),{method,headers:{'X-Operator-Capability':capability,...headers}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({code:res.statusCode,headers:res.headers,text,json:()=>JSON.parse(text)}));});req.on('error',reject);if(body!==undefined)req.write(body);req.end();});
}
const post=server=>({path:'/api/sync',method:'POST',headers:{Origin:new URL(server.url).origin,'Content-Type':'application/json','Content-Length':'2'},body:'{}'});
async function waitFinished(server){
 for(let i=0;i<100;i++){const r=await call(server);if(r.json().lastAttempt?.state!=='running')return r;await new Promise(resolve=>setTimeout(resolve,5));}
 throw Error('Synthetic attempt did not finish');
}
test('real HTTP rejects cross-site, host spoofing, capability omission and target injection before any intake',async()=>{
 let writes=0;const controller=createOperatorSyncService({scope,runIntake:async()=>{writes++;return receipt();},inspectCandidate:async()=>candidate()});
 const server=await startOperatorSyncServer({controller,port:0});try{
 for(const options of [
  {headers:{'X-Operator-Capability':''}},
  {...post(server),headers:{...post(server).headers,Origin:'https://untrusted.invalid'}},
  {...post(server),headers:{...post(server).headers,Host:'attacker.invalid'}},
  {...post(server),headers:{...post(server).headers,'Sec-Fetch-Site':'cross-site'}},
  {...post(server),path:'/api/sync?storeId=another-store'},
  {...post(server),method:'GET'},
 ])assert.ok((await call(server,options)).code>=400);
 assert.equal(writes,0);
 const page=await call(server,{path:'/'});assert.equal(page.code,200);assert.match(page.headers['content-security-policy'],/frame-ancestors 'none'/);assert.equal(page.headers['cache-control'],'no-store');
 const status=await call(server);assert.equal(status.json().financialVerification,'not_assessed');assert.equal(status.text.includes('never-expose'),false);assert.equal(status.json().candidate.mappedEventCount,0);
 }finally{await server.close();}
});
test('overlapping HTTP clicks return promptly and perform one intake; persisted candidate remains separate from attempt',async()=>{
 const gate=deferred(),entered=deferred();let writes=0;
 const controller=createOperatorSyncService({scope,runIntake:async()=>{writes++;entered.resolve();await gate.promise;return receipt();},inspectCandidate:async()=>candidate()});
 const server=await startOperatorSyncServer({controller,port:0});try{
 assert.equal((await call(server,post(server))).code,202);await entered.promise;
 const running=(await call(server)).json();assert.equal(running.activity,'running');assert.equal(running.lastAttempt.state,'running');assert.equal(running.candidate.batchId,batchId);
 assert.equal((await call(server,post(server))).code,202);assert.equal(writes,1);
 gate.resolve();const done=await waitFinished(server);assert.equal(done.json().lastAttempt.state,'completed');assert.equal(done.json().lastAttempt.result.status,'replay');assert.equal(done.json().financialVerification,'not_assessed');assert.equal(done.text.includes('never-expose'),false);
 }finally{gate.resolve();await server.close();}
});
test('uncertain completion is sanitised and status refresh plus another HTTP click cannot retry it',async()=>{
 let writes=0;const controller=createOperatorSyncService({scope,runIntake:async()=>{writes++;throw Error('never-expose-password');},inspectCandidate:async()=>candidate()});
 const server=await startOperatorSyncServer({controller,port:0});try{
 await call(server,post(server));const done=await waitFinished(server);assert.equal(done.json().lastAttempt.state,'unconfirmed');assert.equal(done.json().retryBlocked,true);assert.equal(done.json().candidate.status,'current_unverified');assert.equal(done.text.includes('never-expose'),false);
 await call(server);await call(server,post(server));await new Promise(resolve=>setTimeout(resolve,10));assert.equal(writes,1);assert.equal((await call(server)).json().retryBlocked,true);
 }finally{await server.close();}
});
test('source refusals remain explicit results rather than new-candidate or financial-success claims',async()=>{
 for(const status of ['stale_source','conflicting_source','missing_source']){
  const controller=createOperatorSyncService({scope,runIntake:async()=>({...receipt(),status,batchId:undefined,mappingState:undefined}),inspectCandidate:async()=>({...candidate(),status:'needs_recheck'})});
  const server=await startOperatorSyncServer({controller,port:0});try{
   await call(server,post(server));const result=(await waitFinished(server)).json();
   assert.equal(result.lastAttempt.result.status,status);assert.equal(result.candidate.status,'needs_recheck');assert.equal(result.financialVerification,'not_assessed');assert.equal(result.candidate.mappedEventCount,0);
  }finally{await server.close();}
 }
});
