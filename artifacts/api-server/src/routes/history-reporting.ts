import {Router,type IRouter} from 'express';
import {validProfitScope} from '../../../../experiments/financial-v1/profit-reporting-service.mjs';
import {validHistoryRangeScope,requiredHistoryRangeMonths} from '../../../../experiments/synthetic-company/history-range-reader.mjs';
const EDITION='synthetic-history-v2-2026-11';
export interface HistoryReportingService {
 read(scope:{storeId:string;currency:string;from:string;to:string},authorization:string,selection:{edition:string;versionId:string}):Promise<any>;
 analyze?(scope:{storeId:string;currency:string;from:string;to:string},authorization:string,selection:{edition:string;versionId:string}):Promise<any>;
 available(scope:{storeId:string;currency:string},authorization:string):Promise<any>;
 range?(scope:{storeId:string;currency:string;from:string;to:string},authorization:string,selection:{edition:string;versions:{from:string;to:string;versionId:string}[]}):Promise<any>;
}
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const keys=(q:object,expected:string)=>Object.keys(q).sort().join(',')===expected;
/** Optional injected trusted reader only. HTTP never constructs a DB, policy, clock or credentials. */
export function createHistoryReportingRouter(service?:HistoryReportingService):IRouter{
 const router=Router();
 router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 router.get('/range',async(req,res)=>{
  if(!service?.range){res.status(503).json({error:'Range reporting is not configured'});return;}
  const auth=req.headers.authorization;
  if(typeof auth!=='string'||auth.length>8192||!/^Bearer [^\s,]+$/i.test(auth)){res.status(401).json({error:'Sign-in required'});return;}
  const q=req.query,scope={storeId:q.storeId as string,currency:q.currency as string,from:q.from as string,to:q.to as string};
  let versions:{from:string;to:string;versionId:string}[];
  try{
   if(!keys(q,'currency,edition,from,storeId,to,versions')||q.edition!==EDITION||!uuid(q.storeId)||!validHistoryRangeScope(scope)||typeof q.versions!=='string'||q.versions.length>8192)throw Error('Invalid range');
   versions=JSON.parse(q.versions);
   const expected=requiredHistoryRangeMonths(scope);
   if(!Array.isArray(versions)||!versions.length||versions.length>24||versions.length!==expected.length||versions.some((v,i)=>!v||!keys(v,'from,to,versionId')||!uuid(v.versionId)||v.from!==expected[i].from||v.to!==expected[i].to))throw Error('Invalid source versions');
  }catch{res.status(400).json({error:'Choose an exact date range and all constituent monthly sources'});return;}
  try{
   const result=await service.range(scope,auth,{edition:EDITION,versions});
   if(result?.state==='supported'&&(result.contract!=='history-range-v1'||result.scope?.storeId!==scope.storeId||result.scope?.currency!==scope.currency||result.scope?.from!==scope.from||result.scope?.to!==scope.to||result.metadata?.edition!==EDITION||!Array.isArray(result.versions)||result.versions.length!==versions.length||result.versions.some((v:any,i:number)=>v.from!==versions[i].from||v.to!==versions[i].to||v.versionId!==versions[i].versionId))){res.status(503).json({error:'Range evidence does not match the selected sources'});return;}
   res.json(result);
  }catch(error){
   const message=(error as Error)?.message??'';
   if(/sign-in|sign in/i.test(message)){res.status(401).json({error:'Sign-in could not be verified'});return;}
   if(message==='History store membership required'){res.status(403).json({error:'History evidence is not accessible for this store'});return;}
   res.status(503).json({error:'Range evidence is currently unavailable'});
  }
 });
 router.get(['/','/months','/analysis'],async(req,res)=>{
  if(!service||(req.path==='/analysis'&&!service.analyze)){res.status(503).json({error:'History reporting is not configured'});return;}
  const auth=req.headers.authorization;
  if(typeof auth!=='string'||auth.length>8192||!/^Bearer [^\s,]+$/i.test(auth)){res.status(401).json({error:'Sign-in required'});return;}
  const q=req.query,list=req.path==='/months';
  if(q.edition!==EDITION){res.status(400).json({error:'Choose an available history edition'});return;}
  if(list?(!keys(q,'currency,edition,storeId')||!uuid(q.storeId)||q.currency!=='GBP'):(!keys(q,'currency,edition,from,storeId,to,versionId')||!uuid(q.versionId)||!validProfitScope({storeId:q.storeId,currency:q.currency,from:q.from,to:q.to}))){res.status(400).json({error:'Choose an exact history month and version'});return;}
  try{
   const result=list?await service.available({storeId:q.storeId as string,currency:q.currency as string},auth):await (req.path==='/analysis'?service.analyze!.bind(service):service.read.bind(service))({storeId:q.storeId as string,currency:q.currency as string,from:q.from as string,to:q.to as string},auth,{edition:EDITION,versionId:q.versionId as string});
   if(req.path==='/analysis'){if(result?.contract!=='history-cfo-analysis-response-v1'||result.scope?.storeId!==q.storeId||result.scope?.currency!==q.currency||result.scope?.from!==q.from||result.scope?.to!==q.to||(result.current&&result.current.financialVersionId!==q.versionId)){res.status(503).json({error:'History analysis could not be verified'});return;}}
   else if(list){if(result?.verification!=='sealed-candidates-only'||result?.requiresReadValidation!==true||result?.contract!=='history-availability-v2'||result.edition!==EDITION||result.storeId!==q.storeId||result.currency!==q.currency){res.status(503).json({error:'History availability could not be verified'});return;}}
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
