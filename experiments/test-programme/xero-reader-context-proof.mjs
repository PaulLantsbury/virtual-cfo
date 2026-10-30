const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sources=new WeakSet();
/** SELECT only. Execute in an EXISTING separately authenticated read/audit context.
 * The writer role must not receive access to reader tables or envelopes.
 * Only tenant identity and current-version preflight metadata leave this query.
 */
export const XERO_READER_CONTEXT_SQL=`SELECT c.tenant_id,c.store_id::text AS store_id,
 current_user::text AS context_role,
 p.outcome,p.phase,p.reason,p.tenant_visible,p.checked_at,
 (p.credential_version=e.version) AS matches_current_credential,
 NOT EXISTS(SELECT 1 FROM xero_v1.connection_preflight_evidence tied WHERE tied.connection_id=c.id AND tied.checked_at=p.checked_at AND (tied.outcome<>'connected' OR tied.phase<>'organisation' OR tied.reason<>'ok' OR tied.tenant_visible IS DISTINCT FROM true)) AS latest_time_unambiguous
FROM xero_v1.connections c
LEFT JOIN xero_v1.credential_envelopes e ON e.connection_id=c.id
LEFT JOIN LATERAL (SELECT outcome,phase,reason,tenant_visible,checked_at,credential_version
 FROM xero_v1.connection_preflight_evidence WHERE connection_id=c.id
 ORDER BY checked_at DESC,id DESC LIMIT 1) p ON true
WHERE c.store_id=$2::uuid AND c.retired_at IS NULL
 AND EXISTS(SELECT 1 FROM public.store_memberships m WHERE m.user_id=$1::uuid AND m.store_id=c.store_id)`;
const unavailable=()=>Error('Xero reader context proof unavailable');
export function createXeroReaderContextProofSource({authenticateContext,query,now=()=>new Date()}={}){
 if(typeof authenticateContext!=='function'||typeof query!=='function'||typeof now!=='function')throw unavailable();
 const source=Object.freeze({async read({ownerId,storeId}){
  try{
   if(!UUID.test(ownerId??'')||!UUID.test(storeId??''))throw unavailable();
   const identity=await authenticateContext();
   if(identity?.ownerId!==ownerId||identity.storeId!==storeId||identity.authenticated!==true)throw unavailable();
   const result=await query(XERO_READER_CONTEXT_SQL,[ownerId,storeId]);
   if(result.rows?.length!==1)throw unavailable();
   const r=result.rows[0],clock=now(),at=r.checked_at instanceof Date?r.checked_at.toISOString():r.checked_at;
   if(!(clock instanceof Date)||!Number.isFinite(clock.valueOf())||!UUID.test(r.tenant_id??'')||r.store_id!==storeId||typeof r.context_role!=='string'||['night_scout_test_writer','night_scout_test_writer_service','anon','authenticated'].includes(r.context_role)||typeof at!=='string'||!Number.isFinite(Date.parse(at))||Date.parse(at)>clock.valueOf()||clock.valueOf()-Date.parse(at)>3600000||r.outcome!=='connected'||r.phase!=='organisation'||r.reason!=='ok'||r.tenant_visible!==true||r.matches_current_credential!==true||r.latest_time_unambiguous!==true)throw unavailable();
   return Object.freeze({provider:'xero',target:r.tenant_id,connected:true,observedAt:at,contextObservedAt:clock.toISOString(),provenance:'authenticated_read_context_current_preflight_v1'});
  }catch{throw unavailable();}
 }});sources.add(source);return source;
}
export const isXeroReaderContextProofSource=value=>!!value&&sources.has(value);

const ownerBindingReaders=new WeakSet(),ownerBindingReceipts=new WeakSet();
const PROJECT='bioalckltvkhlczusdvl';
// Proposed isolated demo store: never dispatch this transport to the live reader.
export const XERO_DEMO_BINDING_STORE_ID='f59e3a44-7106-4df8-9c08-52da30c9de30';
function publicMemberKey(key){
 if(typeof key!=='string'||key.length>4096)return false;
 if(/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key))return true;
 try{const parts=key.split('.');if(parts.length!==3)return false;const p=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));return p.role==='anon'&&p.ref===PROJECT;}catch{return false;}
}
/** Uses the EXISTING owner bearer, never a database login. Default legacy SELECT
 * requires existing schema exposure. Explicit public-binding-rpc-v1 opt-in requires
 * separately reviewed/applied SQL; neither transport falls back to the other.
 * Schema exposure/RPC availability is not assumed: failures stay closed.
 * Only safe binding metadata is retained; reader connection health is not inferred.
 */
