/** Native PG17 managed CREATEROLE installer acceptance. Fresh Unix-only disposable database. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {prepareHostedDailyProposal} from './daily-hosted-proposal.mjs';
import {dailyTestPostgres,mkdtempTest} from './daily-test-runtime.mjs';
import {validateDailyCapabilityPreflight,capabilityDigest} from './daily-capability-preflight.mjs';
const core=['daily_capability_owner','daily_capability_invoker','daily_capability_reviewer'];
// Models an already privileged managed database installer; proposal grants none of these attributes.
const managementRole={name:'managed_fixture_installer',login:true,superuser:false,bypassRls:true,replication:true,createRole:true,createDb:true,inherit:true};
const source=await readFile(new URL('./daily-capability.sql',import.meta.url),'utf8');
test('non-superuser managed installer transfers ownership atomically then retains only bootstrap administration',{timeout:120000},async t=>{
 const {bin,share}=dailyTestPostgres(),dir=await mkdtempTest('managed-install-');
 const {Client}=createRequire(new URL('../../artifacts/api-server/package.json',import.meta.url))('pg');
 let admin,installer,runtime,started=false;
 try{
  execFileSync(bin+'initdb',['-D',dir+'/data','-L',share,'-U','managed_fixture_bootstrap','--auth=trust','--no-locale','--encoding=UTF8'],{stdio:'pipe'});
  execFileSync(bin+'pg_ctl',['-D',dir+'/data','-l',dir+'/server.log','-o',`-h '' -k ${dir}`,'-w','start'],{stdio:'pipe'});started=true;
  const connect=async user=>{const client=new Client({host:dir,user,database:'postgres',password:async()=>'',ssl:false});await client.connect();return client;};
  admin=await connect('managed_fixture_bootstrap');
  await admin.query('CREATE ROLE managed_fixture_installer LOGIN CREATEROLE CREATEDB INHERIT NOSUPERUSER BYPASSRLS REPLICATION;GRANT CREATE ON DATABASE postgres TO managed_fixture_installer;GRANT CREATE,USAGE ON SCHEMA public TO managed_fixture_installer');
  installer=await connect(managementRole.name);
  await installer.query('CREATE TABLE public.stores(id uuid PRIMARY KEY,currency_code text,timezone text)');
  await installer.query("INSERT INTO public.stores VALUES('d7500000-0000-4000-8000-000000000009','GBP','Europe/London')");
  await installer.query(await readFile(new URL('./history-schema.sql',import.meta.url),'utf8'));
  await installer.query("INSERT INTO finance_history_v2.contracts VALUES('d7500000-0000-4000-8000-000000000009','uk-gifts-v2','synthetic-history-v2-2026-11','2024-11-01','2026-11-04','GBP','Europe/London')");
  await installer.query("SET createrole_self_grant='inherit'");
  const baseline=async()=>({
   tables:(await admin.query("SELECT c.relname,c.relacl,c.relrowsecurity,(SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.oid),'[]'::jsonb) FROM pg_policy p WHERE p.polrelid=c.oid) policies FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='finance_history_v2' AND c.relkind='r' ORDER BY c.relname")).rows,
   contract:(await admin.query('SELECT to_jsonb(t) body FROM finance_history_v2.contracts t')).rows,
   configuration:(await installer.query("SELECT current_setting('createrole_self_grant') value")).rows[0].value,
  });
  const before=await baseline();
  const proposal=prepareHostedDailyProposal({capabilitySql:source,expectedThrough:'2026-11-04',expectedSeals:0,managementRole});
  await t.test('wrong installer pin and failure after ownership transfer roll back all new authority and settings',async()=>{
   const wrong=prepareHostedDailyProposal({capabilitySql:source,expectedThrough:'2026-11-04',expectedSeals:0,managementRole:{...managementRole,name:'unreviewed_other_installer'}});
   await assert.rejects(installer.query(wrong.sql),/Exact reviewed managed installer/);await installer.query('ROLLBACK');
   const fault=proposal.sql.replace('COMMIT;','SELECT 1/0;\nCOMMIT;');
   await assert.rejects(installer.query(fault),/division by zero/);await installer.query('ROLLBACK');
   assert.equal((await admin.query("SELECT to_regnamespace('finance_daily_v1') IS NULL absent")).rows[0].absent,true);
   assert.equal((await admin.query('SELECT count(*)::int n FROM pg_roles WHERE rolname=ANY($1::text[])',[core])).rows[0].n,0);
   assert.deepEqual(await baseline(),before);
  });
  await installer.query(proposal.sql);
  await t.test('ownership and function ACLs match restricted authority without selectable or inherited installer membership',async()=>{
   const memberships=(await admin.query("SELECT p.rolname role,m.rolname member,g.oid grantor_oid,g.rolsuper grantor_super,a.admin_option,a.inherit_option,a.set_option FROM pg_auth_members a JOIN pg_roles p ON p.oid=a.roleid JOIN pg_roles m ON m.oid=a.member JOIN pg_roles g ON g.oid=a.grantor WHERE p.rolname=ANY($1::text[]) ORDER BY p.rolname",[core])).rows;
   assert.equal(memberships.length,3);assert.ok(memberships.every(m=>m.member===managementRole.name&&m.grantor_oid===10&&m.grantor_super&&m.admin_option&&!m.inherit_option&&!m.set_option));
   for(const role of core){assert.equal((await installer.query('SELECT pg_has_role(current_user,$1,\'SET\') selectable,pg_has_role(current_user,$1,\'USAGE\') inherited',[role])).rows[0].selectable,false);await assert.rejects(installer.query('SET ROLE '+role),/permission denied/);}
   assert.equal((await installer.query("SELECT current_setting('createrole_self_grant') value")).rows[0].value,'inherit');
   assert.equal((await admin.query("SELECT has_schema_privilege('daily_capability_owner','finance_daily_v1','CREATE') value")).rows[0].value,false);
   assert.equal((await admin.query("SELECT has_database_privilege('daily_capability_reviewer',current_database(),'CREATE') value")).rows[0].value,false);
   const owners=(await admin.query("SELECT p.proname,r.rolname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname='finance_daily_v1' ORDER BY p.proname")).rows;
   assert.ok(owners.filter(p=>['append_completed_day','inspect_daily_receipt','validate_reviewed_day'].includes(p.proname)).every(p=>p.rolname==='daily_capability_owner'));
   assert.ok(owners.filter(p=>p.proname.startsWith('guard_')).every(p=>p.rolname==='daily_capability_reviewer'));
   assert.equal((await admin.query("SELECT r.rolname owner FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner WHERE n.nspname='finance_daily_v1'")).rows[0].owner,'daily_capability_reviewer');
  });
  await t.test('normal runtime login retains only explicit invoker SET and cannot gain management authority',async()=>{
   await installer.query("BEGIN;SET LOCAL createrole_self_grant='';CREATE ROLE managed_fixture_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;GRANT daily_capability_invoker TO managed_fixture_runtime WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;COMMIT");
   runtime=await connect('managed_fixture_runtime');
   await runtime.query('SET ROLE daily_capability_invoker');
   for(const role of ['daily_capability_owner','daily_capability_reviewer',managementRole.name])await assert.rejects(runtime.query('SET ROLE '+role),/permission denied/);
   await assert.rejects(runtime.query('CREATE ROLE runtime_cannot_create_roles'),/permission denied/);
   await assert.rejects(runtime.query('SELECT * FROM finance_daily_v1.programme'),/permission denied/);
   await assert.rejects(runtime.query('UPDATE finance_history_v2.contracts SET through_day=through_day'),/permission denied/);
   await assert.rejects(runtime.query('GRANT daily_capability_owner TO managed_fixture_runtime'),/permission denied/);
   assert.equal((await admin.query("SELECT has_function_privilege('daily_capability_invoker','finance_daily_v1.append_completed_day(date,date)','EXECUTE') value")).rows[0].value,true);
   assert.equal((await admin.query("SELECT has_function_privilege('daily_capability_invoker','finance_daily_v1.validate_reviewed_day(date,jsonb)','EXECUTE') value")).rows[0].value,false);
  });
  await t.test('managed installation and runtime preflight agree; extra administrator or selectable management grants fail closed',async()=>{
   await runtime.query('SET search_path=pg_catalog');
   const sql=await readFile(new URL('./daily-capability-preflight.sql',import.meta.url),'utf8');
   const inspect=async()=>(await runtime.query(sql,['daily_capability_invoker','daily_capability_owner',managementRole.name])).rows[0].preflight;
   const observed=await inspect(),protection=t=>capabilityDigest(JSON.stringify({policies:t.policies,triggers:t.triggers,rls:t.rls,forceRls:t.forceRls,columns:t.columns,constraints:t.constraints}));
   const expected={callerRole:'daily_capability_invoker',ownerRole:'daily_capability_owner',schemaOwner:'daily_capability_reviewer',managementRole,
    memberships:[{role:'daily_capability_invoker',member:'managed_fixture_runtime',adminOption:false,inheritOption:false,setOption:true}],
    managementMemberships:[...core,'managed_fixture_runtime'].map(role=>({role,member:managementRole.name,grantor:'managed_fixture_bootstrap',adminOption:true,inheritOption:false,setOption:false})),
    functionHashes:Object.fromEntries(observed.functions.map(f=>[f.name,capabilityDigest(f.definition)])),
    tableProtectionHashes:Object.fromEntries(observed.tables.filter(t=>t.schema==='finance_history_v2').map(t=>[t.name,protection(t)])),
    planProtectionHashes:Object.fromEntries(observed.tables.filter(t=>t.schema==='finance_daily_v1').map(t=>[t.name,protection(t)])),
    canonicalValidationAccepted:true,restrictedCallerTestsAccepted:true,protectedFingerprintsAccepted:true};
   assert.deepEqual(validateDailyCapabilityPreflight(observed,expected).findings,[]);
   await installer.query('GRANT daily_capability_owner TO managed_fixture_installer WITH ADMIN FALSE, INHERIT FALSE, SET TRUE');
   assert.equal(validateDailyCapabilityPreflight(await inspect(),expected).state,'blocked');
   await installer.query('REVOKE daily_capability_owner FROM managed_fixture_installer GRANTED BY managed_fixture_installer');
   assert.deepEqual(validateDailyCapabilityPreflight(await inspect(),expected).findings,[]);
   await admin.query('CREATE ROLE unexpected_fixture_admin LOGIN CREATEROLE;GRANT daily_capability_owner TO unexpected_fixture_admin WITH ADMIN TRUE,INHERIT FALSE,SET FALSE');
   assert.equal(validateDailyCapabilityPreflight(await inspect(),expected).state,'blocked');
   await admin.query('REVOKE daily_capability_owner FROM unexpected_fixture_admin');
   assert.deepEqual(validateDailyCapabilityPreflight(await inspect(),expected).findings,[]);
  });
 }finally{if(runtime)await runtime.end();if(installer)await installer.end();if(admin)await admin.end();if(started)execFileSync(bin+'pg_ctl',['-D',dir+'/data','-m','fast','-w','stop'],{stdio:'pipe'});}
});
