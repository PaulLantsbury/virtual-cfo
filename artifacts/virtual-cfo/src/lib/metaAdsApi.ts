export type MetaAdAccount = Readonly<{accountId:string;currency:string;timeZone:string}>;
export type MetaRun = Readonly<{status:'running'|'complete'|'partial'|'failed';from:string;to:string;startedAt:string;finishedAt:string|null;safeFailure:string|null;pagesRead:number}>;
export type MetaConnection = Readonly<{connectionId:string;status:'pending'|'connected'|'reauthorization_required'|'disconnected'|'revoked';connectedAt:string|null;disconnectedAt:string|null;tokenExpiresAt:string|null;accountId:string|null;currency:string|null;timeZone:string|null;latestRun:MetaRun|null}>;
export type MetaStatus = Readonly<{connections:readonly MetaConnection[]}>;
type Dependencies=Readonly<{fetcher?:typeof fetch;accessToken?:()=>Promise<string>;expectedUserId?:string;signal?:AbortSignal}>
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const day=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(`${v}T00:00:00Z`));
const date=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const plain=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const failures=new Set(['token_expired','access_revoked','provider_unavailable','invalid_response','scope_missing']);
const connectionStates=new Set(['pending','connected','reauthorization_required','disconnected','revoked']);
const runStates=new Set(['running','complete','partial','failed']);
const unavailable=()=>new Error('Meta Ads connection unavailable');

