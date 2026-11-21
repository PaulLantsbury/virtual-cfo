import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=path=>readFileSync(new URL(`../../${path}`,import.meta.url),'utf8');
const owner='10000000-0000-4000-8000-000000000001',store='56d92f8a-746e-4b4f-b408-81fc98c4aa17',connection='30000000-0000-4000-8000-000000000001';
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
async function reconnectEvidence(db,version=4){await db.exec(`INSERT INTO xero_v1.mapping_versions(id,connection_id,version,effective_from,confirmed_by,confirmed_at,directory_retrieved_at) VALUES('40000000-0000-4000-8000-000000000001','${connection}',1,'2026-09-01','${owner}',now(),now());INSERT INTO xero_v1.credential_envelopes(connection_id,ciphertext,encrypted_dek,key_version,algorithm,version) VALUES('${connection}',decode('01','hex'),decode('02','hex'),'test-key','AES-256-GCM',${version});INSERT INTO xero_v1.connection_preflight_evidence VALUES('50000000-0000-4000-8000-000000000001','${connection}',${version},'failed','connection','reconnect_required',false,now());`);}

async function exhausted(){const db=await fixture();await reconnectEvidence(db);await db.exec(sql('db-migrations/proposals/xero-member-readers-activation-2026-10-09.sql'));await db.exec(`UPDATE xero_v1.xero_fourth_reauthorization_authorizations SET consumed_at=now(),replacement_version=5;UPDATE xero_v1.credential_envelopes SET version=6;UPDATE xero_v1.connection_preflight_evidence SET credential_version=6;`);return db;}
async function recurrence(){const db=await exhausted();await db.exec(sql('db-migrations/proposals/xero-reviewed-fifth-reauthorization-2026-10-11.sql'));await db.exec(`UPDATE xero_v1.xero_fifth_reauthorization_authorizations SET consumed_at=now(),replacement_version=7;UPDATE xero_v1.credential_envelopes SET version=8;UPDATE xero_v1.connection_preflight_evidence SET credential_version=8,checked_at=now();`);return db;}
const recovery='db-migrations/proposals/xero-reviewed-sixth-reauthorization-2026-10-11.sql';
async function history(db){const parts=[];for(const relation of ['connections','credential_envelopes','credential_audit','mapping_versions','mapping_selections','mapping_audit','accounting_evidence','connection_preflight_evidence','xero_reauthorization_authorizations','xero_second_reauthorization_authorizations','xero_third_reauthorization_authorizations','xero_fourth_reauthorization_authorizations','xero_fifth_reauthorization_authorizations'])parts.push((await db.query(`SELECT coalesce(jsonb_agg(t ORDER BY to_jsonb(t)::text),'[]'::jsonb) value FROM xero_v1.${relation} t`)).rows[0].value);return parts;}
test('sixth recovery preserves all prior history, RLS and one owner/tenant/version-bound replacement',async()=>{const db=await recurrence();try{
 const before=await history(db);await db.exec(sql(recovery));assert.deepEqual(await history(db),before);
 const post=(await db.query(`SELECT count(*) n FROM xero_v1.xero_sixth_reauthorization_authorizations WHERE consumed_at IS NULL AND target_credential_version=8`)).rows[0];assert.equal(post.n,1);
 const acl=(await db.query("SELECT relrowsecurity rls,has_table_privilege('authenticated','xero_v1.xero_sixth_reauthorization_authorizations','SELECT') member,has_function_privilege('night_scout_import_login','xero_v1.bootstrap_reauthorize_connection(uuid,uuid,text,uuid,integer,bytea,bytea,text,text)','EXECUTE') worker FROM pg_class WHERE oid='xero_v1.xero_sixth_reauthorization_authorizations'::regclass")).rows[0];assert.deepEqual(acl,{rls:true,member:false,worker:false});
 await assert.rejects(db.exec(sql(recovery)),/already exists/);await db.exec('ROLLBACK');assert.deepEqual(await history(db),before);
 await db.exec('SET SESSION AUTHORIZATION night_scout_xero_bootstrap_login');
 assert.equal((await db.query('SELECT * FROM xero_v1.bootstrap_get_reauthorization_target($1,$2,$3)',[store,'synthetic',owner])).rows.length,1);
 assert.equal((await db.query('SELECT * FROM xero_v1.bootstrap_get_reauthorization_target($1,$2,$3)',[store,'wrong',owner])).rows.length,0);
 await db.query('SELECT * FROM xero_v1.bootstrap_reauthorize_connection($1,$2,$3,$4,$5,$6,$7,$8,$9)',[connection,store,'synthetic',owner,8,new Uint8Array([1]),new Uint8Array([2]),'test-key','AES-256-GCM']);
 assert.equal((await db.query('SELECT * FROM xero_v1.bootstrap_get_reauthorization_target($1,$2,$3)',[store,'synthetic',owner])).rows.length,0);
 await assert.rejects(db.query('SELECT * FROM xero_v1.bootstrap_reauthorize_connection($1,$2,$3,$4,$5,$6,$7,$8,$9)',[connection,store,'synthetic',owner,8,new Uint8Array([1]),new Uint8Array([2]),'test-key','AES-256-GCM']),/unavailable/);
}finally{await db.close();}});
for(const [name,patch] of [
 ['latest connected',"UPDATE xero_v1.connection_preflight_evidence SET outcome='connected'"],
 ['stale version',"UPDATE xero_v1.connection_preflight_evidence SET credential_version=7"],
 ['expired receipt',"UPDATE xero_v1.connection_preflight_evidence SET checked_at=now()-interval '25 hours'"],
 ['active lease',"UPDATE xero_v1.credential_envelopes SET lease_expires_at=now()+interval '5 minutes'"],
 ['unconsumed predecessor',"UPDATE xero_v1.xero_fifth_reauthorization_authorizations SET consumed_at=NULL,replacement_version=NULL"],
 ['future mapping',"UPDATE xero_v1.mapping_versions SET effective_from=current_date+1"],
 ['mapping needs review',`INSERT INTO xero_v1.mapping_audit(connection_id,mapping_version_id,action,actor_id,occurred_at) VALUES('${connection}','40000000-0000-4000-8000-000000000001','review_required','${owner}',now()+interval '1 second')`],
])test(`sixth recovery refuses ${name} and atomically preserves history`,async()=>{const db=await recurrence();try{await db.exec(patch);const before=await history(db);await assert.rejects(db.exec(sql(recovery)),/current reconnect failure unavailable/);await db.exec('ROLLBACK');assert.deepEqual(await history(db),before);assert.equal((await db.query("SELECT to_regclass('xero_v1.xero_sixth_reauthorization_authorizations') value")).rows[0].value,null);}finally{await db.close();}});

