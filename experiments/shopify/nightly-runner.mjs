import {INTAKE_TARGET} from './intake-runtime.mjs';
import {nightlyPlan} from './nightly-plan.mjs';
import {createDurableSyncJournal} from './durable-sync-journal.mjs';
const failure=()=>Error('Nightly outcome unconfirmed; inspect durable history before another collection.');
const codes=['recorded_requires_review','changed_requires_review','replay','historical_replay','stale_source','conflicting_source','missing_source'];
/** Daily reservation commits before existing durable journal/intake starts. A
 * lost acknowledgement never invokes intake. Reservations are never released.
 * Production activation and financial date scope remain explicit decisions.
 */
export function createNightlyRunner({db,scope,runIntake,now=()=>new Date()}){
 const journal=createDurableSyncJournal(db,{scope});
 if(typeof runIntake!=='function')throw failure();
 const fixed={...scope};
 return {async tick(){
  const plan=nightlyPlan(now(),INTAKE_TARGET.timezone);
  if(!plan.due)return {state:'not_due',...plan,financeImported:false};
  let claim;
  try{claim=await db.transaction(async tx=>{
   const rows=(await tx.query(`INSERT INTO ingest_v1.nightly_claims(store_id,local_date,timezone,scheduled_at,date_from,date_to) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(store_id,local_date) DO NOTHING RETURNING id`,[fixed.storeId,plan.localDate,plan.timezone,plan.scheduledAt,fixed.from,fixed.to])).rows;
   return rows[0]?.id;
  });}catch{throw failure();}
  if(!claim)return {state:'already_claimed',localDate:plan.localDate,financeImported:false};
  let attemptId,finishingClaim=false;
  try{
   attemptId=await journal.begin();
   const receipt=await runIntake();
   if(receipt?.storeId!==fixed.storeId||receipt.from!==fixed.from||receipt.to!==fixed.to||receipt.financeImported!==false||receipt.coverageCertified!==false||receipt.reviewRequired!==true||!codes.includes(receipt.status)||(receipt.mappingState!==undefined&&!['mapped_for_review','blocked'].includes(receipt.mappingState))||(receipt.batchId!==undefined&&!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(receipt.batchId)))||(['recorded_requires_review','changed_requires_review','replay','historical_replay'].includes(receipt.status)&&!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(receipt.batchId??''))))throw failure();
   await journal.finish(attemptId,{state:'completed',resultCode:receipt.status});
   finishingClaim=true;await finish('completed');
   return {state:'completed',localDate:plan.localDate,resultCode:receipt.status,financeImported:false,coverageCertified:false,reviewRequired:true};
  }catch{
   // Do not repeat a terminal write: its COMMIT may have succeeded. An attempt
   // left running is already a durable blocking signal for the operator.
   if(!finishingClaim){try{await finish('unconfirmed');}catch{}}
   throw failure();
  }
  async function finish(state){await db.transaction(async tx=>{
   const r=await tx.query('UPDATE ingest_v1.nightly_claims SET state=$1 WHERE id=$2 AND state=\'running\' RETURNING id',[state,claim]);if(r.rows.length!==1)throw failure();
  });}
 }};
}
