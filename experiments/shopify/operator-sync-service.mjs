import {INTAKE_TARGET} from './intake-runtime.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const count=v=>Number.isSafeInteger(v)&&v>=0;
const ensure=ok=>{if(!ok)throw Error('Invalid operator sync configuration or receipt');};
const receiptStates=['recorded_requires_review','changed_requires_review','replay','historical_replay','stale_source','conflicting_source','missing_source'];
/** Process-local operator coordinator. Trusted callbacks close over an approved
 * private configuration; callers never pass credentials, target or dates to run.
 * This does not install a scheduler, expose a merchant endpoint or certify data.
 * A restart loses attempts; inspect durable candidates before resuming work.
 */
export function createOperatorSyncService({scope,runIntake,inspectCandidate,now=Date.now}={}){
 ensure(scope?.storeId===INTAKE_TARGET.storeId&&date(scope.from)&&date(scope.to)&&scope.from<=scope.to&&(Date.parse(scope.to)-Date.parse(scope.from))/86400000<31&&typeof runIntake==='function'&&typeof inspectCandidate==='function'&&typeof now==='function');
 const fixed=Object.freeze({projectRef:INTAKE_TARGET.projectRef,storeId:scope.storeId,from:scope.from,to:scope.to});
 let running=false,lastAttempt=null,retryBlocked=false,inspectionSequence=0,candidate={status:'not_checked'};
 const time=()=>{const ms=now();ensure(Number.isFinite(ms));return new Date(ms).toISOString();};
 const matches=r=>r?.storeId===fixed.storeId&&r.from===fixed.from&&r.to===fixed.to;
 const snapshot=()=>structuredClone({...fixed,activity:running?'running':'idle',lastAttempt,candidate,retryBlocked,financialVerification:'not_assessed',historyPersistence:'process_only',scheduled:false});
 function resultProjection(r){
 ensure(matches(r)&&receiptStates.includes(r.status)&&r.coverageCertified===false&&r.financeImported===false&&r.reviewRequired===true);
 ensure(r.batchId===undefined||uuid(r.batchId));if(['recorded_requires_review','changed_requires_review','replay','historical_replay'].includes(r.status))ensure(uuid(r.batchId));ensure(r.mappingState===undefined||['mapped_for_review','blocked'].includes(r.mappingState));
 return {status:r.status,...(r.batchId?{batchId:r.batchId}:{}),...(r.mappingState?{mappingState:r.mappingState}:{}),coverageCertified:false,financeImported:false,reviewRequired:true};
 }
 function candidateProjection(r){
 ensure(matches(r)&&r.projectRef===fixed.projectRef&&['current_unverified','needs_recheck','unavailable'].includes(r.status)&&r.coverageCertified===false&&r.candidateWriteAttempted===false&&r.financialImportStatus==='not_assessed'&&r.reviewRequired===true&&count(r.retainedBatchCount));
 ensure(typeof r.observedAt==='string'&&Number.isFinite(Date.parse(r.observedAt)));
 const base={status:r.status,observedAt:new Date(r.observedAt).toISOString(),retainedBatchCount:r.retainedBatchCount,coverageCertified:false,financialImportStatus:'not_assessed'};
 if(r.status==='unavailable')return base;
 ensure(uuid(r.batchId)&&['mapped_for_review','blocked'].includes(r.mappingState)&&count(r.orderCount)&&count(r.refundCount)&&(r.mappedEventCount===null||count(r.mappedEventCount))&&Array.isArray(r.exclusions));
 const exclusions=r.exclusions.map(e=>{ensure(['TEST_ORDER','UNPAID_ORDER','OTHER'].includes(e.reason)&&count(e.count));return {reason:e.reason,count:e.count};});
 return {...base,batchId:r.batchId,mappingState:r.mappingState,orderCount:r.orderCount,refundCount:r.refundCount,mappedEventCount:r.mappedEventCount,exclusions};
 }
 async function status(){
 const sequence=++inspectionSequence;
 try{const result=candidateProjection(await inspectCandidate());if(sequence===inspectionSequence)candidate=result;}
 catch{if(sequence===inspectionSequence)candidate={status:'inspection_unavailable',message:'Candidate inspection unavailable. No conclusion about an earlier write can be drawn.'};}
 return snapshot();
 }
 async function run(){
 // Duplicate clicks never enqueue another intake. Unknown outcomes require
 // private operator recovery; a read-only status refresh cannot clear this gate.
 if(running||retryBlocked)return snapshot();
 const startedAt=time();running=true;lastAttempt={state:'running',startedAt};
 try{const result=resultProjection(await runIntake());lastAttempt={state:'completed',startedAt,finishedAt:time(),result};}
 catch{retryBlocked=true;lastAttempt={state:'unconfirmed',startedAt,finishedAt:time(),message:'Intake outcome unconfirmed. Inspect candidate state and complete operator recovery before another run.'};}
 finally{running=false;}
 return status();
 }
 return Object.freeze({status,run});
}
