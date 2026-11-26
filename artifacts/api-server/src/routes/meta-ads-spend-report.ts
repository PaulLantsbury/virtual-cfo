import {parseMetaSpendReport} from '../../../../experiments/marketing/meta-spend-report-contract.mjs';
import { Router, type IRouter } from 'express';

type MetaIdentity=Readonly<{userId:string;isOwner:boolean}>;
type ReportService=Readonly<{readSpend(identity:MetaIdentity,input:Readonly<{storeId:string;from:string;to:string}>):Promise<unknown>}>;
type Authenticator=(authorization:string)=>Promise<MetaIdentity>|MetaIdentity;
export type MetaAdsSpendReportDependencies=Readonly<{service?:ReportService;authenticate?:Authenticator}>;

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dayPattern=/^\d{4}-\d{2}-\d{2}$/;
const unavailable=(res:any,status=503)=>res.status(status).json({error:'Meta Ads spend reporting unavailable'});
function validDay(value:unknown):value is string{
 if(typeof value!=='string'||!dayPattern.test(value))return false;
 const parsed=new Date(`${value}T00:00:00.000Z`);
 return Number.isFinite(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value;
}
function daysApart(from:string,to:string){return(Date.parse(`${to}T00:00:00.000Z`)-Date.parse(`${from}T00:00:00.000Z`))/86_400_000;}
function plain(value:unknown):value is Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;}

/** Read-only, store-scoped endpoint; no provider account or credential is accepted from the browser. */
export function createMetaAdsSpendReportRouter(dependencies:MetaAdsSpendReportDependencies={}):IRouter{
 const router=Router();const {service,authenticate}=dependencies;
 router.use('/spend',(_req,res,next)=>{res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');res.set('X-Content-Type-Options','nosniff');if(!service||!authenticate)return unavailable(res);next();});
 router.get('/spend',async(req,res)=>{
  const query=req.query as Record<string,unknown>;
  if(!query||typeof query!=='object'||Array.isArray(query)||Object.keys(query).sort().join(',')!=='from,storeId,to'
    ||typeof query.storeId!=='string'||!uuid.test(query.storeId)
    ||!validDay(query.from)||!validDay(query.to)||query.from>query.to||daysApart(query.from,query.to)>92)return unavailable(res,400);
  const authorization=req.headers.authorization;
  if(typeof authorization!=='string'||authorization.length>8192||!/^Bearer [^\s,]+$/i.test(authorization))return unavailable(res,401);
  let identity:MetaIdentity;
  try{identity=await authenticate!(authorization);}catch{return unavailable(res,401);}
  if(!plain(identity)||typeof identity.userId!=='string'||!uuid.test(identity.userId)||identity.isOwner!==true)return unavailable(res,401);
  try{
   const value=await service!.readSpend(identity,Object.freeze({storeId:query.storeId,from:query.from,to:query.to}));
   return res.status(200).json(parseMetaSpendReport(value,query.storeId,query.from,query.to));
  }catch{return unavailable(res,404);}
 });
 return router;
}
