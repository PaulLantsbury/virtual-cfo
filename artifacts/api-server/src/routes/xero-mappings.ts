import {Router, json, type ErrorRequestHandler, type IRouter} from 'express';

/**
 * Deliberately separate from the local read-only Xero proof routes.  Server
 * composition must inject both dependencies; importing this router alone
 * exposes no merchant mapping capability.
 */
export type XeroMappingCommand={storeId:string;connectionId:string;effectiveFrom:string;mapping:Record<string,unknown>};
export type XeroMappingRead={storeId:string;connectionId:string;asOf?:string};
/** Role is derived by trusted server code.  The browser never supplies it. */
export type XeroMappingIdentity={userId:string;isOwner:boolean};
export type XeroMappingService={
 readCurrentMapping(identity:XeroMappingIdentity,request:XeroMappingRead):Promise<unknown>|unknown;
 confirmMapping(identity:XeroMappingIdentity,command:XeroMappingCommand):Promise<unknown>|unknown;
};
export type XeroMappingAuthenticator=(authorization:string)=>Promise<XeroMappingIdentity>|XeroMappingIdentity;
export type XeroMappingRouterDependencies={service?:XeroMappingService;authenticate?:XeroMappingAuthenticator};

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const plain=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const exact=(value:Record<string,unknown>,allowed:string[])=>Object.keys(value).length===allowed.length&&Object.keys(value).every(key=>allowed.includes(key));
const day=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))&&new Date(`${value}T00:00:00.000Z`).toISOString().slice(0,10)===value;
const bearer=(value:unknown):value is string=>typeof value==='string'&&value.length<=8192&&/^Bearer [^\s,]+$/i.test(value);
function readRequest(value:unknown):XeroMappingRead|null{
 // Express supplies a null-prototype query object.  It is still treated as a
 // strict scalar record: repeated parameters become arrays and are rejected.
 if(value===null||typeof value!=='object'||Array.isArray(value))return null;
 const query=value as Record<string,unknown>;
 if(!exact(query,Object.prototype.hasOwnProperty.call(query,'asOf')?['storeId','connectionId','asOf']:['storeId','connectionId']))return null;
 return typeof query.storeId==='string'&&uuid.test(query.storeId)&&typeof query.connectionId==='string'&&uuid.test(query.connectionId)&&(!('asOf' in query)||day(query.asOf))?{storeId:query.storeId,connectionId:query.connectionId,...(typeof query.asOf==='string'?{asOf:query.asOf}:{})}:null;
}
function command(value:unknown):XeroMappingCommand|null{
 if(!plain(value)||!exact(value,['storeId','connectionId','effectiveFrom','mapping']))return null;
 return typeof value.storeId==='string'&&uuid.test(value.storeId)&&typeof value.connectionId==='string'&&uuid.test(value.connectionId)&&day(value.effectiveFrom)&&plain(value.mapping)?{storeId:value.storeId,connectionId:value.connectionId,effectiveFrom:value.effectiveFrom,mapping:value.mapping}:null;
}
function safeFailure(error:unknown,res:{status:(status:number)=>{json:(value:unknown)=>void}}){
 const message=error instanceof Error?error.message:'';
 if(['Sign-in required','Mapping sign-in could not be verified'].includes(message)){res.status(401).json({error:'Mapping sign-in could not be verified'});return;}
 if(message==='Mapping access unavailable'){res.status(403).json({error:'Mapping access unavailable'});return;}
 if(message==='Xero connection unavailable'){res.status(404).json({error:'Xero mapping unavailable'});return;}
 if(['Xero directory review required','Xero mapping review required','Xero mapping changed'].includes(message)){res.status(409).json({error:'Mapping review required'});return;}
 res.status(503).json({error:'Xero mapping is temporarily unavailable'});
}

/** Disabled by default.  It must be mounted explicitly by trusted server code. */
export function createXeroMappingRouter(dependencies:XeroMappingRouterDependencies={}):IRouter{
 const router=Router();
 const {service,authenticate}=dependencies;
 router.use((_req,res,next)=>{res.set('Cache-Control','no-store');if(!service||!authenticate){res.status(503).json({error:'Xero mapping is not configured'});return;}next();});
 router.use(json({limit:'16kb',strict:true,type:'application/json'}));
 const identity=async(authorization:unknown):Promise<XeroMappingIdentity|null>=>{
  if(!bearer(authorization))return null;
  try{const result=await authenticate!(authorization);return plain(result)&&typeof result.userId==='string'&&result.userId.trim().length>0&&result.userId.length<=256&&typeof result.isOwner==='boolean'?{userId:result.userId,isOwner:result.isOwner}:null;}catch{return null;}
 };
 router.get('/current',async(req,res)=>{
  const request=readRequest(req.query);if(!request){res.status(400).json({error:'Invalid mapping request'});return;}
  const user=await identity(req.headers.authorization);if(!user){res.status(401).json({error:'Mapping sign-in required'});return;}
  try{const result=await service!.readCurrentMapping(user,request);if(result===null){res.status(404).json({error:'Xero mapping unavailable'});return;}res.status(200).json(result);}catch(error){safeFailure(error,res);}
 });
 router.post('/confirm',async(req,res)=>{
  if(!req.is('application/json')){res.status(415).json({error:'JSON request required'});return;}
  const request=command(req.body);if(!request){res.status(400).json({error:'Invalid mapping request'});return;}
  const user=await identity(req.headers.authorization);if(!user){res.status(401).json({error:'Mapping sign-in required'});return;}
  if(!user.isOwner){res.status(403).json({error:'Mapping access unavailable'});return;}
  try{res.status(200).json(await service!.confirmMapping(user,request));}catch(error){safeFailure(error,res);}
 });
 const parserErrors:ErrorRequestHandler=(error,_req,res,_next)=>res.status(error?.type==='entity.too.large'?413:400).json({error:error?.type==='entity.too.large'?'Mapping request is too large':'Invalid JSON request'});
 router.use(parserErrors);
 return router;
}
