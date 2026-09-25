import {Router, json, type ErrorRequestHandler, type IRouter} from 'express';

/**
 * Staging-only owner consent boundary.  It is intentionally separate from the
 * local proof route: browser input can carry an OAuth code/state only; the
 * authenticated owner, store, expected tenant, mapping and persistence ports
 * are all server-derived by the injected service.
 */
export type XeroBootstrapIdentity=Readonly<{userId:string;isOwner:boolean}>;
export type XeroBootstrapAuthenticator=(authorization:string)=>Promise<XeroBootstrapIdentity>|XeroBootstrapIdentity;
export type XeroBootstrapService=Readonly<{
 start(identity:XeroBootstrapIdentity,input:Readonly<{selectionHandle:string;effectiveFrom:string;mapping:Record<string,readonly string[]>}>):Promise<Readonly<{url:string}>>|Readonly<{url:string}>;
 startDiscovery(identity:XeroBootstrapIdentity):Promise<Readonly<{url:string}>>|Readonly<{url:string}>;
 complete(input:Readonly<{state:string;code:string;scope?:string}>):Promise<unknown>|unknown;
 readDiscovery(identity:XeroBootstrapIdentity,handle:string):Promise<unknown>|unknown;
}>;
export type XeroBootstrapRouterDependencies=Readonly<{service?:XeroBootstrapService;authenticate?:XeroBootstrapAuthenticator}>;
const bearer=(value:unknown):value is string=>typeof value==='string'&&value.length<=8192&&/^Bearer [^\s,]+$/i.test(value);
const plain=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const state=(value:unknown):value is string=>typeof value==='string'&&value.length>=16&&value.length<=4096&&/^[A-Za-z0-9._~-]+$/.test(value);
const code=(value:unknown):value is string=>typeof value==='string'&&value.length>=8&&value.length<=4096&&/^[A-Za-z0-9._~-]+$/.test(value);
const scope=(value:unknown):value is string=>typeof value==='string'&&value.length>=1&&value.length<=2048&&/^[A-Za-z0-9._:-]+(?: [A-Za-z0-9._:-]+)*$/.test(value);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const categories=['revenue','processingFee','advertising','software','includedCash'] as const;
const origins=new Set(['https://night-scout-xero-staging.replit.app','https://night-scout-xero-staging.onrender.com']);
function day(value:unknown):value is string{if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))return false;const date=new Date(`${value}T00:00:00.000Z`);return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===value&&value>='2000-01-01'&&value<=new Date().toISOString().slice(0,10);}
function selectedMapping(value:unknown):Record<string,readonly string[]>|null{if(!plain(value)||Object.keys(value).sort().join(',')!==[...categories].sort().join(','))return null;const out:Record<string,readonly string[]>=Object.create(null),used=new Set<string>();for(const category of categories){const ids=value[category];if(!Array.isArray(ids)||ids.length<1||ids.length>20)return null;const selected:string[]=[];for(const id of ids){if(typeof id!=='string'||!uuid.test(id)||used.has(id))return null;used.add(id);selected.push(id);}out[category]=Object.freeze(selected);}return Object.freeze(out);}
const sameOrigin=(value:unknown)=>typeof value==='string'&&origins.has(value);
function identity(value:unknown):XeroBootstrapIdentity|null{return plain(value)&&typeof value.userId==='string'&&value.userId.length>0&&value.userId.length<=256&&typeof value.isOwner==='boolean'?Object.freeze({userId:value.userId,isOwner:value.isOwner}):null;}
function safe(error:unknown,res:any){
 const message=error instanceof Error?error.message:'';
 if(message==='Xero bootstrap sign-in required')return res.status(401).json({error:message});
 if(message==='Xero bootstrap owner required')return res.status(403).json({error:'Xero bootstrap owner required'});
 if(message==='Xero bootstrap selection expired')return res.status(409).json({error:'Xero mapping session expired. Discover Xero again.'});
 if(message==='Xero bootstrap unavailable')return res.status(503).json({error:'Xero staging connection unavailable'});
 return res.status(503).json({error:'Xero staging connection unavailable'});
}

