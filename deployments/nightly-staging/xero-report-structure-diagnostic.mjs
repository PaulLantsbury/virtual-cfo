/** Non-consuming staging diagnostic: reads report shapes but never accounting values. */
import {readStagingXeroWorkerConfig} from './xero-worker.mjs';
import {assertPinnedXeroConnection,decryptStagingEnvelope,encryptStagingEnvelope,hasRequiredXeroScopes,refreshXeroCredential} from './xero-refresh-runtime.mjs';
import {readFixedXeroPeriodSnapshot} from '../../experiments/xero/read-only-period-snapshot.mjs';
import {diagnoseXeroReportStructure} from '../../experiments/xero/report-structure-diagnostic.mjs';
import {validateXeroAccountMapping} from '../../experiments/xero/account-mapping-contract.mjs';

const unavailable=()=>Error('Xero staging report diagnostic unavailable');
const allowedReasons=new Set(['invalid_grant','refresh_failed','insufficient_scope','unauthorized','forbidden','reconnect_required','rate_limited','upstream_unavailable','upstream_refused','provider_unavailable','network_failure','malformed_response']);
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const bytes=value=>{if(Buffer.isBuffer(value))return Buffer.from(value);if(typeof value==='string'&&/^\\x[0-9a-f]*$/i.test(value))return Buffer.from(value.slice(2),'hex');throw unavailable();};
const blockedLease=value=>{if(value===null)return false;const at=value instanceof Date?value.valueOf():typeof value==='string'?Date.parse(value):NaN;return !Number.isFinite(at)||at>Date.now();};
const failed=(phase,reason)=>Object.freeze({event:'xero_report_structure',state:'failed',phase,reason:allowedReasons.has(reason)?reason:'provider_unavailable'});

export function createStagingXeroReportStructureDiagnostic({env=process.env,query,fetchImpl=fetch}={}){
 const config=readStagingXeroWorkerConfig(env);if(typeof query!=='function'||typeof fetchImpl!=='function')throw unavailable();
 const rpc=async(sql,params)=>{try{return (await query(sql,params)).rows;}catch{throw unavailable();}};
 const boundedFetch=(url,options={})=>fetchImpl(url,{...options,signal:AbortSignal.timeout(30_000)});
 const boundedReportFetch=async(url,options={})=>{
  const response=await boundedFetch(url,options);if(!response?.ok)return response;
  const declared=Number(response.headers?.get?.('content-length'));if(Number.isFinite(declared)&&declared>4_194_304)return new Response(null,{status:502});
  if(!response.body?.getReader)return response;
  const reader=response.body.getReader(),chunks=[];let total=0;
  for(;;){const {done,value}=await reader.read();if(done)break;if(value){total+=value.byteLength;if(total>4_194_304){await reader.cancel();return new Response(null,{status:502});}chunks.push(Buffer.from(value));}}
  return new Response(Buffer.concat(chunks,total),{status:response.status,headers:{'content-type':'application/json'}});
 };
 return async()=>{
  const jobs=await rpc('SELECT * FROM xero_v1.worker_get_single_connection_preflight_job()',[]);if(jobs.length!==1)throw unavailable();
  const {connection_id:connectionId,mapping_version_id:mappingVersionId}=jobs[0];if(!uuid(connectionId)||!uuid(mappingVersionId))throw unavailable();
  const rows=await rpc('SELECT * FROM xero_v1.worker_get_refresh_context($1,$2)',[connectionId,mappingVersionId]);if(rows.length!==1)throw unavailable();
  const row=rows[0],mapping=validateXeroAccountMapping(row.mapping);
  if(row.connection_id!==connectionId||row.mapping_version_id!==mappingVersionId||typeof row.tenant_id!=='string'||row.key_version!==config.envelopeKeyVersion||row.algorithm!=='AES-256-GCM'||!Number.isInteger(row.version)||!mapping||blockedLease(row.lease_expires_at))throw unavailable();
  const pinned={connectionId,tenantId:row.tenant_id,keyVersion:row.key_version,version:row.version,ciphertext:bytes(row.ciphertext),encryptedDek:bytes(row.encrypted_dek)};
  const acquired=await rpc('SELECT xero_v1.worker_acquire_refresh_lease($1,$2,$3) AS lease_expires_at',[connectionId,pinned.version,300]);if(acquired.length!==1||acquired[0].lease_expires_at===null)throw unavailable();
  const leaseExpiresAt=acquired[0].lease_expires_at;let leaseVersion=pinned.version,plain,outcome;
  try{
   plain=decryptStagingEnvelope(env.NIGHT_SCOUT_XERO_ENVELOPE_MASTER_KEY,pinned);
   let fresh;try{fresh=await refreshXeroCredential({refreshToken:plain,clientId:env.NIGHT_SCOUT_XERO_CLIENT_ID,clientSecret:env.NIGHT_SCOUT_XERO_CLIENT_SECRET,fetchImpl:boundedFetch});}catch(error){outcome=failed('token',error?.safeReason);return outcome;}
   const next=encryptStagingEnvelope(env.NIGHT_SCOUT_XERO_ENVELOPE_MASTER_KEY,pinned,fresh.refreshToken);
   const rotated=await rpc('SELECT xero_v1.worker_store_refresh_envelope_leased($1,$2,$3,$4,$5,$6,$7,$8) AS rotated',[connectionId,next.ciphertext,next.encryptedDek,pinned.keyVersion,'AES-256-GCM',pinned.version,pinned.version+1,leaseExpiresAt]);if(rotated.length!==1||rotated[0].rotated!==true)throw unavailable();leaseVersion=pinned.version+1;
   if(!hasRequiredXeroScopes(fresh.scope)){outcome=failed('token','insufficient_scope');return outcome;}
   try{await assertPinnedXeroConnection({accessToken:fresh.accessToken,tenantId:pinned.tenantId,fetchImpl:boundedFetch});}catch(error){outcome=failed('connection',error?.safeReason);return outcome;}
   let sourceFailure=null,snapshot;
   try{snapshot=await readFixedXeroPeriodSnapshot({accessToken:fresh.accessToken,tenantId:pinned.tenantId,from:config.scope.from,to:config.scope.to,fetchImpl:boundedReportFetch,diagnose:value=>{sourceFailure=value;}});}catch{outcome=failed(sourceFailure?.phase??'connection',sourceFailure?.reason);return outcome;}
   outcome=diagnoseXeroReportStructure({snapshot,mapping});return outcome;
  }finally{
   plain?.fill(0);
   let released=false;try{const result=await rpc('SELECT xero_v1.worker_release_refresh_lease($1,$2,$3) AS released',[connectionId,leaseVersion,leaseExpiresAt]);released=result.length===1&&result[0].released===true;}catch{/* fail closed */}
   if(!released&&outcome)throw unavailable();
  }
 };
}
