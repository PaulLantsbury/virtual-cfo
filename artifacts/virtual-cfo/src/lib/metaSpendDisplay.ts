import {buildMetaHistoryFromWire,type MetaHistoryWirePresentation} from './metaHistoryWire.ts';

export type MetaSpendDisplayScope=Readonly<{userId:string;storeId:string;revision:number;from:string;to:string}>;
export type MetaSpendDisplayState=Readonly<{status:'idle'|'loading'|'ready'|'unavailable';scopeKey:string;view?:MetaHistoryWirePresentation}>;
export const metaSpendScopeKey=(scope:MetaSpendDisplayScope)=>JSON.stringify([scope.userId,scope.storeId,scope.revision,scope.from,scope.to]);
const uuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const day=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
export function validMetaSpendScope(scope:MetaSpendDisplayScope){return uuid(scope.userId)&&uuid(scope.storeId)&&Number.isSafeInteger(scope.revision)&&scope.revision>=0&&day(scope.from)&&day(scope.to)&&scope.from<=scope.to&&(Date.parse(scope.to+'T00:00:00Z')-Date.parse(scope.from+'T00:00:00Z'))/86400000<93;}
function ownData(value:unknown,key:string):unknown{
 if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)return undefined;
 const d=Object.getOwnPropertyDescriptor(value,key);return d&&'value' in d?d.value:undefined;
}
/** Bootstrap from the authenticated server's latest selection, not an independently pinned version. */
export function presentLatestMetaSpend(wire:unknown,scope:MetaSpendDisplayScope):MetaHistoryWirePresentation{
 if(!validMetaSpendScope(scope)||ownData(wire,'storeId')!==scope.storeId||ownData(wire,'from')!==scope.from||ownData(wire,'to')!==scope.to)return buildMetaHistoryFromWire(null,null,false);
 return buildMetaHistoryFromWire(wire,ownData(wire,'lineage'),true);
}
type FetchDependencies=Readonly<{fetcher?:typeof fetch;accessToken?:(userId:string)=>Promise<string>}>;
async function tokenFor(userId:string){
 const {supabase}=await import('./supabase.ts');const {data,error}=await supabase.auth.getSession();const s=data.session;
 if(error||!s?.access_token||s.user.id!==userId||!s.expires_at||s.expires_at*1000<=Date.now())throw new Error('Saved Meta spend unavailable');
 return s.access_token;
}
/** Reads saved server evidence only. This route does not invoke Meta or collect spend. */
export async function fetchSavedMetaSpend(scope:MetaSpendDisplayScope,signal:AbortSignal,deps:FetchDependencies={}):Promise<unknown>{
 if(!validMetaSpendScope(scope)||signal.aborted)throw new Error('Saved Meta spend unavailable');
 const token=await(deps.accessToken??tokenFor)(scope.userId);
 if(signal.aborted||typeof token!=='string'||token.length<1||token.length>8192||/\s/.test(token))throw new Error('Saved Meta spend unavailable');
 const query=new URLSearchParams({storeId:scope.storeId,from:scope.from,to:scope.to});
 const response=await(deps.fetcher??fetch)(`/api/meta-ads/spend?${query}`,{method:'GET',credentials:'include',cache:'no-store',redirect:'error',signal,headers:{accept:'application/json',authorization:`Bearer ${token}`}});
 if(!response.ok||signal.aborted)throw new Error('Saved Meta spend unavailable');
 return response.json();
}
/** No cache or automatic retry. A new request immediately removes the old display. */
export function createMetaSpendDisplayController(fetchReport:(scope:MetaSpendDisplayScope,signal:AbortSignal)=>Promise<unknown>=fetchSavedMetaSpend){
 let state:MetaSpendDisplayState=Object.freeze({status:'idle',scopeKey:''}),sequence=0,controller:AbortController|null=null;
 const listeners=new Set<()=>void>();
 const publish=(next:MetaSpendDisplayState)=>{state=Object.freeze(next);listeners.forEach(fn=>fn());};
 const clear=()=>{sequence++;controller?.abort();controller=null;publish({status:'idle',scopeKey:''});};
 return {getSnapshot:()=>state,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};},clear,
  async load(scope:MetaSpendDisplayScope){
   const request=++sequence;controller?.abort();controller=new AbortController();const signal=controller.signal;
   const captured=Object.freeze({...scope}),scopeKey=metaSpendScopeKey(captured);
   publish({status:'loading',scopeKey});
   if(!validMetaSpendScope(captured)){publish({status:'unavailable',scopeKey});return;}
   try{
    const wire=await fetchReport(captured,signal);if(request!==sequence||signal.aborted)return;
    const view=presentLatestMetaSpend(wire,captured);
    publish(view.state==='withheld'?{status:'unavailable',scopeKey}:{status:'ready',scopeKey,view});
   }catch{if(request===sequence&&!signal.aborted)publish({status:'unavailable',scopeKey});}
  },
 };
}
