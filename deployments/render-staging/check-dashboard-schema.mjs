// Read-only diagnostic; never emits configuration values or raw database errors.
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {reviewConnectionOptions} from '../../experiments/shopify/review-runtime.mjs';
const count=v=>Number.isSafeInteger(v)&&v>=0?v:null;
export async function checkDashboardSchema(env,{createPool,loadSql=()=>readFile(new URL('./dashboard-schema-diagnostics.sql',import.meta.url),'utf8')}={}){
 const base={event:'dashboard_schema_readiness',staging:env.NIGHT_SCOUT_RUNTIME_ENV==='staging',expectedProject:env.NIGHT_SCOUT_REVIEW_PROJECT_REF==='bioalckltvkhlczusdvl'};
 let pool,client;
 try{
  if(!base.staging||!base.expectedProject)return {...base,state:'refused_target',compatible:false};
  const {pool:options}=reviewConnectionOptions({projectRef:env.NIGHT_SCOUT_REVIEW_PROJECT_REF,authUrl:env.NIGHT_SCOUT_REVIEW_AUTH_URL,publishableKey:env.NIGHT_SCOUT_REVIEW_PUBLIC_KEY,databaseUrl:env.NIGHT_SCOUT_REVIEW_DATABASE_URL});
  const sql=await loadSql();
  if(!sql.startsWith('BEGIN READ ONLY;')||!sql.trimEnd().endsWith('ROLLBACK;'))return {...base,state:'invalid_prepared_query',compatible:false};
  const factory=createPool??(options=>{const require=createRequire(new URL('../../lib/db/package.json',import.meta.url));return new (require('pg').Pool)(options);});
  pool=factory({...options,max:1});
  client=await pool.connect();
  await client.query('BEGIN READ ONLY');
  await client.query('SET LOCAL ROLE night_scout_review_service');
  await client.query("SET LOCAL statement_timeout = '30s'");
  const prepared=sql.replace(/^BEGIN READ ONLY;/,'').replace(/ROLLBACK;\s*$/,'');
  const result=await client.query(prepared),sets=Array.isArray(result)?result:[result];
  const value=sets.flatMap(r=>r.rows??[]).find(r=>r.diagnostics)?.diagnostics;
  if(!value||typeof value.schema_contract_matches!=='boolean')return {...base,state:'invalid_diagnostic_result',compatible:false};
  return {...base,state:value.schema_contract_matches?'compatible':'schema_mismatch',compatible:value.schema_contract_matches,
   serverMajor:count(value.server_major),expectedCatalogMajor:count(value.expected_catalog_major),
   visibleConstraintCounts:Object.fromEntries(['c','f','n','p','u','t','x'].map(k=>[k,count(value.visible_constraint_types?.[k]??0)])),
   mismatches:Object.fromEntries(['columns','constraints','triggers','not_null_attributes'].map(k=>[k,Array.isArray(value.mismatches?.[k])?value.mismatches[k].length:null])),
   applicationAuthorized:false,reviewerVerificationRequired:true};
 }catch(error){return {...base,state:error?.code==='42501'?'insufficient_schema_visibility':'database_check_unavailable',compatible:false};}
 finally{if(client){try{await client.query('ROLLBACK');}catch{}client.release();}try{await pool?.end();}catch{}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const result=await checkDashboardSchema(process.env);console.log(JSON.stringify(result));if(!result.compatible)process.exitCode=1;}
