import test from 'node:test';import assert from 'node:assert/strict';
import {attachHistoryReader} from './history-runtime.mjs';
test('history stays off by default and composes only explicit verified server dependencies',()=>{
 const runtime={close:async()=>{}},database={transaction:async fn=>fn({})},auth={auth:{getUser:async()=>({error:{}})}};
 let called=0;const service={read:async()=>({state:'unavailable'}),available:async()=>({months:[]})};
 const createReader=(db,a)=>{called++;assert.equal(db,database);assert.equal(a,auth);return service;};
 assert.equal(attachHistoryReader(runtime,database,auth,{createReader}),runtime);assert.equal(called,0);
 const on=attachHistoryReader(runtime,database,auth,{enabled:true,createReader});assert.equal(on.historyService,service);assert.equal(on.close,runtime.close);assert.equal(called,1);
 assert.throws(()=>attachHistoryReader(runtime,null,auth,{enabled:true}),/Verified server/);
});
