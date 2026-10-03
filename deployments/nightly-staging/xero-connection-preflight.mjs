/** Connection-only Xero staging preflight. Never selects or writes accounting evidence. */
import {readStagingXeroWorkerConfig} from './xero-worker.mjs';
import {assertPinnedXeroConnection,assertPinnedXeroOrganisation,decryptStagingEnvelope,encryptStagingEnvelope,hasRequiredXeroScopes,refreshXeroCredential} from './xero-refresh-runtime.mjs';

const unavailable=()=>Error('Xero staging preflight unavailable');
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const allowedReasons=new Set(['invalid_grant','refresh_failed','insufficient_scope','unauthorized','forbidden','reconnect_required','rate_limited','upstream_unavailable','provider_unavailable','network_failure','malformed_response']);
const result=(state,phase,reason)=>Object.freeze({event:'xero_connection_preflight',state,phase,reason});
const bytes=value=>{if(Buffer.isBuffer(value))return Buffer.from(value);if(typeof value==='string'&&/^\\x[0-9a-f]*$/i.test(value))return Buffer.from(value.slice(2),'hex');throw unavailable();};
const blockedLease=value=>{if(value===null)return false;const at=value instanceof Date?value.valueOf():typeof value==='string'?Date.parse(value):NaN;return !Number.isFinite(at)||at>Date.now();};

export function createStagingXeroConnectionPreflight({env=process.env,query,fetchImpl=fetch}={}){
 const config=readStagingXeroWorkerConfig(env);
 const connectionId=env.NIGHT_SCOUT_XERO_STAGING_CONNECTION_ID,mappingVersionId=env.NIGHT_SCOUT_XERO_STAGING_MAPPING_VERSION_ID;
 if(!uuid(connectionId)||!uuid(mappingVersionId)||typeof query!=='function'||typeof fetchImpl!=='function')throw unavailable();
 const rpc=async(sql,params)=>{try{return (await query(sql,params)).rows;}catch{throw unavailable();}};
 const boundedFetch=(url,options={})=>fetchImpl(url,{...options,signal:AbortSignal.timeout(30_000)});
 return async()=>{
  const rows=await rpc('SELECT * FROM xero_v1.worker_get_refresh_context($1,$2)',[connectionId,mappingVersionId]);
  if(rows.length!==1)throw unavailable();
  const row=rows[0];
  if(row.connection_id!==connectionId||row.mapping_version_id!==mappingVersionId||typeof row.tenant_id!=='string'||row.key_version!==config.envelopeKeyVersion||row.algorithm!=='AES-256-GCM'||!Number.isInteger(row.version)||blockedLease(row.lease_expires_at))throw unavailable();
  const pinned={connectionId,tenantId:row.tenant_id,keyVersion:row.key_version,version:row.version,ciphertext:bytes(row.ciphertext),encryptedDek:bytes(row.encrypted_dek)};
  const acquired=await rpc('SELECT xero_v1.worker_acquire_refresh_lease($1,$2,$3) AS lease_expires_at',[connectionId,pinned.version,300]);
  if(acquired.length!==1||acquired[0].lease_expires_at===null)throw unavailable();
  const leaseExpiresAt=acquired[0].lease_expires_at;
  let leaseVersion=pinned.version,releaseValid=false,plain,outcome;
  try {
   plain=decryptStagingEnvelope(env.NIGHT_SCOUT_XERO_ENVELOPE_MASTER_KEY,pinned);
   let fresh;
   try { fresh=await refreshXeroCredential({refreshToken:plain,clientId:env.NIGHT_SCOUT_XERO_CLIENT_ID,clientSecret:env.NIGHT_SCOUT_XERO_CLIENT_SECRET,fetchImpl:boundedFetch}); }
   catch(error){const reason=allowedReasons.has(error?.safeReason)?error.safeReason:'provider_unavailable';outcome=result('failed','token',reason);return outcome;}
   const next=encryptStagingEnvelope(env.NIGHT_SCOUT_XERO_ENVELOPE_MASTER_KEY,pinned,fresh.refreshToken);
   const rotated=await rpc('SELECT xero_v1.worker_store_refresh_envelope_leased($1,$2,$3,$4,$5,$6,$7,$8) AS rotated',[connectionId,next.ciphertext,next.encryptedDek,pinned.keyVersion,'AES-256-GCM',pinned.version,pinned.version+1,leaseExpiresAt]);
   if(rotated.length!==1||rotated[0].rotated!==true)throw unavailable();
   leaseVersion=pinned.version+1;
   if(!hasRequiredXeroScopes(fresh.scope)){outcome=result('failed','token','insufficient_scope');return outcome;}
   try { await assertPinnedXeroConnection({accessToken:fresh.accessToken,tenantId:pinned.tenantId,fetchImpl:boundedFetch}); }
   catch(error){const reason=allowedReasons.has(error?.safeReason)?error.safeReason:'provider_unavailable';outcome=result('failed','connection',reason);return outcome;}
   try { await assertPinnedXeroOrganisation({accessToken:fresh.accessToken,tenantId:pinned.tenantId,fetchImpl:boundedFetch}); }
   catch(error){const reason=allowedReasons.has(error?.safeReason)?error.safeReason:'provider_unavailable';outcome=result('failed','organisation',reason);return outcome;}
   const receipt=await rpc('SELECT xero_v1.worker_record_connection_preflight($1,$2,$3,$4,$5,$6,$7,$8) AS recorded',[connectionId,leaseVersion,'connected','organisation','ok',null,true,leaseExpiresAt]);
   if(receipt.length!==1||receipt[0].recorded!==true)throw unavailable();
   outcome=result('connected','organisation','ok');return outcome;
  } finally {
   plain?.fill(0);
   try{const released=await rpc('SELECT xero_v1.worker_release_refresh_lease($1,$2,$3) AS released',[connectionId,leaseVersion,leaseExpiresAt]);releaseValid=released.length===1&&released[0].released===true;}catch{releaseValid=false;}
   if(!releaseValid&&outcome?.state==='connected')throw unavailable();
  }
 };
}
