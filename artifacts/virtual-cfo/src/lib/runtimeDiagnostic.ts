/** Temporary read-only diagnostic client. Tokens remain inside the authenticated request. */
export type DiagnosticScope={storeId:string;from:string;to:string};
export const RUNTIME_DIAGNOSTIC_WINDOW={opensAt:'2026-11-21T16:00:00Z',expiresAt:'2026-11-21T18:00:00Z'} as const;
const labels={loginMatches:'Reporting login matches',serviceMatches:'Reporting service matches',databaseMatches:'Database matches',loginRestricted:'Login restrictions match',serviceRestricted:'Service restrictions match',transactionReadOnly:'Transaction is read only',transactionRepeatableRead:'Transaction snapshot is consistent',targetProjectAttested:'Configured project matches'};
export type RuntimeDiagnostic={state:'observed'|'unavailable';revision:string;checks:{label:string;value:boolean}[]};
export function parseRuntimeDiagnostic(raw:unknown):RuntimeDiagnostic{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Runtime response could not be verified.');
 const r=raw as Record<string,unknown>;
 if(r.contract!=='customer-runtime-attestation-v1'||typeof r.state!=='string'||!['observed','unavailable'].includes(r.state)||typeof r.revision!=='string'||!/^[a-f0-9]{40}$/.test(r.revision)||!Object.keys(labels).every(k=>typeof r[k]==='boolean'))throw Error('Runtime response could not be verified.');
 return {state:r.state as RuntimeDiagnostic['state'],revision:r.revision,checks:Object.entries(labels).map(([key,label])=>({label,value:r[key] as boolean}))};
}
export function diagnosticScopeAvailable(scope:DiagnosticScope,now=new Date()){
 if(!scope||typeof scope!=='object'||Array.isArray(scope)||Object.getPrototypeOf(scope)!==Object.prototype||Object.keys(scope).sort().join(',')!=='from,storeId,to'||typeof scope.storeId!=='string'||typeof scope.from!=='string'||typeof scope.to!=='string')return false;
 const time=+now;
 if(!Number.isFinite(time)||time<Date.parse(RUNTIME_DIAGNOSTIC_WINDOW.opensAt)||time>=Date.parse(RUNTIME_DIAGNOSTIC_WINDOW.expiresAt))return false;
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(scope.storeId)||!/^\d{4}-\d{2}-01$/.test(scope.from)||!Number.isFinite(Date.parse(scope.from+'T12:00:00Z'))||new Date(scope.from+'T12:00:00Z').toISOString().slice(0,10)!==scope.from)return false;
 const end=new Date(Date.UTC(+scope.from.slice(0,4),+scope.from.slice(5,7),0)).toISOString().slice(0,10);
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now),today=['year','month','day'].map(k=>parts.find(p=>p.type===k)!.value).join('-');
 return scope.to===end&&scope.to<today;
}
type SessionResult={data:{session:{access_token:string;user:{id:string}}|null};error:unknown};
function aborted(){return new DOMException('Runtime check cancelled.','AbortError');}
function abortable<T>(work:Promise<T>,signal:AbortSignal):Promise<T>{
 if(signal.aborted)return Promise.reject(aborted());
 return new Promise((resolve,reject)=>{const stop=()=>reject(aborted());signal.addEventListener('abort',stop,{once:true});work.then(v=>{signal.removeEventListener('abort',stop);signal.aborted?reject(aborted()):resolve(v);},()=>{signal.removeEventListener('abort',stop);reject(signal.aborted?aborted():Error('Runtime check is unavailable.'));});});
}
async function requestRuntimeDiagnosticInternal({scope,userId,signal,getSession,fetchImpl=fetch,now=()=>new Date(),onDispatch}:{scope:DiagnosticScope;userId:string|null;signal:AbortSignal;getSession:()=>Promise<SessionResult>;fetchImpl?:typeof fetch;now?:()=>Date;onDispatch?:()=>void}):Promise<RuntimeDiagnostic>{
 if(!diagnosticScopeAvailable(scope,now()))throw Error('The temporary runtime check is unavailable, expired or already used. No configuration change was requested.');
 const requested={storeId:scope.storeId,from:scope.from,to:scope.to};
 if(!userId||signal.aborted)throw aborted();
 const session=await abortable(getSession(),signal);
 if(!diagnosticScopeAvailable(requested,now()))throw Error('The temporary runtime check is unavailable, expired or already used. No configuration change was requested.');
 if(session.error||!session.data.session?.access_token||session.data.session.user.id!==userId)throw Error('Sign in again before checking runtime configuration.');
 let response:Response;
 try{if(signal.aborted)throw aborted();onDispatch?.();response=await abortable(fetchImpl('/api/financial-reviews/prepare',{method:'POST',redirect:'error',cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.data.session.access_token}`},body:JSON.stringify({scope:requested,runtimeAttestation:true}),signal}),signal);}catch{if(signal.aborted)throw aborted();throw Error('Runtime check is unavailable. No configuration change was requested.');}
 if(response.status===401)throw Error('Sign in again before checking runtime configuration.');
 if(response.status===403)throw Error('This account is not authorised for the operator runtime check. Store membership alone does not grant permission.');
 if(!response.ok)throw Error('The temporary runtime check is unavailable, expired or already used. No configuration change was requested.');
 const reader=response.body?.getReader();let text='';let bytes=0;const decoder=new TextDecoder();
 if(!reader)throw Error('Runtime response could not be verified.');
 try{for(;;){const {done,value}=await abortable(reader.read(),signal);if(done)break;bytes+=value.byteLength;if(bytes>8192)throw Error('Runtime response could not be verified.');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
 let raw:unknown;try{raw=JSON.parse(text);}catch{throw Error('Runtime response could not be verified.');}
 if(!diagnosticScopeAvailable(requested,now()))throw Error('The temporary runtime check is unavailable, expired or already used. No configuration change was requested.');
 return parseRuntimeDiagnostic(raw);
}

const publicDiagnosticMessages=new Set(['Runtime response could not be verified.','Sign in again before checking runtime configuration.','Runtime check is unavailable.','Runtime check is unavailable. No configuration change was requested.','This account is not authorised for the operator runtime check. Store membership alone does not grant permission.','The temporary runtime check is unavailable, expired or already used. No configuration change was requested.']);
export async function requestRuntimeDiagnostic(options:Parameters<typeof requestRuntimeDiagnosticInternal>[0]):Promise<RuntimeDiagnostic>{
 try{return await requestRuntimeDiagnosticInternal(options);}catch(error){if(options.signal.aborted)throw aborted();throw Error(error instanceof Error&&publicDiagnosticMessages.has(error.message)?error.message:'Runtime check is unavailable.');}
}
