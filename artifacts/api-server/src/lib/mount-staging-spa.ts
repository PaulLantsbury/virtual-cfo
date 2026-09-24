import express,{type Express} from 'express';
import {resolve} from 'node:path';

export function mountStagingSpa(app:Express,webRoot:string){
 app.use(express.static(webRoot,{fallthrough:true,index:false,maxAge:0}));
 app.use((req,res,next)=>{if(req.method==='GET'&&!req.path.startsWith('/api/')&&req.accepts('html')){res.set('Cache-Control','no-store');res.sendFile(resolve(webRoot,'index.html'),error=>{if(error&&!res.headersSent)next();});return;}next();});
}