/** Disabled unless a trusted host injects both authentication and the owner service. */
export function createXeroStagingBootstrapRouter(dependencies:XeroBootstrapRouterDependencies={}):IRouter{
 const router=Router(),{service,authenticate}=dependencies;
 router.use((_req,res,next)=>{res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');if(!service||!authenticate){res.status(503).json({error:'Xero staging connection unavailable'});return;}next();});
 router.use(json({limit:'12kb',strict:true,type:'application/json'}));
 const owner=async(authorization:unknown):Promise<XeroBootstrapIdentity|null>=>{
  if(!bearer(authorization))return null;
  try { const result=identity(await authenticate!(authorization));return result?.isOwner?result:null; } catch { return null; }
 };
 router.post('/connect',async(req,res)=>{
  if(!sameOrigin(req.headers.origin)){res.status(403).json({error:'Xero bootstrap owner required'});return;}
  const principal=await owner(req.headers.authorization);if(!principal){res.status(401).json({error:'Xero bootstrap sign-in required'});return;}
  const body=req.body,selected=plain(body)&&Object.keys(body).sort().join(',')==='effectiveFrom,mapping,selectionHandle'&&state(body.selectionHandle)&&day(body.effectiveFrom)?selectedMapping(body.mapping):null;
  if(!selected){res.status(400).json({error:'Xero staging connection unavailable'});return;}
  try { const result=await service!.start(principal,Object.freeze({selectionHandle:body.selectionHandle as string,effectiveFrom:body.effectiveFrom as string,mapping:selected}));if(typeof result?.url!=='string'||result.url.length>8192||!result.url.startsWith('https://login.xero.com/'))throw Error('Xero bootstrap unavailable');res.status(200).json({url:result.url}); } catch(error){safe(error,res);}
 });
 router.post('/discover',async(req,res)=>{
  if(!sameOrigin(req.headers.origin)){res.status(403).json({error:'Xero bootstrap owner required'});return;}
  const principal=await owner(req.headers.authorization);if(!principal){res.status(401).json({error:'Xero bootstrap sign-in required'});return;}
  try { const result=await service!.startDiscovery(principal);if(typeof result?.url!=='string'||result.url.length>8192||!result.url.startsWith('https://login.xero.com/'))throw Error('Xero bootstrap unavailable');res.status(200).json({url:result.url}); } catch(error){safe(error,res);}
 });
 router.get('/discovery/:handle',async(req,res)=>{
  const principal=await owner(req.headers.authorization);if(!principal){res.status(401).json({error:'Xero bootstrap sign-in required'});return;}
  if(!state(req.params.handle)){res.status(400).json({error:'Xero staging connection unavailable'});return;}
  try { res.status(200).json(await service!.readDiscovery(principal,req.params.handle)); } catch(error){safe(error,res);}
 });
 router.get('/callback',async(req,res)=>{
  const query=req.query as Record<string,unknown>;
  const keys=query!==null&&typeof query==='object'&&!Array.isArray(query)?Object.keys(query).sort():[];
  const shape=keys.join(',');
  const input=(shape==='code,state'||shape==='code,scope,state')&&state(query.state)&&code(query.code)&&(query.scope===undefined||scope(query.scope))?{state:query.state,code:query.code,...(query.scope===undefined?{}:{scope:query.scope})}:null;
  if(!input){res.status(400).type('text/plain').send('Xero authorisation unavailable');return;}
  try { const result:any=await service!.complete(Object.freeze(input));if(result?.status==='received'&&state(result?.handle)){res.redirect(303,`/settings?xeroDiscovery=${encodeURIComponent(result.handle)}`);return;}res.status(200).type('text/plain').send('Xero authorisation received. You can close this window.'); } catch(error){safe(error,res);}
 });
 const parserErrors:ErrorRequestHandler=(error,_req,res,_next)=>res.status(error?.type==='entity.too.large'?413:400).json({error:error?.type==='entity.too.large'?'Xero authorisation unavailable':'Invalid JSON request'});
 router.use(parserErrors);
 return router;
}
