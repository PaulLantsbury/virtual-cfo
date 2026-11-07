import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import {resolveApiBuildRevision} from '../build/deployment-revision.mjs';
import {deploymentVersion,compiledDeploymentRevision} from '../src/lib/deployment-version.ts';
import {createDeploymentVersionRouter} from '../src/routes/deployment-version.ts';
const revision='a'.repeat(40);
test('build revision uses exact source HEAD, with a validated Render build-only fallback',()=>{
 assert.equal(resolveApiBuildRevision({readGit:()=>revision+'\n',env:{RENDER_GIT_COMMIT:'b'.repeat(40)}}),revision);
 assert.equal(resolveApiBuildRevision({readGit:()=>{throw Error('PRIVATE git error');},env:{RENDER_GIT_COMMIT:'B'.repeat(40),PRIVATE_SECRET:'never-output'}}),'b'.repeat(40));
 for(const value of [undefined,'PRIVATE token','a'.repeat(7),'a'.repeat(40)+'\n','postgresql://secret',{},'x'.repeat(40)])assert.equal(resolveApiBuildRevision({readGit:()=>{throw Error('PRIVATE');},env:{RENDER_GIT_COMMIT:value}}),null);
});
test('runtime metadata defaults to unknown without a build stamp and never reflects arbitrary values',()=>{
 assert.equal(compiledDeploymentRevision(),null);assert.deepEqual(deploymentVersion(revision),{revision});
 for(const value of [undefined,null,{PRIVATE_SECRET:'canary'},'PRIVATE',revision+'\n'])assert.deepEqual(deploymentVersion(value),{revision:null});
});
test('public endpoint ignores query/header overrides, exposes only build SHA and prevents stale caching',async()=>{
 const app=express();app.use('/api',createDeploymentVersionRouter(revision));const server=app.listen(0,'127.0.0.1');
 try{await new Promise(resolve=>server.once('listening',resolve));const response=await fetch(`http://127.0.0.1:${server.address().port}/api/version?revision=PRIVATE`,{headers:{'x-render-git-commit':'PRIVATE'}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{revision});}finally{await new Promise(resolve=>server.close(resolve));}
});
