import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {attestProviderAccess,providerAccessAttestationSql} from './provider-access-attestation.mjs';
async function install(db){
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE TABLE public.stores(id uuid PRIMARY KEY);
 CREATE TABLE public.store_memberships(user_id uuid,store_id uuid,PRIMARY KEY(user_id,store_id));`);
 for(const p of ['meta','google']){
  for(const c of ['api','report','collector'])await db.exec(`CREATE ROLE night_scout_${p}_ads_${c}_group NOLOGIN;CREATE ROLE night_scout_${p}_ads_${c}_login LOGIN INHERIT;GRANT night_scout_${p}_ads_${c}_group TO night_scout_${p}_ads_${c}_login;`);
  for(const suffix of ['store','rpcs','read-rpc'])await db.exec(await readFile(new URL(`../../db-migrations/proposals/${p}-ads-spend-${suffix}-${p==='meta'?'2026-11-20':'2026-11-21'}.sql`,import.meta.url),'utf8'));
 }
}
async function read(db,mode){return attestProviderAccess((sql,params)=>db.query(sql,params),mode);}
test('catalog attestor distinguishes absent, partial, installed and disabled states',async()=>{
 const db=await PGlite.create();try{
  assert.equal((await read(db,'absent')).accepted,true);
  assert.equal((await read(db,'installed')).accepted,false);
  await db.exec('CREATE SCHEMA meta_ads_v1');assert.equal((await read(db,'absent')).accepted,false);await db.exec('DROP SCHEMA meta_ads_v1');
  await install(db);const installed=await read(db,'installed');assert.equal(installed.accepted,true,JSON.stringify(installed));
  assert.equal((await read(db,'absent')).accepted,false);assert.equal((await read(db,'disabled')).accepted,false);
  for(const p of ['meta','google'])for(const c of ['api','report','collector'])await db.exec(`ALTER ROLE night_scout_${p}_ads_${c}_login NOLOGIN`);
  assert.equal((await read(db,'disabled')).accepted,true);assert.equal((await read(db,'installed')).accepted,false);
  await db.exec('ALTER ROLE night_scout_meta_ads_report_login LOGIN');assert.equal((await read(db,'disabled')).accepted,false);
 }finally{await db.close();}
});
test('effective grants and role drift fail closed after exact installation',async()=>{
 const db=await PGlite.create();try{
  await install(db);
  const cases=[
   ['direct credential SELECT','GRANT SELECT ON meta_ads_v1.credential_envelopes TO night_scout_meta_ads_report_login','tables_safe'],
   ['inherited credential SELECT','GRANT SELECT ON meta_ads_v1.credential_envelopes TO night_scout_meta_ads_report_group','tables_safe'],
   ['PUBLIC credential SELECT','GRANT SELECT ON google_ads_v1.credential_envelopes TO PUBLIC','tables_safe'],
   ['unrelated application table','CREATE TABLE public.unrelated_sensitive(id integer); GRANT SELECT ON public.unrelated_sensitive TO night_scout_google_ads_report_login','tables_safe'],
   ['unrelated sequence','CREATE SEQUENCE public.unrelated_sequence;GRANT USAGE ON SEQUENCE public.unrelated_sequence TO night_scout_meta_ads_api_group','sequences_safe'],
   ['extra role membership','CREATE ROLE unexpected_role;GRANT unexpected_role TO night_scout_meta_ads_report_login','memberships_safe'],
   ['admin membership','GRANT night_scout_meta_ads_report_group TO night_scout_meta_ads_report_login WITH ADMIN OPTION','memberships_safe'],
   ['incoming login membership','CREATE ROLE unexpected_member;GRANT night_scout_meta_ads_report_login TO unexpected_member','memberships_safe'],
   ['elevated role','ALTER ROLE night_scout_meta_ads_report_login BYPASSRLS','role_flags_safe'],
   ['ownership','CREATE TABLE public.owned_fixture(id integer);ALTER TABLE public.owned_fixture OWNER TO night_scout_google_ads_api_login','ownership_safe'],
   ['schema CREATE','GRANT CREATE ON SCHEMA public TO night_scout_google_ads_collector_group','schemas_safe'],
   ['missing intended RPC','REVOKE EXECUTE ON FUNCTION meta_ads_v1.worker_read_daily_spend(uuid,uuid,date,date,timestamptz) FROM night_scout_meta_ads_report_group','rpc_matrix_safe'],
   ['cross-capability RPC','GRANT EXECUTE ON FUNCTION google_ads_v1.worker_read_daily_spend(uuid,uuid,date,date,timestamptz) TO night_scout_google_ads_api_group','rpc_matrix_safe'],
   ['PUBLIC RPC','GRANT EXECUTE ON FUNCTION meta_ads_v1.worker_read_daily_spend(uuid,uuid,date,date,timestamptz) TO PUBLIC','rpc_matrix_safe'],
   ['future PUBLIC credential table','ALTER DEFAULT PRIVILEGES IN SCHEMA meta_ads_v1 GRANT SELECT ON TABLES TO PUBLIC','default_acls_safe'],
   ['future unrelated direct table','ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO night_scout_google_ads_report_group','default_acls_safe'],
   ['global future RPC grant','ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO authenticated','default_acls_safe'],
   ['future credential sequence','ALTER DEFAULT PRIVILEGES IN SCHEMA google_ads_v1 GRANT USAGE ON SEQUENCES TO authenticated','default_acls_safe'],
   ['old report return signature',`DROP FUNCTION meta_ads_v1.worker_read_daily_spend(uuid,uuid,date,date,timestamptz);
    CREATE FUNCTION meta_ads_v1.worker_read_daily_spend(uuid,uuid,date,date,timestamptz) RETURNS TABLE(provider_account_id text)
    LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,meta_ads_v1 AS 'SELECT NULL::text';
    REVOKE ALL ON FUNCTION meta_ads_v1.worker_read_daily_spend(uuid,uuid,date,date,timestamptz) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION meta_ads_v1.worker_read_daily_spend(uuid,uuid,date,date,timestamptz) TO night_scout_meta_ads_report_group`,'report_contracts_safe'],
   ['external PUBLIC definer',"CREATE FUNCTION public.unrelated_privileged_rpc() RETURNS integer LANGUAGE sql SECURITY DEFINER AS 'SELECT 1'",'external_definers_safe'],
   ['unsafe function search path',"ALTER FUNCTION meta_ads_v1.worker_read_daily_spend(uuid,uuid,date,date,timestamptz) SET search_path=public",'function_config_safe'],
  ];
  for(const [name,change,check] of cases){
   await db.exec('BEGIN');try{await db.exec(change);const result=await read(db,'installed');assert.equal(result.accepted,false,name);assert.equal(result[check],false,name);}finally{await db.exec('ROLLBACK');}
  }
  assert.equal((await read(db,'installed')).accepted,true);
 }finally{await db.close();}
});
test('attestor is read-only, validates mode and masks executor failures',async()=>{
 assert.match(providerAccessAttestationSql,/^-- Read-only/);
 assert.doesNotMatch(providerAccessAttestationSql,/\b(?:INSERT|UPDATE|DELETE|ALTER|GRANT|REVOKE|CREATE|DROP|TRUNCATE)\s+(?:TABLE|ROLE|SCHEMA|ON|INTO|FROM|FUNCTION)\b/i);
 let called=false;await assert.rejects(attestProviderAccess(()=>{called=true;},'unexpected'),/unavailable/);assert.equal(called,false);
 await assert.rejects(attestProviderAccess(async()=>{throw Error('secret fictional');},'installed'),{message:'Provider access attestation unavailable'});
 await assert.rejects(attestProviderAccess(async()=>({rows:[{secret:'fictional'}]}),'installed'),/unavailable/);
});
