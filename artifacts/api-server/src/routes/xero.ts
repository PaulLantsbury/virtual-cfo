import {Router} from 'express';
import {xeroOAuthRuntime} from '../lib/xero-oauth';
type XeroRuntime=ReturnType<typeof xeroOAuthRuntime>;

export function createXeroRouter(runtime:XeroRuntime){
 const router=Router();
 router.get('/start',(_req,res)=>{if(!runtime){res.status(404).json({error:'Xero test connection unavailable'});return;}res.set('Cache-Control','no-store').redirect(302,runtime.start().url);});
 router.get('/mapping-preview',async(_req,res)=>{if(!runtime||typeof runtime.mappingPreview!=='function'){res.status(404).json({error:'Xero local mapping preview unavailable'});return;}try{res.set('Cache-Control','no-store').json(await runtime.mappingPreview());}catch{res.status(503).json({error:'Xero local mapping preview unavailable'});}});
 router.post('/callback',expressCallback(runtime));
 return router;
}
function expressCallback(runtime:XeroRuntime){return async (req:any,res:any)=>{
 if(!runtime||typeof req.body?.code!=='string'||req.body.code.length<8||req.body.code.length>4096||!runtime.accept(req.body.state))return res.status(400).json({error:'Xero authorisation unavailable'});
 try{const result=await runtime.exchange(req.body.code);res.set('Cache-Control','no-store').json({status:'snapshot_read',...result});}catch{res.status(502).json({error:'Xero snapshot unavailable'});}
};}
