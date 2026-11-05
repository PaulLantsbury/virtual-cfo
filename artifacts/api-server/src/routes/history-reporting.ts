import {Router,type IRouter} from 'express';
import {validProfitScope} from '../../../../experiments/financial-v1/profit-reporting-service.mjs';
const EDITION='synthetic-history-v2-2026-11';
export interface HistoryReportingService {
 read(scope:{storeId:string;currency:string;from:string;to:string},authorization:string,selection:{edition:string;versionId:string}):Promise<any>;
 available(scope:{storeId:string;currency:string},authorization:string):Promise<any>;
}
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const keys=(q:object,expected:string)=>Object.keys(q).sort().join(',')===expected;
/** Optional injected trusted reader only. HTTP never constructs a DB, policy, clock or credentials. */
export function createHistoryReportingRouter(service?:HistoryReportingService):IRouter{
 const router=Router();
 router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 router.get(['/','/months'],async(req,res)=>{
  if(!service){res.status(503).json({error:'History reporting is not configured'});return;}
  const auth=req.headers.authorization;
  if(typeof auth!=='string'||auth.length>8192||!/^Bearer [^\s,]+$/i.test(auth)){res.status(401).json({error:'Sign-in required'});return;}
  const q=req.query,list=req.path==='/months';
  if(q.edition!==EDITION){res.status(400).json({error:'Choose an available history edition'});return;}
  if(list?(!keys(q,'currency,edition,storeId')||!uuid(q.storeId)||q.currency!=='GBP'):(!keys(q,'currency,edition,from,storeId,to,versionId')||!uuid(q.versionId)||!validProfitScope({storeId:q.storeId,currency:q.currency,from:q.from,to:q.to}))){res.status(400).json({error:'Choose an exact history month and version'});return;}
  try{
   const result=list?await service.available({storeId:q.storeId as string,currency:q.currency as string},auth):await service.read({storeId:q.storeId as string,currency:q.currency as string,from:q.from as string,to:q.to as string},auth,{edition:EDITION,versionId:q.versionId as string});
   if(list){if(result?.verification!=='sealed-candidates-only'||result?.requiresReadValidation!==true||result?.contract!=='history-availability-v2'||result.edition!==EDITION||result.storeId!==q.storeId||result.currency!==q.currency){res.status(503).json({error:'History availability could not be verified'});return;}}
   else if(result?.state==='supported'&&(result.metadata?.edition!==EDITION||result.versionId!==q.versionId||result.scope?.storeId!==q.storeId||result.scope?.from!==q.from||result.scope?.to!==q.to||result.scope?.currency!==q.currency)){res.status(503).json({error:'History evidence does not match the selected version'});return;}
   res.status(200).json(result);
  }catch(error){
   const message=(error as Error)?.message??'';
   if(/sign-in|sign in/i.test(message)){res.status(401).json({error:'Sign-in could not be verified'});return;}
   if(message==='History store membership required'){res.status(403).json({error:'History evidence is not accessible for this store'});return;}
   res.status(503).json({error:'History evidence is currently unavailable'});
  }
 });return router;
}
