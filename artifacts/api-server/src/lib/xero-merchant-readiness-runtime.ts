import {createClient} from '@supabase/supabase-js';
import type {XeroReadinessDependencies,XeroReadinessIdentity} from '../routes/xero-merchant-readiness.ts';

const PROJECT='bioalckltvkhlczusdvl';
const unavailable=()=>Error('Xero readiness unavailable');
export function createXeroMerchantReadinessRuntime(env:NodeJS.ProcessEnv,deps:{createAuthClient?:typeof createClient;fetchImpl?:typeof fetch}={}):XeroReadinessDependencies|undefined{
 if(env.NIGHT_SCOUT_XERO_MERCHANT_READINESS_ENABLED!=='true')return undefined;
 const url=env.NIGHT_SCOUT_REVIEW_AUTH_URL??env.VITE_SUPABASE_URL,key=env.NIGHT_SCOUT_REVIEW_PUBLIC_KEY??env.VITE_SUPABASE_ANON_KEY;
 if(env.NIGHT_SCOUT_RUNTIME_ENV!=='staging'||env.NIGHT_SCOUT_XERO_STAGING_PROJECT_REF!==PROJECT||url!==`https://${PROJECT}.supabase.co`||typeof key!=='string'||key.length<20)throw unavailable();
 const auth=(deps.createAuthClient??createClient)(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}),fetchImpl=deps.fetchImpl??fetch;
 return Object.freeze({
  authenticate:async authorization=>{const token=authorization.replace(/^Bearer\s+/i,'');const {data,error}=await auth.auth.getUser(token);if(error||typeof data?.user?.id!=='string')throw unavailable();const identity=Object.freeze({userId:data.user.id});tokens.set(identity,token);return identity;},
  service:Object.freeze({read:async(_identity:XeroReadinessIdentity,storeId:string)=>{const response=await fetchImpl(`${url}/rest/v1/rpc/xero_merchant_readiness`,{method:'POST',redirect:'error',headers:{apikey:key,authorization:`Bearer ${authorizationToken(_identity)}`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({p_store_id:storeId}),signal:AbortSignal.timeout(10_000)}).catch(()=>{throw unavailable();});const declared=Number(response.headers.get('content-length'));if(!response.ok||(Number.isFinite(declared)&&declared>16_384))throw unavailable();const bytes=await response.arrayBuffer();if(bytes.byteLength>16_384)throw unavailable();let value:unknown;try{value=JSON.parse(Buffer.from(bytes).toString('utf8'));}catch{throw unavailable();}if(!validReadiness(value,storeId))throw unavailable();return value;}})
 });
}

// Identity deliberately carries no reusable credential. The route/runtime pair
// attaches the verified bearer only inside one request via this private slot.
const tokens=new WeakMap<object,string>();
function authorizationToken(identity:object){const token=tokens.get(identity);if(!token)throw unavailable();tokens.delete(identity);return token;}
const timestamp=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)&&Number.isFinite(Date.parse(value)),plain=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
function validReadiness(value:unknown,storeId:string){if(!plain(value)||Object.keys(value).sort().join(',')!=='connection,evidenceRetrievedAt,evidenceState,storeId'||value.storeId!==storeId||!(value.evidenceRetrievedAt===null||timestamp(value.evidenceRetrievedAt))||!(value.evidenceState===null||['checking','ready','stale','review_required','unavailable','denied'].includes(String(value.evidenceState))))return false;if(value.connection===null)return value.evidenceState===null&&value.evidenceRetrievedAt===null;if(!plain(value.connection)||Object.keys(value.connection).sort().join(',')!=='createdAt,lastFailureAt,lastSuccessAt,mappingReviewRequired,scopeVersion,status')return false;const c=value.connection;return ['active','reauthorization_required','disconnected'].includes(String(c.status))&&c.scopeVersion==='read-only-v1'&&timestamp(c.createdAt)&&(c.lastSuccessAt===null||timestamp(c.lastSuccessAt))&&(c.lastFailureAt===null||timestamp(c.lastFailureAt))&&typeof c.mappingReviewRequired==='boolean'&&(value.evidenceState!=='ready'||timestamp(value.evidenceRetrievedAt));}
