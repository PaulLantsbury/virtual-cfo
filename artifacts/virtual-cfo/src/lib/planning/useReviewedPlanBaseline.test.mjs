import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),ts=require('typescript');
const compiled=ts.transpileModule(readFileSync(new URL('./useReviewedPlanBaseline.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
// Isolated hook orchestration: validation/formula contracts have their own real-fixture tests.
function harness(){
 const months=[1,2,3].map(n=>({selection:{storeId:'store',currency:'GBP',edition:'reviewed',versionId:'v'+n,period:{from:`2026-0${n}-01`,to:`2026-0${n}-28`}},evidence:{},input:{profit:{state:'complete'}}}));
 const history={userId:'user',storeId:'store',month:months[2],selection:months[2].selection,loading:false,loadingMonths:false,error:null,retry(){}};
 const state={isSuccess:false,isFetching:true,isError:false,data:null},calls={builder:0,actualRetry:0},baseline={accepted:true};let options;
 const dependencies={
 '@tanstack/react-query':{useQuery(o){options=o;return {...state,refetch(){}};}},
 '../useReviewedHistory':{useReviewedHistory:()=>history},
 '../useReviewedHistorySeries':{useReviewedHistorySeries:(_h,count)=>count===3?{months,status:'supported',failureKind:null,retry(){}}:{months:[],status:'unavailable',error:'Independent actuals failed',retry(){calls.actualRetry++;}}},
 '../reviewedSupplement':{reviewedSupplement:raw=>raw},
 '../supabase':{supabase:{auth:{getSession:async()=>({data:{session:{user:{id:'user'},access_token:'token'}}})}}},
 './reviewed-plan-baseline':{reviewedPlanBaseline(entries){calls.builder++;assert.equal(entries.length,3);return baseline;}},
 '../marketing/acquisition-evidence':{acquisitionFinancialContext:()=>({}),acquisitionView:()=>({economicsView:{},economics:{first:{acquisitionMetricsState:'supported'}},coverage:{paidFirstCustomers:1}})},
 '../marketing/linked-model':{linkedMarketingMetrics:()=>({revenue:10,beforeAds:8,advertising:2,overheads:1})},
 './plan-baseline-evidence':{classifyPlanBaseline:input=>({kind:input.acquisitionLoading?'loading':input.result?.baseline?'supported':input.result?.months.some(m=>m.state==='read-failed')?'acquisition-read-failure':'unavailable'})}
 };
 let failedIndex=-1,fetches=0;
 const sandbox={exports:{},require:name=>{assert.ok(dependencies[name],name);return dependencies[name];},URLSearchParams,fetch:async()=>({ok:fetches++!==failedIndex,json:async()=>({payload:{accepted:true},snapshotId:'snapshot',observedAt:'date',financialVersionId:'version',salesRevision:'sales',costRevision:'cost'})})};
 vm.runInNewContext(compiled,sandbox);const render=()=>sandbox.exports.useReviewedPlanBaseline();
 return {render,state,calls,baseline,history,async read(failure=-1){render();failedIndex=failure;fetches=0;state.data=await options.queryFn({signal:new AbortController().signal});state.isSuccess=true;state.isFetching=false;return render();}};
}
test('one acquisition read failure retains accepted other months and never calls baseline builder',async()=>{
 const h=harness(),result=await h.read(1);assert.equal(result.baseline,null);assert.equal(result.status.kind,'acquisition-read-failure');assert.deepEqual(Array.from(result.acquisitionMonths,m=>m.state),['supported','read-failed','supported']);assert.equal(h.calls.builder,0);assert.equal(result.acquisitionMonths[0].supplement.snapshotId,'snapshot');
});
test('refetch and changed user with cached query data withhold prior baseline and acquisition rows',async()=>{
 const h=harness();assert.equal((await h.read()).baseline,h.baseline);h.state.isFetching=true;let result=h.render();assert.equal(result.baseline,null);assert.equal(result.acquisitionMonths.length,0);h.state.isFetching=false;h.history.userId=null;result=h.render();assert.equal(result.baseline,null);assert.equal(result.acquisitionMonths.length,0);
});
test('independent failed actuals history does not gate accepted three-month baseline and remains retryable',async()=>{
 const h=harness(),result=await h.read();assert.equal(result.baseline,h.baseline);assert.equal(result.actualsStatus,'unavailable');assert.equal(result.actualsError,'Independent actuals failed');result.retryActuals();assert.equal(h.calls.actualRetry,1);assert.equal(h.calls.builder,1);
});
