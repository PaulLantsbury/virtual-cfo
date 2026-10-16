import {Router,type IRouter} from 'express';
import {parseXeroAccountingPeriod,validXeroScope,type XeroAccountingScope} from '../lib/xero-accounting-reader.ts';
export type XeroAccountingIdentity=Readonly<{userId:string}>;
export type XeroAccountingDependencies=Readonly<{authenticate?:(authorization:string)=>Promise<XeroAccountingIdentity>;read?:(identity:XeroAccountingIdentity,scope:XeroAccountingScope)=>Promise<unknown>}>;
/** Prepared, default-off route. Only the member-authorised RPC may provide amounts. */
export function createXeroAccountingRouter(deps:XeroAccountingDependencies={}):IRouter{
 const router=Router();
 router.use('/accounting-period',(_req,res,next)=>{res.set('Cache-Control','private, no-store');res.set('Vary','Authorization');res.set('Referrer-Policy','no-referrer');if(!deps.authenticate||!deps.read){res.status(503).json({error:'Xero accounting unavailable'});return;}next();});
 router.get('/accounting-period',async(req,res)=>{
  const authorization=req.headers.authorization;if(typeof authorization!=='string'||authorization.length>8192||!/^Bearer [^\s,]+$/i.test(authorization)){res.status(401).json({error:'Xero accounting sign-in required'});return;}
  const scope={...req.query};if(!validXeroScope(scope)){res.status(400).json({error:'Invalid Xero accounting period'});return;}
  let identity:XeroAccountingIdentity;try{identity=await deps.authenticate!(authorization);}catch{res.status(403).json({error:'Xero accounting unavailable'});return;}
  try{const result=parseXeroAccountingPeriod(await deps.read!(identity,scope),scope);if(!result)throw Error('invalid');res.status(200).json(result);}catch{res.status(503).json({error:'Xero accounting unavailable'});}
 });return router;
}
