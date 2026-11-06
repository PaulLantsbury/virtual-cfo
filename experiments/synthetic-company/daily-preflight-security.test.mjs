/** Fresh local PostgreSQL catalog → validator goldens, including actual bound LOGIN/RESET ROLE. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolveBenchmarkPostgres} from './history-performance.mjs';
import {validateDailyCapabilityPreflight,capabilityDigest,DAILY_PROTECTED_TABLES} from './daily-capability-preflight.mjs';
const {Client}=createRequire(new URL('../../artifacts/api-server/package.json',import.meta.url))('pg');
test('actual catalog audits bound LOGIN, effective privileges and every application relation class',async t=>{
 const tools=resolveBenchmarkPostgres(),root=await mkdtemp(join(tmpdir(),'daily-acl-golden-')),clients=[];let started=false;
 const command=(file,args)=>execFileSync(file,args,{stdio:'pipe'});
 try{
  command(tools.initdb,['-D',join(root,'data'),'-L',tools.sharedir,'-U','acl_fixture_admin','--auth=trust','--no-locale','--encoding=UTF8']);
  command(tools.pgCtl,['-D',join(root,'data'),'-l',join(root,'server.log'),'-o',`-h '' -k ${root}`,'-w','start']);started=true;
  const connect=async user=>{const c=new Client({host:root,user,database:'postgres'});await c.connect();clients.push(c);return c;};
  const admin=await connect('acl_fixture_admin');
  await admin.query('CREATE TABLE public.stores(id uuid PRIMARY KEY,currency_code text,timezone text)');
  await admin.query(await readFile(new URL('./history-schema.sql',import.meta.url),'utf8'));
  await admin.query(await readFile(new URL('./daily-capability.sql',import.meta.url),'utf8'));
  await admin.query("CREATE ROLE fixture_bound_login LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;GRANT daily_capability_invoker TO fixture_bound_login WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;CREATE TABLE public.acl_probe(value integer);INSERT INTO public.acl_probe VALUES(1);CREATE TABLE public.acl_partition(value integer) PARTITION BY RANGE(value);CREATE VIEW public.acl_view AS SELECT * FROM public.acl_probe;CREATE MATERIALIZED VIEW public.acl_materialized AS SELECT * FROM public.acl_probe;CREATE FOREIGN DATA WRAPPER fixture_fdw;CREATE SERVER fixture_server FOREIGN DATA WRAPPER fixture_fdw;CREATE FOREIGN TABLE public.acl_foreign(value integer) SERVER fixture_server;CREATE SEQUENCE public.acl_sequence;CREATE SCHEMA acl_scope;CREATE FUNCTION public.acl_definer() RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS 'SELECT 1';REVOKE ALL ON FUNCTION public.acl_definer() FROM PUBLIC");
  const login=await connect('fixture_bound_login');await login.query('SET search_path=pg_catalog');const sql=await readFile(new URL('./daily-capability-preflight.sql',import.meta.url),'utf8');
  const inspect=async()=>(await login.query(sql,['daily_capability_invoker','daily_capability_owner'])).rows[0].preflight;
  const initial=await inspect();
  const protection=t=>capabilityDigest(JSON.stringify({policies:t.policies,triggers:t.triggers,rls:t.rls,forceRls:t.forceRls,columns:t.columns,constraints:t.constraints}));
  const expected={callerRole:'daily_capability_invoker',ownerRole:'daily_capability_owner',schemaOwner:'daily_capability_reviewer',memberships:[{role:'daily_capability_invoker',member:'fixture_bound_login',adminOption:false,inheritOption:false,setOption:true}],functionHashes:Object.fromEntries(initial.functions.map(f=>[f.name,capabilityDigest(f.definition)])),tableProtectionHashes:Object.fromEntries(initial.tables.filter(t=>DAILY_PROTECTED_TABLES.includes(t.name)&&t.schema==='finance_history_v2').map(t=>[t.name,protection(t)])),planProtectionHashes:Object.fromEntries(initial.tables.filter(t=>t.schema==='finance_daily_v1').map(t=>[t.name,protection(t)])),canonicalValidationAccepted:true,restrictedCallerTestsAccepted:true,protectedFingerprintsAccepted:true};
  const check=async()=>validateDailyCapabilityPreflight(await inspect(),expected);
  await t.test('reviewed candidate is catalog-ready and every relation class is visible',async()=>{
   assert.deepEqual((await check()).findings,[]);
   for(const [name,kind]of [['acl_probe','r'],['acl_partition','p'],['acl_view','v'],['acl_materialized','m'],['acl_foreign','f']])assert.equal(initial.tables.find(t=>t.name===name)?.kind,kind);
   assert.deepEqual(initial.auditedPrincipals,['daily_capability_invoker','daily_capability_owner','fixture_bound_login']);
  });
  const mutation=async(name,grant,revoke,code,exercise)=>t.test(name,async()=>{await admin.query(grant);try{if(exercise)await exercise();const result=await check();assert.equal(result.state,'blocked');assert.ok(result.findings.includes(code),JSON.stringify(result));}finally{await login.query('RESET ROLE');await admin.query(revoke);}assert.deepEqual((await check()).findings,[]);});
  await mutation('bound LOGIN REPLICATION rejected','ALTER ROLE fixture_bound_login REPLICATION','ALTER ROLE fixture_bound_login NOREPLICATION','bound-login-must-have-only-restricted-invoker-membership');
  await mutation('direct LOGIN UPDATE survives RESET ROLE but preflight rejects it','GRANT UPDATE ON public.acl_probe TO fixture_bound_login','REVOKE UPDATE ON public.acl_probe FROM fixture_bound_login','bound-login-direct-authority-forbidden',async()=>{
   await login.query('SET ROLE daily_capability_invoker');await assert.rejects(login.query('UPDATE public.acl_probe SET value=2'),/permission denied/);await login.query('RESET ROLE');assert.equal((await login.query('UPDATE public.acl_probe SET value=2')).rowCount,1);
  });
  await mutation('column-only LOGIN UPDATE rejected','GRANT UPDATE(value) ON public.acl_probe TO fixture_bound_login','REVOKE UPDATE(value) ON public.acl_probe FROM fixture_bound_login','bound-login-direct-authority-forbidden');
  for(const principal of ['fixture_bound_login','daily_capability_invoker','daily_capability_owner'])await mutation('schema CREATE rejected for '+principal,`GRANT CREATE ON SCHEMA acl_scope TO ${principal}`,`REVOKE CREATE ON SCHEMA acl_scope FROM ${principal}`,'schema-create-authority-forbidden');
  for(const principal of ['fixture_bound_login','daily_capability_invoker','daily_capability_owner'])await mutation('database CREATE schema authority rejected for '+principal,`GRANT CREATE ON DATABASE postgres TO ${principal}`,`REVOKE CREATE ON DATABASE postgres FROM ${principal}`,'schema-create-authority-forbidden');
  for(const principal of ['fixture_bound_login','daily_capability_invoker','daily_capability_owner'])await mutation('unexpected SECURITY DEFINER EXECUTE rejected for '+principal,`GRANT EXECUTE ON FUNCTION public.acl_definer() TO ${principal}`,`REVOKE EXECUTE ON FUNCTION public.acl_definer() FROM ${principal}`,'unexpected-security-definer-execute-forbidden');
  await mutation('column-only LOGIN INSERT rejected','GRANT INSERT(value) ON public.acl_probe TO fixture_bound_login','REVOKE INSERT(value) ON public.acl_probe FROM fixture_bound_login','bound-login-direct-authority-forbidden');
  await mutation('protected-table direct LOGIN UPDATE rejected','GRANT UPDATE ON finance_history_v2.contracts TO fixture_bound_login','REVOKE UPDATE ON finance_history_v2.contracts FROM fixture_bound_login','bound-login-direct-authority-forbidden');
  for(const principal of ['daily_capability_invoker','daily_capability_owner'])await mutation('unrelated column SELECT rejected for '+principal,`GRANT SELECT(value) ON public.acl_probe TO ${principal}`,`REVOKE SELECT(value) ON public.acl_probe FROM ${principal}`,'unrelated-or-original-authority-forbidden:public.acl_probe');
  await mutation('owner column INSERT rejected','GRANT INSERT(value) ON public.acl_probe TO daily_capability_owner','REVOKE INSERT(value) ON public.acl_probe FROM daily_capability_owner','unrelated-or-original-authority-forbidden:public.acl_probe');
  await mutation('owner TRIGGER authority rejected','GRANT TRIGGER ON public.acl_probe TO daily_capability_owner','REVOKE TRIGGER ON public.acl_probe FROM daily_capability_owner','relation-control-authority-forbidden:public.acl_probe');
  for(const name of ['acl_partition','acl_view','acl_materialized','acl_foreign'])await mutation('LOGIN SELECT on '+name+' rejected',`GRANT SELECT ON public.${name} TO fixture_bound_login`,`REVOKE SELECT ON public.${name} FROM fixture_bound_login`,'bound-login-direct-authority-forbidden');
  for(const privilege of ['USAGE','SELECT','UPDATE'])await mutation('sequence '+privilege+' rejected',`GRANT ${privilege} ON SEQUENCE public.acl_sequence TO fixture_bound_login`,`REVOKE ${privilege} ON SEQUENCE public.acl_sequence FROM fixture_bound_login`,'sequence-authority-forbidden');
  for(const principal of ['daily_capability_invoker','daily_capability_owner'])await mutation('sequence authority rejected for '+principal,`GRANT USAGE ON SEQUENCE public.acl_sequence TO ${principal}`,`REVOKE USAGE ON SEQUENCE public.acl_sequence FROM ${principal}`,'sequence-authority-forbidden');
 }finally{await Promise.allSettled(clients.map(c=>c.end()));if(started)command(tools.pgCtl,['-D',join(root,'data'),'-m','fast','-w','stop']);await rm(root,{recursive:true,force:true});}
});
