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
 start(identity:XeroBootstrapIdentity):Promise<Readonly<{url:string}>>|Readonly<{url:string}>;
 complete(input:Readonly<{state:string;code:string}>):Promise<unknown>|unknown;
}>;
export type XeroBootstrapRouterDependencies=Readonly<{service?:XeroBootstrapService;authenticate?:XeroBootstrapAuthenticator}>;
const bearer=(value:unknown):value is string=>typeof value==='string'&&value.length<=8192&&/^Bearer [^\s,]+$/i.test(value);
const plain=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const state=(value:unknown):value is string=>typeof value==='string'&&value.length>=16&&value.length<=4096&&/^[A-Za-z0-9._~-]+$/.test(value);
const code=(value:unknown):value is string=>typeof value==='string'&&value.length>=8&&value.length<=4096&&/^[A-Za-z0-9._~-]+$/.test(value);
function identity(value:unknown):XeroBootstrapIdentity|null{return plain(value)&&typeof value.userId==='string'&&value.userId.length>0&&value.userId.length<=256&&typeof value.isOwner==='boolean'?Object.freeze({userId:value.userId,isOwner:value.isOwner}):null;}
function safe(error:unknown,res:any){
 const message=error instanceof Error?error.message:'';
 if(message==='Xero bootstrap sign-in required')return res.status(401).json({error:message});
 if(message==='Xero bootstrap owner required')return res.status(403).json({error:'Xero bootstrap owner required'});
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
 router.get('/connect',async(req,res)=>{
  const principal=await owner(req.headers.authorization);if(!principal){res.status(401).json({error:'Xero bootstrap sign-in required'});return;}
  try { const result=await service!.start(principal);if(typeof result?.url!=='string'||result.url.length>8192||!result.url.startsWith('https://login.xero.com/'))throw Error('Xero bootstrap unavailable');res.status(200).json({url:result.url}); } catch(error){safe(error,res);}
 });
 router.get('/callback',async(req,res)=>{
  const query=req.query as Record<string,unknown>;
  const input=query!==null&&typeof query==='object'&&!Array.isArray(query)&&Object.keys(query).length===2&&state(query.state)&&code(query.code)?{state:query.state,code:query.code}:null;
  if(!input){res.status(400).type('text/plain').send('Xero authorisation unavailable');return;}
  try { const result=await service!.complete(Object.freeze(input));res.status(200).type('text/plain').send((result as any)?.status==='connected'?'Xero connected. You can close this window.':'Xero staging connection unavailable'); } catch(error){safe(error,res);}
 });
 const parserErrors:ErrorRequestHandler=(error,_req,res,_next)=>res.status(error?.type==='entity.too.large'?413:400).json({error:error?.type==='entity.too.large'?'Xero authorisation unavailable':'Invalid JSON request'});
 router.use(parserErrors);
 return router;
}
