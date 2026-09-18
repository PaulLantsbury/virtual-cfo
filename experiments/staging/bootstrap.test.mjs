import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=readFileSync(new URL('../../db-migrations/staging/20260909_bootstrap.sql',import.meta.url),'utf8');
async function instance(){
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;`);
 return db;
}
test('exact staging bundle builds an empty restricted schema and permits only member-store reads',async()=>{
 const db=await instance();
 try{
  await db.exec(sql);
  const result=(await db.query(`SELECT
  (SELECT count(*)::int FROM pg_tables WHERE schemaname='public') tables,
  (SELECT count(*)::int FROM pg_views WHERE schemaname='public') views,
  (SELECT count(*)::int FROM pg_proc WHERE pronamespace='public'::regnamespace) functions,
  (SELECT count(*)::int FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosecdef) definers,
  (SELECT count(*)::int FROM pg_policies WHERE schemaname='public') policies`)).rows[0];
  assert.deepEqual(result,{tables:23,views:5,functions:24,definers:0,policies:23});
  for(const {tablename} of (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows)assert.equal((await db.query(`SELECT count(*)::int n FROM public."${tablename}"`)).rows[0].n,0);
  const a='70000000-0000-0000-0000-000000000001',b='70000000-0000-0000-0000-000000000002',u='80000000-0000-0000-0000-000000000001';
  await db.query(`INSERT INTO public.stores(id,shopify_domain,shopify_store_id) VALUES ($1,'a.invalid','a'),($2,'b.invalid','b')`,[a,b]);
  await db.query('INSERT INTO auth.users VALUES ($1)',[u]);await db.query('INSERT INTO public.store_memberships VALUES ($1,$2)',[u,a]);
  await db.query(`INSERT INTO public.opportunities(store_id,category,title,impact_type,impact_low,impact_high) VALUES ($1,'Test','A','monthly_contribution',100,200),($2,'Test','B','monthly_contribution',900,1000),($1,'Test','Cash','cash_release',5000,6000)`,[a,b]);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[u]);await db.exec('SET ROLE authenticated');
  assert.deepEqual((await db.query('SELECT id FROM public.stores')).rows,[{id:a}]);
  assert.deepEqual((await db.query('SELECT * FROM public.recoverable_contribution_range($1)',[a])).rows,[{recoverable_low:'100.00',recoverable_high:'200.00'}]);
  assert.deepEqual((await db.query('SELECT * FROM public.recoverable_contribution_range($1)',[b])).rows,[{recoverable_low:'0',recoverable_high:'0'}]);
  await assert.rejects(db.query('INSERT INTO public.store_memberships VALUES ($1,$2)',[u,b]),e=>e.code==='42501');
  await assert.rejects(db.exec('CREATE TABLE public.client_injected(id int)'),e=>e.code==='42501');
  await db.exec('RESET ROLE; SET ROLE anon');await assert.rejects(db.query('SELECT * FROM public.recoverable_contribution_range($1)',[a]),e=>e.code==='42501');
  await db.exec('RESET ROLE');
  await assert.rejects(db.exec(sql),/empty public schema/);await db.exec('ROLLBACK');
  assert.equal((await db.query('SELECT count(*)::int n FROM public.stores')).rows[0].n,2);
 }finally{await db.close();}
});
test('failure late in the bundle rolls back all earlier application DDL',async()=>{
 const db=await instance();
 try{
  await assert.rejects(db.exec(sql.replace(/COMMIT;\s*$/,'SELECT missing_staging_verification_function();\nCOMMIT;')));
  await db.exec('ROLLBACK');
  assert.equal((await db.query("SELECT count(*)::int n FROM pg_tables WHERE schemaname='public'")).rows[0].n,0);
  assert.equal((await db.query("SELECT count(*)::int n FROM pg_proc WHERE pronamespace='public'::regnamespace")).rows[0].n,0);
 }finally{await db.close();}
});
