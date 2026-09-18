import {Router} from 'express';
import {xeroOAuthRuntime} from '../lib/xero-oauth';
type XeroRuntime=ReturnType<typeof xeroOAuthRuntime>;

export function createXeroRouter(runtime:XeroRuntime){
 const router=Router();
 router.get('/start',(_req,res)=>{if(!runtime)return res.status(404).json({error:'Xero test connection unavailable'});res.set('Cache-Control','no-store').redirect(302,runtime.start().url);});
 router.post('/callback',expressCallback(runtime));
 return router;
}
function expressCallback(runtime:XeroRuntime){return (req:any,res:any)=>{
 if(!runtime||typeof req.body?.code!=='string'||req.body.code.length<8||req.body.code.length>4096||!runtime.accept(req.body.state))return res.status(400).json({error:'Xero authorisation unavailable'});
 res.set('Cache-Control','no-store').json({status:'authorisation_code_validated',next:'No token was exchanged or retained.'});
};}