test('duration verifier requires distinct current connected observations spanning 31 minutes after reconnect',async()=>{const db=await recurrence();try{
 await db.exec(sql(recovery));const read=async()=>{const results=await db.exec(sql('db-migrations/proposals/verify-xero-sixth-reconnect-duration-2026-10-11.sql'));return results[1].rows[0];};assert.equal((await read()).state,'duration_acceptance_pending');
 await db.exec(`UPDATE xero_v1.xero_sixth_reauthorization_authorizations SET consumed_at=now()-interval '33 minutes',replacement_version=9;UPDATE xero_v1.credential_envelopes SET version=11;UPDATE xero_v1.connection_preflight_evidence SET checked_at=now()-interval '40 minutes';INSERT INTO xero_v1.connection_preflight_evidence VALUES('60000000-0000-4000-8000-000000000001','${connection}',10,'connected','organisation','ok',true,now()-interval '32 minutes');`);
 assert.equal((await read()).state,'duration_acceptance_pending');
 await db.exec(`INSERT INTO xero_v1.connection_preflight_evidence VALUES('60000000-0000-4000-8000-000000000002','${connection}',11,'connected','organisation','ok',true,now());`);
 const accepted=await read();assert.equal(accepted.state,'connection_observed_beyond_31_minutes');assert.equal(accepted.successful_observations,2);assert.equal(accepted.observations_span_31_minutes,true);assert.equal(accepted.no_failures_during_observation,true);
 await db.exec("UPDATE xero_v1.connection_preflight_evidence SET checked_at=now()-interval '1 minute' WHERE id='60000000-0000-4000-8000-000000000001'");assert.equal((await read()).state,'duration_acceptance_pending');
 await db.exec("UPDATE xero_v1.connection_preflight_evidence SET checked_at=now()-interval '32 minutes' WHERE id='60000000-0000-4000-8000-000000000001'");
 await db.exec(`INSERT INTO xero_v1.connection_preflight_evidence VALUES('60000000-0000-4000-8000-000000000003','${connection}',10,'failed','connection','reconnect_required',false,now()-interval '15 minutes');`);const interrupted=await read();assert.equal(interrupted.state,'duration_acceptance_pending');assert.equal(interrupted.no_failures_during_observation,false);
 await db.exec("DELETE FROM xero_v1.connection_preflight_evidence WHERE id='60000000-0000-4000-8000-000000000003'");
 await db.exec('UPDATE xero_v1.credential_envelopes SET version=12');assert.equal((await read()).state,'duration_acceptance_pending');
 await db.exec('UPDATE xero_v1.credential_envelopes SET version=11');await db.exec("UPDATE xero_v1.connection_preflight_evidence SET outcome='failed' WHERE id='60000000-0000-4000-8000-000000000002'");assert.equal((await read()).state,'duration_acceptance_pending');
}finally{await db.close();}});
