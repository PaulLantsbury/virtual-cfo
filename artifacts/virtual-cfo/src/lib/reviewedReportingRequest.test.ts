import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedReportingRequest as read,reviewedRangeReadError,ReviewedReportingRequestError as Failure} from './reviewedReportingRequest.ts';
const session=async()=>({data:{session:{user:{id:'member'},access_token:'fictional-secret'}},error:null});
const signal=()=>new AbortController().signal;
test('503 is a bounded HTTP failure; response secrets and body never escape; no automatic retry',async()=>{
 let calls=0;await assert.rejects(read('/api/history-reporting/range',{},signal(),'member',session,async()=>{calls++;return new Response('private-response-token',{status:503});}),e=>e instanceof Failure&&e.stage==='http'&&e.status===503&&!JSON.stringify(e).includes('private')&&!e.message.includes('fictional-secret'));assert.equal(calls,1);
});
test('authentication rejection and user mismatch never send a request',async()=>{
 for(const getSession of [async()=>{throw Error('private-session-detail');},async()=>({data:{session:{user:{id:'other'},access_token:'secret'}},error:null})]){
  let calls=0;await assert.rejects(read('/api/history-reporting/range',{},signal(),'member',getSession,async()=>{calls++;return new Response('{}');}),e=>e instanceof Failure&&e.stage==='session'&&!e.message.includes('private'));assert.equal(calls,0);
 }
});
test('cancelled old selection during delayed auth cannot issue a late fetch; new selection proceeds independently',async()=>{
 const old=new AbortController();let finish:Function=()=>{};const deferred=new Promise<any>(resolve=>{finish=resolve;});let calls=0;
 const previous=read('/api/history-reporting/range',{from:'old'},old.signal,'member',()=>deferred,async()=>{calls++;return new Response('{}');});old.abort();finish(await session());await assert.rejects(previous,e=>(e as Error).name==='AbortError');assert.equal(calls,0);
 const result=await read('/api/history-reporting/range',{from:'new'},signal(),'member',session,async(url)=>{calls++;assert.match(String(url),/from=new/);return new Response('{"state":"supported"}');});assert.deepEqual(result,{state:'supported'});assert.equal(calls,1);
});
test('network and malformed response failures remain distinct and bounded',async()=>{
 for(const [fetcher,stage]of [[async()=>{throw Error('https://private.example/token');},'transport'],[async()=>new Response('private invalid json'),'response']] as const)await assert.rejects(read('/api/history-reporting/range',{},signal(),'member',session,fetcher),e=>e instanceof Failure&&e.stage===stage&&!e.message.includes('private'));
});
test('cached success hidden during refetch is loading rather than false source rejection',()=>{
 const cached={isFetching:true,isSuccess:true,isError:false,error:null};assert.equal(reviewedRangeReadError(cached,false,false),null);assert.equal(reviewedRangeReadError({...cached,isFetching:false},true,false),null);
 assert.match(reviewedRangeReadError({...cached,isFetching:false},false,false)!,/source evidence/);
 assert.equal(reviewedRangeReadError({...cached,isFetching:false},false,true),null);
});
test('failed refetch shows no stale failure during retry then reports bounded status when settled',()=>{
 const failed={isFetching:true,isSuccess:false,isError:true,error:new Failure('http',503)};assert.equal(reviewedRangeReadError(failed,false,false),null);assert.match(reviewedRangeReadError({...failed,isFetching:false},false,false)!,/status 503/);
});
