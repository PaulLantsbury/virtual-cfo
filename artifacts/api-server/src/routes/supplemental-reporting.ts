import {Router,type IRouter} from 'express';
import {validProfitScope} from '../../../../experiments/financial-v1/profit-reporting-service.mjs';
export interface SupplementalReportingService {read(scope:{storeId:string;currency:string;from:string;to:string},authorization:string,selection:{edition:string;versionId:string},kind:'cash'|'acquisition'):Promise<any>}
const edition='synthetic-history-v2-2026-11';
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
/** Optional read-only trusted service. No browser chooses database credentials, roles or source payloads. */
export function createSupplementalReportingRouter(service?:SupplementalReportingService):IRouter{
 const router=Router();router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 router.get('/',async(req,res)=>{
  if(!service){res.status(503).json({error:'Additional reviewed evidence is not configured'});return;}
  const auth=req.headers.authorization,q=req.query;
  if(typeof auth!=='string'||auth.length>8192||!/^Bearer [^\s,]+$/i.test(auth)){res.status(401).json({error:'Sign-in required'});return;}
  if(Object.keys(q).sort().join(',')!=='currency,edition,from,kind,storeId,to,versionId'||q.edition!==edition||q.currency!=='GBP'||!uuid(q.versionId)||!['cash','acquisition'].includes(q.kind as string)||!validProfitScope({storeId:q.storeId,currency:q.currency,from:q.from,to:q.to})){res.status(400).json({error:'Choose an exact reviewed month and evidence kind'});return;}
  try{
   const result=await service.read({storeId:q.storeId as string,currency:q.currency as string,from:q.from as string,to:q.to as string},auth,{edition,versionId:q.versionId as string},q.kind as 'cash'|'acquisition');
   if(result?.state==='supported'&&(result.contract!=='reviewed-supplement-v1'||result.kind!==q.kind||result.financialVersionId!==q.versionId||result.scope?.storeId!==q.storeId||result.scope?.currency!==q.currency||result.scope?.timezone!=='Europe/London'||result.scope?.from!==q.from||result.scope?.to!==q.to)){res.status(503).json({error:'Additional evidence does not match this selection'});return;}
   res.status(200).json(result);
  }catch(e){const message=(e as Error)?.message??'';res.status(/sign.in/i.test(message)?401:/membership required/.test(message)?403:503).json({error:'Additional reviewed evidence is unavailable'});}
 });return router;
}
