import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {buildMetaHistoryFromWire} from '../src/lib/metaHistoryWire.ts';
import {savedReport,fixtureStore} from './meta-display-report.fixture.ts';
const scope={userId:'60000000-0000-4000-8000-000000000001',storeId:fixtureStore,revision:1,from:'2026-10-01',to:'2026-10-02'};
function actual({session={access_token:'fictional-token',user:{id:scope.userId},expires_at:Math.floor(Date.now()/1000)+3600},error=null,fetcher=async()=>({ok:true,json:async()=>savedReport()})}={}){
 const source=readFileSync(new URL('../src/lib/metaSpendDisplay.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};const deps={'./metaHistoryWire.ts':{buildMetaHistoryFromWire},'./supabase.ts':{supabase:{auth:{getSession:async()=>({data:{session},error})}}}};
 vm.runInNewContext(code,{exports,require:key=>{assert.ok(key in deps,'Unexpected dependency '+key);return deps[key];},Object,Array,Date,Number,JSON,URLSearchParams,AbortController,fetch:fetcher});return exports;
}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('real request uses one authenticated GET to saved reporting only and no cache/redirect',async()=>{
 const calls=[];const {fetchSavedMetaSpend}=actual({fetcher:async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>savedReport()};}});
 const result=await fetchSavedMetaSpend(scope,new AbortController().signal);assert.deepEqual(result,savedReport());assert.equal(calls.length,1);const {url,init}=calls[0],parsed=new URL(url,'http://127.0.0.1');assert.equal(parsed.pathname,'/api/meta-ads/spend');assert.deepEqual(Object.fromEntries(parsed.searchParams),{storeId:scope.storeId,from:scope.from,to:scope.to});assert.equal(init.method,'GET');assert.equal(init.cache,'no-store');assert.equal(init.redirect,'error');assert.equal(init.headers.authorization,'Bearer fictional-token');
});
for(const [name,session] of [['absent',null],['wrong user',{access_token:'token',user:{id:'different'},expires_at:Math.floor(Date.now()/1000)+3600}],['expired',{access_token:'token',user:{id:scope.userId},expires_at:1}],['no expiry',{access_token:'token',user:{id:scope.userId}}]])test('real token check rejects '+name+' session before request',async()=>{
 let calls=0;const {fetchSavedMetaSpend}=actual({session,fetcher:async()=>{calls++;throw Error('No request expected');}});await assert.rejects(fetchSavedMetaSpend(scope,new AbortController().signal));assert.equal(calls,0);
});
test('invalid dates and aborted scope never fetch; HTTP denial is not retried',async()=>{
 let calls=0;const {fetchSavedMetaSpend}=actual({fetcher:async()=>{calls++;return {ok:false,status:403};}});
 for(const input of [{...scope,from:'2026-02-30'},{...scope,to:'2027-10-01'},{...scope,from:'2026-11-01'}])await assert.rejects(fetchSavedMetaSpend(input,new AbortController().signal));assert.equal(calls,0);
 await assert.rejects(fetchSavedMetaSpend(scope,AbortSignal.abort()));assert.equal(calls,0);await assert.rejects(fetchSavedMetaSpend(scope,new AbortController().signal));assert.equal(calls,1);
});
test('controller makes no automatic call, expires access without rewriting saved evidence',async()=>{
 let calls=0;const {createMetaSpendDisplayController}=actual();const controller=createMetaSpendDisplayController(async()=>savedReport({expired:++calls===2}));assert.equal(calls,0);assert.equal(controller.getSnapshot().status,'idle');await controller.load(scope);const current=controller.getSnapshot().view;await controller.load(scope);const expired=controller.getSnapshot().view;assert.deepEqual(current.sourceDays,expired.sourceDays);assert.equal(current.subtotalMinor,'1200');assert.equal(expired.subtotalMinor,'1200');assert.match(expired.connectionLabel,/expired/i);
});
test('new load clears stale display immediately and denied revalidation cannot resurrect it',async()=>{
 let calls=0;const delayed=deferred();const {createMetaSpendDisplayController}=actual();const controller=createMetaSpendDisplayController(async()=>++calls===1?savedReport():delayed.promise);await controller.load(scope);assert.equal(controller.getSnapshot().status,'ready');const pending=controller.load(scope);assert.equal(controller.getSnapshot().status,'loading');assert.equal(controller.getSnapshot().view,undefined);delayed.resolve({status:'not_connected',storeId:scope.storeId,from:scope.from,to:scope.to,account:null,days:[]});await pending;assert.equal(controller.getSnapshot().status,'unavailable');assert.equal(controller.getSnapshot().view,undefined);assert.equal(calls,2);
});
for(const change of ['revision','storeId','from'])test('late response from old '+change+' cannot replace newer scope',async()=>{
 const first=deferred(),second=deferred(),signals=[];let calls=0;const {createMetaSpendDisplayController}=actual();const controller=createMetaSpendDisplayController((_s,signal)=>{signals.push(signal);return ++calls===1?first.promise:second.promise;});const old=controller.load(scope);const next={...scope,...(change==='revision'?{revision:2}:change==='storeId'?{storeId:'d7500000-0000-4000-8000-000000000008'}:{from:'2026-10-02'})};const fresh=controller.load(next);assert.equal(signals[0].aborted,true);second.resolve(savedReport({...next,amount:'9900'}));await fresh;first.resolve(savedReport());await old;assert.equal(controller.getSnapshot().view.subtotalMinor,'9900');assert.match(controller.getSnapshot().scopeKey,new RegExp(String(next[change])));
});
test('clear/unmount drops even a fetch that ignores cancellation',async()=>{
 const pending=deferred();const {createMetaSpendDisplayController}=actual();const controller=createMetaSpendDisplayController(()=>pending.promise);const run=controller.load(scope);controller.clear();pending.resolve(savedReport());await run;assert.equal(controller.getSnapshot().status,'idle');assert.equal(controller.getSnapshot().view,undefined);
});
test('real controller withholds malformed account, different requested scope and invalid version without substituting zero',async()=>{
 const {createMetaSpendDisplayController}=actual();for(const mutate of [v=>v.storeId='other',v=>v.from='2026-09-01',v=>v.to='2026-11-01',v=>v.account.providerAccountId='654321',v=>v.lineage.connectionId='bad',v=>v.lineage.version='guessed']){const report=savedReport();mutate(report);const controller=createMetaSpendDisplayController(async()=>report);await controller.load(scope);assert.equal(controller.getSnapshot().status,'unavailable');assert.equal(controller.getSnapshot().view,undefined);}
});
