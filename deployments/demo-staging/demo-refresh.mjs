/** Bounded demo-only composition of the existing report/calculation contract. */
import {demoIntakeWindow,DEMO_INTAKE_END} from './demo-intake-window.mjs';
import {readDemoReaderConfig} from './demo-config.mjs';
import {encryptDemoEnvelope,decryptDemoEnvelope} from './demo-envelope-crypto.mjs';
import {refreshXeroCredential,hasRequiredXeroScopes,assertPinnedXeroConnection,assertGbpDemoOrganisation,readGbpDemoOrganisationResponse} from './demo-source-primitives.mjs';
import {readFixedXeroPeriodSnapshot} from '../../experiments/xero/read-only-period-snapshot.mjs';
import {runStagingXeroRefresh} from '../../experiments/xero/staging-refresh-orchestrator.mjs';
import {validateXeroAccountMapping} from '../../experiments/xero/account-mapping-contract.mjs';
const fail=()=>Error('Demo reader refresh unavailable'),uuid=v=>typeof v==='string'&&v.length===36&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const bytes=v=>{if(v instanceof Uint8Array)return Buffer.from(v);if(typeof v==='string'&&/^\\x[0-9a-f]+$/i.test(v))return Buffer.from(v.slice(2),'hex');throw fail();};
const leaseTime=v=>v instanceof Date?v.valueOf():typeof v==='string'?Date.parse(v):NaN;
const blockedLease=v=>v!==null&&(!Number.isFinite(leaseTime(v))||leaseTime(v)>Date.now());
const minor=v=>{const n=typeof v==='string'&&/^-?\d+$/.test(v)?Number(v):v;return Number.isSafeInteger(n)?n:null;};
const reasons=new Set(['invalid_grant','refresh_failed','insufficient_scope','unauthorized','forbidden','reconnect_required','rate_limited','upstream_unavailable','provider_unavailable','network_failure','malformed_response','non_demo_organisation','unsupported_currency']);
export function createDemoRefreshJob({env=process.env,query,fetchImpl=fetch,clock=()=>new Date(),diagnose=()=>{}}={}){
 const config=readDemoReaderConfig(env,clock),secret=Object.freeze({master:env.NIGHT_SCOUT_DEMO_XERO_ENVELOPE_MASTER_KEY,clientId:env.NIGHT_SCOUT_DEMO_XERO_CLIENT_ID,clientSecret:env.NIGHT_SCOUT_DEMO_XERO_CLIENT_SECRET});
 if(typeof query!=='function'||typeof fetchImpl!=='function'||typeof diagnose!=='function')throw fail();
 const rpc=async(sql,args)=>{try{return (await query(sql,args)).rows;}catch{throw fail();}};
 const boundedFetch=(url,opts={})=>{const current=clock();if(demoIntakeWindow(current).state!=='admitted')throw fail();return fetchImpl(url,{...opts,signal:AbortSignal.timeout(Math.min(30000,Math.max(1,Date.parse(DEMO_INTAKE_END)-current.valueOf())))});};
 const report=(phase,reason)=>{try{diagnose(Object.freeze({event:'demo_xero_source_failed',phase:['token','connection','organisation'].includes(phase)?phase:'connection',reason:reasons.has(reason)?reason:'provider_unavailable'}));}catch{}};
 let used=false;
 return async()=>{
  if(used||demoIntakeWindow(clock()).state!=='admitted')throw fail();used=true;
  const jobs=await rpc('SELECT * FROM xero_demo_v1.worker_get_single_refresh_job($1,$2,$3,$4)',[config.scope.from,config.scope.to,config.scope.currency,false]);
  if(jobs.length!==1||!uuid(jobs[0].connection_id)||!uuid(jobs[0].mapping_version_id))throw fail();const selected={connectionId:jobs[0].connection_id,mappingVersionId:jobs[0].mapping_version_id};
  const contexts=await rpc('SELECT * FROM xero_demo_v1.worker_get_refresh_context($1,$2)',[selected.connectionId,selected.mappingVersionId]);if(contexts.length!==1)throw fail();const r=contexts[0],mapping=validateXeroAccountMapping(r.mapping);
  if(r.store_id!==config.storeId||r.connection_id!==selected.connectionId||r.mapping_version_id!==selected.mappingVersionId||r.tenant_id!==config.expectedTenantId||r.key_version!==config.envelopeKeyVersion||r.algorithm!=='AES-256-GCM'||!Number.isInteger(r.version)||r.version<1||!mapping||blockedLease(r.lease_expires_at))throw fail();
  const identity={connectionId:r.connection_id,tenantId:r.tenant_id,keyVersion:r.key_version,ciphertext:bytes(r.ciphertext),encryptedDek:bytes(r.encrypted_dek)};
  const acquired=await rpc('SELECT xero_demo_v1.worker_acquire_refresh_lease($1,$2,$3) AS lease_expires_at',[selected.connectionId,r.version,300]),lease=acquired[0]?.lease_expires_at;
  if(acquired.length!==1||!Number.isFinite(leaseTime(lease))||leaseTime(lease)<=Date.now())throw fail();
  let leaseVersion=r.version,leaseHeld=true,plain,accessToken,demoVerified=false,terminalSourceFailure=null;
  const recordPreflight=async(state,phase,reason)=>{if(state==='connected'&&demoIntakeWindow(clock()).state!=='admitted')throw fail();const rows=await rpc('SELECT xero_demo_v1.worker_record_connection_preflight($1,$2,$3,$4,$5,$6,$7,$8) AS recorded',[selected.connectionId,leaseVersion,state,phase,reason==='network_failure'?'provider_unavailable':reason,null,state==='connected'?true:reason==='reconnect_required'?false:null,lease]);if(rows.length!==1||rows[0].recorded!==true)throw fail();};
  const safeReceipt=(state,extra={})=>Object.freeze({event:'demo_xero_refresh',state,projectRef:config.projectRef,storeId:config.storeId,scope:config.scope,...extra});
  const refuseSource=async(phase,error)=>{const reason=reasons.has(error?.safeReason)?error.safeReason:'provider_unavailable';demoVerified=false;terminalSourceFailure={phase,reason};report(phase,reason);await recordPreflight('failed',phase,reason);return safeReceipt('failed',{phase,reason});};
  const write=async input=>{
   if(!leaseHeld||!demoVerified||terminalSourceFailure||demoIntakeWindow(clock()).state!=='admitted')throw fail();const state=input.evidence?'supported':input.failure.reason==='later_posting_review_required'?'review_required':'failed',source=input.evidence?.values??null;
   const rows=await rpc('SELECT xero_demo_v1.worker_record_accounting_evidence_leased($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) AS evidence_id',[selected.connectionId,selected.mappingVersionId,config.scope.from,config.scope.to,config.scope.currency,false,state,input.failure?.reason??null,input.evidence?.asOf??null,clock().toISOString(),input.sourceFingerprint??null,source?.revenue??null,source?.processingFee??null,source?.advertising??null,source?.software??null,source?.includedCash??null,leaseVersion,lease]);
   if(rows.length!==1||!uuid(rows[0].evidence_id))throw fail();leaseHeld=false;
  };
  const prior=async()=>{
   const rows=await rpc('SELECT * FROM xero_demo_v1.worker_get_latest_supported_evidence($1,$2,$3,$4,$5,$6)',[selected.connectionId,selected.mappingVersionId,config.scope.from,config.scope.to,config.scope.currency,false]);if(!rows.length)return null;if(rows.length!==1)throw fail();const p=rows[0],values={revenue:minor(p.booked_revenue_minor),processingFee:minor(p.processing_fee_minor),advertising:minor(p.advertising_minor),software:minor(p.software_minor),includedCash:minor(p.included_cash_minor)};
   if(typeof p.source_fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(p.source_fingerprint)||typeof p.report_as_of!=='string'||Object.values(values).some(v=>v===null))throw fail();
   return {connectionId:selected.connectionId,tenantId:identity.tenantId,mappingVersionId:selected.mappingVersionId,scope:{...config.scope},sourceFingerprint:p.source_fingerprint,evidence:{state:'supported',scope:{...config.scope},asOf:p.report_as_of,values}};
  };
  try{
   plain=decryptDemoEnvelope(secret.master,identity);let fresh;
   try{fresh=await refreshXeroCredential({refreshToken:plain,clientId:secret.clientId,clientSecret:secret.clientSecret,fetchImpl:boundedFetch});}catch(e){return await refuseSource('token',e);}
   const next=encryptDemoEnvelope(secret.master,identity,fresh.refreshToken),rotated=await rpc('SELECT xero_demo_v1.worker_store_refresh_envelope_leased($1,$2,$3,$4,$5,$6,$7,$8) AS rotated',[selected.connectionId,next.ciphertext,next.encryptedDek,identity.keyVersion,'AES-256-GCM',leaseVersion,leaseVersion+1,lease]);
   if(rotated.length!==1||rotated[0].rotated!==true){await rpc('SELECT xero_demo_v1.worker_record_credential_refresh_failure($1,$2)',[selected.connectionId,'refresh_failed']);throw fail();}leaseVersion++;
   if(!hasRequiredXeroScopes(fresh.scope))return await refuseSource('token',{safeReason:'insufficient_scope'});
   try{await assertPinnedXeroConnection({accessToken:fresh.accessToken,tenantId:identity.tenantId,fetchImpl:boundedFetch});}catch(e){return await refuseSource('connection',e);}
   try{await assertGbpDemoOrganisation({accessToken:fresh.accessToken,tenantId:identity.tenantId,fetchImpl:boundedFetch});}catch(e){return await refuseSource('organisation',e);}
   demoVerified=true;accessToken=fresh.accessToken;await recordPreflight('connected','organisation','ok');
   const snapshotFetch=async(url,opts)=>{if(terminalSourceFailure)throw fail();const response=await boundedFetch(url,opts);if(new URL(url).pathname==='/api.xro/2.0/Organisation'){
    try{const body=await readGbpDemoOrganisationResponse(response);return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});}catch(e){await refuseSource('organisation',e);throw fail();}
   }
   if(!response?.ok)return response;
   if(response.redirected||Number(response.headers?.get?.('content-length'))>1048576)throw fail();const reader=response.body?.getReader();if(!reader)throw fail();let size=0;const chunks=[];
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1048576){await reader.cancel();throw fail();}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
   return new Response(Buffer.concat(chunks,size),{status:response.status,headers:{'content-type':'application/json'}});};
   try{
    const result=await runStagingXeroRefresh({connection:{id:selected.connectionId,tenantId:identity.tenantId},scope:config.scope,mapping,now:()=>clock().toISOString(),diagnose,
     readSnapshot:({tenantId,from,to})=>{if(terminalSourceFailure)throw fail();return readFixedXeroPeriodSnapshot({accessToken,tenantId,from,to,includeAccountDirectory:true,fetchImpl:snapshotFetch,diagnose});},persist:{writeSupported:write,writeFailure:write,readLatestSupported:prior}});
    if(!['supported','failed','stale'].includes(result.state))throw fail();return safeReceipt(result.state);
   }catch(error){if(terminalSourceFailure)return safeReceipt('failed',terminalSourceFailure);throw error;}
  }finally{plain?.fill(0);if(leaseHeld){const released=await rpc('SELECT xero_demo_v1.worker_release_refresh_lease($1,$2,$3) AS released',[selected.connectionId,leaseVersion,lease]);if(released.length!==1||released[0].released!==true)throw fail();}}
 };
}
