import express from 'express';
import {createMetaAdsRouter} from '../../artifacts/api-server/src/routes/meta-ads.ts';
import {createGoogleAdsRouter} from '../../artifacts/api-server/src/routes/google-ads.ts';
import {createMetaAdsRuntime} from '../../artifacts/api-server/src/lib/meta-ads-runtime.mjs';
import {createGoogleAdsRuntime} from '../../artifacts/api-server/src/lib/google-ads-runtime.mjs';
import {validateHostEnvironment} from './host-boundary.mjs';

/** Dedicated private capability host: no website, report, collector or scheduler imports. */
export async function createProviderApiHost(env:NodeJS.ProcessEnv, factories = {meta:createMetaAdsRuntime,google:createGoogleAdsRuntime}) {
 validateHostEnvironment('private-api',env);
 const app=express();
 app.disable('x-powered-by');
 const opened:Array<{close:()=>Promise<void>}>=[];
 const close=async()=>{await Promise.allSettled(opened.splice(0).map(r=>r.close()));};
 const enabled=env.NIGHT_SCOUT_PROVIDER_API_HOST_ENABLED==='true';
 let meta:Awaited<ReturnType<typeof createMetaAdsRuntime>>;
 let google:Awaited<ReturnType<typeof createGoogleAdsRuntime>>;
 try {
  if(enabled){meta=await factories.meta(env);if(meta)opened.push(meta);google=await factories.google(env);if(google)opened.push(google);}
 } catch {await close();throw new Error('Provider API host unavailable');}
 app.use((_req,res,next)=>{res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');res.set('X-Content-Type-Options','nosniff');next();});
 const active=Boolean(meta||google);
 app.get('/health',(_req,res)=>res.json({status:active?'ready':'disabled',capability:'provider-api'}));
 // Report capability never exists on this host, even when API runtimes are enabled.
 app.all(['/api/meta-ads/spend','/api/google-ads/spend'],(_req,res)=>res.status(404).json({error:'Not found'}));
 app.use('/api/meta-ads',createMetaAdsRouter(meta?{service:meta.service,authenticate:meta.authenticate,allowedOrigins:meta.allowedOrigins}:undefined));
 app.use('/api/google-ads',createGoogleAdsRouter(google?{service:google.service,authenticate:google.authenticate,allowedOrigins:google.allowedOrigins}:undefined));
 app.use((_req,res)=>res.status(404).json({error:'Not found'}));
 app.use((_err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(503).json({error:'Provider API unavailable'}));
 return {app,close,enabled:active};
}
