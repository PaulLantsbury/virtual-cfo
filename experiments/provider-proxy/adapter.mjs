import {APPROVED_PRIVATE_ORIGINS,prepareProviderProxyRequest,projectProviderProxyResponse} from './boundary.mjs';
const unavailable={error:'Provider connection unavailable'};
const fail=()=>Error('Provider proxy unavailable');
function origin(value){try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.pathname!=='/'||u.search||u.hash||u.origin!==value)throw fail();return u.origin;}catch{throw fail();}}
function incomingHeaders(req){const seen=new Set();for(let i=0;i<(req.rawHeaders?.length??0);i+=2){const k=req.rawHeaders[i].toLowerCase();if(['authorization','origin','content-type','cookie','content-length','transfer-encoding'].includes(k)){if(seen.has(k))throw fail();seen.add(k);}}if(seen.has('content-length')&&seen.has('transfer-encoding'))throw fail();return req.headers??{};}
export function readBody(req,signal,maxBytes=8192){return new Promise((resolve,reject)=>{let size=0;const chunks=[];const cleanup=()=>{req.removeListener('data',data);req.removeListener('end',end);req.removeListener('error',error);signal.removeEventListener('abort',aborted);};const error=()=>{cleanup();req.pause();reject(fail());};const aborted=()=>error();const data=chunk=>{const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=b.length;if(size>maxBytes)return error();chunks.push(b);};const end=()=>{cleanup();const raw=Buffer.concat(chunks);try{resolve(new TextDecoder('utf-8',{fatal:true}).decode(raw));}catch{reject(fail());}};if(signal.aborted)return error();req.on('data',data);req.once('end',end);req.once('error',error);signal.addEventListener('abort',aborted,{once:true});});}
export async function readResponse(response,signal,maxBytes=1048576){if(!response.body)return '';const reader=response.body.getReader();let size=0;const chunks=[];const abort=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});try{for(;;){if(signal.aborted)throw fail();const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw fail();}chunks.push(Buffer.from(value));}if(signal.aborted)throw fail();return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));}finally{signal.removeEventListener('abort',abort);reader.releaseLock();}}
/** Unregistered middleware. approvedOrigins is a reviewed source binding, never request/env data.
 * Default empty allowlist means enabled:true alone cannot activate forwarding.
 * transport/schedule are dependency injection for offline tests, not user-controlled fields. */
export function createProviderProxyAdapter({enabled=false,upstreamOrigin,approvedOrigins=APPROVED_PRIVATE_ORIGINS,transport=globalThis.fetch,schedule=(fn,ms)=>{const t=setTimeout(fn,ms);return()=>clearTimeout(t);}}={}){
 let target=null;if(enabled===true){if(!Array.isArray(approvedOrigins)||!approvedOrigins.includes(upstreamOrigin))throw fail();target=origin(upstreamOrigin);}
 return async function providerOwnerProxy(req,res){
  const headers={'Cache-Control':'no-store, private','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Type':'application/json'};
  const send=(status,body,extra={})=>{if(res.destroyed||res.writableEnded)return;res.writeHead(status,{...headers,...extra});res.end(typeof body==='string'?body:JSON.stringify(body));};
  if(!target){send(503,unavailable);return;}
  const controller=new AbortController(),signal=controller.signal;let rejectAbort;const aborted=new Promise((_,reject)=>{rejectAbort=reject;});
  const abort=()=>{controller.abort();rejectAbort(fail());};const closed=()=>{if(!res.writableEnded)abort();};req.once('aborted',abort);res.once('close',closed);
  const cancel=schedule(abort,15000);
  const execute=async()=>{
   const requestHeaders=incomingHeaders(req),length=requestHeaders['content-length'];if(length!==undefined&&(!/^\d+$/.test(length)||Number(length)>8192))throw fail();
   const body=await readBody(req,signal);const plan=prepareProviderProxyRequest({method:req.method,rawPath:req.originalUrl??req.url,headers:requestHeaders,body});
   if(signal.aborted)throw fail();const response=await transport(target+plan.path,{method:plan.method,headers:plan.headers,...(plan.body?{body:plan.body}:{}),redirect:'manual',signal});
   if(signal.aborted){void response.body?.cancel().catch(()=>{});throw fail();}
   const cookies=response.headers.getSetCookie?.()??(response.headers.get('set-cookie')?[response.headers.get('set-cookie')]:[]);if(cookies.length>1){void response.body?.cancel().catch(()=>{});throw fail();}
   const projectedHeaders={};for(const h of ['content-type','location']){const value=response.headers.get(h);if(value!==null)projectedHeaders[h]=value;}if(cookies.length)projectedHeaders['set-cookie']=cookies[0];
   const projected=projectProviderProxyResponse(plan,{status:response.status,headers:projectedHeaders,body:await readResponse(response,signal)});if(signal.aborted)throw fail();send(projected.status,projected.body,projected.headers);
  };
  try{await Promise.race([execute(),aborted]);}catch{controller.abort();send(503,unavailable,{Connection:'close'});}finally{cancel();req.removeListener('aborted',abort);res.removeListener('close',closed);}
 };
}
