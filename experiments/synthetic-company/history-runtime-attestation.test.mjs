/** Controlled pool/Auth fixtures only; no real credential, network or hosted process. */
import test from 'node:test';import assert from 'node:assert/strict';import {initialiseHistoryReportingRuntime} from './history-runtime.mjs';import {HISTORY_EDITION} from './history-context.mjs';
const ref='bioalckltvkhlczusdvl',user='10000000-0000-4000-8000-000000000001',store='d7500000-0000-4000-8000-000000000009';
function fixture(){
 const calls=[];let pools=0,ends=0,auths=0,connects=0;
 const auth={auth:{getUser:async token=>{calls.push(['auth',token]);return {data:{user:{id:user,is_anonymous:false}}};}}};
 const client={query:async(sql,args)=>{calls.push(['sql',sql,args]);if(sql.includes('current_user AS role'))return {rows:[{role:'night_scout_review_service',unsafe_login:false,unsafe_writes:false,lock_ready:true}]};return {rows:[]};},release:()=>calls.push(['release'])};
 const pool={on(){},connect:async()=>{connects++;return client;},end:async()=>{ends++;}};
 const config={projectRef:ref,authUrl:`https://${ref}.supabase.co`,publishableKey:'sb_publishable_synthetic_fixture',databaseUrl:`postgresql://night_scout_review_login:explicit-synthetic-fixture@db.${ref}.supabase.co/postgres`};
 const factories={createPool:options=>{pools++;assert.equal(options.user,'night_scout_review_login');assert.equal(options.ssl.rejectUnauthorized,true);return pool;},createAuthClient:()=>{auths++;return auth;}};
 return {calls,config,factories,pool,auth,stats:()=>({pools,ends,auths,connects})};
}
test('trusted hook, financial history and supplemental service share one validated pool/Auth and retain close',async()=>{
 const f=fixture();let hooked,close;const runtime=await initialiseHistoryReportingRuntime(f.config,f.factories,{enabled:true,supplementalEnabled:true,attachRuntime:(ready,database,auth)=>{assert.equal(auth,f.auth);assert.equal(typeof ready.historyService.read,'function');assert.equal(typeof ready.supplementalService.read,'function');hooked=database;close=ready.close;return {...ready,attestationPort:database};}});
 assert.equal(runtime.attestationPort,hooked);assert.equal(runtime.close,close);assert.deepEqual(f.stats(),{pools:1,ends:0,auths:1,connects:1});
 await hooked.transaction(async tx=>{await tx.exec('SELECT 1 /* trusted hook proof */');});
 const scope={storeId:store,currency:'GBP',from:'2026-10-01',to:'2026-10-31'};
 await assert.rejects(runtime.historyService.read(scope,'Bearer fixture-history',{edition:HISTORY_EDITION,versionId:user}),/membership/);
 await assert.rejects(runtime.supplementalService.read(scope,'Bearer fixture-supplement',{edition:HISTORY_EDITION,versionId:user},'acquisition'),/membership/);
 assert.equal(f.stats().pools,1);assert.equal(f.stats().auths,1);assert.equal(f.stats().connects,4);assert.deepEqual(f.calls.filter(c=>c[0]==='auth').map(c=>c[1]),['fixture-history','fixture-supplement']);assert.equal(f.calls.filter(c=>c[0]==='sql'&&c[1]==='SET LOCAL ROLE night_scout_review_service').length,4);
 await runtime.close();assert.equal(f.stats().ends,1);
});
test('history disabled never attaches; synchronous trusted hook failure closes the same pool',async()=>{
 const off=fixture();let calls=0;const runtime=await initialiseHistoryReportingRuntime(off.config,off.factories,{enabled:false,attachRuntime:()=>{calls++;throw Error('must not attach');}});assert.equal(calls,0);assert.equal(runtime.historyService,undefined);await runtime.close();assert.equal(off.stats().ends,1);
 const failed=fixture();await assert.rejects(initialiseHistoryReportingRuntime(failed.config,failed.factories,{enabled:true,attachRuntime:()=>{throw Error('trusted hook fixture failure');}}),/trusted hook fixture failure/);assert.equal(failed.stats().pools,1);assert.equal(failed.stats().ends,1);
});
