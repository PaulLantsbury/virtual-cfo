import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {readDemoReaderConfig} from './demo-config.mjs';
import {validDemoReaderIdentity} from './demo-database-identity.mjs';
import {validateXeroAccountMapping} from '../../experiments/xero/account-mapping-contract.mjs';
import {xeroCronWindow} from '../nightly-staging/xero-cron-window.mjs';
const fail=()=>Error('Demo reader readiness unavailable');
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const rolesSql="SELECT rolname,rolsuper,rolinherit,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolcanlogin,rolconnlimit,session_user::text AS session_login FROM pg_catalog.pg_roles WHERE rolname IN ('night_scout_demo_import_login','night_scout_demo_import_service')";
const membersSql="SELECT r.rolname AS role_name,u.rolname AS member_name,m.admin_option,m.inherit_option,m.set_option FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r ON r.oid=m.roleid JOIN pg_catalog.pg_roles u ON u.oid=m.member WHERE u.rolname IN ('night_scout_demo_import_login','night_scout_demo_import_service')";
// Select metadata only; never retrieve encrypted credentials or financial amounts into this receipt.
const jobSql='SELECT connection_id,mapping_version_id FROM xero_demo_v1.worker_get_single_connection_preflight_job()';
const contextSql='SELECT store_id,connection_id,mapping_version_id,tenant_id,mapping,key_version,algorithm,version,lease_expires_at FROM xero_demo_v1.worker_get_refresh_context($1,$2)';
const evidenceSql='SELECT report_as_of,retrieved_at FROM xero_demo_v1.worker_get_latest_supported_evidence($1,$2,$3,$4,$5,$6)';
export async function demoReadiness({env=process.env,now=new Date(),scope,createPool}={}){
 let pool,client;
 try{
  const config=readDemoReaderConfig(env,()=>now);
  if(!scope||!date(scope.from)||!date(scope.to)||scope.from>scope.to||scope.to>config.scope.to||(Date.parse(scope.to)-Date.parse(scope.from))/86400000>=31)throw fail();
  const factory=createPool??(options=>{const require=createRequire(new URL('./demo-reader.manifest.json',import.meta.url));return new (require('pg').Pool)(options);});
  pool=factory({connectionString:env.NIGHT_SCOUT_DEMO_XERO_DATABASE_URL,ssl:{ca:env.NIGHT_SCOUT_DEMO_XERO_CA_PEM,rejectUnauthorized:true},max:1,connectionTimeoutMillis:5000,statement_timeout:30000,idle_in_transaction_session_timeout:15000});pool.on('error',()=>{});
  client=await pool.connect();await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const roles=(await client.query(rolesSql)).rows,members=(await client.query(membersSql)).rows;if(!validDemoReaderIdentity(roles,members))throw fail();
  await client.query('SET LOCAL ROLE night_scout_demo_import_service');
  const jobs=(await client.query(jobSql)).rows;if(jobs.length!==1||!uuid(jobs[0].connection_id)||!uuid(jobs[0].mapping_version_id))throw fail();
  const j=jobs[0],contexts=(await client.query(contextSql,[j.connection_id,j.mapping_version_id])).rows;if(contexts.length!==1)throw fail();const c=contexts[0];
  const lease=c.lease_expires_at===null?null:new Date(c.lease_expires_at).valueOf();
  if(c.store_id!==config.storeId||c.connection_id!==j.connection_id||c.mapping_version_id!==j.mapping_version_id||c.tenant_id!==config.expectedTenantId||c.key_version!==config.envelopeKeyVersion||c.algorithm!=='AES-256-GCM'||!Number.isInteger(c.version)||c.version<1||!validateXeroAccountMapping(c.mapping)||lease!==null&&(!Number.isFinite(lease)||lease>now.valueOf()))throw fail();
  const evidence=(await client.query(evidenceSql,[j.connection_id,j.mapping_version_id,scope.from,scope.to,'GBP',false])).rows;
  if(evidence.length>1||evidence.length===1&&(!date(evidence[0].report_as_of)||evidence[0].report_as_of!==scope.to||evidence[0].retrieved_at===null||!Number.isFinite(new Date(evidence[0].retrieved_at).valueOf())||new Date(evidence[0].retrieved_at).valueOf()>now.valueOf()))throw fail();
  await client.query('ROLLBACK');
  return {event:'demo_xero_readiness',state:'checked',configValid:true,restrictedIdentity:true,contextValid:true,leaseIdle:true,evidence:{scopeFrom:scope.from,scopeTo:scope.to,supported:evidence.length===1,reportAsOf:evidence[0]?.report_as_of??null,retrievedAt:evidence.length?new Date(evidence[0].retrieved_at).toISOString():null},clockGuard:xeroCronWindow(now).state,hostSchedule:'not_checked',automaticRun:'not_checked'};
 }catch{if(client)await client.query('ROLLBACK').catch(()=>{});throw fail();}finally{client?.release();if(pool)await pool.end().catch(()=>{});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length!==4)throw fail();const result=await demoReadiness({now:new Date(),scope:{from:process.argv[2],to:process.argv[3]}});process.stdout.write(JSON.stringify(result)+'\n');}catch{process.stderr.write('Demo reader readiness unavailable\n');process.exitCode=1;}}
