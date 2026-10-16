import {Router,type IRouter} from 'express';
import {parseSavedXeroMapping} from '../../../../experiments/xero/saved-mapping-view.mjs';
export type SavedMappingIdentity=Readonly<{userId:string}>;
export type SavedMappingDependencies=Readonly<{authenticate?:(authorization:string)=>Promise<SavedMappingIdentity>;read?:(identity:SavedMappingIdentity,storeId:string)=>Promise<unknown>}>;
/** Prepared metadata-only reader; no confirmation/edit route or consent. */
export function createXeroSavedMappingRouter(deps:SavedMappingDependencies={}):IRouter{
 const router=Router();
 router.use('/saved-mapping',(_req,res,next)=>{res.set('Cache-Control','private, no-store');res.set('Vary','Authorization');res.set('Referrer-Policy','no-referrer');if(!deps.authenticate||!deps.read){res.status(503).json({error:'Saved Xero mapping unavailable'});return;}next();});
 router.get('/saved-mapping',async(req,res)=>{
  const authorization=req.headers.authorization;if(typeof authorization!=='string'||authorization.length>8192||!/^Bearer [^\s,]+$/i.test(authorization)){res.status(401).json({error:'Xero mapping sign-in required'});return;}
  const storeId=req.query.storeId;if(typeof storeId!=='string'||Object.keys(req.query).length!==1||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storeId)){res.status(400).json({error:'Invalid Xero mapping request'});return;}
  let identity:SavedMappingIdentity;try{identity=await deps.authenticate!(authorization);}catch{res.status(403).json({error:'Saved Xero mapping unavailable'});return;}
  try{const result=parseSavedXeroMapping(await deps.read!(identity,storeId),storeId);if(!result)throw Error('invalid');res.status(200).json(result);}catch{res.status(503).json({error:'Saved Xero mapping unavailable'});}
 });return router;
}
