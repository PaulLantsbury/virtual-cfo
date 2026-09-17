import test from 'node:test';
import assert from 'node:assert/strict';
import {INTAKE_TARGET as target,intakeConnectionOptions,intakeDatabase,initialiseIntakeRuntime} from './intake-runtime.mjs';
const config={projectRef:target.projectRef,databaseUrl:`postgresql://night_scout_intake_login:synthetic@db.${target.projectRef}.supabase.co/postgres`,scope:{storeId:target.storeId,shopId:target.shopId,from:'2026-09-17',to:'2026-09-17'}};
function poolFixture({badRole=false,wrongStore=false,commitFailure=false}={}){
 const queries=[];let closed=false,discard;
 return {queries,get closed(){return closed;},get discard(){return discard;},end:async()=>{closed=true;},connect:async()=>({release:v=>{discard=v;},query:async(sql,args)=>{
 queries.push([sql,args]);
 if(sql==='COMMIT'&&commitFailure)throw Error('secret database error');
 if(sql.includes('AS safe_login'))return {rows:[{role:badRole?'postgres':'night_scout_intake_service',safe_login:true,safe_role:true,unsafe_writes:false,unsafe_membership:false,lock_ready:true}]};
 if(sql.startsWith('SELECT id,'))return {rows:[{id:target.storeId,shopify_domain:wrongStore?'other.myshopify.com':target.domain,shopify_store_id:'95601983836',currency_code:'GBP',timezone:'Europe/London'}]};
 return {rows:[]};
 }})};
}
test('configuration pins staging, private login and store; forces validated TLS and bounded pool',()=>{
 const options=intakeConnectionOptions(config);assert.equal(options.pool.ssl.rejectUnauthorized,true);assert.equal(options.pool.max,1);assert.equal(options.pool.statement_timeout,30000);assert.ok(Object.isFrozen(options.scope));
 for(const change of [{projectRef:'futkktdebdygsdrcknpr'},{databaseUrl:config.databaseUrl+'?sslmode=disable'},{databaseUrl:config.databaseUrl.replace('intake_login','review_login')},{databaseUrl:config.databaseUrl.replace('db.bio','evil.bio')},{scope:{...config.scope,storeId:'90000000-0000-4000-8000-000000000004'}},{scope:{...config.scope,shopId:'gid://shopify/Shop/1'}},{scope:{...config.scope,to:'2026-09-31'}}])assert.throws(()=>intakeConnectionOptions({...config,...change}),/configuration is invalid/);
});
test('restricted store lock helper only accepts configured store',async()=>{
 const pool=poolFixture(),db=intakeDatabase(pool);
 await db.transaction(tx=>db.lockCandidateStore(tx,target.storeId));
 assert.ok(pool.queries.some(([s])=>s==='SELECT ingest_v1.lock_intake_store($1)'));
 const count=pool.queries.length;await assert.rejects(db.lockCandidateStore({query:()=>assert.fail()},'other'),/invalid/);assert.equal(pool.queries.length,count);
});
test('commit acknowledgement loss discards connection and never retries transaction',async()=>{
 const pool=poolFixture({commitFailure:true});let runs=0;
 await assert.rejects(intakeDatabase(pool).transaction(async()=>{runs++;}),/secret database error/);
 assert.equal(runs,1);assert.equal(pool.discard,true);assert.equal(pool.queries.filter(([q])=>q==='COMMIT').length,1);
});
test('readiness rejects wrong role or source mapping and closes pool',async()=>{
 for(const bad of [{badRole:true},{wrongStore:true}]){
 const pool=poolFixture(bad);await assert.rejects(initialiseIntakeRuntime(config,{createPool:()=>pool,resolveCredential:async()=>assert.fail()}),e=>e.message==='Intake could not be initialised');assert.equal(pool.closed,true);
 }
});
test('initialisation is read-only; explicit confirmation gates credential resolution; failures are sanitised',async()=>{
 const pool=poolFixture();let credentials=0;
 const runtime=await initialiseIntakeRuntime(config,{createPool:()=>pool,resolveCredential:async()=>{credentials++;throw Error('private-token-do-not-expose');}});
 assert.equal(credentials,0);assert.ok(pool.queries.every(([s])=>! /^(INSERT|UPDATE|DELETE)/.test(s)));
 await assert.rejects(runtime.run(),/Explicit staging/);assert.equal(credentials,0);
 await assert.rejects(runtime.run({confirmTarget:`${target.projectRef}/${target.storeId}`}),e=>e.message==='Intake outcome unconfirmed; inspect candidate state before retrying');assert.equal(credentials,1);
 await runtime.close();assert.equal(pool.closed,true);await assert.rejects(runtime.run({confirmTarget:`${target.projectRef}/${target.storeId}`}),/closed/);
});
