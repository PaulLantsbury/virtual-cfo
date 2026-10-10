import test from 'node:test';import assert from 'node:assert/strict';
import {checkDashboardSchema} from './check-dashboard-schema.mjs';
const env={NIGHT_SCOUT_RUNTIME_ENV:'staging',NIGHT_SCOUT_REVIEW_PROJECT_REF:'bioalckltvkhlczusdvl',NIGHT_SCOUT_REVIEW_AUTH_URL:'https://bioalckltvkhlczusdvl.supabase.co',NIGHT_SCOUT_REVIEW_PUBLIC_KEY:'sb_publishable_fixture',NIGHT_SCOUT_REVIEW_DATABASE_URL:'postgres://night_scout_review_login:fixture-secret@db.bioalckltvkhlczusdvl.supabase.co:5432/postgres'};
const sql='BEGIN READ ONLY;\nSELECT true;\nROLLBACK;';
test('Dedicated staging read only and safe diagnostic output exclude secrets/DDL/identifiers',async()=>{
 let closed=false,released=false;const calls=[];const result=await checkDashboardSchema(env,{loadSql:async()=>sql,createPool:options=>{assert.equal(options.ssl.rejectUnauthorized,true);assert.equal(options.max,1);return {connect:async()=>({query:async actual=>{calls.push(actual);if(actual.includes('SELECT true'))return {rows:[{diagnostics:{server_major:17,expected_catalog_major:18,schema_contract_matches:false,visible_constraint_types:{n:0,c:44},mismatches:{columns:[],constraints:[{definition:'sensitive-ddl'}],triggers:[]},injected:'fixture-secret'}}]};return {rows:[]};},release:()=>{released=true;}}),end:async()=>{closed=true;}};}});
 assert.equal(released,true);assert.deepEqual(calls,['BEGIN READ ONLY','SET LOCAL ROLE night_scout_review_service',"SET LOCAL statement_timeout = '30s'",'\nSELECT true;\n','ROLLBACK']);
 assert.equal(closed,true);assert.equal(result.compatible,false);assert.equal(result.state,'schema_mismatch');assert.equal(result.mismatches.constraints,1);assert.doesNotMatch(JSON.stringify(result),/fixture-secret|sensitive-ddl|injected/);
});
test('Invalid target/config avoids network and permission errors remain value-free',async()=>{
 const factory=()=>{throw Error('unexpected network fixture-secret');};
 assert.equal((await checkDashboardSchema({...env,NIGHT_SCOUT_RUNTIME_ENV:'production'},{createPool:factory})).state,'refused_target');
 assert.equal((await checkDashboardSchema({...env,NIGHT_SCOUT_REVIEW_DATABASE_URL:'bad fixture-secret'},{createPool:factory})).state,'database_check_unavailable');
 const result=await checkDashboardSchema(env,{loadSql:async()=>sql,createPool:()=>({connect:async()=>({query:async()=>{throw Object.assign(Error('private credential'),{code:'42501'});},release:()=>{}}),end:async()=>{}})});
 assert.equal(result.state,'insufficient_schema_visibility');assert.doesNotMatch(JSON.stringify(result),/private credential/);
});
