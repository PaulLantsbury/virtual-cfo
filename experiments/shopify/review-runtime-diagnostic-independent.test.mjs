/** Independent masked startup regression: installed pg-pool and a fictional
 * client; zero network, credentials, live database or settings changes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {initialiseReviewRuntime} from './review-runtime.mjs';
const require=createRequire(new URL('../../artifacts/api-server/package.json',import.meta.url));
const pg=require('pg');
const ref='abcdefghijklmnopqrst',secret='fictional-secret-host-password-query';
const config={projectRef:ref,authUrl:`https://${ref}.supabase.co`,publishableKey:'sb_publishable_synthetic',databaseUrl:`postgresql://night_scout_review_login:synthetic-password@db.${ref}.supabase.co:5432/postgres`};
test('installed pg-pool preserves PostgreSQL 53300 and startup exposes only its fixed code',async()=>{
 let constructed=0,connections=0;
 class FictionalLimitedClient extends EventEmitter{
  constructor(){super();constructed++;}
  connect(callback){connections++;queueMicrotask(()=>callback(Object.assign(Error(secret),{code:'53300',severity:'FATAL',detail:secret,host:secret,user:secret})));}
  end(){assert.fail('Rejected connection is not an established client');}
 }
 await assert.rejects(initialiseReviewRuntime(config,{createPool:options=>new pg.Pool({...options,Client:FictionalLimitedClient}),createAuthClient:()=>assert.fail('Auth must not run after connection denial')}),error=>{
  assert.equal(error.message,'Review server could not be initialised');assert.deepEqual(error.safeDiagnostic,{phase:'database_connect',code:'53300'});
  assert.equal(JSON.stringify(error).includes(secret),false);assert.equal('cause' in error,false);return true;
 });
 assert.equal(constructed,1);assert.equal(connections,1,'No automatic retry');
});
test('a role-limit-looking private message without an approved code remains generic',async()=>{
 const cause=Object.assign(Error('too many connections for role '+secret),{code:'private-unapproved-code',detail:secret});
 await assert.rejects(initialiseReviewRuntime(config,{createPool:()=>({connect:async()=>{throw cause;},end:async()=>{}}),createAuthClient:()=>assert.fail()}),error=>{
  assert.deepEqual(error.safeDiagnostic,{phase:'database_connect',code:'CHECK_FAILED'});assert.equal(JSON.stringify(error).includes(secret),false);return true;
 });
});
