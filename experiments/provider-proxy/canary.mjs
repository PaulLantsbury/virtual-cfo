// Exact fictional contract from backend 25353b2f83d47662d822033bc177d9556f4eb150.
// Never import the standalone credential-free diagnostic server into the website.
import {APPROVED_PRIVATE_ORIGINS} from './boundary.mjs';
import {readBody,readResponse} from './adapter.mjs';
export const CANARY_PATHS=Object.freeze(['/__night_scout_fictional_logging_canary__/capture','/__night_scout_fictional_logging_canary__/failure']);
const query='NIGHT_SCOUT_FICTIONAL_QUERY_SENTINEL',header='NIGHT_SCOUT_FICTIONAL_HEADER_SENTINEL',bodyMarker='NIGHT_SCOUT_FICTIONAL_BODY_SENTINEL',responseMarker='NIGHT_SCOUT_FICTIONAL_RESPONSE_SENTINEL';
const expectedBody=JSON.stringify({client_secret:bodyMarker,refresh_token:bodyMarker});
const fail=()=>Error('Fictional logging canary unavailable');
export function createCanaryProxy({enabled=false,expiresAt,upstreamOrigin,approvedOrigins=APPROVED_PRIVATE_ORIGINS,transport=globalThis.fetch,now=()=>Date.now()}={}){
 let end=0;
 if(enabled){
  const u=new URL(upstreamOrigin);if(!approvedOrigins.includes(upstreamOrigin)||u.origin!==upstreamOrigin||!['http:','https:'].includes(u.protocol)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw fail();
  end=Date.parse(expiresAt);if(typeof expiresAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(expiresAt)||!Number.isFinite(end)||new Date(end).toISOString()!==expiresAt||end<=now()||end-now()>900000)throw fail();
 }
 return async(req,res)=>{
  const send=(status,body)=>{if(!res.destroyed&&!res.writableEnded){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));}};
  if(!enabled||now()>=end){send(503,{unavailable:true});return;}
  const controller=new AbortController();let rejectAbort;
  const aborted=new Promise((_,reject)=>{rejectAbort=reject;});
  const abort=()=>{controller.abort();rejectAbort(fail());};const close=()=>{if(!res.writableEnded)abort();};
  const timer=setTimeout(abort,Math.min(5000,end-now()));req.once('aborted',abort);res.once('close',close);
  const execute=async()=>{
   const raw=req.originalUrl??req.url;const step=CANARY_PATHS.findIndex(p=>raw===p+'?code='+query+'&state='+query);
   if(req.method!=='POST'||step<0)throw fail();
   const seen=new Set();for(let i=0;i<(req.rawHeaders?.length??0);i+=2){const key=req.rawHeaders[i].toLowerCase();if(['authorization','x-provider-secret','content-type','content-length','transfer-encoding'].includes(key)){if(seen.has(key))throw fail();seen.add(key);}}
   if(seen.has('content-length')&&seen.has('transfer-encoding'))throw fail();
   const h=req.headers;if(h.authorization!=='Bearer '+header||h['x-provider-secret']!==header||h['content-type']!=='application/json')throw fail();
   if(h['content-length']!==undefined&&(!/^\d+$/.test(h['content-length'])||Number(h['content-length'])>1024))throw fail();
   if(await readBody(req,controller.signal,1024)!==expectedBody||controller.signal.aborted||now()>=end)throw fail();
   const response=await transport(upstreamOrigin+raw,{method:'POST',redirect:'manual',signal:controller.signal,headers:{authorization:'Bearer '+header,'x-provider-secret':header,'content-type':'application/json'},body:expectedBody});
   if(controller.signal.aborted){void response.body?.cancel().catch(()=>{});throw fail();}
   const text=await readResponse(response,controller.signal,1024);
   const expected=step===0?{fictional:true,marker:responseMarker}:{unavailable:true,marker:responseMarker};
   if(response.status!==(step===0?200:503)||response.headers.get('cache-control')!=='no-store'||text!==JSON.stringify(expected)||controller.signal.aborted||now()>=end)throw fail();
   send(response.status,expected);
  };
  try{await Promise.race([execute(),aborted]);}catch{controller.abort();send(503,{unavailable:true});}finally{clearTimeout(timer);req.removeListener('aborted',abort);res.removeListener('close',close);}
 };
}
