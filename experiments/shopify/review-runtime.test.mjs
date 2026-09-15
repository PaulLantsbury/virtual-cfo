import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewConnectionOptions,boundedAuthFetch,reviewDatabase,initialiseReviewRuntime} from './review-runtime.mjs';
const ref='abcdefghijklmnopqrst';
const config={projectRef:ref,authUrl:`https://${ref}.supabase.co`,publishableKey:'sb_publishable_synthetic',databaseUrl:`postgresql://night_scout_review_login:synthetic-password@db.${ref}.supabase.co:5432/postgres`};
test('connection settings bind Auth and direct database project with verified TLS',()=>{
 const options=reviewConnectionOptions(config);assert.equal(options.pool.ssl.rejectUnauthorized,true);assert.equal(options.pool.max,3);
 for(const change of [{authUrl:'https://another-project.supabase.co'},{databaseUrl:config.databaseUrl.replace(ref,'anotherprojectabcdef')},{databaseUrl:config.databaseUrl+'?sslmode=disable'},{databaseUrl:config.databaseUrl.replace('night_scout_review_login','postgres')},{publishableKey:'sb_secret_do-not-expose'}]){
  assert.throws(()=>reviewConnectionOptions({...config,...change}),e=>e.message==='Review server configuration is invalid');
 }
});
test('Auth fetch prevents redirects, unrelated destinations and aborts stalled responses',async()=>{
 let calls=0;
 const f=boundedAuthFetch(`https://${ref}.supabase.co`,async(_url,options)=>{calls++;assert.equal(options.redirect,'error');return new Response('{}');});
 assert.equal(await (await f(`https://${ref}.supabase.co/auth/v1/user`)).text(),'{}');
 await assert.rejects(f('https://elsewhere.invalid/auth/v1/user'));assert.equal(calls,1);
 const stalled=boundedAuthFetch(`https://${ref}.supabase.co`,async(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')))),{timeoutMs:10});
 await assert.rejects(stalled(`https://${ref}.supabase.co/auth/v1/user`),/aborted/);
 const oversized=boundedAuthFetch(`https://${ref}.supabase.co`,async()=>new Response('x'.repeat(65537)));
 await assert.rejects(oversized(`https://${ref}.supabase.co/auth/v1/user`),/too large/);
});
test('database adapter isolates role in transaction and never retries uncertain commits',async()=>{
 const queries=[],releases=[];
 const pool={connect:async()=>({query:async sql=>{queries.push(sql);if(sql==='COMMIT')throw new Error('connection lost');return {rows:[]};},release:destroy=>releases.push(destroy)})};
 await assert.rejects(reviewDatabase(pool).transaction(async tx=>tx.query('SELECT 1')),/connection lost/);
 assert.deepEqual(queries,['BEGIN','SET LOCAL ROLE night_scout_review_service','SELECT 1','COMMIT','ROLLBACK']);assert.deepEqual(releases,[true]);
});
function factories(overrides={}){
 const calls={ended:0,released:0,auth:0};
 const pool={connect:async()=>({query:async sql=>({rows:sql.includes('unsafe_login')?[{role:'night_scout_review_service',unsafe_login:false,unsafe_writes:false,lock_ready:true,...overrides}]:[]}),release:()=>calls.released++}),end:async()=>{calls.ended++;}};
 return {calls,createPool:options=>{assert.equal(options.user,'night_scout_review_login');return pool;},createAuthClient:(url,key,options)=>{calls.auth++;assert.equal(url,`https://${ref}.supabase.co`);assert.equal(options.auth.persistSession,false);assert.equal(options.auth.autoRefreshToken,false);assert.equal(typeof options.global.fetch,'function');return {auth:{getUser:async()=>({error:{}})}};}};
}
test('runtime becomes usable only after permission readiness succeeds',async()=>{
 const f=factories();const runtime=await initialiseReviewRuntime(config,f);assert.equal(typeof runtime.service.prepare,'function');assert.equal(f.calls.auth,1);assert.equal(f.calls.released,1);await runtime.close();assert.equal(f.calls.ended,1);
});
test('unsafe or incomplete permissions close the pool without creating Auth client',async()=>{
 for(const override of [{unsafe_login:true},{unsafe_writes:true},{lock_ready:false},{role:'postgres'}]){
  const f=factories(override);await assert.rejects(initialiseReviewRuntime(config,f),/could not be initialised/);assert.equal(f.calls.ended,1);assert.equal(f.calls.auth,0);
 }
});
