import {Router,type IRouter} from 'express';
import {validProfitScope} from '../../../../experiments/financial-v1/profit-reporting-service.mjs';
export type ProfitScope={storeId:string;from:string;to:string;currency:string};
export type ProfitReportingService={read(scope:ProfitScope,authorization:string):Promise<unknown>};
/** Optional trusted composition; never initializes a database from HTTP input. */
export function createProfitReportingRouter(service?:ProfitReportingService):IRouter{
 const router=Router();
 router.get('/',async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!service){res.status(503).json({error:'Profit reporting is not configured'});return;}
  const authorization=req.headers.authorization;
  if(typeof authorization!=='string'||authorization.length>8192||!/^Bearer [^\s,]+$/i.test(authorization)){res.status(401).json({error:'Sign-in required'});return;}
  if(!validProfitScope(req.query)){res.status(400).json({error:'Select one complete calendar month and a supported currency'});return;}
  try{res.status(200).json(await service.read(req.query as ProfitScope,authorization));}
  catch(error){
   const message=(error as {message?:string})?.message;
   if(message==='Reviewer sign-in required'||message==='Reviewer sign-in could not be verified'){res.status(401).json({error:'Sign-in could not be verified'});return;}
   if(message==='Profit store membership required'){res.status(403).json({error:'Store access unavailable'});return;}
   res.status(503).json({error:'Profit reporting is currently unavailable'});
  }
 });return router;
}
