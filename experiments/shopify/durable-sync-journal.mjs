import {INTAKE_TARGET} from './intake-runtime.mjs';
import {createOperatorSyncService} from './operator-sync-service.mjs';
const states=['recorded_requires_review','changed_requires_review','replay','historical_replay','stale_source','conflicting_source','missing_source'];
const valid=ok=>{if(!ok)throw Error('Durable sync history unavailable; inspect before retrying');};
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const iso=v=>new Date(v).toISOString();
/** Uses the existing intakeDatabase adapter/role. All writes are metadata only.
 * Persisted unresolved attempts block a new attempt across process restarts.
 */
export function createDurableSyncJournal(db,{scope}){
 valid(typeof db?.transaction==='function'&&scope?.storeId===INTAKE_TARGET.storeId&&day(scope.from)&&day(scope.to)&&scope.from<=scope.to&&(Date.parse(scope.to)-Date.parse(scope.from))/86400000<31);
 const fixed=Object.freeze({storeId:scope.storeId,from:scope.from,to:scope.to});
 const project=r=>r?{id:r.id,state:r.state,startedAt:iso(r.started_at),finishedAt:r.finished_at?iso(r.finished_at):null,from:typeof r.date_from==='string'?r.date_from:iso(r.date_from).slice(0,10),to:typeof r.date_to==='string'?r.date_to:iso(r.date_to).slice(0,10),resultCode:r.result_code}:null;
 async function query(fn){try{return await db.transaction(fn);}catch{throw Error('Durable sync history unavailable; inspect before retrying');}}
 return Object.freeze({scope:fixed,
 async begin(){return query(async tx=>{const {rows}=await tx.query('INSERT INTO ingest_v1.sync_attempts(store_id,date_from,date_to) VALUES($1,$2,$3) RETURNING id',[fixed.storeId,fixed.from,fixed.to]);valid(rows.length===1);return rows[0].id;});},
 async finish(id,{state,resultCode=null}){valid(['completed','unconfirmed'].includes(state)&&(state==='completed'?states.includes(resultCode):resultCode===null));return query(async tx=>{const {rows}=await tx.query('UPDATE ingest_v1.sync_attempts SET state=$1,result_code=$2 WHERE id=$3 AND store_id=$4 AND date_from=$5 AND date_to=$6 AND state=\'running\' RETURNING id',[state,resultCode,id,fixed.storeId,fixed.from,fixed.to]);valid(rows.length===1);});},
 async latest(){return query(async tx=>{const {rows}=await tx.query('SELECT id,state,started_at,finished_at,date_from,date_to,result_code FROM ingest_v1.sync_attempts WHERE store_id=$1 ORDER BY started_at DESC,id DESC LIMIT 1',[fixed.storeId]);return project(rows[0]);});},
 });
}
/** Optional wrapper; without a journal preserves the current process-only service.
 * A durable start must commit before intake. A finish acknowledgement failure
 * stays uncertain; no automatic second finish or intake is attempted.
 */
export function createJournaledOperatorSyncService({journal,...options}){
 if(!journal)return createOperatorSyncService(options);
 valid(['begin','finish','latest'].every(k=>typeof journal[k]==='function'));
 valid(journal.scope?.storeId===options.scope?.storeId&&journal.scope?.from===options.scope?.from&&journal.scope?.to===options.scope?.to);
 options={...options,scope:Object.freeze({...options.scope})};
 let active=false;
 const inner=createOperatorSyncService({...options,runIntake:async()=>{
 const id=await journal.begin();
 let receipt;
 try{receipt=await options.runIntake();valid(receipt?.storeId===options.scope.storeId&&receipt.from===options.scope.from&&receipt.to===options.scope.to&&states.includes(receipt.status)&&receipt.coverageCertified===false&&receipt.financeImported===false&&receipt.reviewRequired===true);valid(receipt.batchId===undefined||uuid(receipt.batchId));if(['recorded_requires_review','changed_requires_review','replay','historical_replay'].includes(receipt.status))valid(uuid(receipt.batchId));valid(receipt.mappingState===undefined||['mapped_for_review','blocked'].includes(receipt.mappingState));}
 catch{try{await journal.finish(id,{state:'unconfirmed'});}catch{}throw Error('Intake outcome unconfirmed; inspect durable history');}
 await journal.finish(id,{state:'completed',resultCode:receipt.status});return receipt;
 }});
 async function decorate(snapshot){
 try{const latestAttempt=await journal.latest();return {...snapshot,historyPersistence:'durable',durableHistory:{state:'available',latestAttempt},retryBlocked:snapshot.retryBlocked||['running','unconfirmed'].includes(latestAttempt?.state)};}
 catch{return {...snapshot,historyPersistence:'durable',durableHistory:{state:'unavailable',latestAttempt:null},retryBlocked:true};}
 }
 return Object.freeze({
 async status(){return decorate(await inner.status());},
 async run(){
 if(active)return decorate(await inner.status());active=true;
 try{const before=await decorate(await inner.status());if(before.retryBlocked)return before;return decorate(await inner.run());}finally{active=false;}
 },
 });
}
