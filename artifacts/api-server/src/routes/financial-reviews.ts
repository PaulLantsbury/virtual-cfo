import { Router, json, type IRouter, type ErrorRequestHandler } from 'express';
export type ReviewScope = { storeId: string; from: string; to: string };
export type RestoreRequest = {scope: ReviewScope; batchId: string; snapshotDigest: string; coverageConfirmed: true; evidenceRef: string; completenessStatement: string};
export type ReviewService = {
 prepare(scope: ReviewScope, authorization: string): Promise<unknown>;
 restore(request: RestoreRequest, authorization: string): Promise<unknown>;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object=(v: unknown): v is Record<string,unknown> => !!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v: Record<string,unknown>,allowed: string[])=>Object.keys(v).length===allowed.length&&Object.keys(v).every(k=>allowed.includes(k));
const day=(v: unknown): v is string => typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
function scope(v: unknown): v is ReviewScope {
 return object(v)&&keys(v,['storeId','from','to'])&&typeof v.storeId==='string'&&uuid.test(v.storeId)&&day(v.from)&&day(v.to)&&v.from<=v.to;
}
const text=(v: unknown,max: number)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
function restore(v: unknown): v is RestoreRequest {
 return object(v)&&keys(v,['scope','batchId','snapshotDigest','coverageConfirmed','evidenceRef','completenessStatement'])&&scope(v.scope)&&typeof v.batchId==='string'&&uuid.test(v.batchId)&&typeof v.snapshotDigest==='string'&&/^[a-f0-9]{64}$/.test(v.snapshotDigest)&&v.coverageConfirmed===true&&text(v.evidenceRef,2000)&&text(v.completenessStatement,10000);
}
/** Dependencies must be provided by trusted server composition, never request data.
 * Production is disabled by default; there is no environment-variable shortcut.
 */
export function createFinancialReviewRouter(service?: ReviewService): IRouter {
 const router=Router();
 router.use((_req,res,next)=>{res.set('Cache-Control','no-store');if(!service){res.status(503).json({error:'Financial review is not configured'});return;}next();});
 router.use((req,res,next)=>{
  const header=req.headers.authorization;
  if(typeof header!=='string'||header.length>8192||!/^Bearer [^\s,]+$/i.test(header)){res.status(401).json({error:'Reviewer sign-in required'});return;}
  next();
 });
 router.use(json({limit:'16kb',strict:true,type:'application/json'}));
 for(const action of ['prepare','restore'] as const){
  router.post(`/${action}`,async(req,res)=>{
   if(!req.is('application/json')){res.status(415).json({error:'JSON request required'});return;}
   const valid=action==='prepare'?object(req.body)&&keys(req.body,['scope'])&&scope(req.body.scope):restore(req.body);
   if(!valid){res.status(400).json({error:'Invalid review request'});return;}
   try{
    const result=action==='prepare'?await service!.prepare(req.body.scope,req.headers.authorization!):await service!.restore(req.body,req.headers.authorization!);
    res.status(200).json(result);
   }catch(error){
    // Fixed responses only: never send SQL, upstream details, tokens or stack traces.
    const e=(error??{}) as {message?: string;code?: string};
    if(['Reviewer sign-in required','Reviewer sign-in could not be verified'].includes(e.message??'')){res.status(401).json({error:'Reviewer sign-in could not be verified'});return;}
    if(e.message==='Reviewer is not authorised for this store'){res.status(403).json({error:'Review access unavailable'});return;}
    if(['Review snapshot changed; prepare a new review','Financial reconciliation has not passed','Store or candidate period missing'].includes(e.message??'')){res.status(409).json({error:'Prepare a new review before continuing'});return;}
    res.status(503).json({error:'Review could not be completed; check its status before retrying'});
   }
  });
 }
 const safeParserErrors: ErrorRequestHandler=(error,_req,res,_next)=>{res.status(error?.type==='entity.too.large'?413:400).json({error:error?.type==='entity.too.large'?'Review request is too large':'Invalid JSON request'});};
 router.use(safeParserErrors);
 return router;
}
export default createFinancialReviewRouter();
