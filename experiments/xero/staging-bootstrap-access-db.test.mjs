import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const staging=file=>readFileSync(new URL(`../../db-migrations/staging/${file}`,import.meta.url),'utf8');
const store='20000000-0000-4000-8000-000000000001';
const store2='20000000-0000-4000-8000-000000000002';
const owner='10000000-0000-4000-8000-000000000001';
const accounts=[
 {accountId:'revenue-1',accountName:'Revenue',accountType:'REVENUE',accountStatus:'ACTIVE'},
 {accountId:'fees-1',accountName:'Fees',accountType:'EXPENSE',accountStatus:'ACTIVE'},
 {accountId:'ads-1',accountName:'Advertising',accountType:'EXPENSE',accountStatus:'ACTIVE'},
 {accountId:'software-1',accountName:'Software',accountType:'EXPENSE',accountStatus:'ACTIVE'},
 {accountId:'cash-1',accountName:'Bank',accountType:'BANK',accountStatus:'ACTIVE'},
];
const mapping=[
 {category:'revenue',accountId:'revenue-1'},
 {category:'processingFee',accountId:'fees-1'},
 {category:'advertising',accountId:'ads-1'},
 {category:'software',accountId:'software-1'},
 {category:'includedCash',accountId:'cash-1'},
];
const call=`SELECT * FROM xero_v1.bootstrap_create_initial_connection(
 $1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::bytea,$9::bytea,$10,$11)`;
const params=(tenant='tenant-1',selected=mapping,targetStore=store)=>[
 targetStore,tenant,owner,'2026-09-18','2026-09-18T12:00:00Z',JSON.stringify(accounts),JSON.stringify(selected),
 new Uint8Array([1,2,3]),new Uint8Array([4,5,6]),'staging-key-v1','AES-256-GCM',
];

test('bootstrap migration executes atomically with isolated service-role privileges',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`
   CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE night_scout_import_service NOLOGIN;
   CREATE ROLE night_scout_import_login LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 1 PASSWORD NULL;
   GRANT night_scout_import_service TO night_scout_import_login;
   CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   CREATE TABLE public.stores(id uuid PRIMARY KEY);
   CREATE TABLE public.store_memberships(user_id uuid,store_id uuid,PRIMARY KEY(user_id,store_id));
  `);
  await db.exec(staging('20260918_apply_xero_staging.sql'));
  await db.exec(staging('20260918_grant_xero_worker_access.sql'));
  await db.exec(staging('20260918_grant_xero_bootstrap_access.sql'));
  await db.exec(`CREATE FUNCTION public.xero_test_counts() RETURNS TABLE(connections int,accounts int,versions int,selections int,envelopes int)
   LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,xero_v1 AS $$SELECT
   (SELECT count(*)::int FROM xero_v1.connections),(SELECT count(*)::int FROM xero_v1.account_directories),
   (SELECT count(*)::int FROM xero_v1.mapping_versions),(SELECT count(*)::int FROM xero_v1.mapping_selections),
   (SELECT count(*)::int FROM xero_v1.credential_envelopes)$$;`);
  await db.query('INSERT INTO auth.users VALUES ($1)',[owner]);
  await db.query('INSERT INTO public.stores VALUES ($1)',[store]);
  await db.query('INSERT INTO public.stores VALUES ($1)',[store2]);
  await db.query('INSERT INTO public.store_memberships VALUES ($1,$2)',[owner,store]);
  await db.query('INSERT INTO public.store_memberships VALUES ($1,$2)',[owner,store2]);
  const memberships=await db.query(`SELECT member.rolname member_role,granted.rolname granted_role
   FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member JOIN pg_roles granted ON granted.oid=m.roleid
   WHERE member.rolname IN ('night_scout_import_login','night_scout_xero_bootstrap_login') ORDER BY member_role,granted_role`);
  assert.deepEqual(memberships.rows,[{member_role:'night_scout_import_login',granted_role:'night_scout_import_service'}]);

  await db.exec('SET SESSION AUTHORIZATION night_scout_import_login');
  await assert.rejects(db.query(call,params()),/permission denied|bootstrap capability required/i);
  await db.exec('RESET SESSION AUTHORIZATION; SET SESSION AUTHORIZATION night_scout_xero_bootstrap_login');
  await assert.rejects(db.query('SELECT * FROM xero_v1.connections'),/permission denied/i);
  await assert.rejects(db.query(`SELECT xero_v1.worker_record_credential_refresh_failure('00000000-0000-4000-8000-000000000001','refresh_failed')`),/permission denied/i);
  const receipt=await db.query(call,params());
  assert.equal(receipt.rows.length,1);

  await db.exec('RESET SESSION AUTHORIZATION');
  const counts=await db.query('SELECT * FROM public.xero_test_counts()');
  assert.deepEqual(counts.rows[0],{connections:1,accounts:5,versions:1,selections:5,envelopes:1});

  await db.exec('SET SESSION AUTHORIZATION night_scout_xero_bootstrap_login');
  const invalidMapping=[...mapping.slice(0,4),{category:'includedCash',accountId:'missing-active-account'}];
  await assert.rejects(db.query(call,params('tenant-invalid',invalidMapping,store2)),/invalid active Xero mapping selection/i);
  await db.exec('RESET SESSION AUTHORIZATION');
  const after=await db.query('SELECT * FROM public.xero_test_counts()');
  assert.equal(after.rows[0].connections,1,'invalid bootstrap must roll back every connection write');
 } finally { await db.close(); }
});
