import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {operatorOrigin} from './operator-origin.mjs';
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
