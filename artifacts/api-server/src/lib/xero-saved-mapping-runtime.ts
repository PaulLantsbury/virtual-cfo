import {createClient} from '@supabase/supabase-js';
import {parseSavedXeroMapping} from '../../../../experiments/xero/saved-mapping-view.mjs';
import type {SavedMappingDependencies} from '../routes/xero-saved-mapping.ts';
const PROJECT='bioalckltvkhlczusdvl';
const unavailable=()=>Error('Saved Xero mapping unavailable');
export function createXeroSavedMappingRuntime(env:NodeJS.ProcessEnv,deps:{createAuthClient?:typeof createClient;fetchImpl?:typeof fetch}={}):SavedMappingDependencies|undefined{
 if(env.NIGHT_SCOUT_XERO_SAVED_MAPPING_ENABLED!=='true')return undefined;
 const url=env.NIGHT_SCOUT_REVIEW_AUTH_URL??env.VITE_SUPABASE_URL,key=env.NIGHT_SCOUT_REVIEW_PUBLIC_KEY??env.VITE_SUPABASE_ANON_KEY;
 if(env.NIGHT_SCOUT_RUNTIME_ENV!=='staging'||env.NIGHT_SCOUT_XERO_STAGING_PROJECT_REF!==PROJECT||url!==`https://${PROJECT}.supabase.co`||typeof key!=='string'||key.length<20)throw unavailable();
 const fetchImpl=deps.fetchImpl??fetch;
 const boundedAuthFetch:typeof fetch=(input,init)=>fetchImpl(input,{...init,signal:init?.signal?AbortSignal.any([init.signal,AbortSignal.timeout(10_000)]):AbortSignal.timeout(10_000)});
 const auth=(deps.createAuthClient??createClient)(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:boundedAuthFetch}}),tokens=new WeakMap<object,string>();
 return {
  authenticate:async authorization=>{const token=authorization.replace(/^Bearer\s+/i,'');const {data,error}=await auth.auth.getUser(token);if(error||typeof data?.user?.id!=='string')throw unavailable();const identity=Object.freeze({userId:data.user.id});tokens.set(identity,token);return identity;},
  read:async(identity,storeId)=>{
   const token=tokens.get(identity);tokens.delete(identity);if(!token)throw unavailable();
   const response=await fetchImpl(`${url}/rest/v1/rpc/xero_saved_mapping`,{method:'POST',redirect:'error',headers:{apikey:key,authorization:`Bearer ${token}`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({p_store_id:storeId}),signal:AbortSignal.timeout(10_000)}).catch(()=>{throw unavailable();});
   if(!response.ok||!response.body||Number(response.headers.get('content-length'))>131_072)throw unavailable();
   const reader=response.body.getReader(),chunks:Uint8Array[]=[];let total=0;
   try{while(true){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>131_072){await reader.cancel();throw unavailable();}chunks.push(part.value);}}finally{reader.releaseLock();}
   let value:unknown;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw unavailable();}
   const parsed=parseSavedXeroMapping(value,storeId);if(!parsed)throw unavailable();return parsed;
  }
 };
}
