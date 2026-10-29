import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
import {operatorOrigin} from './operator-origin.mjs';
import {operatorOwnerPage} from './operator-owner-page.mjs';
import {createXeroTestWriterRuntime} from './xero-test-writer-runtime.ts';
import {createXeroWriterBootstrapRouter} from './xero-writer-bootstrap-router.mjs';
/** Operator-owned dependencies are resolved here, never from artifacts/api-server. */
export function operatorDependencies(){
 const require=createRequire(new URL('./operator-package.manifest.json',import.meta.url));
 return {express:require('express'),createPool:config=>new (require('pg').Pool)(config),createAuthClient:require('@supabase/supabase-js').createClient};
}
export function createOperatorConsentServer({env=process.env,deps}={}){
 const origin=operatorOrigin(env.NIGHT_SCOUT_TEST_WRITER_OPERATOR_ORIGIN);
 if(!deps?.express||typeof deps.createPool!=='function'||typeof deps.createAuthClient!=='function')throw Error('Operator dependencies unavailable');
 const runtime=createXeroTestWriterRuntime(env,deps);
 const app=deps.express();app.disable('x-powered-by');
 // No request/query logging: OAuth code/state and bearer material stay out of logs.
 app.use((_req,res,next)=>{res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');res.set('X-Content-Type-Options','nosniff');next();});
 app.get('/health',(_req,res)=>res.json({state:'operator_consent_service'}));
 app.get('/',(req,res)=>{
  if(Object.keys(req.query).length){res.status(400).json({error:'Owner sign-in unavailable'});return;}
  if(!runtime||req.headers.host!==new URL(origin).host){res.status(503).json({error:'Owner sign-in unavailable'});return;}
  try{
   const nonce=randomBytes(18).toString('base64url');
   const page=operatorOwnerPage({origin,authUrl:env.NIGHT_SCOUT_REVIEW_AUTH_URL,publicKey:env.NIGHT_SCOUT_REVIEW_PUBLIC_KEY,nonce});
   res.set('Content-Security-Policy',`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self' https://bioalckltvkhlczusdvl.supabase.co; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'`);
   res.set('X-Frame-Options','DENY');res.type('html').send(page);
  }catch{res.status(503).json({error:'Owner sign-in unavailable'});}
 });
 app.use('/api/xero/test-writer',createXeroWriterBootstrapRouter({service:runtime?.service,express:deps.express,operatorOrigin:origin}));
 app.use((_req,res)=>res.status(404).json({error:'endpoint_unavailable'}));
 return {app,close:()=>runtime?.close()};
}
export function startOperatorConsentServer({env=process.env,deps=operatorDependencies()}={}){
 const port=Number(env.PORT??3001);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Operator port unavailable');
 const runtime=createOperatorConsentServer({env,deps});const server=runtime.app.listen(port,'0.0.0.0');
 const close=()=>new Promise(resolve=>server.close(()=>Promise.resolve(runtime.close()).finally(resolve)));
 return {server,close};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const service=startOperatorConsentServer();for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>void service.close().finally(()=>process.exit(0)));}
 catch{process.stderr.write('Operator consent service unavailable\n');process.exitCode=1;}
}
