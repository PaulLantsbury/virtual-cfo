import express from 'express';
import http from 'node:http';
import {createFinancialReviewRouter} from './src/routes/financial-reviews.ts';
/** Local-only composition, with no generic database or production route imports. */
export async function listenLocalReview({service,port,frontendOrigin}){
 const origin=new URL(frontendOrigin);
 if(!['localhost','127.0.0.1'].includes(origin.hostname)||origin.protocol!=='http:'||origin.origin!==frontendOrigin||!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid local review address');
 const app=express();app.disable('x-powered-by');
 app.use((req,res,next)=>{
  if(req.headers.origin&&req.headers.origin!==frontendOrigin||req.headers['sec-fetch-site']==='cross-site'){res.status(403).json({error:'Review origin unavailable'});return;}
  next();
 });
 app.use('/api/financial-reviews',createFinancialReviewRouter(service));
 const server=http.createServer({headersTimeout:10000,requestTimeout:15000},app);
 server.maxConnections=20;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 return {port:server.address().port,close:()=>new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();})};
}
