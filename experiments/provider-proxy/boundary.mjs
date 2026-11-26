/** Pure, unregistered proxy boundary. No environment, URL target, socket or fetch.
 * The fixed private service is pinned; runtime enablement remains explicit and default-off. */
export const WEBSITE_ORIGIN='https://night-scout-xero-staging.onrender.com';
export const PINNED_PRIVATE_PROVIDER_ORIGIN='http://night-scout-provider-api-staging:10000';
export const APPROVED_PRIVATE_ORIGINS=Object.freeze([PINNED_PRIVATE_PROVIDER_ORIGIN]);
export const providerProxyActivation=()=>Object.freeze({enabled:false,reason:'explicit_runtime_enablement_required'});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const opaque=/^[A-Za-z0-9_-]{43}$/;
const fail=()=>{throw Error('Provider proxy unavailable');};
const bytes=s=>Buffer.byteLength(s,'utf8');
const plain=x=>x&&typeof x==='object'&&Object.getPrototypeOf(x)===Object.prototype&&Reflect.ownKeys(x).length===Object.keys(x).length&&Object.values(Object.getOwnPropertyDescriptors(x)).every(d=>'value'in d);
const exact=(x,keys)=>plain(x)&&Object.keys(x).sort().join(',')===keys.split(',').sort().join(',');
function header(headers,name){if(!plain(headers))fail();const keys=Object.keys(headers).filter(k=>k.toLowerCase()===name);if(keys.length>1)fail();const v=keys.length?headers[keys[0]]:undefined;if(v!==undefined&&(typeof v!=='string'||/[\r\n\0]/.test(v)))fail();return v;}
function flatJson(text){if(typeof text!=='string'||bytes(text)>8192)fail();let value;try{value=JSON.parse(text);}catch{fail();}if(!plain(value)||Object.values(value).some(v=>v!==null&&typeof v!=='string'))fail();const tokens=text.match(/"(?:[^"\\]|\\.)*"|null|[{}:,]/g);if(!tokens||tokens[0]!=='{'||tokens.at(-1)!=='}')fail();const names=new Set();for(let i=1;i<tokens.length-1;i+=4){if(tokens[i+1]!==':'||i+3<tokens.length-1&&tokens[i+3]!==',')fail();let k;try{k=JSON.parse(tokens[i]);}catch{fail();}if(names.has(k))fail();names.add(k);}if(names.size!==Object.keys(value).length)fail();return value;}
export function prepareProviderProxyRequest({method,rawPath,headers={},body=''}={}){
 if(typeof rawPath!=='string'||bytes(rawPath)>8192||/[\r\n\0#]/.test(rawPath)||!['GET','POST'].includes(method))fail();
 const [path,queryText='']=rawPath.split('?');if(rawPath.split('?').length>2)fail();
 const match=/^\/api\/(meta-ads|google-ads)\/(connect|callback|selection|status|select-account|selection\/cancel|disconnect|account-selections)$/.exec(path);if(!match)fail();
 const [,provider,action]=match,isMeta=provider==='meta-ads';
 if((!isMeta&&['selection','selection/cancel'].includes(action))||(isMeta&&action==='account-selections'))fail();
 const get=['callback','selection','status','account-selections'].includes(action);if(method!==(get?'GET':'POST')||get&&body!=='')fail();
 const q=new URLSearchParams(queryText);if([...q.keys()].some((k,i,a)=>a.indexOf(k)!==i))fail();
 const forwarded={accept:'application/json'};let requestBody;
 if(action==='callback'){
  const allowed=['code','error','error_code','error_description','error_reason','error_subcode','error_type','state'];
  if([...q.keys()].some(k=>!allowed.includes(k))||![...q.values()].every(v=>v.length<=4096&&!/[\r\n\0]/.test(v))||!(isMeta?/^[A-Za-z0-9_-]{32,512}$/:opaque).test(q.get('state')??''))fail();
  const denied=[...q.keys()].some(k=>k.startsWith('error'));
  if(!denied&&!(isMeta?/^[A-Za-z0-9._~-]{8,4096}$/:/^[A-Za-z0-9._~+\-/=]{8,4096}$/).test(q.get('code')??''))fail();
 }else{
  const auth=header(headers,'authorization');if(typeof auth!=='string'||bytes(auth)>8192||!/^Bearer [^\s,]+$/i.test(auth))fail();forwarded.authorization=auth;
  if(get){if([...q.keys()].join(',')!=='storeId'||!uuid.test(q.get('storeId')??''))fail();}
  else{
   if(queryText||header(headers,'origin')!==WEBSITE_ORIGIN||!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(header(headers,'content-type')??''))fail();
   const v=flatJson(body);let keys='storeId';if(action==='select-account')keys=isMeta?'storeId,accountId':Object.hasOwn(v,'loginCustomerId')?'storeId,customerId,loginCustomerId':'storeId,customerId';if(action==='disconnect')keys='storeId,connectionId';
   if(!exact(v,keys)||!uuid.test(v.storeId??''))fail();if(action==='disconnect'&&!uuid.test(v.connectionId??''))fail();if(action==='select-account'&&(isMeta?!/^\d{5,32}$/.test(v.accountId??''):!/^\d{10}$/.test(v.customerId??'')||!(v.loginCustomerId===undefined||v.loginCustomerId===null||/^\d{10}$/.test(v.loginCustomerId))))fail();
   requestBody=JSON.stringify(v);forwarded.origin=WEBSITE_ORIGIN;forwarded['content-type']='application/json';
  }
  const cookies=header(headers,'cookie');if(cookies!==undefined){if(bytes(cookies)>16384)fail();const name=isMeta?'ns_meta_ads_selection':'ns_google_ads_selection';const found=cookies.split(';').map(v=>v.trim()).filter(v=>v.slice(0,v.indexOf('='))===name);if(found.length>1)fail();if(found.length){const value=found[0].slice(name.length+1);if(!opaque.test(value))fail();forwarded.cookie=name+'='+value;}}
 }
 return Object.freeze({provider,action,method,path:path+(queryText?'?'+q.toString():''),headers:Object.freeze(forwarded),...(requestBody?{body:requestBody}:{}),redirect:'manual',timeoutMs:15000,maxResponseBytes:1048576});
}
const responseHeaders=Object.freeze({'Cache-Control':'no-store, private','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Type':'application/json'});
function selectionCookie(value,provider){if(typeof value!=='string'||bytes(value)>512)fail();const name=provider==='meta-ads'?'ns_meta_ads_selection':'ns_google_ads_selection',path='/api/'+provider;const set=new RegExp('^'+name+'=[A-Za-z0-9_-]{43}; Max-Age=900; Path='+path+'; HttpOnly; Secure; SameSite=Lax$');const clear=name+'=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path='+path+'; HttpOnly; Secure; SameSite=Lax';if(!set.test(value)&&value!==clear)fail();return value;}
const fields=new Set('status,url,accounts,expiresAt,accountId,currency,timeZone,connectedAt,connections,connectionId,disconnectedAt,tokenExpiresAt,latestRun,runId,from,to,startedAt,finishedAt,safeFailure,pagesRead,provider,customerId,loginCustomerId,oauthAppPublishingStatus,reauthorizeBy,lastCollectedThrough,updatedAt'.split(','));
function safeJson(value,depth=0){if(depth>6)fail();if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return;if(typeof value==='string'){if(value.length>8192||/[\r\n\0]/.test(value))fail();return;}if(Array.isArray(value)){if(value.length>5000)fail();value.forEach(v=>safeJson(v,depth+1));return;}if(!plain(value)||Object.keys(value).some(k=>!fields.has(k)))fail();Object.values(value).forEach(v=>safeJson(v,depth+1));}
export function projectProviderProxyResponse(request,{status,headers={},body=''}={}){
 if(!request||!['meta-ads','google-ads'].includes(request.provider))fail();const out={...responseHeaders};
 const cookie=header(headers,'set-cookie');if(cookie!==undefined){if(!['callback','selection','account-selections','select-account','selection/cancel','disconnect'].includes(request.action))fail();out['Set-Cookie']=selectionCookie(cookie,request.provider);}
 if(status===303){const location=header(headers,'location');const allowed=request.provider==='meta-ads'?['/settings?metaConnect=cancelled','/settings?metaSelection=select']:['/settings?googleAds=cancelled','/settings?googleAds=select'];if(request.action!=='callback'||!allowed.includes(location))fail();return Object.freeze({status:303,headers:Object.freeze({...out,Location:location}),body:''});}
 if(status!==200){if(![400,401,403,404,409,413,429,500,502,503,504].includes(status))status=502;return Object.freeze({status,headers:Object.freeze(out),body:JSON.stringify({error:'Provider connection unavailable'})});}
 if(request.action==='callback'||typeof body!=='string'||bytes(body)>1048576||!(header(headers,'content-type')??'').toLowerCase().startsWith('application/json'))fail();let data;try{data=JSON.parse(body);}catch{fail();}safeJson(data);
 const keys=request.action==='connect'?'url':request.action==='disconnect'||request.action==='selection/cancel'?'status':request.action==='status'?(request.provider==='meta-ads'?'status,connections':'provider,connections'):request.action==='select-account'?(request.provider==='meta-ads'?'status,accountId,currency,timeZone,connectedAt':'status,customerId,loginCustomerId,currency,timeZone,connectedAt'):'status,accounts,expiresAt';if(!exact(data,keys))fail();
 return Object.freeze({status:200,headers:Object.freeze(out),body:JSON.stringify(data)});
}
