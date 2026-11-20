/**
 * Local-only mock of the future server credential boundary.  It accepts opaque
 * ciphertext envelopes, never OAuth plaintext, and exposes only safe records.
 */
const safeReasons=new Set(['consent_denied','provider_unavailable','invalid_grant','scope_changed','tenant_unavailable','refresh_failed']);
export function createInMemoryXeroCredentialLifecycle({memberships=[],workerId='xero-refresh-worker',now=()=>new Date().toISOString(),provider={}}={}){
 const attempts=[],connections=[],credentials=[],audits=[];let sequence=0;
 const member=(context,storeId)=>validContext(context)&&memberships.some(x=>x.userId===context.userId&&x.storeId===storeId&&x.active!==false);
 const stamp=()=>{const value=now();if(!validTimestamp(value))throw Error('Credential lifecycle unavailable');return value;};
 const audit=(connectionId,storeId,action,reason)=>audits.push(Object.freeze({id:`audit-${++sequence}`,connectionId,storeId,action,recordedAt:stamp(),...(reason?{reason}:{})}));
 function startConsent(context,{storeId}={}){
  if(!id(storeId)||!member(context,storeId))throw Error('Xero connection forbidden');
  const attempt={id:`attempt-${++sequence}`,storeId,userId:context.userId,status:'authorization_pending',createdAt:stamp()};attempts.push(attempt);audit(null,storeId,'consent_started');return attemptView(attempt);
 }
 function receiveConsent(context,{attemptId,tenants,envelope}={}){
  const attempt=attempts.find(x=>x.id===attemptId);if(!attempt||!member(context,attempt.storeId)||attempt.userId!==context.userId||attempt.status!=='authorization_pending')throw Error('Xero consent unavailable');
  if(!Array.isArray(tenants)||tenants.length===0||!tenants.every(validTenant)||new Set(tenants.map(tenant=>tenant.id)).size!==tenants.length||!validEnvelope(envelope))throw Error('Xero consent unavailable');
  attempt.status='tenant_selection_required';attempt.tenants=Object.freeze(tenants.map(x=>Object.freeze({id:x.id,name:x.name})));attempt.envelope=freezeEnvelope(envelope);return attemptView(attempt);
 }
 function rejectConsent(context,{attemptId,reason='consent_denied'}={}){
  const attempt=attempts.find(x=>x.id===attemptId);if(!attempt||!member(context,attempt.storeId)||attempt.userId!==context.userId||attempt.status!=='authorization_pending'||!safeReasons.has(reason))throw Error('Xero consent unavailable');
  attempt.status='reauthorization_required';audit(null,attempt.storeId,'reauthorization_required',reason);return attemptView(attempt);
 }
 function selectTenant(context,{attemptId,tenantId}={}){
  const attempt=attempts.find(x=>x.id===attemptId);if(!attempt||!member(context,attempt.storeId)||attempt.userId!==context.userId||attempt.status!=='tenant_selection_required'||!id(tenantId))throw Error('Xero tenant selection unavailable');
  if(!attempt.tenants.some(x=>x.id===tenantId))throw Error('Xero tenant selection unavailable');
  if(connections.some(x=>x.tenantId===tenantId&&x.storeId!==attempt.storeId&&x.status!=='disconnected'))throw Error('Xero tenant already attached');
  const prior=connections.find(x=>x.storeId===attempt.storeId&&x.status!=='disconnected');if(prior)throw Error('Xero connection already active');
  const connection={id:`connection-${++sequence}`,storeId:attempt.storeId,tenantId,status:'active',scopeVersion:'read-only-v1',createdAt:stamp(),lastSuccessAt:null,lastFailureAt:null,mappingReviewRequired:true};connections.push(connection);credentials.push({connectionId:connection.id,envelope:attempt.envelope,version:1,lease:false,createdAt:connection.createdAt,rotatedAt:connection.createdAt});attempt.status='active';delete attempt.envelope;audit(connection.id,connection.storeId,'tenant_pinned');return connectionView(connection);
 }
 async function refresh({workerId:caller,connectionId}={}){
  if(caller!==workerId||!id(connectionId))throw Error('Xero refresh forbidden');const connection=connections.find(x=>x.id===connectionId),credential=credentials.find(x=>x.connectionId===connectionId);
  if(!connection||!credential||connection.status!=='active'||credential.lease)throw Error('Xero refresh unavailable');credential.lease=true;
  try{const rotated=await provider.refresh?.({connectionId,tenantId:connection.tenantId,envelope:freezeEnvelope(credential.envelope)});if(!validEnvelope(rotated?.envelope))throw Error('invalid_grant');credential.envelope=freezeEnvelope(rotated.envelope);credential.version+=1;credential.rotatedAt=stamp();connection.lastSuccessAt=credential.rotatedAt;audit(connection.id,connection.storeId,'refresh_succeeded');return connectionView(connection);
  }catch(error){const reason=safeReasons.has(error?.safeReason)?error.safeReason:'refresh_failed';connection.lastFailureAt=stamp();if(reason==='invalid_grant'||reason==='scope_changed'||reason==='tenant_unavailable')connection.status='reauthorization_required';audit(connection.id,connection.storeId,connection.status==='reauthorization_required'?'reauthorization_required':'refresh_failed',reason);throw Error('Xero refresh unavailable');
  }finally{credential.lease=false;}
 }
 async function disconnect(context,{connectionId}={}){
  const connection=connections.find(x=>x.id===connectionId);if(!connection||!member(context,connection.storeId))throw Error('Xero disconnect forbidden');if(connection.status==='disconnected')return connectionView(connection);connection.status='disconnected';connection.mappingReviewRequired=true;const index=credentials.findIndex(x=>x.connectionId===connectionId);if(index>=0)credentials.splice(index,1);try{await provider.revoke?.({connectionId,tenantId:connection.tenantId});}catch{}audit(connection.id,connection.storeId,'disconnected');return connectionView(connection);
 }
 function getConnection(context,{storeId,connectionId}={}){if(!member(context,storeId))throw Error('Xero connection forbidden');const c=connections.find(x=>x.id===connectionId&&x.storeId===storeId);return c?connectionView(c):null;}
 function inspect(){return Object.freeze({attempts:Object.freeze(attempts.map(attemptView)),connections:Object.freeze(connections.map(connectionView)),credentials:Object.freeze(credentials.map(x=>Object.freeze({connectionId:x.connectionId,version:x.version,keyVersion:x.envelope.keyVersion,createdAt:x.createdAt,rotatedAt:x.rotatedAt}))),audits:Object.freeze(audits.map(x=>Object.freeze({...x})))});}
 return Object.freeze({startConsent,receiveConsent,rejectConsent,selectTenant,refresh,disconnect,getConnection,inspect});
}
function id(value){return typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value)}
function validContext(value){return value&&typeof value==='object'&&id(value.userId)}
function validTimestamp(value){
 const match=typeof value==='string'&&value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d{1,3})?Z$/);
 if(!match)return false;
 const parsed=new Date(value);return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,19)===match[1];
}
function validTenant(value){return value&&Object.getPrototypeOf(value)===Object.prototype&&id(value.id)&&typeof value.name==='string'&&value.name.trim()!==''&&value.name.length<=120}
function validEnvelope(value){return value&&Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).sort().join(',')==='ciphertext,keyVersion'&&typeof value.ciphertext==='string'&&value.ciphertext.startsWith('sealed:')&&value.ciphertext.length<=1000&&id(value.keyVersion)}
function freezeEnvelope(value){return Object.freeze({ciphertext:value.ciphertext,keyVersion:value.keyVersion})}
function attemptView(value){return Object.freeze({id:value.id,storeId:value.storeId,status:value.status,createdAt:value.createdAt,...(value.status==='tenant_selection_required'?{tenants:Object.freeze(value.tenants.map(x=>Object.freeze({...x})))}:{})})}
function connectionView(value){return Object.freeze({id:value.id,storeId:value.storeId,tenantId:value.tenantId,status:value.status,scopeVersion:value.scopeVersion,createdAt:value.createdAt,lastSuccessAt:value.lastSuccessAt,lastFailureAt:value.lastFailureAt,mappingReviewRequired:value.mappingReviewRequired})}
