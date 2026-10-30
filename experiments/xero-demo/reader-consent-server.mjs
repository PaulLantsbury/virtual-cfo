import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {operatorOwnerPage} from '../test-programme/operator-owner-page.mjs';
import {createDemoReaderConsentRuntime} from './reader-consent-runtime.mjs';
export function demoReaderConsentDependencies(){const require=createRequire(new URL('./demo-reader-package.manifest.json',import.meta.url));return {express:require('express'),createPool:config=>new(require('pg').Pool)(config),createAuthClient:require('@supabase/supabase-js').createClient};}
const opaque=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{32,128}$/.test(value);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
export function createDemoReaderConsentServer({env=process.env,deps}={}){
 if(!deps?.express)throw Error('Demo reader dependencies unavailable');
 const runtime=createDemoReaderConsentRuntime(env,deps),app=deps.express();app.disable('x-powered-by');
 app.use((_req,res,next)=>{res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');res.set('X-Content-Type-Options','nosniff');res.set('X-Frame-Options','DENY');next();});
 app.get('/health',(_req,res)=>res.json({state:'isolated_demo_reader_consent_service'}));
 app.get('/',(req,res)=>{
  if(!runtime||req.headers.host!==new URL(runtime.publicConfig.origin).host){res.status(503).json({error:'Demo reader setup unavailable'});return;}
  const keys=Object.keys(req.query),valid=keys.length===0||keys.length===1&&(keys[0]==='demoDiscovery'&&opaque(req.query.demoDiscovery)||keys[0]==='demoConnected'&&req.query.demoConnected==='1');
  if(!valid){res.status(400).json({error:'Demo reader setup unavailable'});return;}
  try{const nonce=randomBytes(18).toString('base64url'),config=runtime.publicConfig;res.set('Content-Security-Policy',`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self' https://bioalckltvkhlczusdvl.supabase.co; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'`);res.type('html').send(operatorOwnerPage({...config,nonce,flow:'demo-reader',consentReturned:req.query.demoConnected==='1',...(req.query.demoDiscovery?{discoveryHandle:req.query.demoDiscovery}:{})}));}catch{res.status(503).json({error:'Demo reader setup unavailable'});}
 });
 app.use('/api/xero-demo/reader',deps.express.json({limit:'12kb',strict:true,type:'application/json'}));
 const owner=async(req,res)=>{if(!runtime){res.status(503).json({error:'Demo reader setup unavailable'});return;}if(req.headers.host!==new URL(runtime.publicConfig.origin).host||req.headers.origin!==runtime.publicConfig.origin){res.status(403).json({error:'Demo reader owner required'});return;}try{return await runtime.authenticate(req.headers.authorization);}catch{res.status(401).json({error:'Demo reader sign-in required'});}};
 app.post('/api/xero-demo/reader/discover',async(req,res)=>{const principal=await owner(req,res);if(!principal)return;if(!plain(req.body)||Object.keys(req.body).length){res.status(400).json({error:'Demo reader setup unavailable'});return;}try{res.json(runtime.service.startDiscovery(principal));}catch{res.status(503).json({error:'Demo reader setup unavailable'});}});
 app.post('/api/xero-demo/reader/discovery',async(req,res)=>{const principal=await owner(req,res);if(!principal)return;if(!plain(req.body)||Object.keys(req.body).join(',')!=='handle'||!opaque(req.body.handle)){res.status(400).json({error:'Demo reader setup unavailable'});return;}try{res.json(runtime.service.readDiscovery(principal,req.body.handle));}catch{res.status(503).json({error:'Demo reader setup unavailable'});}});
 app.post('/api/xero-demo/reader/connect',async(req,res)=>{const principal=await owner(req,res);if(!principal)return;try{res.json(runtime.service.start(principal,req.body));}catch{res.status(503).json({error:'Demo reader setup unavailable'});}});
 app.get('/api/xero-demo/reader/callback',async(req,res)=>{
  if(!runtime||req.headers.host!==new URL(runtime.publicConfig.origin).host){res.status(503).json({error:'Demo reader setup unavailable'});return;}
  const query=req.query,keys=Object.keys(query),valid=keys.length>=2&&keys.every(key=>['state','code','scope','session_state'].includes(key))&&opaque(query.state)&&typeof query.code==='string'&&/^[-A-Za-z0-9._~]{8,4096}$/.test(query.code)&&(query.scope===undefined||typeof query.scope==='string'&&query.scope.length<=2048&&/^[A-Za-z0-9._:-]+(?: [A-Za-z0-9._:-]+)*$/.test(query.scope))&&(query.session_state===undefined||typeof query.session_state==='string'&&/^[-A-Za-z0-9._~]{1,4096}$/.test(query.session_state));
  if(!valid){res.status(400).json({error:'Demo reader callback unavailable'});return;}
  try{const result=await runtime.service.complete({state:query.state,code:query.code,...(query.scope?{scope:query.scope}:{})});if(result.state==='demo_discovery_received'&&opaque(result.handle)){res.status(302).set('Location','/?demoDiscovery='+encodeURIComponent(result.handle)).end();return;}if(result.state==='demo_reader_connected'){res.status(302).set('Location','/?demoConnected=1').end();return;}throw Error();}catch{res.status(503).json({error:'Demo reader setup unavailable'});}
 });
 app.use((_req,res)=>res.status(404).json({error:'endpoint_unavailable'}));
 app.use((_error,_req,res,_next)=>res.status(400).json({error:'Demo reader request unavailable'}));
 return {app,close:()=>runtime?.close()};
}
export function startDemoReaderConsentServer({env=process.env,deps=demoReaderConsentDependencies()}={}){const port=Number(env.PORT??3002);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Demo reader port unavailable');const service=createDemoReaderConsentServer({env,deps}),server=service.app.listen(port,'0.0.0.0');return {server,close:()=>new Promise(resolve=>server.close(()=>Promise.resolve(service.close()).finally(resolve)))};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const service=startDemoReaderConsentServer();for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>void service.close().finally(()=>process.exit(0)));}catch{process.stderr.write('Demo reader consent service unavailable\n');process.exitCode=1;}}
