import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=path=>readFileSync(new URL(`../../${path}`,import.meta.url),'utf8');
const owner='10000000-0000-4000-8000-000000000001',store='20000000-0000-4000-8000-000000000001',connection='30000000-0000-4000-8000-000000000001';
async function fixture(){
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN;CREATE ROLE night_scout_xero_bootstrap_login NOLOGIN;CREATE ROLE night_scout_import_login NOLOGIN;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth TO authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;CREATE TABLE public.stores(id uuid PRIMARY KEY);CREATE TABLE public.store_memberships(user_id uuid,store_id uuid,PRIMARY KEY(user_id,store_id));`);
 await db.exec(sql('db-migrations/staging/20260918_apply_xero_staging.sql'));
 await db.exec(sql('db-migrations/staging/20260925_xero_merchant_readiness.sql'));
 await db.exec(`CREATE TABLE xero_v1.connection_preflight_evidence(id uuid PRIMARY KEY,connection_id uuid,credential_version integer,outcome text,phase text,reason text,tenant_visible boolean,checked_at timestamptz);CREATE TABLE xero_v1.xero_reauthorization_authorizations(connection_id uuid,consumed_at timestamptz);CREATE TABLE xero_v1.xero_second_reauthorization_authorizations(connection_id uuid,consumed_at timestamptz);CREATE TABLE xero_v1.xero_third_reauthorization_authorizations(id uuid DEFAULT gen_random_uuid(),connection_id uuid,allowed_owner_id uuid,target_credential_version integer,consumed_at timestamptz,replacement_version integer);INSERT INTO auth.users VALUES('${owner}');INSERT INTO public.stores VALUES('${store}');INSERT INTO public.store_memberships VALUES('${owner}','${store}');INSERT INTO xero_v1.connections(id,store_id,tenant_id) VALUES('${connection}','${store}','synthetic');INSERT INTO xero_v1.xero_reauthorization_authorizations VALUES('${connection}',now());INSERT INTO xero_v1.xero_second_reauthorization_authorizations VALUES('${connection}',now());INSERT INTO xero_v1.xero_third_reauthorization_authorizations(connection_id,allowed_owner_id,target_credential_version) VALUES('${connection}','${owner}',3);`);
 const third=sql('db-migrations/staging/20261009_xero_third_reviewed_reauthorization.sql');
 for(const name of ['bootstrap_get_reauthorization_target','bootstrap_reauthorize_connection']){
  const definition=third.slice(third.indexOf(`CREATE OR REPLACE FUNCTION xero_v1.${name}`));await db.exec(definition.slice(0,definition.indexOf('END $$;')+7));
 }
 await db.exec("REVOKE ALL ON FUNCTION xero_v1.bootstrap_get_reauthorization_target(uuid,text,uuid),xero_v1.bootstrap_reauthorize_connection(uuid,uuid,text,uuid,integer,bytea,bytea,text,text) FROM PUBLIC,anon,authenticated,service_role,night_scout_import_login;GRANT USAGE ON SCHEMA xero_v1 TO night_scout_xero_bootstrap_login;GRANT EXECUTE ON FUNCTION xero_v1.bootstrap_get_reauthorization_target(uuid,text,uuid),xero_v1.bootstrap_reauthorize_connection(uuid,uuid,text,uuid,integer,bytea,bytea,text,text) TO night_scout_xero_bootstrap_login;");
 return db;
}
test('atomic reader activation preserves all source rows and pending third authorization; member ACL remains narrow',async()=>{
 const db=await fixture();try{
  await db.exec(sql('db-migrations/proposals/xero-member-readers-activation-2026-10-09.sql'));
  const postflight=await db.exec(sql('db-migrations/proposals/verify-xero-member-readers-activation-2026-10-09.sql'));
  for(const result of postflight)for(const row of result.rows??[])for(const [key,value] of Object.entries(row))if(key!=='reader')assert.equal(value,true,key);
  const flags=(await db.query(`SELECT has_function_privilege('authenticated','public.xero_accounting_period(uuid,date,date,text)','EXECUTE') member,has_function_privilege('anon','public.xero_accounting_period(uuid,date,date,text)','EXECUTE') anonymous`)).rows[0];assert.deepEqual(flags,{member:true,anonymous:false});
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${owner}',false);SET SESSION AUTHORIZATION authenticated`);
  const value=(await db.query('SELECT public.xero_merchant_readiness($1) value',[store])).rows[0].value;assert.equal(value.connection.status,'reauthorization_required');assert.equal(value.evidenceState,'review_required');
  await assert.rejects(db.query('SELECT public.xero_merchant_readiness($1)',['20000000-0000-4000-8000-000000000002']),/access denied/);
 }finally{await db.close();}
});
test('incompatible missing dependency aborts before replacing existing readiness',async()=>{
 const db=await fixture();try{
  const before=(await db.query("SELECT pg_get_functiondef('public.xero_merchant_readiness(uuid)'::regprocedure) body")).rows[0].body;
  await db.exec('DROP TABLE xero_v1.connection_preflight_evidence');
  await assert.rejects(db.exec(sql('db-migrations/proposals/xero-member-readers-activation-2026-10-09.sql')),/required Xero staging relation unavailable/);await db.exec('ROLLBACK');
  assert.equal((await db.query("SELECT pg_get_functiondef('public.xero_merchant_readiness(uuid)'::regprocedure) body")).rows[0].body,before);
  assert.equal((await db.query("SELECT to_regprocedure('public.xero_accounting_period(uuid,date,date,text)') value")).rows[0].value,null);
 }finally{await db.close();}
});

