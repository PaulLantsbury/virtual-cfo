import test from 'node:test';import assert from 'node:assert/strict';import {validDemoReaderIdentity,validDemoBootstrapIdentity} from './demo-database-identity.mjs';import {createDemoQueryPort} from './demo-query-port.mjs';import {executeDemoReader} from './run-demo-refresh.mjs';import {runDemoDailyCron} from './run-demo-daily-cron.mjs';import {demoEnv,clock} from './demo-fixture.mjs';
function roleFixture(prefix='import'){
 const login=`night_scout_demo_${prefix}_login`,service=`night_scout_demo_${prefix}_service`,safe={rolsuper:false,rolinherit:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false,session_login:login};return {roles:[{...safe,rolname:login,rolcanlogin:true,rolconnlimit:3},{...safe,rolname:service,rolcanlogin:false,rolconnlimit:-1}],members:[{role_name:service,member_name:login,admin_option:false,inherit_option:false,set_option:true}]};
}
test('both fixed demo role pairs reject privilege drift, old identities and extra inherited membership',()=>{
 for(const [kind,check] of [['import',validDemoReaderIdentity],['bootstrap',validDemoBootstrapIdentity]]){const f=roleFixture(kind);assert.equal(check(f.roles,f.members),true);assert.equal(check(roleFixture(kind==='import'?'bootstrap':'import').roles,f.members),false);
 for(const flag of ['rolsuper','rolinherit','rolcreatedb','rolcreaterole','rolreplication','rolbypassrls']){assert.equal(check([{...f.roles[0],[flag]:true},f.roles[1]],f.members),false);assert.equal(check([{...f.roles[0],[flag]:undefined},f.roles[1]],f.members),false);}
 for(const patch of [{session_login:'night_scout_import_login'},{rolconnlimit:-1},{rolconnlimit:4},{rolcanlogin:false}])assert.equal(check([{...f.roles[0],...patch},f.roles[1]],f.members),false);
 assert.equal(check(f.roles,[...f.members,{role_name:'postgres'}]),false);assert.equal(check(f.roles,[{...f.members[0],inherit_option:true}]),false);assert.equal(check(f.roles,[{...f.members[0],admin_option:true}]),false);
 }
});
test('query adapter validates real session on each transaction before SET-only new schema RPC; old/arbitrary SQL refused',async()=>{
 const f=roleFixture(),calls=[];let released=0;const pool={connect:async()=>({release:()=>released++,query:async(sql,args)=>{calls.push(sql);if(sql.includes('FROM pg_catalog.pg_roles'))return {rows:f.roles};if(sql.includes('pg_auth_members'))return {rows:f.members};return {rows:[{synthetic:true}]};}})};
 const query=createDemoQueryPort(pool);assert.deepEqual(await query('SELECT * FROM xero_demo_v1.worker_get_single_connection_preflight_job()',[]),{rows:[{synthetic:true}]});assert.ok(calls.indexOf('SET LOCAL ROLE night_scout_demo_import_service')>calls.findIndex(c=>c.includes('pg_auth_members')));assert.equal(calls.at(-1),'COMMIT');assert.equal(released,1);
 const n=calls.length;for(const sql of ['SELECT * FROM xero_v1.worker_get_single_connection_preflight_job()','SELECT * FROM xero_demo_v1.connections','DROP SCHEMA xero_demo_v1 CASCADE'])await assert.rejects(query(sql));assert.equal(calls.length,n);
 f.roles[0].rolsuper=true;await assert.rejects(query('SELECT * FROM xero_demo_v1.worker_get_single_connection_preflight_job()',[]));assert.equal(calls.at(-1),'ROLLBACK');
});
test('disabled execution uses no config/pool/provider; enabled driver uses dedicated verified-TLS parameters and sanitized failure',async()=>{
 let calls=0;assert.equal((await executeDemoReader({env:{},createPool:()=>{calls++;throw Error('must not create');}})).state,'disabled');assert.equal(calls,0);
 const env=demoEnv();let ended=false,config;await assert.rejects(executeDemoReader({env,clock,createPool:c=>{config=c;return {on:()=>{},connect:async()=>{throw Error('PRIVATE DATABASE CONNECTION');},end:async()=>ended=true};}}),/^Error: Demo reader execution unavailable$/);assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(config.ssl.ca,env.NIGHT_SCOUT_DEMO_XERO_CA_PEM);assert.equal(config.max,1);assert.equal(ended,true);
});
test('daily CLI admits one 02 London candidate within the bounded GMT trial and skips before work',async()=>{
 const env=demoEnv();let calls=0;const run=async()=>{calls++;return {state:'synthetic-not-a-live-run'};};
 for(const date of ['2026-10-30','2026-11-06']){let admitted=0;for(const hour of ['01','02']){const r=await runDemoDailyCron({env,now:new Date(`${date}T${hour}:00:00Z`),run});if(r.state==='synthetic-not-a-live-run')admitted++;}assert.equal(admitted,1);}
 assert.equal(calls,2);assert.equal((await runDemoDailyCron({env,now:new Date('2026-10-30T02:15:00Z'),run})).state,'skipped');assert.equal((await runDemoDailyCron({env:{},now:new Date('2026-10-30T02:00:00Z'),run})).state,'disabled');assert.equal(calls,2);
 await assert.rejects(runDemoDailyCron({env:{...env,NIGHT_SCOUT_DEMO_XERO_PERIOD_MODE:'fixed'},now:new Date('2026-10-30T02:00:00Z'),run}));
});

import {demoIntakeWindow} from './demo-intake-window.mjs';import {readDemoReaderConfig} from './demo-config.mjs';
test('fixed new intake start/last final02/hardstop reject later work before pool or provider',async()=>{
 const env=demoEnv();let calls=0;const pool=()=>{calls++;throw Error('must not create');};
 assert.equal(demoIntakeWindow(new Date('2026-10-29T23:59:59Z')).reason,'trial_not_started');assert.equal(demoIntakeWindow(new Date('2026-10-30T00:00:00Z')).state,'admitted');assert.equal(demoIntakeWindow(new Date('2026-11-06T02:00:00Z')).state,'admitted');assert.equal(demoIntakeWindow(new Date('2026-11-06T03:00:00Z')).state,'trial_expired');
 for(const at of ['2026-10-29T23:59:59Z','2026-11-06T03:00:00Z','2026-11-07T02:00:00Z']){const clock=()=>new Date(at);assert.throws(()=>readDemoReaderConfig(env,clock));const r=await executeDemoReader({env,clock,createPool:pool});assert.ok(['disabled','trial_expired'].includes(r.state));const cron=await runDemoDailyCron({env,now:clock(),run:async()=>{calls++;}});assert.ok(['disabled','trial_expired'].includes(cron.state));}
 assert.equal(calls,0);assert.deepEqual(readDemoReaderConfig(env,()=>new Date('2026-11-06T02:00:00Z')).scope,{from:'2026-11-01',to:'2026-11-05',currency:'GBP'});
});
