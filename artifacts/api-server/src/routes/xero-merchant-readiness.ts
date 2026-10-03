import {Router,type IRouter} from 'express';

export type XeroReadinessIdentity=Readonly<{userId:string}>;
export type XeroReadinessAuthenticator=(authorization:string)=>Promise<XeroReadinessIdentity>;
export type XeroReadinessService=Readonly<{read(identity:XeroReadinessIdentity,storeId:string):Promise<unknown>}>;
export type XeroReadinessDependencies=Readonly<{authenticate?:XeroReadinessAuthenticator;service?:XeroReadinessService}>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bearer=(value:unknown):value is string=>typeof value==='string'&&value.length<=8192&&/^Bearer [^\s,]+$/i.test(value);

export function createXeroMerchantReadinessRouter(dependencies:XeroReadinessDependencies={}):IRouter{
 const router=Router(),{authenticate,service}=dependencies;
 router.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');res.set('Vary','Authorization');res.set('Referrer-Policy','no-referrer');if(!authenticate||!service){res.status(503).json({error:'Xero readiness unavailable'});return;}next();});
 router.get('/merchant-readiness',async(req,res)=>{
  if(!bearer(req.headers.authorization)){res.status(401).json({error:'Xero readiness sign-in required'});return;}
  const storeId=typeof req.query.storeId==='string'&&Object.keys(req.query).length===1&&uuid.test(req.query.storeId)?req.query.storeId:null;
  if(!storeId){res.status(400).json({error:'Xero readiness unavailable'});return;}
  try{const identity=await authenticate!(req.headers.authorization);const result=await service!.read(identity,storeId);res.status(200).json(result);}catch{res.status(403).json({error:'Xero readiness unavailable'});}
 });
 return router;
}