async function reconnectEvidence(db,version=4){await db.exec(`INSERT INTO xero_v1.mapping_versions(id,connection_id,version,effective_from,confirmed_by,confirmed_at,directory_retrieved_at) VALUES('40000000-0000-4000-8000-000000000001','${connection}',1,'2026-09-01','${owner}',now(),now());INSERT INTO xero_v1.credential_envelopes(connection_id,ciphertext,encrypted_dek,key_version,algorithm,version) VALUES('${connection}',decode('01','hex'),decode('02','hex'),'test-key','AES-256-GCM',${version});INSERT INTO xero_v1.connection_preflight_evidence VALUES('50000000-0000-4000-8000-000000000001','${connection}',${version},'failed','connection','reconnect_required',false,now());`);}
test('current reconnect with stale third authorization creates only fourth; exact bootstrap lookup works',async()=>{
 const db=await fixture();try{
  await reconnectEvidence(db);await db.exec(sql('db-migrations/proposals/xero-member-readers-activation-2026-10-09.sql'));
  assert.equal((await db.query('SELECT count(*) n FROM xero_v1.xero_fourth_reauthorization_authorizations')).rows[0].n,1);
  assert.equal((await db.query('SELECT target_credential_version v,consumed_at FROM xero_v1.xero_third_reauthorization_authorizations')).rows[0].v,3);
  await db.exec('SET SESSION AUTHORIZATION night_scout_xero_bootstrap_login');
  const rows=(await db.query('SELECT * FROM xero_v1.bootstrap_get_reauthorization_target($1,$2,$3)',[store,'synthetic',owner])).rows;assert.equal(rows.length,1);assert.equal(rows[0].credential_version,4);
  await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');
  await db.exec(sql('db-migrations/proposals/xero-member-readers-activation-2026-10-09.sql'));assert.equal((await db.query('SELECT count(*) n FROM xero_v1.xero_fourth_reauthorization_authorizations')).rows[0].n,1);
  await db.exec('SET SESSION AUTHORIZATION night_scout_xero_bootstrap_login');
  const replaced=(await db.query('SELECT * FROM xero_v1.bootstrap_reauthorize_connection($1,$2,$3,$4,$5,$6,$7,$8,$9)',[connection,store,'synthetic',owner,4,new Uint8Array([3]),new Uint8Array([4]),'test-key','AES-256-GCM'])).rows;assert.equal(replaced[0].credential_version,5);
  await assert.rejects(db.query('SELECT * FROM xero_v1.bootstrap_reauthorize_connection($1,$2,$3,$4,$5,$6,$7,$8,$9)',[connection,store,'synthetic',owner,4,new Uint8Array([3]),new Uint8Array([4]),'test-key','AES-256-GCM']),/unavailable/);
  await db.exec(`RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres;SELECT set_config('request.jwt.claim.sub','${owner}',false);SET SESSION AUTHORIZATION authenticated`);
  assert.equal((await db.query('SELECT public.xero_merchant_readiness($1) value',[store])).rows[0].value.connection.status,'active');
 }finally{await db.close();}
});
test('usable third authorization remains unchanged and no fourth is installed',async()=>{
 const db=await fixture();try{await reconnectEvidence(db,3);await db.exec(sql('db-migrations/proposals/xero-member-readers-activation-2026-10-09.sql'));assert.equal((await db.query("SELECT to_regclass('xero_v1.xero_fourth_reauthorization_authorizations') value")).rows[0].value,null);}finally{await db.close();}
});

test('exact approved combined installer commits readers, reconnect and disabled isolated writer together',async()=>{
 const db=await fixture();try{
  await reconnectEvidence(db);const results=await db.exec(sql('deployments/nightly-staging/approved-staging-activation-2026-10-09.sql'));
  const receipt=results.at(-1).rows[0];assert.deepEqual(receipt,{state:'staging_readers_and_disabled_writer_installed',member_readers:2,enabled_writer_programmes:0,provider_actions:0,reconnect_uses_fourth_authorization:true});
  const guard=(await db.query("SELECT NOT has_schema_privilege('authenticated','staging_test_programme','USAGE') browser_denied,NOT has_table_privilege('night_scout_test_writer','staging_test_programme.writer_envelopes','SELECT') writer_direct_denied")).rows[0];assert.deepEqual(guard,{browser_denied:true,writer_direct_denied:true});
  await db.exec(sql('experiments/test-programme/activation-postflight.sql'));
 }finally{await db.close();}
});
test('writer target conflict rolls back earlier reader and fourth-authorization preparation atomically',async()=>{
 const db=await fixture();try{
  await reconnectEvidence(db);await db.exec('CREATE SCHEMA staging_test_programme');
  const before=(await db.query("SELECT pg_get_functiondef('public.xero_merchant_readiness(uuid)'::regprocedure) value")).rows[0].value;
  await assert.rejects(db.exec(sql('deployments/nightly-staging/approved-staging-activation-2026-10-09.sql')),/Writer installation target occupied/);await db.exec('ROLLBACK');
  assert.equal((await db.query("SELECT to_regprocedure('public.xero_accounting_period(uuid,date,date,text)') value")).rows[0].value,null);
  assert.equal((await db.query("SELECT to_regclass('xero_v1.xero_fourth_reauthorization_authorizations') value")).rows[0].value,null);
  assert.equal((await db.query("SELECT pg_get_functiondef('public.xero_merchant_readiness(uuid)'::regprocedure) value")).rows[0].value,before);
 }finally{await db.close();}
});
