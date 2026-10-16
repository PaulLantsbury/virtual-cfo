import {parseSavedXeroMapping,type SavedXeroMapping} from '../../../../experiments/xero/saved-mapping-view.mjs';
export type SavedMappingReadDependencies=Readonly<{fetcher?:typeof fetch;accessToken?:()=>Promise<string>}>;
async function accessToken(){const {supabase}=await import('./supabase.ts');const {data,error}=await supabase.auth.getSession();const s=data.session;if(error||!s?.access_token||!s.expires_at||s.expires_at*1000<=Date.now())throw Error('Saved Xero mapping unavailable');return s.access_token;}
export async function fetchSavedXeroMapping(storeId:string,signal?:AbortSignal,deps:SavedMappingReadDependencies={}):Promise<SavedXeroMapping>{
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storeId))throw Error('Saved Xero mapping unavailable');
 const token=await (deps.accessToken??accessToken)();if(typeof token!=='string'||!token.length||token.length>8192||/\s/.test(token))throw Error('Saved Xero mapping unavailable');
 const response=await (deps.fetcher??fetch)(`/api/xero/saved-mapping?storeId=${encodeURIComponent(storeId)}`,{credentials:'include',cache:'no-store',signal,headers:{accept:'application/json',authorization:`Bearer ${token}`}});
 if(!response.ok)throw Error('Saved Xero mapping unavailable');const value=parseSavedXeroMapping(await response.json(),storeId);if(!value)throw Error('Saved Xero mapping unavailable');return value;
}
