import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperatorSyncService} from './operator-sync-service.mjs';
import {INTAKE_TARGET as target} from './intake-runtime.mjs';
const scope={storeId:target.storeId,from:'2026-09-17',to:'2026-09-17'};
const batch='11111111-1111-4111-8111-111111111111';
const completed=status=>({...scope,status,batchId:batch,mappingState:'mapped_for_review',coverageCertified:false,reviewRequired:true,financeImported:false,rawSecret:'never expose'});
const stored=()=>({...scope,projectRef:target.projectRef,status:'needs_recheck',observedAt:'2026-09-17T12:00:00Z',retainedBatchCount:2,batchId:batch,mappingState:'mapped_for_review',orderCount:1,refundCount:2,mappedEventCount:0,exclusions:[{reason:'TEST_ORDER',count:1}],candidateWriteAttempted:false,coverageCertified:false,financialImportStatus:'not_assessed',reviewRequired:true,customer:'never expose'});
const make=(extra={})=>createOperatorSyncService({scope,runIntake:async()=>completed('replay'),inspectCandidate:async()=>stored(),now:()=>Date.parse('2026-09-17T12:00:00Z'),...extra});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('configuration fixes target and bounded dates without runtime or credential side effects',()=>{
 for(const change of [{scope:{...scope,storeId:'90000000-0000-4000-8000-000000000004'}},{scope:{...scope,to:'2026-12-01'}},{scope:{...scope,from:'2026-02-30'}},{runIntake:null},{inspectCandidate:null}])assert.throws(()=>make(change),/Invalid/);
});
test('status reads only and separates durable candidate from process attempt and financial verification',async()=>{
 let runs=0,inspections=0;const service=make({runIntake:async()=>{runs++;},inspectCandidate:async()=>{inspections++;return stored();}});
 const state=await service.status();assert.equal(runs,0);assert.equal(inspections,1);assert.equal(state.lastAttempt,null);assert.equal(state.historyPersistence,'process_only');assert.equal(state.candidate.status,'needs_recheck');assert.equal(state.financialVerification,'not_assessed');assert.equal(state.candidate.financialImportStatus,'not_assessed');assert.equal(state.scheduled,false);assert.ok(!JSON.stringify(state).includes('never expose'));
 state.candidate.status='forged';assert.equal((await service.status()).candidate.status,'needs_recheck');
});
test('manual collection is single flight, duplicate clicks never enqueue and replay never clears candidate recheck',async()=>{
 const pending=deferred();let calls=0;const service=make({runIntake:()=>{calls++;return pending.promise;}});
 const first=service.run();assert.equal((await service.run()).activity,'running');assert.equal((await service.status()).lastAttempt.state,'running');assert.equal(calls,1);
 pending.resolve(completed('replay'));const result=await first;assert.equal(result.activity,'idle');assert.equal(result.lastAttempt.state,'completed');assert.equal(result.lastAttempt.result.status,'replay');assert.equal(result.candidate.status,'needs_recheck');assert.equal(result.lastAttempt.result.coverageCertified,false);assert.ok(!JSON.stringify(result).includes('never expose'));assert.equal(calls,1);
 await service.status();assert.equal(calls,1);
});
test('uncertain run remains blocked after successful inspection and never retries or exposes raw errors',async()=>{
 let calls=0;const service=make({runIntake:async()=>{calls++;throw Error('private-token customer');}});
 const state=await service.run();assert.equal(state.lastAttempt.state,'unconfirmed');assert.equal(state.retryBlocked,true);assert.equal(state.candidate.status,'needs_recheck');assert.ok(!JSON.stringify(state).includes('private-token'));
 await service.status();await service.run();assert.equal(calls,1);
 const restarted=make();const next=await restarted.status();assert.equal(next.lastAttempt,null);assert.equal(next.candidate.status,'needs_recheck');assert.equal(next.historyPersistence,'process_only');
});
test('failed or invalid inspection cannot erase attempt result or assert absent candidate/financial failure',async()=>{
 for(const inspectCandidate of [async()=>{throw Error('private database URL');},async()=>({...stored(),storeId:'wrong'}),async()=>({...stored(),coverageCertified:true}),async()=>({...stored(),exclusions:[{reason:'customer@example.com',count:1}]})]){
 const state=await make({inspectCandidate}).run();assert.equal(state.lastAttempt.state,'completed');assert.equal(state.lastAttempt.result.status,'replay');assert.equal(state.candidate.status,'inspection_unavailable');assert.equal(state.financialVerification,'not_assessed');assert.ok(!JSON.stringify(state).includes('private database'));
 }
});
test('invalid intake receipt is uncertain even if callback resolves',async()=>{
 for(const value of [{...completed('replay'),storeId:'wrong'},{...completed('replay'),financeImported:true},completed('secret-text'),{...completed('replay'),batchId:'secret-token'},{...completed('replay'),batchId:undefined}]){
 const state=await make({runIntake:async()=>value}).run();assert.equal(state.lastAttempt.state,'unconfirmed');assert.equal(state.retryBlocked,true);
 }
});
test('late older inspection cannot overwrite a later-requested observation',async()=>{
 const first=deferred(),second=deferred();let calls=0;const service=make({inspectCandidate:()=>++calls===1?first.promise:second.promise});
 const a=service.status(),b=service.status();second.resolve({...stored(),refundCount:3});assert.equal((await b).candidate.refundCount,3);first.resolve(stored());assert.equal((await a).candidate.refundCount,3);
});
test('unavailable and blocked candidate results preserve absent versus unknown financial events',async()=>{
 const empty=await make({inspectCandidate:async()=>({...stored(),status:'unavailable',retainedBatchCount:0})}).status();assert.equal(empty.candidate.status,'unavailable');assert.equal(empty.candidate.orderCount,undefined);
 const blocked=await make({inspectCandidate:async()=>({...stored(),mappingState:'blocked',mappedEventCount:null,exclusions:[]})}).status();assert.equal(blocked.candidate.mappedEventCount,null);assert.equal(blocked.candidate.mappingState,'blocked');
});
