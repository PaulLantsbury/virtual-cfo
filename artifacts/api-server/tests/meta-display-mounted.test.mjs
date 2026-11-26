// Combined actual application -> saved report parser -> actual display request/controller.
// Auth/report service ports are fictional; loopback only; no .env or provider runtime activation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createMetaSpendDisplayController,fetchSavedMetaSpend} from '../../virtual-cfo/src/lib/metaSpendDisplay.ts';
import {savedReport,fixtureStore} from '../../virtual-cfo/tests/meta-display-report.fixture.ts';
const root=fileURLToPath(new URL('../',import.meta.url)),scratch=await mkdtemp(join(root,'.display-mounted-test-')),outfile=join(scratch,'app.mjs');
await build({entryPoints:[join(root,'src/app.ts')],outfile,bundle:true,platform:'node',format:'esm',packages:'external',alias:{zod:createRequire(join(root,'../../lib/api-zod/package.json')).resolve('zod'),'@workspace/api-zod':join(root,'../../lib/api-zod/src/index.ts')},logLevel:'silent'});
const {createApp}=await import(pathToFileURL(outfile));
const scope={userId:'60000000-0000-4000-8000-000000000001',storeId:fixtureStore,revision:1,from:'2026-10-01',to:'2026-10-02'};
async function serve(run){
 const state={report:savedReport(),authorized:true,reads:0,requests:0};
 const metaReport={authenticate:async token=>{assert.equal(token,'Bearer fictional');if(!state.authorized)throw Error('Denied');return {userId:scope.userId,isOwner:true};},service:{readSpend:async(identity,input)=>{state.reads++;assert.equal(identity.userId,scope.userId);assert.deepEqual(input,{storeId:scope.storeId,from:scope.from,to:scope.to});return state.report;}}};
 const app=createApp(undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,{metaReport});
 const server=await new Promise((resolve,reject)=>{const s=app.listen(0,'127.0.0.1',error=>error?reject(error):resolve(s));});
 const origin=`http://127.0.0.1:${server.address().port}`;
 const controller=createMetaSpendDisplayController((input,signal)=>fetchSavedMetaSpend(input,signal,{accessToken:async()=> 'fictional',fetcher:async(path,init)=>{state.requests++;assert.equal(new URL(path,origin).pathname,'/api/meta-ads/spend');return fetch(origin+path,init);}}));
 try{await run(controller,state);}finally{controller.clear();await new Promise(resolve=>server.close(resolve));}
}
test('combined mounted expiry preserves same report through actual request/parser/controller and denial clears it',async()=>{
 await serve(async(controller,state)=>{assert.equal(state.requests,0);await controller.load(scope);const current=controller.getSnapshot();assert.equal(current.status,'ready');assert.equal(current.view.subtotalMinor,'1200');assert.deepEqual(current.view.sourceDays,state.report.days);
 state.report=savedReport({expired:true});await controller.load(scope);const expired=controller.getSnapshot();assert.equal(expired.status,'ready');assert.deepEqual(expired.view.sourceDays,current.view.sourceDays);assert.match(expired.view.connectionLabel,/expired/);
 state.authorized=false;await controller.load(scope);assert.equal(controller.getSnapshot().status,'unavailable');assert.equal(controller.getSnapshot().view,undefined);assert.equal(state.reads,2);assert.equal(state.requests,3);
 });
});
test('combined mounted parser refuses poisoned scope and preserves all-unknown without zero fallback',async()=>{
 await serve(async(controller,state)=>{for(const change of [v=>v.storeId=scope.userId,v=>v.lineage.accountId='654321',v=>v.days[0].observedAt='2026-10-03T24:00:00Z',v=>v.lineage.version='guess']){state.report=savedReport();change(state.report);await controller.load(scope);assert.equal(controller.getSnapshot().status,'unavailable');assert.equal(controller.getSnapshot().view,undefined);}
 state.report={status:'not_connected',storeId:scope.storeId,from:scope.from,to:scope.to,account:null,days:[]};await controller.load(scope);assert.equal(controller.getSnapshot().status,'unavailable');
 state.report=savedReport();state.report.evidenceAvailability='unavailable';state.report.days=state.report.days.map(d=>({...d,coverageState:'not_collected',spendMinor:null,observedAt:null,runId:null,runStatus:null,runStartedAt:null}));await controller.load(scope);assert.equal(controller.getSnapshot().status,'ready');assert.equal(controller.getSnapshot().view.state,'unavailable');assert.equal(controller.getSnapshot().view.subtotalMinor,null);assert.ok(controller.getSnapshot().view.sourceDays.every(d=>d.spendMinor===null));assert.equal(state.requests,6);
 });
});
test.after(async()=>rm(scratch,{recursive:true,force:true}));
