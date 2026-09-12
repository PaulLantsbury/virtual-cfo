import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {catalog,restoreObservedPublic} from './restore.mjs';
const read=name=>readFileSync(new URL('../../db-migrations/proposed/'+name,import.meta.url),'utf8');
const correction=read('20260908000001_recoverable_contribution_monthly_only.sql');
const access=read('20260908000002_store_membership_read_access.sql');
const a='30000000-0000-0000-0000-000000000001',b='30000000-0000-0000-0000-000000000002';
const alice='40000000-0000-0000-0000-000000000001',bob='40000000-0000-0000-0000-000000000002';
let db;
beforeEach(async()=>{
 db=new PGlite();await restoreObservedPublic(db);
 // TEST ONLY: simulates a gateway-validated subject, not JWT verification.
 await db.exec(`CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
 GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;`);
 await db.query('INSERT INTO auth.users VALUES ($1),($2)',[alice,bob]);
 await db.query(`INSERT INTO public.stores(id,shopify_domain,shopify_store_id) VALUES ($1,'a.invalid','a'),($2,'b.invalid','b')`,[a,b]);
 await db.query(`INSERT INTO public.opportunities(store_id,title,category,impact_type,impact_low,impact_high) VALUES ($1,'A only','Test','monthly_contribution',100,200),($2,'B confidential','Test','monthly_contribution',900,1000),($1,'A cash','Test','cash_release',8000,9000)`,[a,b]);
});
afterEach(async()=>{await db.close();});
async function asUser(role,subject,fn){
 assert.ok(['anon','authenticated'].includes(role));
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[subject||'']);
 await db.exec(`SET ROLE ${role}`);
 try{return await fn();}finally{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub','',false)");}
}
async function install(){
 await db.exec(correction);await db.exec(access);
 await db.query('INSERT INTO public.store_memberships VALUES ($1,$2),($3,$4)',[alice,a,bob,b]);
}
const range=async store=>(await db.query('SELECT * FROM public.recoverable_contribution_range($1)',[store])).rows;

test('observed security-definer RPC exposes another store despite table RLS',async()=>{
 await asUser('anon',null,async()=>{
  assert.equal((await db.query('SELECT * FROM public.opportunities')).rows.length,0);
  assert.deepEqual(await range(b),[{recoverable_low:'900.00',recoverable_high:'1000.00'}]);
 });
});

test('membership proposal isolates rows, views and all 24 callable RPCs; anonymous execution is denied',async()=>{
 await install();
 for(const f of catalog.functions){
  const args=f.arguments.split(', ').map(arg=>{
   const [name,type]=arg.split(' ');
   return name==='p_store_id'?`'${b}'::uuid`:type==='date'?`'2026-04-01'::date`:type==='integer'?'3':"'actual'::text";
  }).join(',');
  await asUser('anon',null,()=>assert.rejects(db.query(`SELECT * FROM public.${f.name}(${args})`),e=>e.code==='42501'));
  await asUser('authenticated',alice,async()=>{
   const denied=(await db.query(`SELECT * FROM public.${f.name}(${args})`)).rows;
   const absent=(await db.query(`SELECT * FROM public.${f.name}(${args.replace(b,'30000000-0000-0000-0000-000000000099')})`)).rows;
   assert.deepEqual(denied,absent,f.name+' cannot distinguish another store from absent data');
  });
 }
 await asUser('authenticated',alice,async()=>{
  assert.deepEqual((await db.query('SELECT id FROM public.stores')).rows,[{id:a}]);
  assert.equal((await db.query('SELECT * FROM public.opportunities')).rows.length,2);
  assert.equal((await db.query('SELECT * FROM public.opportunities WHERE store_id=$1',[b])).rows.length,0);
  assert.deepEqual(await range(a),[{recoverable_low:'100.00',recoverable_high:'200.00'}]);
  assert.deepEqual(await range(b),[{recoverable_low:'0',recoverable_high:'0'}]);
  for(const v of catalog.views){const rows=(await db.query(`SELECT * FROM public.${v.name}`)).rows;assert.ok(rows.every(r=>r.store_id===a),v.name);}
 });
 await asUser('authenticated',bob,async()=>assert.deepEqual(await range(b),[{recoverable_low:'900.00',recoverable_high:'1000.00'}]));
 const f=(await db.query("SELECT count(*)::int n FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosecdef")).rows[0];assert.equal(f.n,0);
});

test('no subject, self-enrolment, membership/data writes and revoked membership cannot grant access',async()=>{
 await install();
 await asUser('authenticated',null,async()=>assert.equal((await db.query('SELECT * FROM public.stores')).rows.length,0));
 await asUser('authenticated',alice,async()=>{
  assert.deepEqual((await db.query('SELECT * FROM public.store_memberships')).rows,[{user_id:alice,store_id:a}]);
  for(const sql of [
   `INSERT INTO public.store_memberships VALUES ('${alice}','${b}')`,
   `UPDATE public.store_memberships SET store_id='${b}'`,
   'DELETE FROM public.store_memberships',
   `UPDATE public.opportunities SET impact_low=999`,
   'DELETE FROM public.opportunities',
   `INSERT INTO public.opportunities(store_id,title,category) VALUES ('${a}','forged','Test')`
  ])await assert.rejects(db.exec(sql),e=>e.code==='42501');
 });
 await db.query('DELETE FROM public.store_memberships WHERE user_id=$1',[alice]);
 await asUser('authenticated',alice,async()=>{
  assert.equal((await db.query('SELECT * FROM public.opportunities')).rows.length,0);
  assert.deepEqual(await range(a),[{recoverable_low:'0',recoverable_high:'0'}]);
 });
});

test('earlier financial correction cannot restore security-definer access after hardening',async()=>{
 await install();
 await assert.rejects(db.exec(correction),/Security mode changed/);
 await db.exec('ROLLBACK');
 const f=(await db.query("SELECT prosecdef FROM pg_proc WHERE oid='public.recoverable_contribution_range(uuid)'::regprocedure")).rows[0];assert.equal(f.prosecdef,false);
});
