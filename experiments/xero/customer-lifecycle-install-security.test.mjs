import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const installer=readFileSync(new URL('../../db-migrations/proposals/xero-durable-reconnect-2026-10-15.sql',import.meta.url),'utf8');
const owner='10000000-0000-4000-8000-000000000001',store='56d92f8a-746e-4b4f-b408-81fc98c4aa17',connection='30000000-0000-4000-8000-000000000001';
const reset=`ALTER ROLE night_scout_xero_bootstrap_login LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 1;REVOKE drift_parent FROM night_scout_xero_bootstrap_login;REVOKE night_scout_xero_bootstrap_login FROM drift_borrower;`;
// Minimal baseline for independent installation/identity tests. The owner's
// full-schema suite separately verifies transaction/credential compatibility.
async function base(){const db=new PGlite();await db.exec(`
CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN;CREATE ROLE night_scout_import_login NOLOGIN;
CREATE ROLE night_scout_xero_bootstrap_login LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 1;
CREATE ROLE drift_parent NOLOGIN;CREATE ROLE drift_borrower NOLOGIN;
CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);INSERT INTO auth.users VALUES('${owner}');
CREATE TABLE public.stores(id uuid PRIMARY KEY);INSERT INTO public.stores VALUES('${store}');
CREATE TABLE public.store_memberships(user_id uuid,store_id uuid,PRIMARY KEY(user_id,store_id));INSERT INTO public.store_memberships VALUES('${owner}','${store}');
CREATE SCHEMA xero_v1;CREATE TABLE xero_v1.connections(id uuid PRIMARY KEY,store_id uuid,tenant_id text,retired_at timestamptz);INSERT INTO xero_v1.connections VALUES('${connection}','${store}','synthetic-tenant',NULL);
CREATE TABLE xero_v1.credential_envelopes(connection_id uuid PRIMARY KEY,version int,lease_expires_at timestamptz);INSERT INTO xero_v1.credential_envelopes VALUES('${connection}',7,NULL);
CREATE TABLE xero_v1.mapping_versions(id uuid PRIMARY KEY,connection_id uuid,version int,confirmed_by uuid);INSERT INTO xero_v1.mapping_versions VALUES('${owner}','${connection}',1,'${owner}');`);return db;}
const driftCases=[
 'ALTER ROLE night_scout_xero_bootstrap_login SUPERUSER',
 'ALTER ROLE night_scout_xero_bootstrap_login INHERIT',
 'ALTER ROLE night_scout_xero_bootstrap_login BYPASSRLS',
 'ALTER ROLE night_scout_xero_bootstrap_login CREATEDB',
 'ALTER ROLE night_scout_xero_bootstrap_login CREATEROLE',
 'ALTER ROLE night_scout_xero_bootstrap_login REPLICATION',
 'ALTER ROLE night_scout_xero_bootstrap_login NOLOGIN',
 'ALTER ROLE night_scout_xero_bootstrap_login CONNECTION LIMIT 2',
 'GRANT drift_parent TO night_scout_xero_bootstrap_login',
 'GRANT night_scout_xero_bootstrap_login TO drift_borrower',
];
test('installer refuses privilege, connection-limit and membership drift atomically without repairing roles',async()=>{
 const db=await base();try{for(const change of driftCases){await db.exec(change);await assert.rejects(db.exec(installer),/reviewed bootstrap role required|bootstrap membership drift/);await db.exec('ROLLBACK');assert.equal((await db.query("SELECT to_regclass('xero_v1.customer_reconnect_attempts') IS NULL AS absent")).rows[0].absent,true);await db.exec(reset);}}finally{await db.close();}
});
test('installed command rechecks role drift on every call and borrowed SET ROLE is never authority',async()=>{
 const db=await base();try{
  await db.exec(installer);
  const begin=()=>db.query('SELECT * FROM xero_v1.customer_reconnect_begin($1,$2,$3,$4,$5)',[store,owner,'a'.repeat(64),'b'.repeat(64),'read-only-v1']);
  for(const change of driftCases){await db.exec(change);await db.exec('SET SESSION AUTHORIZATION night_scout_xero_bootstrap_login');await assert.rejects(begin(),/reconnect unavailable/);await db.exec('SET SESSION AUTHORIZATION postgres');assert.equal((await db.query('SELECT count(*)::int n FROM xero_v1.customer_reconnect_attempts')).rows[0].n,0);await db.exec(reset);}
  await db.exec('GRANT night_scout_xero_bootstrap_login TO drift_borrower;SET SESSION AUTHORIZATION drift_borrower;SET ROLE night_scout_xero_bootstrap_login');await assert.rejects(begin(),/reconnect unavailable/);
 }finally{await db.close();}
});
test('installed table stays private with RLS, internal helper private and only four new bootstrap RPC grants',async()=>{
 const db=await base();try{await db.exec(installer);
  assert.equal((await db.query("SELECT relrowsecurity FROM pg_class WHERE oid='xero_v1.customer_reconnect_attempts'::regclass")).rows[0].relrowsecurity,true);
  for(const role of ['anon','authenticated','service_role','night_scout_import_login','night_scout_xero_bootstrap_login']){
   assert.equal((await db.query("SELECT has_table_privilege($1,'xero_v1.customer_reconnect_attempts','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS direct",[role])).rows[0].direct,false);
   assert.equal((await db.query("SELECT has_function_privilege($1,'xero_v1._customer_reconnect_guard(uuid,uuid)','EXECUTE') AS helper",[role])).rows[0].helper,false);
  }
  const entries=(await db.query("SELECT p.proname,has_function_privilege('night_scout_xero_bootstrap_login',p.oid,'EXECUTE') AS bootstrap,has_function_privilege('authenticated',p.oid,'EXECUTE') AS browser,p.prosecdef,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='xero_v1' AND p.proname LIKE 'customer_reconnect_%' ORDER BY p.proname")).rows;
  assert.equal(entries.length,4);for(const row of entries){assert.equal(row.bootstrap,true);assert.equal(row.browser,false);assert.equal(row.prosecdef,true);assert.deepEqual(row.proconfig,['search_path=pg_catalog, xero_v1, public']);}
 }finally{await db.close();}
});
