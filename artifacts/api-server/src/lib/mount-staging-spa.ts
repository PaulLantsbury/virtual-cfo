import express,{type Express} from 'express';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';

export function mountStagingSpa(app:Express,webRoot:string){
 const indexPath=resolve(webRoot,'index.html');
 // Replit packages the static artifact separately from the API process. Its
 // promotion probe still requests the API process root, so provide a bounded,
 // data-free readiness response only when that process cannot see the SPA.
 if(!existsSync(indexPath))app.get('/',(_req,res)=>{res.set('Cache-Control','no-store');res.status(200).type('text/plain').send('Night Scout staging ready');});
 app.use(express.static(webRoot,{fallthrough:true,index:false,maxAge:0}));
 app.use((req,res,next)=>{if(req.method==='GET'&&!req.path.startsWith('/api/')&&req.accepts('html')){res.set('Cache-Control','no-store');res.sendFile(indexPath,error=>{if(error&&!res.headersSent)next();});return;}next();});
}
