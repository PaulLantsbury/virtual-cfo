import {createRequire} from 'node:module';
import {X509Certificate} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {INTAKE_TARGET as target,intakeConnectionOptions} from './intake-runtime.mjs';
import {rollingReportingScope} from './rolling-reporting-scope.mjs';
const failure='Shopify nightly history unavailable; no collection, retry or write was attempted.';
const ensure=ok=>{if(!ok)throw Error(failure);};
const safeCodes=['ENETUNREACH','ENOTFOUND','ECONNREFUSED','ETIMEDOUT','28P01','28000','42501','42P01','42703','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','CERT_HAS_EXPIRED'];
const diagnosticError=(phase,error)=>Object.assign(Error(failure),{diagnostic:Object.freeze({event:'shopify_nightly_readiness',state:'unavailable',phase,code:safeCodes.includes(error?.code)?error.code:'READINESS_UNAVAILABLE',collectionAttempted:false,writeAttempted:false})});
const codes=['recorded_requires_review','changed_requires_review','replay','historical_replay','stale_source','conflicting_source','missing_source'];
/** Database metadata only. No Shopify authentication, claims, writes or payloads.
 * Existing dedicated intake login is required; no reporting/admin fallback.
 */
export async function checkCloudNightly({env=process.env}={}, {createPool,now=()=>new Date()}={}){
 let pool,client,discard=false,phase='configuration';
 try{
  ensure(env.NIGHT_SCOUT_STAGING_PROJECT_REF===target.projectRef);
  const period=rollingReportingScope({now:now().toISOString(),timezone:target.timezone});
  const scope={storeId:target.storeId,shopId:target.shopId,from:period.from,to:period.to};
  const options=intakeConnectionOptions({projectRef:target.projectRef,databaseUrl:env.NIGHT_SCOUT_INTAKE_DATABASE_URL,scope});
  if(!createPool){const require=createRequire(new URL('../../lib/db/package.json',import.meta.url));const {Pool}=require('pg');createPool=o=>new Pool(o);}
  // The diagnostic connects in-process; unlike cloud-nightly's subprocess it
  // cannot rely on materialising NODE_EXTRA_CA_CERTS after Node startup. Pin
  // the same configured root chain directly into pg's verified TLS options.
  if(env.NIGHT_SCOUT_STAGING_CA_PEM!==undefined){
   const pem=env.NIGHT_SCOUT_STAGING_CA_PEM;ensure(typeof pem==='string'&&pem.length<=32768);
   const certs=pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
   ensure(certs?.length>0&&certs.length<=8&&certs.reduce((s,c)=>s.replace(c,''),pem).trim()==='');
   for(const cert of certs)ensure(new X509Certificate(cert).ca===true);
   options.pool.ssl={rejectUnauthorized:true,ca:pem};
  }
  phase='database_connect';pool=createPool(options.pool);pool.on?.('error',()=>{});client=await pool.connect();
  phase='database_role';
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await client.query('SET LOCAL ROLE night_scout_intake_service');
  const role=(await client.query(`SELECT current_user AS role,
   (SELECT rolname='night_scout_intake_login' AND rolcanlogin AND NOT (rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls) FROM pg_roles WHERE rolname=session_user) AS safe_login,
   (SELECT NOT (rolcanlogin OR rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls) FROM pg_roles WHERE rolname=current_user) AS safe_role`)).rows;
  ensure(role.length===1&&role[0].role==='night_scout_intake_service'&&role[0].safe_login===true&&role[0].safe_role===true);
  phase='store_identity';
  const store=(await client.query('SELECT shopify_domain,shopify_store_id,currency_code,timezone FROM public.stores WHERE id=$1',[target.storeId])).rows;
  ensure(store.length===1&&store[0].shopify_domain===target.domain&&store[0].shopify_store_id==='95601983836'&&store[0].currency_code.trim()===target.currency&&store[0].timezone===target.timezone);
  phase='durable_history';
  const attempts=(await client.query('SELECT state,date_from::text AS date_from,date_to::text AS date_to,result_code FROM ingest_v1.sync_attempts WHERE store_id=$1 ORDER BY started_at DESC,id DESC LIMIT 1',[target.storeId])).rows;
  const claims=(await client.query('SELECT state,date_from::text AS date_from,date_to::text AS date_to FROM ingest_v1.nightly_claims WHERE store_id=$1 AND local_date=$2',[target.storeId,period.localDate])).rows;
  const totals=(await client.query(`SELECT (SELECT count(*)::int FROM ingest_v1.sync_attempts WHERE store_id=$1 AND state IN ('running','unconfirmed')) AS unresolved_attempts,
   (SELECT count(*)::int FROM ingest_v1.heads WHERE store_id=$1 AND date_from=$2 AND date_to=$3) AS current_heads`,[target.storeId,scope.from,scope.to])).rows;
  ensure(attempts.length<=1&&claims.length<=1&&totals.length===1&&Number.isSafeInteger(totals[0].unresolved_attempts)&&totals[0].unresolved_attempts>=0&&[0,1].includes(totals[0].current_heads));
  const same=r=>r.date_from===scope.from&&r.date_to===scope.to;
  for(const r of [...attempts,...claims])ensure(['running','completed','unconfirmed'].includes(r.state));
  if(attempts[0])ensure(attempts[0].state==='completed'?codes.includes(attempts[0].result_code):attempts[0].result_code===null);
  await client.query('ROLLBACK');
  return {event:'shopify_nightly_readiness',projectRef:target.projectRef,localDate:period.localDate,from:scope.from,to:scope.to,
   latestAttempt:attempts[0]?{state:attempts[0].state,resultCode:attempts[0].result_code,matchesCurrentScope:same(attempts[0])}:null,
   todayClaim:claims[0]?{state:claims[0].state,matchesCurrentScope:same(claims[0])}:null,
   retryBlocked:totals[0].unresolved_attempts>0,currentCandidatePresent:totals[0].current_heads===1,
   sourceAuthenticationChecked:false,collectionAttempted:false,financialVerification:'not_assessed',writeAttempted:false};
 }catch(error){discard=true;try{await client?.query('ROLLBACK');}catch{}throw diagnosticError(phase,error);}
 finally{let failed=false;try{client?.release(discard);}catch{failed=true;}try{await pool?.end();}catch{failed=true;}if(failed)throw diagnosticError('cleanup');}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length!==2)throw Error(failure);console.log(JSON.stringify(await checkCloudNightly()));}catch(error){console.log(JSON.stringify(error?.diagnostic??diagnosticError('configuration').diagnostic));process.exitCode=1;}}
