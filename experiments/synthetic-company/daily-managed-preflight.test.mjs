/** Managed-administrator boundaries plus native PostgreSQL portable policy-pin proof. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {DAILY_FUNCTION_CONTRACT,DAILY_PROTECTED_TABLES,capabilityDigest,validateDailyCapabilityPreflight} from './daily-capability-preflight.mjs';
function candidate({managed=true,pinGrantor=true}={}){
 const expected={callerRole:'fixture_invoker',ownerRole:'fixture_owner',schemaOwner:'fixture_reviewer',memberships:[{role:'fixture_invoker',member:'fixture_runtime_login',adminOption:false,inheritOption:false,setOption:true}],functionHashes:{},tableProtectionHashes:{},planProtectionHashes:{},canonicalValidationAccepted:true,restrictedCallerTestsAccepted:true,protectedFingerprintsAccepted:true};
 const role=name=>({name,login:name==='fixture_runtime_login',superuser:false,bypassRls:false,replication:false,createRole:false,createDb:false,inherit:false});
 const observed={schemaPresent:true,schemaOwner:expected.schemaOwner,roles:[expected.callerRole,expected.ownerRole,expected.schemaOwner,'fixture_runtime_login'].map(role),auditedPrincipals:[expected.callerRole,expected.ownerRole,'fixture_runtime_login'],memberships:structuredClone(expected.memberships),managementRole:null,managementMemberships:[],boundLoginPrivileges:[],unsafeSchemaCreate:[],unsafeSequencePrivileges:[],unsafeSecurityDefinerExecute:[],schemaPrivileges:[],unsafeOtherFunctions:[],functions:[],tables:[]};
 for(const spec of DAILY_FUNCTION_CONTRACT){const definition='fixed managed-boundary fixture '+spec.name;expected.functionHashes[spec.name]=capabilityDigest(definition);observed.functions.push({...spec,definition,owner:expected.ownerRole,securityDefiner:true,settings:spec.caller&&spec.name==='append_completed_day'?['search_path=pg_catalog','lock_timeout=5s']:['search_path=pg_catalog'],executeGrantees:[expected.ownerRole,...(spec.caller?[expected.callerRole]:[])]});}
 const protection=t=>capabilityDigest(JSON.stringify({policies:t.policies,triggers:t.triggers,rls:t.rls,forceRls:t.forceRls,columns:t.columns,constraints:t.constraints}));
 for(const name of DAILY_PROTECTED_TABLES){const table={schema:'finance_history_v2',name,kind:'r',owner:'fixture_source_owner',rls:true,forceRls:false,callerSelect:false,callerDml:false,callerColumnUpdate:false,ownerSelect:true,ownerDeleteTruncate:false,ownerInsert:!['contracts','invalidations'].includes(name),ownerUpdateColumns:name==='contracts'?['through_day']:[],policies:[],triggers:[],columns:[],constraints:[]};observed.tables.push(table);expected.tableProtectionHashes[name]=protection(table);}
 for(const name of ['programme','reviewed_days','publication_receipts']){const table={schema:'finance_daily_v1',name,kind:'r',owner:expected.schemaOwner,rls:true,forceRls:false,callerSelect:false,callerDml:false,callerColumnUpdate:false,ownerSelect:true,ownerDeleteTruncate:false,ownerInsert:name==='publication_receipts',ownerUpdateColumns:[],policies:[],triggers:[],columns:[],constraints:[]};observed.tables.push(table);expected.planProtectionHashes[name]=protection(table);}
 if(managed){
  // These are explicitly reviewed privileges of a separate pre-existing administrator, never runtime allowances.
  const management={name:'fixture_managed_admin',login:true,superuser:false,bypassRls:true,replication:true,createRole:true,createDb:true,inherit:true};
  expected.managementRole={...management};observed.managementRole={...management};
  observed.managementMemberships=[expected.callerRole,expected.ownerRole,expected.schemaOwner,'fixture_runtime_login'].map(name=>({role:name,member:management.name,grantor:'fixture_bootstrap_admin',adminOption:true,inheritOption:false,setOption:false}));
  expected.managementMemberships=observed.managementMemberships.map(row=>pinGrantor?{...row}:Object.fromEntries(Object.entries(row).filter(([key])=>key!=='grantor')));
 }
 return {expected,observed};
}
const accepted=({expected,observed})=>validateDailyCapabilityPreflight(observed,expected).state==='catalog-ready-for-separate-approval';
test('explicit separate management descriptor and exact bootstrap administration edges preserve restricted runtime acceptance',()=>{
 assert.equal(accepted(candidate()),true);assert.equal(accepted(candidate({pinGrantor:false})),false);assert.equal(accepted(candidate({managed:false})),true);
 const c=candidate();assert.equal(validateDailyCapabilityPreflight(c.observed,c.expected).activationAllowed,false);
});
test('unconfigured, missing, changed or runtime-aliased management identity fails closed',()=>{
 for(const change of [c=>delete c.expected.managementRole,c=>delete c.observed.managementRole,c=>c.observed.managementRole.replication=false,c=>c.expected.managementRole.name=c.expected.callerRole,c=>c.expected.managementRole.name='fixture_runtime_login',c=>c.expected.managementRole.createRole=false,c=>c.expected.managementRole.superuser=true,c=>c.observed.managementRole.extra=true,c=>c.observed.roles.push({...c.observed.managementRole}),c=>c.observed.auditedPrincipals.push(c.expected.managementRole.name)]){const c=candidate();change(c);assert.equal(accepted(c),false);}
 const legacy=candidate({managed:false});delete legacy.observed.managementMemberships;assert.equal(accepted(legacy),false);
});
test('every management edge is explicitly enumerated and cannot confer SET, INHERIT or runtime administration',()=>{
 for(const change of [c=>c.observed.managementMemberships.pop(),c=>c.observed.managementMemberships.push({...c.observed.managementMemberships[0],role:'unreviewed_role'}),c=>c.observed.managementMemberships[0].setOption=true,c=>c.observed.managementMemberships[0].inheritOption=true,c=>c.observed.managementMemberships[0].adminOption=false,c=>c.observed.managementMemberships[0].grantor='unreviewed_grantor',c=>[c.observed.managementMemberships[0].role,c.observed.managementMemberships[0].member]=[c.observed.managementMemberships[0].member,c.observed.managementMemberships[0].role],c=>c.expected.managementMemberships[0].setOption=true,c=>c.observed.managementMemberships=[null]]){const c=candidate();change(c);assert.equal(accepted(c),false);}
});
test('management awareness never suppresses unknown privileged runtime members or direct runtime grants',()=>{
 for(const change of [c=>c.observed.memberships.push({role:c.expected.ownerRole,member:'unknown_admin',adminOption:true,inheritOption:false,setOption:false}),c=>c.observed.memberships[0].adminOption=true,c=>c.observed.roles.find(r=>r.name==='fixture_runtime_login').createRole=true,c=>c.observed.roles.find(r=>r.name==='fixture_runtime_login').replication=true,c=>c.observed.boundLoginPrivileges.push({principal:'fixture_runtime_login'}),c=>c.observed.unsafeSchemaCreate.push({principal:c.expected.ownerRole}),c=>c.observed.unsafeSecurityDefinerExecute.push({principal:'fixture_runtime_login'})]){const c=candidate();change(c);assert.equal(accepted(c),false);}
});

test('native PostgreSQL protection pins normalize policy roles across distinct OID allocations',{timeout:120000},async()=>{
 const {readFile}=await import('node:fs/promises'),{execFileSync}=await import('node:child_process'),{createRequire}=await import('node:module');
 const {dailyTestPostgres,mkdtempTest}=await import('./daily-test-runtime.mjs'),{bin,share}=dailyTestPostgres();
 const {Client}=createRequire(new URL('../../artifacts/api-server/package.json',import.meta.url))('pg');
 const clusters=[],clients=[];
 try{
  const catalogues=[],rawRoleOids=[];
  for(const extraRoles of [0,7]){
   const dir=await mkdtempTest('policy-pin-');execFileSync(bin+'initdb',['-D',dir+'/data','-L',share,'-U','policy_pin_fixture','--auth=trust','--no-locale','--encoding=UTF8'],{stdio:'pipe'});execFileSync(bin+'pg_ctl',['-D',dir+'/data','-l',dir+'/postgres.log','-o',`-h '' -k ${dir}`,'-w','start'],{stdio:'pipe'});clusters.push(dir);
   const db=new Client({host:dir,user:'policy_pin_fixture',database:'postgres'});await db.connect();clients.push(db);
   for(let i=0;i<extraRoles;i++)await db.query(`CREATE ROLE policy_pin_padding_${i} NOLOGIN`);
   await db.query('CREATE TABLE public.stores(id uuid PRIMARY KEY,currency_code text,timezone text)');
   await db.query(await readFile(new URL('./history-schema.sql',import.meta.url),'utf8'));
   await db.query('CREATE POLICY fixture_public_deny ON finance_history_v2.contracts TO PUBLIC USING(false) WITH CHECK(false)');
   await db.query(await readFile(new URL('./daily-capability.sql',import.meta.url),'utf8'));
   await db.query('SET search_path=pg_catalog');
   const observed=(await db.query(await readFile(new URL('./daily-capability-preflight.sql',import.meta.url),'utf8'),['daily_capability_invoker','daily_capability_owner',null])).rows[0].preflight;
   catalogues.push(observed);
   rawRoleOids.push((await db.query("SELECT p.polroles::text AS roles FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='finance_history_v2' AND c.relname='contracts' AND p.polname='daily_owner_scope'")).rows[0].roles);
  }
  assert.notEqual(rawRoleOids[0],rawRoleOids[1]);
  const protection=t=>capabilityDigest(JSON.stringify({policies:t.policies,triggers:t.triggers,rls:t.rls,forceRls:t.forceRls,columns:t.columns,constraints:t.constraints}));
  for(const table of catalogues[0].tables.filter(t=>['finance_history_v2','finance_daily_v1'].includes(t.schema))){const other=catalogues[1].tables.find(t=>t.schema===table.schema&&t.name===table.name);assert.ok(other);assert.equal(protection(table),protection(other),table.schema+'.'+table.name);for(const policy of table.policies)assert.ok(policy.roles.every(role=>typeof role==='string'));}
  assert.deepEqual(catalogues[0].tables.find(t=>t.schema==='finance_history_v2'&&t.name==='contracts').policies.find(p=>p.name==='daily_owner_scope').roles,['daily_capability_owner']);
  assert.ok(catalogues[0].tables.find(t=>t.schema==='finance_history_v2'&&t.name==='contracts').policies.some(p=>p.roles.includes('PUBLIC')));
 }finally{await Promise.allSettled(clients.map(c=>c.end()));for(const dir of clusters)execFileSync(bin+'pg_ctl',['-D',dir+'/data','-m','fast','-w','stop'],{stdio:'pipe'});}
});
