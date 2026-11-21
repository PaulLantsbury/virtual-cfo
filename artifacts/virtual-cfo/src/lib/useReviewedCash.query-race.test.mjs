/** Disposable query-function regression. Auth, fetch and query scheduling are
 * controlled ports; the hook, cash-window reader and evidence validators are real.
 * No browser, provider or hosted database is contacted. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {reviewedSupplement} from './reviewedSupplement.ts';
import {eligibleCashView} from './cashSourceAdapter.ts';
import {CashWindowCurrentMismatch,cashWindowResult,readCashWindow} from './reviewedCashWindow.ts';

function loadSource(name,dependencies,globals={}) {
 const source=readFileSync(new URL(name,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext(code,{exports,require:key=>{
  assert.ok(key in dependencies,`Unexpected dependency ${key}`);
  return dependencies[key];
 },...globals});
 return exports;
}
const {cashFinancialContext,cashSupplementView}=loadSource('./cashSupplement.ts',{'./cashSourceAdapter.ts':{eligibleCashView}});
const now=new Date('2026-11-21T12:00:00Z');
const store='d7500000-0000-4000-8000-000000000009';
const observedAt='2026-11-20T12:00:00Z';
const snapshot=index=>`90000000-0000-4000-8000-${String(index).padStart(12,'0')}`;

function fixture({replaceSelectedSnapshot=false}={}) {
 const months=[['2026-08-01','2026-08-31'],['2026-09-01','2026-09-30'],['2026-10-01','2026-10-31']].map(([from,to],index)=>({
  selection:{storeId:store,currency:'GBP',timezone:'Europe/London',edition:'reviewed',period:{from,to},versionId:snapshot(100+index)},
  evidence:{salesRevision:'a'.repeat(64),costRevision:'b'.repeat(64),costCoverage:'complete'},
  context:{snapshotAsOf:'2026-11-01T00:00:00Z'},amounts:{ebitda:100},
 }));
 const envelopes=months.map((month,index)=>{
  const {period:{from,to},versionId,...scope}=month.selection;
  delete scope.edition;
  const evidence={contract:'eligible-cash-v1',...scope,from,to,state:'reviewed',sourceRevision:'cash-v1',mappingVersion:'mapping-v1',observedAt,invalidated:false,
   coverage:{accountsComplete:true,workingCapitalComplete:true,bankMovementsComplete:true,internalTransfersExcluded:true},
   accounts:[{id:'disposable-bank',included:true,unrestricted:true,openingDate:from,closingDate:to,opening:100+index*100,closing:200+index*100}],
   ebitda:100,workingCapital:{stock:0,debtors:0,providerSettlements:0,supplierCredit:0,other:0},operatingCash:100,
   bankMovements:{taxAndInterest:0,investing:0,financing:0,other:0},unsettledProviderFunds:0};
  return {contract:'reviewed-supplement-v1',state:'supported',kind:'cash',sourceBasis:'synthetic-local',snapshotId:snapshot(index+1),financialVersionId:versionId,
   salesRevision:month.evidence.salesRevision,costRevision:month.evidence.costRevision,scope:{...scope,from,to},observedAt,
   payload:{evidence,source:{contract:'synthetic-cash-journal-v1',sourceBasis:'synthetic-model',profile:'uk-gifts-v2',anchor:'2024-11-01',from,to,sourceRevision:'cash-v1',mappingVersion:'mapping-v1',sourcePrefixHash:'c'.repeat(64),bankLedgerHash:'d'.repeat(64)}}};
 });
 const selected=months.at(-1),accepted=envelopes.at(-1);
 const supplement={payload:accepted.payload,evidence:accepted,retry:()=>{counts.currentRetries++;},error:null,loading:false};
 const current=cashSupplementView(supplement.payload,cashFinancialContext(selected),now);
 assert.ok(current,'The accepted current cash must pass the real validator');
 const financials={months,status:'supported',loading:false,failureKind:null,retryable:false,retry:()=>{counts.financialRetries++;}};
 const history={userId:'disposable-owner',storeId:store,month:selected,selection:selected.selection,loading:false,loadingMonths:false,error:null,retry:()=>{}};
 const counts={currentRetries:0,windowRetries:0,financialRetries:0,auth:0};
 const requests=[];
 let options;
 const query={isFetching:true,isError:false,isSuccess:false,error:null,data:undefined,refetch:()=>{counts.windowRetries++;}};
 const deps={
  '@tanstack/react-query':{useQuery:next=>{options=next;return query;}},
  './useReviewedSupplement':{useReviewedSupplement:()=>supplement},
  './useReviewedHistorySeries':{useReviewedHistorySeries:(_history,count)=>{assert.equal(count,3);return financials;}},
  './cashSupplement':{cashFinancialContext,cashSupplementView:(payload,scope)=>cashSupplementView(payload,scope,now)},
  './reviewedSupplement':{reviewedSupplement:(raw,month,kind)=>reviewedSupplement(raw,month,kind,now)},
  './reviewedCashWindow':{CashWindowCurrentMismatch,cashWindowResult,readCashWindow},
  './supabase':{supabase:{auth:{getSession:async()=>{counts.auth++;return {data:{session:{user:{id:history.userId},access_token:'disposable-token'}},error:null};}}}},
 };
 const {useReviewedCash}=loadSource('./useReviewedCash.ts',deps,{URLSearchParams,fetch:async(input,request)=>{
  const url=new URL(input,'https://disposable.invalid');
  assert.equal(url.pathname,'/api/supplemental-reporting');
  assert.equal(request.headers.Authorization,'Bearer disposable-token');
  assert.equal(request.signal.aborted,false);
  assert.equal(url.searchParams.get('storeId'),store);
  const index=months.findIndex(month=>month.selection.period.from===url.searchParams.get('from'));
  assert.ok(index>=0);
  assert.equal(url.searchParams.get('versionId'),months[index].selection.versionId);
  requests.push(url.searchParams.get('from'));
  const envelope=structuredClone(envelopes[index]);
  if(replaceSelectedSnapshot&&index===2)envelope.snapshotId=snapshot(999);
  // The replacement is independently valid for the same financial month: only
  // its snapshot identity differs from the current figure accepted earlier.
  assert.ok(reviewedSupplement(envelope,months[index],'cash',now));
  assert.ok(cashSupplementView(envelope.payload,cashFinancialContext(months[index]),now));
  return {ok:true,json:async()=>envelope};
 }});
 return {current,query,counts,requests,run:()=>useReviewedCash(history),execute:()=>options.queryFn({signal:new AbortController().signal})};
}

test('actual cash queryFn accepts coherent history but rejects a newly fetched selected snapshot, retains current cash and pairs recovery',async()=>{
 const coherent=fixture();coherent.run();
 const rows=await coherent.execute();
 assert.equal(rows.length,3);
 Object.assign(coherent.query,{isFetching:false,isSuccess:true,data:rows});
 const complete=coherent.run();
 assert.equal(complete.months.length,3);
 assert.equal(complete.supplementalWindow.status,'supported');

 const race=fixture({replaceSelectedSnapshot:true});
 assert.equal(race.run().current.cash.closingBankCash,400);
 let mismatch;
 await assert.rejects(race.execute(),error=>{mismatch=error;return error instanceof CashWindowCurrentMismatch;});
 assert.deepEqual(race.requests,['2026-08-01','2026-09-01','2026-10-01']);
 assert.equal(race.counts.auth,3);
 // Model the query library delivering the real queryFn failure while retaining
 // stale cached rows. The hook must not expose those rows as supported history.
 Object.assign(race.query,{isFetching:false,isError:true,isSuccess:false,error:mismatch,data:rows});
 const result=race.run();
 assert.equal(result.current.cash.closingBankCash,400);
 assert.equal(result.current.cash.sourceRevision,race.current.cash.sourceRevision);
 assert.equal(result.months.length,0);
 assert.equal(result.supplementalWindow.status,'error');
 assert.match(result.supplementalWindow.error,/Recheck both current and historical/);
 assert.equal(result.supplementalWindow.retryable,true);
 result.supplementalWindow.retry();
 assert.equal(race.counts.currentRetries,1);
 assert.equal(race.counts.windowRetries,1);
 assert.equal(race.counts.financialRetries,0);
});
