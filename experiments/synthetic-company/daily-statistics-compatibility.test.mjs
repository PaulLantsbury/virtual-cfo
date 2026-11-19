/** Fresh native PostgreSQL fixtures only. Never reads hosted statistics or modifies global hosted grants. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {dailyTestPostgres,mkdtempTest} from './daily-test-runtime.mjs';
import {validateDailyCapabilityPreflight,capabilityDigest} from './daily-capability-preflight.mjs';
import {statisticsObjectDigest,prepareStatisticsCatalogQuery,validateStatisticsCompatibility,validateDailyPreflightWithStatistics} from './daily-statistics-compatibility.mjs';
import {PG17_STATISTICS_PROFILE,PG17_STATISTICS_SUPABASE_PROFILE} from './daily-statistics-profile.mjs';
import {RESERVED_SYNTHETIC_IDENTITY as identity} from './staging-payload.mjs';
import {operateDaily,operatorClientConfig,OPERATOR_PURPOSE} from './daily-operator.mjs';
const {bin,share}=dailyTestPostgres(),{Client}=createRequire(new URL('../../artifacts/api-server/package.json',import.meta.url))('pg');
const scope={storeId:identity.storeId,profile:'uk-gifts-v2',edition:'synthetic-history-v2-2026-11',anchor:'2024-11-01',currency:'GBP',timezone:'Europe/London'};
const ordinarySql=await readFile(new URL('./daily-capability-preflight.sql',import.meta.url),'utf8');
for(const profile of [PG17_STATISTICS_PROFILE,PG17_STATISTICS_SUPABASE_PROFILE])test(profile.id+' native visibility and exact compatibility',{timeout:120000},async t=>{
 const dir=await mkdtempTest('stats-compat-'),clients=[];let started=false;
 try{
  execFileSync(bin+'initdb',['-D',dir+'/data','-L',share,'-U','stats_fixture_bootstrap','--auth=trust','--no-locale','--encoding=UTF8'],{stdio:'pipe'});
  execFileSync(bin+'pg_ctl',['-D',dir+'/data','-l',dir+'/postgres.log','-o',`-h '' -k ${dir} -c shared_preload_libraries=pg_stat_statements -c compute_query_id=on -c pg_stat_statements.track=all`,'-w','start'],{stdio:'pipe'});started=true;
  const connect=async user=>{const c=new Client({host:dir,user,database:'postgres'});await c.connect();clients.push(c);return c;};
  const admin=await connect('stats_fixture_bootstrap');
  await admin.query("CREATE SCHEMA extensions;CREATE EXTENSION pg_stat_statements WITH SCHEMA extensions VERSION '1.11';GRANT USAGE ON SCHEMA extensions TO PUBLIC");
  if(profile===PG17_STATISTICS_SUPABASE_PROFILE)await admin.query('CREATE ROLE dashboard_user NOSUPERUSER CREATEDB CREATEROLE REPLICATION;GRANT ALL ON SCHEMA extensions TO dashboard_user;GRANT ALL ON ALL TABLES IN SCHEMA extensions TO dashboard_user;GRANT ALL ON ALL ROUTINES IN SCHEMA extensions TO dashboard_user');
  await admin.query('CREATE TABLE public.stores(id uuid PRIMARY KEY,currency_code text,timezone text)');await admin.query("INSERT INTO public.stores VALUES($1,'GBP','Europe/London')",[identity.storeId]);
  await admin.query(await readFile(new URL('./history-schema.sql',import.meta.url),'utf8'));await admin.query(await readFile(new URL('./daily-capability.sql',import.meta.url),'utf8'));
  await admin.query('CREATE ROLE stats_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;GRANT daily_capability_invoker TO stats_runtime WITH ADMIN FALSE,INHERIT FALSE,SET TRUE');
  const runtime=await connect('stats_runtime');await runtime.query('SET ROLE daily_capability_invoker');await runtime.query('SET search_path=pg_catalog');await admin.query('SET search_path=pg_catalog');
  const initial=(await runtime.query(ordinarySql,['daily_capability_invoker','daily_capability_owner',null])).rows[0].preflight;
  const protection=o=>capabilityDigest(JSON.stringify({policies:o.policies,triggers:o.triggers,rls:o.rls,forceRls:o.forceRls,columns:o.columns,constraints:o.constraints}));
  // This expectation is derived only from this fresh, source-built fixture; live catalog hashes are never accepted as a golden.
  const expected={callerRole:'daily_capability_invoker',ownerRole:'daily_capability_owner',schemaOwner:'daily_capability_reviewer',managementRole:null,managementMemberships:[],memberships:[{role:'daily_capability_invoker',member:'stats_runtime',adminOption:false,inheritOption:false,setOption:true}],functionHashes:Object.fromEntries(initial.functions.map(f=>[f.name,capabilityDigest(f.definition)])),tableProtectionHashes:Object.fromEntries(initial.tables.filter(o=>o.schema==='finance_history_v2').map(o=>[o.name,protection(o)])),planProtectionHashes:Object.fromEntries(initial.tables.filter(o=>o.schema==='finance_daily_v1').map(o=>[o.name,protection(o)])),canonicalValidationAccepted:true,restrictedCallerTestsAccepted:true,protectedFingerprintsAccepted:true};
  const owner={name:'stats_fixture_bootstrap',login:true,superuser:true,bypassRls:true,replication:true,createRole:true,createDb:true,inherit:true};
  expected.statisticsCompatibility={profile:profile.id,reviewAccepted:true,ownerRoles:[owner]};
  const query=await prepareStatisticsCatalogQuery(ordinarySql,expected),inspect=async(c=runtime)=>(await c.query(query.sql,query.values)).rows[0];
  const captured=await inspect(),principals=['daily_capability_invoker','daily_capability_owner','stats_runtime'];
  await t.test('source-derived exact profile requires explicit review and ordinary guards remain strict',async()=>{
   assert.equal(validateDailyCapabilityPreflight(captured.preflight,expected).state,'blocked');
   assert.equal(validateDailyPreflightWithStatistics(captured.preflight,expected,captured.statistics_preflight).state,'catalog-ready-for-separate-approval');
   assert.equal(validateDailyPreflightWithStatistics(captured.preflight,{...expected,statisticsCompatibility:{...expected.statisticsCompatibility,reviewAccepted:false}},captured.statistics_preflight).state,'blocked');
   const noReview={...expected};delete noReview.statisticsCompatibility;assert.equal(validateDailyPreflightWithStatistics(captured.preflight,noReview,captured.statistics_preflight).state,'blocked');
   assert.deepEqual(await prepareStatisticsCatalogQuery(ordinarySql,noReview),{sql:ordinarySql,values:['daily_capability_invoker','daily_capability_owner',null]});
   for(const change of [s=>s.extension.version='1.10',s=>s.views[0].extensionMember=false,s=>s.functions[0].securityDefiner=true,s=>s.ownerRoles[0].name='unreviewed_owner',s=>s.principals[0].readAllStatsSet=true,s=>s.principals[0].superuserSet=true,s=>s.principals[0].resetExecute=true,s=>s.principals[0].views[0].change=true]){const altered=structuredClone(captured.statistics_preflight);change(altered);assert.equal(validateStatisticsCompatibility(altered,expected.statisticsCompatibility,principals).state,'blocked');}
   for(const malformed of [undefined,{}, {...captured.statistics_preflight,views:[null,{}]}, {...captured.statistics_preflight,principals:[null]}])assert.equal(validateStatisticsCompatibility(malformed,expected.statisticsCompatibility,principals).state,'blocked');
   assert.equal(validateStatisticsCompatibility(captured.statistics_preflight,{...expected.statisticsCompatibility,profile:'toString'},principals).state,'blocked');
   const unknownField=structuredClone(captured.preflight);unknownField.boundLoginPrivileges[0].unknownPrivilege=true;assert.equal(validateDailyPreflightWithStatistics(unknownField,expected,captured.statistics_preflight).state,'blocked');
  });
  await t.test('only inherent owner grant options normalize; non-owner rights remain exact',async()=>{
   const before=await inspect(),objects=s=>[...s.views,...s.functions];
   await admin.query('BEGIN');
   try{
    await admin.query('GRANT ALL ON ALL TABLES IN SCHEMA extensions TO stats_fixture_bootstrap WITH GRANT OPTION;GRANT ALL ON ALL ROUTINES IN SCHEMA extensions TO stats_fixture_bootstrap WITH GRANT OPTION');
    const after=await inspect(admin);
    assert.notDeepEqual(objects(before.statistics_preflight).map(o=>o.acl),objects(after.statistics_preflight).map(o=>o.acl));
    assert.deepEqual(objects(before.statistics_preflight).map(statisticsObjectDigest),objects(after.statistics_preflight).map(statisticsObjectDigest));
    assert.equal(validateStatisticsCompatibility(after.statistics_preflight,expected.statisticsCompatibility,principals).state,'reviewed-public-statistics-metadata-only');
   }finally{await admin.query('ROLLBACK');}
   for(const grantee of ['PUBLIC',...(profile===PG17_STATISTICS_SUPABASE_PROFILE?['dashboard_user']:[])]){
    const altered=structuredClone(before.statistics_preflight);
    const entry=altered.views[0].acl.find(a=>a.grantee===grantee);entry.grantOption=!entry.grantOption;
    assert.notEqual(statisticsObjectDigest(altered.views[0]),statisticsObjectDigest(before.statistics_preflight.views[0]));
    assert.equal(validateStatisticsCompatibility(altered,expected.statisticsCompatibility,principals).state,'blocked');
   }
   const changedPrivilege=structuredClone(before.statistics_preflight);changedPrivilege.views[0].acl=changedPrivilege.views[0].acl.filter(a=>!(a.grantee==='@OWNER'&&a.privilege==='SELECT'));
   assert.equal(validateStatisticsCompatibility(changedPrivilege,expected.statisticsCompatibility,principals).state,'blocked');
  });
  await t.test('real C invoker functions hide other users query text/id despite superuser view ownership',async()=>{
   await admin.query('SELECT 123456 AS synthetic_other_role_marker');
   const otherOid=(await admin.query("SELECT oid FROM pg_roles WHERE rolname='stats_fixture_bootstrap'")).rows[0].oid;
   for(const source of ['extensions.pg_stat_statements','extensions.pg_stat_statements(true)']){const result=(await runtime.query(`SELECT count(*)::int AS rows,bool_and(queryid IS NULL) AS ids_masked,bool_and(query IS NULL OR query='<insufficient privilege>') AS text_masked FROM ${source} WHERE userid=$1`,[otherOid])).rows[0];assert.ok(result.rows>0);assert.equal(result.ids_masked,true);assert.equal(result.text_masked,true);}
   await runtime.query('SELECT 789 AS synthetic_own_role_marker');assert.equal((await runtime.query("SELECT count(*)::int AS rows FROM extensions.pg_stat_statements WHERE userid=(SELECT oid FROM pg_roles WHERE rolname=current_user) AND query LIKE '%synthetic_own_role_marker%' AND queryid IS NOT NULL")).rows[0].rows>0,true);
   await assert.rejects(runtime.query('SELECT extensions.pg_stat_statements_reset()'),/permission denied/);
  });
  await t.test('actual privilege and definition drift blocks without changing hosted or unrelated permissions',async()=>{
   const blocked=async()=>{const c=await inspect();assert.equal(validateDailyPreflightWithStatistics(c.preflight,expected,c.statistics_preflight).state,'blocked');};
   await admin.query('GRANT pg_read_all_stats TO stats_runtime WITH INHERIT FALSE,SET TRUE');await blocked();await admin.query('REVOKE pg_read_all_stats FROM stats_runtime');
   await admin.query('GRANT SELECT ON finance_history_v2.orders TO stats_runtime');await blocked();await admin.query('REVOKE SELECT ON finance_history_v2.orders FROM stats_runtime');
   await admin.query('GRANT UPDATE ON extensions.pg_stat_statements TO daily_capability_invoker');await blocked();await admin.query('REVOKE UPDATE ON extensions.pg_stat_statements FROM daily_capability_invoker');
   await admin.query('GRANT SELECT(query) ON extensions.pg_stat_statements TO daily_capability_invoker WITH GRANT OPTION');await blocked();await admin.query('REVOKE SELECT(query) ON extensions.pg_stat_statements FROM daily_capability_invoker');
   await admin.query('GRANT UPDATE(query) ON extensions.pg_stat_statements TO stats_runtime');await blocked();await admin.query('REVOKE UPDATE(query) ON extensions.pg_stat_statements FROM stats_runtime');
   await admin.query('GRANT SELECT(query) ON extensions.pg_stat_statements TO stats_runtime WITH GRANT OPTION');await blocked();await admin.query('REVOKE SELECT(query) ON extensions.pg_stat_statements FROM stats_runtime');
   await admin.query('GRANT EXECUTE ON FUNCTION extensions.pg_stat_statements_reset(oid,oid,bigint,boolean) TO daily_capability_invoker');await blocked();await admin.query('REVOKE EXECUTE ON FUNCTION extensions.pg_stat_statements_reset(oid,oid,bigint,boolean) FROM daily_capability_invoker');
   for(const sql of ['ALTER FUNCTION extensions.pg_stat_statements(boolean) SECURITY DEFINER','ALTER EXTENSION pg_stat_statements DROP VIEW extensions.pg_stat_statements']){await admin.query('BEGIN');try{await admin.query(sql);const c=await inspect(admin);assert.equal(validateDailyPreflightWithStatistics(c.preflight,expected,c.statistics_preflight).state,'blocked');}finally{await admin.query('ROLLBACK');}}
   const restored=await inspect();assert.equal(validateDailyPreflightWithStatistics(restored.preflight,expected,restored.statistics_preflight).state,'catalog-ready-for-separate-approval');
  });
  await t.test('actual operator uses atomic ordinary/statistics metadata in both preflights; default review remains blocked',async()=>{
   // Empty protocol material proves operator/catalog integration; it is not a financial oracle.
   await admin.query("INSERT INTO finance_history_v2.contracts VALUES($1,'uk-gifts-v2','synthetic-history-v2-2026-11','2024-11-01','2026-11-04','GBP','Europe/London')",[identity.storeId]);
   const base=(await admin.query("SELECT to_jsonb(t)-'through_day' AS body FROM finance_history_v2.contracts t")).rows[0].body;
   await admin.query("INSERT INTO finance_daily_v1.programme VALUES(true,$1,$2,'2026-11-04','2026-11-05','[]','[]',true)",[identity.storeId,base]);
   const day='2026-11-05',hash='0'.repeat(64),runId='10000000-0000-4000-8000-000000000001';
   const manifest={scope:{storeId:identity.storeId,currency:'GBP',from:day,to:day},edition:scope.edition,anchor:scope.anchor,profile:scope.profile,timezone:'Europe/London',formulaVersion:'night-scout-v11-2026-10-30',sourceAsOf:'2026-11-06T00:00:00Z',observedAt:'2026-11-06T02:00:00Z'};
   const receipt={contract:'synthetic-daily-preparation-v1',runId,day,anchor:scope.anchor,edition:scope.edition,profile:scope.profile,sourceHash:hash,sourceAsOf:manifest.sourceAsOf,inserted:0};
   const empty=(await admin.query("SELECT encode(sha256(convert_to('[]','UTF8')),'hex') AS hash")).rows[0].hash,sources=Object.fromEntries(['events','orders','refunds','lines','returns'].map(k=>[k,[]]));
   const material={contract:'reviewed-synthetic-daily-material-v1',storeId:identity.storeId,day,expectedThrough:'2026-11-04',edition:scope.edition,profile:scope.profile,anchor:scope.anchor,sourceHash:hash,sources,validationSets:Object.fromEntries(Object.keys(sources).map(k=>[k,{rowCount:0,sha256:empty}])),coverage:[{coverage_id:'10000000-0000-4000-8000-000000000002',store_id:identity.storeId,date_from:day,date_to:day,kind:'day',source_manifest:manifest,source_hash:hash}],seals:[],run:{run_id:runId,store_id:identity.storeId,date_from:day,date_to:day,source_hash:hash,receipt}};
   await admin.query("INSERT INTO finance_daily_v1.reviewed_days VALUES($1,$2,encode(sha256(convert_to($2::jsonb::text,'UTF8')),'hex'),'local statistics integration fixture')",[day,JSON.stringify(material)]);
   // Explicit disposable-clock substitution only; no deployed clock override exists.
   await admin.query("CREATE OR REPLACE FUNCTION pg_catalog.clock_timestamp() RETURNS timestamptz LANGUAGE sql VOLATILE AS $$SELECT '2026-11-06T02:00:00Z'::timestamptz$$");
   const binding={purpose:OPERATOR_PURPOSE,syntheticOnly:true,scope,approvedDay:day,expectedThrough:'2026-11-04',initialThrough:'2026-11-04',ceiling:day,appendApproved:true,expected,connection:{host:dir,port:5432,database:'postgres',user:'stats_runtime',password:'',ssl:false}};
   let audits=0,appends=0;const createClient=b=>{const c=new Client(operatorClientConfig(b));clients.push(c);const q=c.query.bind(c);c.query=(sql,...args)=>{if(sql.includes('statistics.statistics_preflight'))audits++;if(sql.includes('SELECT finance_daily_v1.append_completed_day'))appends++;return q(sql,...args);};return c;};
   const refused=structuredClone(binding);refused.expected.statisticsCompatibility.reviewAccepted=false;await assert.rejects(operateDaily({enabled:true,mode:'append',binding:refused},{createClient}),/preflight-blocked/);assert.equal(appends,0);
   const before=audits,result=await operateDaily({enabled:true,mode:'append',binding},{createClient});assert.equal(result.state,'committed-reconciled');assert.equal(appends,1);assert.equal(audits-before,2);
  });
 }finally{await Promise.allSettled(clients.map(c=>c.end()));if(started)execFileSync(bin+'pg_ctl',['-D',dir+'/data','-m','fast','-w','stop'],{stdio:'pipe'});}
});
