import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {CashWindowCurrentMismatch,cashWindowResult,readCashWindow} from './reviewedCashWindow.ts';
const source=readFileSync(new URL('./useReviewedCash.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness(){
 const current={cash:{openingBankCash:200,closingBankCash:300,sourceRevision:'cash-v1',mappingVersion:'mapping-v1'},evidence:{}};
 const month={selection:{versionId:'financial-v1'},evidence:{salesRevision:'sales-v1',costRevision:'cost-v1'}};
 const h={userId:'owner',storeId:'store',month,loading:false,loadingMonths:false,error:null,retry:()=>{}};
 let financialRetries=0,cashRetries=0,currentRetries=0,requestedCount=null,queryOptions;
 const supplement={payload:current,evidence:{snapshotId:'cash-snapshot-v1',observedAt:'2026-11-20'},retry:()=>{currentRetries++;},error:null,loading:false};
 const financials={months:[month,month,month],status:'supported',loading:false,failureKind:null,retryable:false,retry:()=>{financialRetries++;}};
 const query={isFetching:false,isError:true,isSuccess:false,error:Error('HTTP failure'),data:[1,2,3].map(()=>({...current,financialVersionId:'financial-v1',supplementalSnapshotId:'cash-snapshot-v1',cash:{...current.cash}})),refetch:()=>{cashRetries++;}};
 const dependencies={
  '@tanstack/react-query':{useQuery:options=>{queryOptions=options;return query;}},
  './useReviewedSupplement':{useReviewedSupplement:()=>supplement},
  './useReviewedHistorySeries':{useReviewedHistorySeries:(_history,count)=>{requestedCount=count;return financials;}},
  './cashSupplement':{cashFinancialContext:()=>({}),cashSupplementView:payload=>payload},
  './reviewedSupplement':{reviewedSupplement:()=>null},'./supabase':{supabase:{}},
  './reviewedCashWindow':{CashWindowCurrentMismatch,cashWindowResult,readCashWindow},
 };
 const exports={};vm.runInNewContext(code,{exports,require:name=>{if(!(name in dependencies))throw Error(`Unexpected import: ${name}`);return dependencies[name];}});
 return {current,supplement,financials,query,h,run:()=>exports.useReviewedCash(h),counts:()=>({requestedCount,financialRetries,cashRetries,currentRetries}),key:()=>queryOptions.queryKey};
}
test('actual cash hook retains independently accepted current cash when window fails or refetches',()=>{
 const f=harness();let r=f.run();
 assert.equal(r.current,f.current);assert.deepEqual(r.months,[]);assert.equal(r.supplementalWindow.status,'error');
 assert.equal(f.counts().requestedCount,3);
 r.supplementalWindow.retry();assert.equal(f.counts().cashRetries,1);assert.equal(f.counts().financialRetries,0);
 f.query.isFetching=true;r=f.run();assert.equal(r.current,f.current);assert.deepEqual(r.months,[]);assert.equal(r.supplementalWindow.status,'loading');assert.equal(r.supplementalWindow.retryable,false);
 f.query.isFetching=false;f.query.isError=false;f.query.isSuccess=true;r=f.run();assert.equal(r.months.length,3);
});
test('financial failure retries only financial history and leaves current cash accepted',()=>{
 const f=harness();Object.assign(f.financials,{months:[],status:'unavailable',failureKind:'read-or-reconciliation',retryable:true});
 const r=f.run();assert.equal(r.current,f.current);assert.deepEqual(r.months,[]);assert.equal(r.financialWindow.status,'error');
 r.financialWindow.retry();assert.equal(f.counts().financialRetries,1);assert.equal(f.counts().cashRetries,0);
 f.financials.failureKind='coverage';f.financials.retryable=false;assert.equal(f.run().financialWindow.status,'unavailable');
});
test('cash window identity follows independently revised current supplement evidence',()=>{
 const f=harness();Object.assign(f.query,{isError:false,isSuccess:true});assert.equal(f.run().months.length,3);const before=JSON.stringify(f.key());
 f.supplement.evidence.snapshotId='cash-snapshot-v2';f.current.cash.sourceRevision='cash-v2';f.run();
 assert.notEqual(JSON.stringify(f.key()),before);const changed=f.run();assert.equal(changed.current,f.current);assert.equal(changed.months.length,0);assert.equal(changed.supplementalWindow.status,'error');changed.supplementalWindow.retry();assert.equal(f.counts().currentRetries,1);assert.equal(f.counts().cashRetries,1);
});