async function currentAccessToken(expectedUserId?:string){
 const {supabase}=await import('./supabase.ts');
 const {data,error}=await supabase.auth.getSession();const session=data.session;
 if(error||(expectedUserId!==undefined&&session?.user.id!==expectedUserId)||!session?.access_token||!session.expires_at||session.expires_at*1000<=Date.now())throw unavailable();
 return session.access_token;
}
async function request(path:string,storeId:string,method:'GET'|'POST',body?:Record<string,string>,signal?:AbortSignal,deps:Dependencies={}){
 signal=signal??deps.signal;
 if(!uuid(storeId)||signal?.aborted)throw unavailable();
 const token=await(deps.accessToken??(()=>currentAccessToken(deps.expectedUserId)))();
 if(signal?.aborted)throw unavailable();
 if(typeof token!=='string'||token.length<1||token.length>8192||/\s/.test(token))throw unavailable();
 const url=method==='GET'?`${path}?${new URLSearchParams({storeId,...(body??{})})}`:path;
 const response=await(deps.fetcher??fetch)(url,{method,credentials:'include',cache:'no-store',redirect:'error',signal,headers:{accept:'application/json',authorization:`Bearer ${token}`,...(method==='POST'?{'content-type':'application/json'}:{})},...(method==='POST'?{body:JSON.stringify({storeId,...body})}:{})});
 if(!response.ok||signal?.aborted)throw unavailable();
 return response.json() as Promise<unknown>;
}
function parseAccount(v:unknown):MetaAdAccount|null{
 if(!plain(v)||Object.keys(v).sort().join(',')!=='accountId,currency,timeZone'||typeof v.accountId!=='string'||!/^[0-9]{5,32}$/.test(v.accountId)||typeof v.currency!=='string'||!/^[A-Z]{3}$/.test(v.currency)||typeof v.timeZone!=='string'||v.timeZone.length<1||v.timeZone.length>128)return null;
 try{new Intl.DateTimeFormat('en',{timeZone:v.timeZone})}catch{return null}
 return Object.freeze({accountId:v.accountId,currency:v.currency,timeZone:v.timeZone});
}
function parseRun(v:unknown):MetaRun|null{
 if(v===null)return null;
 if(!plain(v)||!uuid(v.runId)||typeof v.status!=='string'||!runStates.has(v.status)||!date(v.startedAt)||!(v.finishedAt===null||date(v.finishedAt))||!day(v.from)||!day(v.to)||v.from>v.to||!(v.safeFailure===null||typeof v.safeFailure==='string'&&failures.has(v.safeFailure))||!Number.isInteger(v.pagesRead)||(v.pagesRead as number)<0||(v.pagesRead as number)>100)return null;
 return Object.freeze({status:v.status as MetaRun['status'],from:v.from,to:v.to,startedAt:v.startedAt,finishedAt:v.finishedAt as string|null,safeFailure:v.safeFailure as string|null,pagesRead:v.pagesRead as number});
}
function parseConnection(v:unknown):MetaConnection|null{
 if(!plain(v)||!uuid(v.connectionId)||typeof v.status!=='string'||!connectionStates.has(v.status)||!(v.connectedAt===null||date(v.connectedAt))||!(v.disconnectedAt===null||date(v.disconnectedAt))||!(v.tokenExpiresAt===null||date(v.tokenExpiresAt))||!(v.accountId===null||typeof v.accountId==='string'&&/^[0-9]{5,32}$/.test(v.accountId))||!(v.currency===null||typeof v.currency==='string'&&/^[A-Z]{3}$/.test(v.currency))||!(v.timeZone===null||typeof v.timeZone==='string'&&v.timeZone.length>0&&v.timeZone.length<=128))return null;
 const run=parseRun(v.latestRun);if(v.latestRun!==null&&!run)return null;
 return Object.freeze({connectionId:v.connectionId,status:v.status as MetaConnection['status'],connectedAt:v.connectedAt as string|null,disconnectedAt:v.disconnectedAt as string|null,tokenExpiresAt:v.tokenExpiresAt as string|null,accountId:v.accountId as string|null,currency:v.currency as string|null,timeZone:v.timeZone as string|null,latestRun:run});
}
function parseStatus(v:unknown):MetaStatus{
 if(!plain(v)||Object.keys(v).sort().join(',')!=='connections,status'||v.status!=='available'||!Array.isArray(v.connections)||v.connections.length>100)throw unavailable();
 const connections=v.connections.map(parseConnection);if(connections.some(x=>!x)||new Set(connections.map(x=>x!.connectionId)).size!==connections.length)throw unavailable();
 return Object.freeze({connections:Object.freeze(connections as MetaConnection[])});
}
async function postResult(path:string,storeId:string,body:Record<string,string>,deps:Dependencies={}){
 const value=await request(path,storeId,'POST',body,undefined,deps);if(!plain(value))throw unavailable();return value;
}
export async function fetchMetaAdsStatus(storeId:string,signal?:AbortSignal,deps:Dependencies={}):Promise<MetaStatus>{return parseStatus(await request('/api/meta-ads/status',storeId,'GET',undefined,signal,deps));}
export async function startMetaAdsConnect(storeId:string,deps:Dependencies={}):Promise<string>{
 const value=await postResult('/api/meta-ads/connect',storeId,{},deps);if(Object.keys(value).join(',')!=='url'||typeof value.url!=='string')throw unavailable();
 let target:URL;try{target=new URL(value.url)}catch{throw unavailable()}
 if(target.origin!=='https://www.facebook.com'||!/^\/v\d+\.\d+\/dialog\/oauth$/.test(target.pathname)||target.searchParams.get('scope')!=='ads_read'||target.searchParams.get('response_type')!=='code')throw unavailable();
 return target.toString();
}
export async function fetchMetaAdSelection(storeId:string,signal?:AbortSignal,deps:Dependencies={}):Promise<Readonly<{accounts:readonly MetaAdAccount[];expiresAt:string}>>{
 const value=await request('/api/meta-ads/selection',storeId,'GET',undefined,signal,deps);
 if(!plain(value)||Object.keys(value).sort().join(',')!=='accounts,expiresAt,status'||value.status!=='selection_required'||!date(value.expiresAt)||!Array.isArray(value.accounts)||value.accounts.length<1||value.accounts.length>5000)throw unavailable();
 const accounts=value.accounts.map(parseAccount);if(accounts.some(x=>!x)||new Set(accounts.map(x=>x!.accountId)).size!==accounts.length)throw unavailable();
 return Object.freeze({accounts:Object.freeze(accounts as MetaAdAccount[]),expiresAt:value.expiresAt});
}
export async function selectMetaAdAccount(storeId:string,accountId:string,deps:Dependencies={}):Promise<void>{
 if(!/^[0-9]{5,32}$/.test(accountId))throw unavailable();const value=await postResult('/api/meta-ads/select-account',storeId,{accountId},deps);
 if(Object.keys(value).sort().join(',')!=='accountId,connectedAt,currency,status,timeZone'||value.status!=='connected'||value.accountId!==accountId||typeof value.currency!=='string'||!/^[A-Z]{3}$/.test(value.currency)||typeof value.timeZone!=='string'||!date(value.connectedAt))throw unavailable();
}
export async function cancelMetaAdSelection(storeId:string,deps:Dependencies={}):Promise<void>{
 const value=await postResult('/api/meta-ads/selection/cancel',storeId,{},deps);if(Object.keys(value).sort().join(',')!=='status'||value.status!=='cancelled')throw unavailable();
}
export async function disconnectMetaAds(storeId:string,connectionId:string,deps:Dependencies={}):Promise<void>{
 if(!uuid(connectionId))throw unavailable();const value=await postResult('/api/meta-ads/disconnect',storeId,{connectionId},deps);if(Object.keys(value).sort().join(',')!=='status'||value.status!=='disconnected')throw unavailable();
}