export function createXeroOwnerSessionBindingReader({authUrl,publicKey,authenticateOwner,fetchImpl=fetch,now=()=>new Date(),bindingTransport='existing-schema-select',selectedRevenueAccountId}={}){
 const demo=bindingTransport==='demo-public-binding-rpc-v1';
 if(authUrl!==`https://${PROJECT}.supabase.co`||!publicMemberKey(publicKey)||typeof authenticateOwner!=='function'||typeof fetchImpl!=='function'||typeof now!=='function'||!['existing-schema-select','public-binding-rpc-v1','demo-public-binding-rpc-v1'].includes(bindingTransport)||demo&&!UUID.test(selectedRevenueAccountId??''))throw unavailable();
 const reader=Object.freeze({async read({authorization,ownerId,storeId}){
  try{
   if(typeof authorization!=='string'||authorization.length>8192||!/^Bearer [^\s,]+$/i.test(authorization)||!UUID.test(ownerId??'')||!UUID.test(storeId??'')||demo&&storeId!==XERO_DEMO_BINDING_STORE_ID)throw unavailable();
   const principal=await authenticateOwner(authorization);if(principal?.userId!==ownerId||principal.isOwner!==true)throw unavailable();
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);let bodyReader;
   try{
    const rpc=demo||bindingTransport==='public-binding-rpc-v1';
    const url=new URL(`${authUrl}/rest/v1/${demo?'rpc/xero_demo_member_active_tenant_binding_v1':rpc?'rpc/xero_member_active_tenant_binding_v1':'connections'}`);
    if(!rpc){url.searchParams.set('select','store_id,tenant_id');url.searchParams.set('store_id',`eq.${storeId}`);url.searchParams.set('retired_at','is.null');url.searchParams.set('limit','2');}
    const r=await fetchImpl(url.href,{method:rpc?'POST':'GET',redirect:'error',signal:controller.signal,headers:{apikey:publicKey,Authorization:authorization,Accept:'application/json','Accept-Profile':rpc?'public':'xero_v1',...(rpc?{'Content-Profile':'public','Content-Type':'application/json'}:{})},...(rpc?{body:JSON.stringify({p_store_id:storeId})}:{})});
    if(!r?.ok||r.redirected||Number(r.headers?.get?.('content-length'))>8192)throw unavailable();bodyReader=r.body?.getReader();if(!bodyReader)throw unavailable();let size=0;const chunks=[];
    while(true){const {done,value}=await bodyReader.read();if(done)break;size+=value.byteLength;if(size>8192){await bodyReader.cancel();throw unavailable();}chunks.push(Buffer.from(value));}
    const rows=JSON.parse(Buffer.concat(chunks,size).toString('utf8'));if(!Array.isArray(rows)||rows.length!==1||Object.keys(rows[0]).sort().join(',')!=='store_id,tenant_id'||rows[0].store_id!==storeId||!UUID.test(rows[0].tenant_id??''))throw unavailable();
    const clock=now();if(!(clock instanceof Date)||!Number.isFinite(clock.valueOf()))throw unavailable();
    if(demo){
     bodyReader.releaseLock();bodyReader=undefined;
     const statusResponse=await fetchImpl(`${authUrl}/rest/v1/rpc/xero_demo_reader_status_v1`,{method:'POST',redirect:'error',signal:controller.signal,headers:{apikey:publicKey,Authorization:authorization,Accept:'application/json','Accept-Profile':'public','Content-Profile':'public','Content-Type':'application/json'},body:JSON.stringify({p_store_id:storeId})});
     if(!statusResponse?.ok||statusResponse.redirected||Number(statusResponse.headers?.get?.('content-length'))>8192)throw unavailable();
     bodyReader=statusResponse.body?.getReader();if(!bodyReader)throw unavailable();let statusSize=0;const statusChunks=[];
     while(true){const {done,value}=await bodyReader.read();if(done)break;statusSize+=value.byteLength;if(statusSize>8192){await bodyReader.cancel();throw unavailable();}statusChunks.push(Buffer.from(value));}
     const status=JSON.parse(Buffer.concat(statusChunks,statusSize).toString('utf8')),ids=status?.revenueAccountIds,date=status?.mappingEffectiveFrom;
     if(status?.storeId!==storeId||status.tenantId!==rows[0].tenant_id||status.bindingState!=='active'||status.mappingState!=='current'||!Number.isSafeInteger(status.mappingVersion)||status.mappingVersion<1||typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||date>clock.toISOString().slice(0,10)||!Array.isArray(ids)||ids.length<1||ids.length>100||ids.some(id=>typeof id!=='string'||!UUID.test(id))||new Set(ids).size!==ids.length||!ids.includes(selectedRevenueAccountId))throw unavailable();
    }
    const receipt=Object.freeze({provider:'xero',target:rows[0].tenant_id,ownerId,storeId,tenantBindingVerified:true,readerHealthVerified:false,...(demo?{revenueAccountBindingVerified:true,mappedRevenueAccountId:selectedRevenueAccountId}:{}),observedAt:clock.toISOString(),expiresAt:new Date(clock.valueOf()+600000).toISOString(),provenance:demo?'authenticated_owner_demo_rpc_binding_v1':rpc?'authenticated_owner_public_rpc_binding_v1':'authenticated_owner_rls_connection_binding_v1'});
    ownerBindingReceipts.add(receipt);return receipt;
   }finally{clearTimeout(timer);bodyReader?.releaseLock();}
  }catch{throw unavailable();}
 }});ownerBindingReaders.add(reader);return reader;
}
export const isXeroOwnerSessionBindingReader=value=>!!value&&ownerBindingReaders.has(value);
export const isXeroOwnerSessionBindingReceipt=value=>!!value&&ownerBindingReceipts.has(value);
