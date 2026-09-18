import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,sql,A,U} from '../shopify/finance-fixture.mjs';
import {provisionStagingReviewer,buildStagingReviewerSql} from './provision-reviewer.mjs';
const input={projectRef:'bioalckltvkhlczusdvl',storeId:A,reviewerId:U,password:'synthetic_'.repeat(6)};
async function fixture(){const {db}=await setup(undefined,{installIntake:false});await db.exec(sql('staging/20260910_review_setup.sql'));return db;}
function adapter(db,fail=false){return {transaction:async fn=>{await db.exec('BEGIN');try{const r=await fn({query:async(...args)=>{await db.exec(args[0]);if(fail)throw new Error('synthetic failure');return {rows:[]};}});await db.exec('COMMIT');return r;}catch(e){await db.exec('ROLLBACK');throw e;}}};}
test('provisions one existing synthetic-store member with restricted login; replay refused',async()=>{
 const db=await fixture();try{
 assert.deepEqual(await provisionStagingReviewer(adapter(db),input),{provisioned:true});
 const {rows}=await db.query("SELECT rolcanlogin,rolinherit,rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls,rolconnlimit FROM pg_roles WHERE rolname='night_scout_review_login'");
 assert.deepEqual(rows,[{rolcanlogin:true,rolinherit:false,rolsuper:false,rolcreaterole:false,rolcreatedb:false,rolreplication:false,rolbypassrls:false,rolconnlimit:3}]);
 assert.equal((await db.query('SELECT count(*)::int n FROM ingest_v1.review_authorizations')).rows[0].n,1);
 await assert.rejects(provisionStagingReviewer(adapter(db),input),/provisioning failed/);
 }finally{await db.close();}
});
test('missing membership or late error leaves no login or authorisation',async()=>{
 for(const late of [false,true]){const db=await fixture();try{
 await assert.rejects(provisionStagingReviewer(adapter(db,late),{...input,reviewerId:late?U:'80000000-0000-4000-8000-000000000099'}),/provisioning failed/);
 assert.equal((await db.query("SELECT count(*)::int n FROM pg_roles WHERE rolname='night_scout_review_login'")).rows[0].n,0);
 assert.equal((await db.query('SELECT count(*)::int n FROM ingest_v1.review_authorizations')).rows[0].n,0);
 }finally{await db.close();}}
});
test('rejects other projects, stores and unsafe password input before touching database',async()=>{
 for(const change of [{projectRef:'futkktdebdygsdrcknpr'},{storeId:'other'},{password:"unsafe'password"},{password:'short'}])await assert.rejects(provisionStagingReviewer({transaction:()=>assert.fail('must not connect')},{...input,...change}),/Invalid staging/);
});

test('SQL uses a SCRAM verifier instead of exposing the plaintext credential',()=>{const sql=buildStagingReviewerSql(input);assert.ok(sql.includes('SCRAM-SHA-256$4096:'));assert.ok(!sql.includes(input.password));});
