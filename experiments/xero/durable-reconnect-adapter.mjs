/** Disconnected, default-off server command adapter. It deliberately does NOT
 * issue OAuth URLs, exchange codes, seal PKCE, accept browser owner flags, or
 * mount a route. Those require the separately reviewed opaque-proof boundary.
 */
import {hasRequiredXeroScopes} from '../../deployments/nightly-staging/xero-refresh-runtime.mjs';
const STORE='56d92f8a-746e-4b4f-b408-81fc98c4aa17',PROJECT='bioalckltvkhlczusdvl',SCOPE='read-only-v1';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const digest=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const opaque=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{32,8192}$/.test(v);
const version=v=>Number.isSafeInteger(v)&&v>0;
const unavailable=()=>Error('Durable Xero reconnect unavailable');
const timestamp=v=>v instanceof Date&&Number.isFinite(v.valueOf())?v.toISOString():typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;

/** authenticate(request,storeId) must verify the current server-side account
 * session, not decode unsigned browser claims. proofs.verifyPending/Callback/
 * Failure/Grant must authenticate purpose-separated, encrypted durable context
 * and session/PKCE/state bindings. No such proof provider is implemented here.
 */
export function createDurableReconnectAdapter({enabled=false,runtimeEnv,projectRef,expectedKeyVersion,authenticate,proofs,rpc}={}){
 const active=enabled===true;
 if(active&&(runtimeEnv!=='staging'||projectRef!==PROJECT||typeof authenticate!=='function'||typeof rpc?.call!=='function'||typeof expectedKeyVersion!=='string'||!/^[A-Za-z0-9._-]{1,128}$/.test(expectedKeyVersion)||!['verifyPending','verifyCallback','verifyFailure','verifyGrant'].every(name=>typeof proofs?.[name]==='function')))throw unavailable();
 const identity=async(request)=>{
  if(!active)throw unavailable();
  try{const principal=await authenticate(request,STORE);if(!uuid(principal?.userId)||!digest(principal?.sessionDigest))throw unavailable();return Object.freeze({storeId:STORE,userId:principal.userId,sessionDigest:principal.sessionDigest});}catch{throw unavailable();}
 };
 const verified=async(kind,proof,context)=>{if(!opaque(proof))throw unavailable();try{const value=await proofs[kind](proof,context);if(!value||value.scopeVersion!==SCOPE)throw unavailable();return value;}catch{throw unavailable();}};
 const call=async(name,args)=>{try{const rows=await rpc.call(`xero_v1.customer_reconnect_${name}`,args);if(!Array.isArray(rows)||rows.length!==1)throw unavailable();return rows[0];}catch{throw unavailable();}};
 const bound=value=>uuid(value?.attemptId)&&uuid(value?.exchangeClaim)&&uuid(value?.connectionId)&&uuid(value?.tenantId)&&version(value?.credentialVersion);
 return Object.freeze({enabled:active,
  async begin(request,pendingProof){const context=await identity(request),proof=await verified('verifyPending',pendingProof,context);if(!digest(proof.stateDigest))throw unavailable();
   const row=await call('begin',[STORE,context.userId,context.sessionDigest,proof.stateDigest,SCOPE]);const expiresAt=timestamp(row.expires_at);
   if(!uuid(row.attempt_id)||!uuid(row.connection_id)||!uuid(row.tenant_id)||!version(row.credential_version)||!expiresAt)throw unavailable();
   return Object.freeze({state:'pending',attemptId:row.attempt_id,expiresAt});
  },
  async claim(request,callbackProof){const context=await identity(request),proof=await verified('verifyCallback',callbackProof,context);if(!uuid(proof.attemptId)||!digest(proof.stateDigest))throw unavailable();
   const row=await call('claim',[proof.attemptId,STORE,context.userId,context.sessionDigest,proof.stateDigest]);const binding={attemptId:proof.attemptId,exchangeClaim:row.exchange_claim,connectionId:row.connection_id,tenantId:row.tenant_id,credentialVersion:row.credential_version};if(!bound(binding))throw unavailable();
   // Server-only binding for the sealed proof provider; never an HTTP response.
   return Object.freeze({state:'exchanging',...binding});
  },
  async fail(request,failureProof){const context=await identity(request),proof=await verified('verifyFailure',failureProof,context);if(!uuid(proof.attemptId)||!uuid(proof.exchangeClaim))throw unavailable();
   const row=await call('fail',[proof.attemptId,proof.exchangeClaim,STORE,context.userId,context.sessionDigest]);if(row.state!=='failed')throw unavailable();return Object.freeze({state:'failed',next:'fresh_consent_required'});
  },
  async finalize(request,grantProof){const context=await identity(request),proof=await verified('verifyGrant',grantProof,context),envelope=proof.envelope;
   if(!bound(proof)||!hasRequiredXeroScopes(proof.grantedScopes)||!Buffer.isBuffer(envelope?.ciphertext)||envelope.ciphertext.length<30||envelope.ciphertext.length>16384||!Buffer.isBuffer(envelope?.encryptedDek)||envelope.encryptedDek.length<30||envelope.encryptedDek.length>16384||envelope.keyVersion!==expectedKeyVersion||envelope.algorithm!=='AES-256-GCM')throw unavailable();
   // No exchange/retry takes place here. SQL alone atomically checks the claim,
   // pinned tenant, current credential version and absent worker lease.
   let row;try{row=await call('finalize',[proof.attemptId,proof.exchangeClaim,STORE,context.userId,context.sessionDigest,proof.tenantId,SCOPE,envelope.ciphertext,envelope.encryptedDek,envelope.keyVersion,envelope.algorithm,proof.connectionId,proof.credentialVersion]);}catch{return Object.freeze({state:'unconfirmed',next:'inspect_saved_connection_status'});}
   if(row.connection_id!==proof.connectionId||row.credential_version!==proof.credentialVersion+1)return Object.freeze({state:'unconfirmed',next:'inspect_saved_connection_status'});
   return Object.freeze({state:'connected',connectionId:row.connection_id,credentialVersion:row.credential_version});
  }
 });
}
