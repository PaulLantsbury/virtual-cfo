import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const proposal=readFileSync(new URL('../../db-migrations/proposals/xero-member-active-tenant-binding-2026-10-30.sql',import.meta.url),'utf8');
const owner='90000000-0000-4000-8000-000000000001',store='90000000-0000-4000-8000-000000000002',tenant='90000000-0000-4000-8000-000000000003',other='90000000-0000-4000-8000-000000000004',connection='90000000-0000-4000-8000-000000000005';
async function fixture({apply=true}={}){
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE night_scout_test_writer;CREATE ROLE night_scout_test_writer_service;
 CREATE SCHEMA auth;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth TO authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
 CREATE TABLE public.store_memberships(user_id uuid,store_id uuid);ALTER TABLE public.store_memberships ENABLE ROW LEVEL SECURITY;
 CREATE SCHEMA xero_v1;CREATE TABLE xero_v1.connections(id uuid,store_id uuid,tenant_id text,created_at timestamptz,retired_at timestamptz);ALTER TABLE xero_v1.connections ENABLE ROW LEVEL SECURITY;
 CREATE TABLE xero_v1.credential_envelopes(secret text);INSERT INTO xero_v1.credential_envelopes VALUES('SENSITIVE_READER_CREDENTIAL');
 REVOKE ALL ON SCHEMA xero_v1 FROM PUBLIC;REVOKE ALL ON ALL TABLES IN SCHEMA xero_v1 FROM PUBLIC,anon,authenticated;`);
 await db.query('INSERT INTO public.store_memberships VALUES($1,$2)',[owner,store]);
 await db.query("INSERT INTO xero_v1.connections VALUES($1,$2,$3,'2026-10-01T00:00:00Z',NULL),($4,$5,$6,'2026-10-01T00:00:00Z',NULL)",[connection,store,tenant,other,other,other]);
 if(apply)await db.exec(proposal);
 const read=async({user=owner,scope=store,role='authenticated',readOnly=false}={})=>{
  await db.exec(readOnly?'BEGIN READ ONLY':'BEGIN');
  try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user??'']);await db.exec(`SET LOCAL ROLE ${role}`);return (await db.query('SELECT * FROM public.xero_member_active_tenant_binding_v1($1)',[scope])).rows;}
  finally{await db.exec('ROLLBACK');}
 };
 return {db,read,close:()=>db.close()};
}

test('public member RPC returns only exact active binding with private schema/table access still denied',async()=>{
 const f=await fixture();try{
  assert.deepEqual(await f.read(),[{store_id:store,tenant_id:tenant}]);
  assert.deepEqual(await f.read({readOnly:true}),[{store_id:store,tenant_id:tenant}]);
  assert.doesNotMatch(JSON.stringify(await f.read()),/SENSITIVE_|credential|token|ciphertext|health|connected/);
  await f.db.exec('SET ROLE authenticated');
  await assert.rejects(f.db.query('SELECT * FROM xero_v1.connections'),/permission/);
  await assert.rejects(f.db.query('SELECT * FROM xero_v1.credential_envelopes'),/permission/);
  await f.db.exec('RESET ROLE');
  const fn=(await f.db.query("SELECT provolatile,prosecdef,proconfig FROM pg_proc WHERE oid='public.xero_member_active_tenant_binding_v1(uuid)'::regprocedure")).rows[0];
  assert.equal(fn.provolatile,'s');assert.equal(fn.prosecdef,true);assert.deepEqual(fn.proconfig,['search_path=pg_catalog']);
 }finally{await f.close();}
});

test('anonymous, absent auth, nonmember, cross-store and null scope are denied without metadata',async()=>{
 const f=await fixture();try{
  for(const args of [{role:'anon'},{user:null},{user:other},{scope:other},{scope:null}])await assert.rejects(f.read(args));
  for(const role of ['anon','service_role','night_scout_test_writer','night_scout_test_writer_service'])assert.equal((await f.db.query("SELECT has_function_privilege($1,'public.xero_member_active_tenant_binding_v1(uuid)','EXECUTE') allowed",[role])).rows[0].allowed,false);
 }finally{await f.close();}
});

test('ambiguous/retired/malformed/future bindings fail closed; no current health is inferred',async()=>{
 const f=await fixture();try{
  for(const change of ["INSERT INTO xero_v1.connections SELECT '90000000-0000-4000-8000-000000000006',store_id,tenant_id,created_at,NULL FROM xero_v1.connections WHERE id=$1",'UPDATE xero_v1.connections SET retired_at=now() WHERE id=$1',"UPDATE xero_v1.connections SET tenant_id='private unexpected text' WHERE id=$1","UPDATE xero_v1.connections SET created_at=now()+interval '1 day' WHERE id=$1",'UPDATE xero_v1.connections SET created_at=NULL WHERE id=$1','UPDATE xero_v1.connections SET tenant_id=NULL WHERE id=$1']){
   await f.db.exec('BEGIN');await f.db.query(change,[connection]);
   // Use direct role command inside this disposable transaction, then roll changes back.
   await f.db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[owner]);await f.db.exec('SET LOCAL ROLE authenticated');
   await assert.rejects(f.db.query('SELECT * FROM public.xero_member_active_tenant_binding_v1($1)',[store]),/binding unavailable/);await f.db.exec('ROLLBACK');
  }
  assert.deepEqual(await f.read(),[{store_id:store,tenant_id:tenant}]);
 }finally{await f.close();}
});

test('membership revocation immediately removes access; proposal is one-shot and transactional',async()=>{
 const f=await fixture();try{
  await f.db.query('DELETE FROM public.store_memberships WHERE user_id=$1',[owner]);await assert.rejects(f.read());
  await assert.rejects(f.db.exec(proposal),/already exists/);await f.db.exec('ROLLBACK');
  assert.equal((await f.db.query("SELECT count(*)::int n FROM xero_v1.credential_envelopes")).rows[0].n,1);
 }finally{await f.close();}
 const g=await fixture({apply:false});try{
  await g.db.exec('ALTER TABLE xero_v1.connections DISABLE ROW LEVEL SECURITY');await assert.rejects(g.db.exec(proposal),/security boundary/);await g.db.exec('ROLLBACK');
  assert.equal((await g.db.query("SELECT to_regprocedure('public.xero_member_active_tenant_binding_v1(uuid)') name")).rows[0].name,null);
 }finally{await g.close();}
});
