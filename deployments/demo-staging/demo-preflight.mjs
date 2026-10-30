import {demoIntakeWindow,DEMO_INTAKE_END} from './demo-intake-window.mjs';
import {readDemoReaderConfig} from './demo-config.mjs';
import {decryptDemoEnvelope,encryptDemoEnvelope} from './demo-envelope-crypto.mjs';
import {assertPinnedXeroConnection,assertGbpDemoOrganisation,hasRequiredXeroScopes,refreshXeroCredential} from './demo-source-primitives.mjs';
const fail=()=>Error('Demo reader preflight unavailable');
const reasons=new Set(['invalid_grant','refresh_failed','insufficient_scope','unauthorized','forbidden','reconnect_required','rate_limited','upstream_unavailable','provider_unavailable','network_failure','malformed_response','non_demo_organisation','unsupported_currency']);
const bytes=v=>{if(v instanceof Uint8Array)return Buffer.from(v);if(typeof v==='string'&&/^\\x[0-9a-f]+$/i.test(v))return Buffer.from(v.slice(2),'hex');throw fail();};
const blockedLease=v=>{if(v===null)return false;const t=v instanceof Date?v.valueOf():typeof v==='string'?Date.parse(v):NaN;return !Number.isFinite(t)||t>Date.now();};
const uuid=v=>typeof v==='string'&&v.length===36&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function createDemoConnectionPreflight({env=process.env,query,fetchImpl=fetch,clock=()=>new Date()}={}){
 const config=readDemoReaderConfig(env,clock),secret=Object.freeze({master:env.NIGHT_SCOUT_DEMO_XERO_ENVELOPE_MASTER_KEY,clientId:env.NIGHT_SCOUT_DEMO_XERO_CLIENT_ID,clientSecret:env.NIGHT_SCOUT_DEMO_XERO_CLIENT_SECRET});
 if(typeof query!=='function'||typeof fetchImpl!=='function')throw fail();
 const rpc=async(sql,args)=>{try{return (await query(sql,args)).rows;}catch{throw fail();}};
 const boundedFetch=(url,opts={})=>{const current=clock();if(demoIntakeWindow(current).state!=='admitted')throw fail();return fetchImpl(url,{...opts,signal:AbortSignal.timeout(Math.min(30000,Math.max(1,Date.parse(DEMO_INTAKE_END)-current.valueOf())))});};
 let used=false;
 return async()=>{
  if(used||demoIntakeWindow(clock()).state!=='admitted')throw fail();used=true;
  const jobs=await rpc('SELECT * FROM xero_demo_v1.worker_get_single_connection_preflight_job()',[]);if(jobs.length!==1||!uuid(jobs[0].connection_id)||!uuid(jobs[0].mapping_version_id))throw fail();
  const {connection_id:connectionId,mapping_version_id:mappingVersionId}=jobs[0];
  const rows=await rpc('SELECT * FROM xero_demo_v1.worker_get_refresh_context($1,$2)',[connectionId,mappingVersionId]);if(rows.length!==1)throw fail();const r=rows[0];
  if(r.store_id!==config.storeId||r.connection_id!==connectionId||r.mapping_version_id!==mappingVersionId||r.tenant_id!==config.expectedTenantId||r.key_version!==config.envelopeKeyVersion||r.algorithm!=='AES-256-GCM'||!Number.isInteger(r.version)||r.version<1||blockedLease(r.lease_expires_at))throw fail();
  const identity={connectionId,tenantId:r.tenant_id,keyVersion:r.key_version,ciphertext:bytes(r.ciphertext),encryptedDek:bytes(r.encrypted_dek)};
  const acquired=await rpc('SELECT xero_demo_v1.worker_acquire_refresh_lease($1,$2,$3) AS lease_expires_at',[connectionId,r.version,300]),lease=acquired[0]?.lease_expires_at;
  if(acquired.length!==1||!Number.isFinite(new Date(lease).valueOf())||new Date(lease).valueOf()<=Date.now())throw fail();
  let version=r.version,plain,outcome;
  const record=async(value)=>{if(value.state==='connected'&&demoIntakeWindow(clock()).state!=='admitted')throw fail();const rows=await rpc('SELECT xero_demo_v1.worker_record_connection_preflight($1,$2,$3,$4,$5,$6,$7,$8) AS recorded',[connectionId,version,value.state==='connected'?'connected':'failed',value.phase,value.reason==='network_failure'?'provider_unavailable':value.reason,null,value.state==='connected'?true:value.reason==='reconnect_required'?false:null,lease]);if(rows.length!==1||rows[0].recorded!==true)throw fail();};
  try{
   plain=decryptDemoEnvelope(secret.master,identity);let fresh;
   try{fresh=await refreshXeroCredential({refreshToken:plain,clientId:secret.clientId,clientSecret:secret.clientSecret,fetchImpl:boundedFetch});}catch(e){outcome={state:'failed',phase:'token',reason:reasons.has(e?.safeReason)?e.safeReason:'provider_unavailable'};await record(outcome);return Object.freeze({event:'demo_xero_preflight',...outcome});}
   const next=encryptDemoEnvelope(secret.master,identity,fresh.refreshToken),rotated=await rpc('SELECT xero_demo_v1.worker_store_refresh_envelope_leased($1,$2,$3,$4,$5,$6,$7,$8) AS rotated',[connectionId,next.ciphertext,next.encryptedDek,identity.keyVersion,'AES-256-GCM',version,version+1,lease]);if(rotated.length!==1||rotated[0].rotated!==true)throw fail();version++;
   if(!hasRequiredXeroScopes(fresh.scope)){outcome={state:'failed',phase:'token',reason:'insufficient_scope'};await record(outcome);return Object.freeze({event:'demo_xero_preflight',...outcome});}
   for(const [phase,check] of [['connection',assertPinnedXeroConnection],['organisation',assertGbpDemoOrganisation]]){try{await check({accessToken:fresh.accessToken,tenantId:identity.tenantId,fetchImpl:boundedFetch});}catch(e){outcome={state:'failed',phase,reason:reasons.has(e?.safeReason)?e.safeReason:'provider_unavailable'};await record(outcome);return Object.freeze({event:'demo_xero_preflight',...outcome});}}
   outcome={state:'connected',phase:'organisation',reason:'ok'};await record(outcome);return Object.freeze({event:'demo_xero_preflight',...outcome});
  }finally{plain?.fill(0);const released=await rpc('SELECT xero_demo_v1.worker_release_refresh_lease($1,$2,$3) AS released',[connectionId,version,lease]);if(released.length!==1||released[0].released!==true)throw fail();}
 };
}
