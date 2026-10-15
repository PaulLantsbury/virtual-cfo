import {Router,type IRouter} from 'express';
import {compiledDeploymentRevision,deploymentVersion} from '../lib/deployment-version.ts';

export function createDeploymentVersionRouter(revision:unknown=compiledDeploymentRevision()):IRouter{
 const router=Router();
 const response=deploymentVersion(revision);
 router.get('/version',(_req,res)=>{
  res.set('Cache-Control','no-store');
  res.json(response);
 });
 return router;
}
