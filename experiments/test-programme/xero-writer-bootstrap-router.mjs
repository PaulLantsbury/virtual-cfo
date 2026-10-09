// Host supplies its Express ports; no dependency/path resolution occurs during
// module import or after esbuild relocates this source into dist/index.mjs.
export function createXeroWriterBootstrapRouter({service,express}={}){
 if(typeof express?.Router!=='function' || typeof express?.json!=='function')throw new Error('Writer router host ports required');
 const {Router,json}=express;
 const router=Router();router.use((_req,res,next)=>{res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');if(!service){res.status(503).json({error:'Xero writer setup unavailable'});return;}next();});
 router.use(json({limit:'1kb',strict:true}));
 router.post('/connect',async(req,res)=>{
  if(req.headers.origin!=='https://night-scout-xero-staging.onrender.com' || typeof req.headers.authorization!=='string' || !/^Bearer [^\s,]+$/i.test(req.headers.authorization) || req.headers.authorization.length>8192 || !req.body || Object.keys(req.body).length!==0){res.status(403).json({error:'Xero writer setup unavailable'});return;}
  try{res.json(await service.start(req.headers.authorization));}catch{res.status(503).json({error:'Xero writer setup unavailable'});}
 });
 router.get('/callback',async(req,res)=>{
  if(Object.keys(req.query).some(k=>!['code','state','scope','session_state'].includes(k)) || typeof req.query.state!=='string' || typeof req.query.code!=='string'){res.status(400).json({error:'Xero writer setup unavailable'});return;}
  try{const result=await service.complete({state:req.query.state,code:req.query.code});res.status(200).json(result);}catch{res.status(503).json({error:'Xero writer setup unavailable'});}
 });
 router.use((_error,_req,res,_next)=>res.status(400).json({error:'Xero writer setup unavailable'}));return router;
}
