/** Branded disposable writer only. Typed expense-accrual corrections; no generic SQL or live connection. */
import {amendedExpense} from './history-expense-correction.mjs';
import {reviewerAuthenticator} from '../shopify/reviewer-auth.mjs';
import {profitEvidenceDigest as digest} from '../financial-v1/profit-evidence-reader.mjs';
import {validProfitScope} from '../financial-v1/profit-reporting-service.mjs';
import {requireHistoryHandle} from './history-rehearsal.mjs';
import {readHistoryInTransaction,calculateHistorySources} from './history-reader.mjs';
import {historyOverlays} from './history-versions.mjs';
import {HISTORY_EDITION} from './history-context.mjs';
import {stableId} from './staging-payload.mjs';
const ensure=(x,m)=>{if(!x)throw Error(m);};
const key=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(x);
const summary=p=>({state:'proposed',proposalId:p.proposal_id,proposalHash:p.proposal_hash,versionId:p.payload.versionId});
export function createHistoryCorrectionService(handle,supabase){
 const h=requireHistoryHandle(handle);
 async function transaction(authorization,fn,{readonly=false}={}){
  const user=await reviewerAuthenticator(supabase,authorization)();
  ensure(user.id===h.reviewerId,'Correction reviewer authorisation required');
  return h.db.transaction(async tx=>{
   if(readonly)await tx.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
   await tx.query("SELECT set_config('night_scout.profit_user_id',$1,true)",[user.id]);
   ensure((await tx.query('SELECT store_id FROM public.store_memberships WHERE store_id=$1 AND user_id=$2',[h.storeId,user.id])).rows.length===1,'Correction store membership required');
   if(!readonly)await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['history-v2:'+h.storeId]);
   return fn(tx,user);
  });
 }
 async function proposal(tx,requestKey,proposalHash){
  ensure(key(requestKey),'Invalid immutable request key');const p=(await tx.query('SELECT * FROM finance_history_v2.correction_proposals WHERE store_id=$1 AND request_key=$2',[h.storeId,requestKey])).rows[0];
  ensure(p&&digest(p.payload)===p.proposal_hash&&(!proposalHash||proposalHash===p.proposal_hash),'Proposal digest mismatch or proposal absent');return p;
 }
 async function checkedReceipt(tx,p){
  const row=(await tx.query('SELECT * FROM finance_history_v2.correction_receipts WHERE store_id=$1 AND request_key=$2',[h.storeId,p.request_key])).rows[0];if(!row)return null;
  ensure(row.proposal_hash===p.proposal_hash&&row.version_id===p.payload.versionId,'Receipt identity differs');
  const base=(await tx.query('SELECT snapshot_id FROM finance_history_v2.seals WHERE store_id=$1 AND date_from=$2 AND date_to=$3',[h.storeId,p.payload.scope.from,p.payload.scope.to])).rows[0];
  const chain=await historyOverlays(tx,p.payload.scope,row.version_id,base?.snapshot_id);
  const v=chain.chain.at(-1),selection=(await tx.query('SELECT * FROM finance_history_v2.correction_selections WHERE selection_id=$1',[row.selection_id])).rows[0];
  ensure(v&&selection&&selection.version_id===row.version_id&&selection.proposal_hash===p.proposal_hash&&row.receipt.manifestHash===v.manifest_hash,'Receipt evidence differs');
  const head=(await tx.query('SELECT version_id,selection_id FROM finance_history_v2.version_heads WHERE store_id=$1 AND date_from=$2 AND date_to=$3',[h.storeId,p.payload.scope.from,p.payload.scope.to])).rows[0];
  const successors=(await tx.query('SELECT selection_id FROM finance_history_v2.correction_selections WHERE store_id=$1 AND previous_version_id=$2',[h.storeId,row.version_id])).rows;
  return {outcome:'committed',versionId:row.version_id,selected:head?.version_id===row.version_id&&head.selection_id===row.selection_id&&successors.length===0,receipt:row.receipt};
 }
 return {
  async prepare(input,authorization){return transaction(authorization,async(tx,user)=>{
   const {scope,requestKey,expectedVersionId,eventId,amountPence,reason}=input||{};
   ensure(validProfitScope(scope)&&scope.storeId===h.storeId&&key(requestKey)&&typeof eventId==='string'&&typeof reason==='string'&&reason.trim().length>0&&reason.length<=2000,'Invalid reviewed correction intent');
   const intent={scope,requestKey,expectedVersionId,eventId,amountPence,reason};
   const old=(await tx.query('SELECT * FROM finance_history_v2.correction_proposals WHERE store_id=$1 AND request_key=$2',[h.storeId,requestKey])).rows[0];
   if(old){ensure(digest(old.payload.intent)===digest(intent)&&digest(old.payload)===old.proposal_hash,'Immutable correction request changed');return {...summary(old),replay:true};}
   const current=await readHistoryInTransaction(tx,scope,{now:h.now,selection:{edition:HISTORY_EDITION,versionId:expectedVersionId}});ensure(current.state==='supported','Expected selected version unavailable');
   const base=(await tx.query('SELECT * FROM finance_history_v2.seals WHERE store_id=$1 AND date_from=$2 AND date_to=$3',[h.storeId,scope.from,scope.to])).rows[0];
   const previous=await historyOverlays(tx,scope,expectedVersionId,base.snapshot_id);
   const raw=(await tx.query('SELECT body,row_hash,event_date::text FROM finance_history_v2.events WHERE store_id=$1 AND source_id=$2',[h.storeId,eventId])).rows[0];
   ensure(raw&&digest(raw.body)===raw.row_hash&&raw.event_date>=scope.from&&raw.event_date<=scope.to,'Expense source outside reviewed month');
   const before=previous.overlays.get(eventId)||raw,after=amendedExpense(before.body,amountPence),versionId=stableId('history-correction-version',`${h.storeId}:${requestKey}`);
   const payload={type:'expense-accrual-amount',edition:HISTORY_EDITION,intent,scope,requestKey,expectedVersionId,eventId,amountPence,reason,versionId,beforeHash:digest(before.body),afterHash:digest(after),afterBody:after};
   const p={proposal_id:stableId('history-correction-proposal',`${h.storeId}:${requestKey}`),store_id:h.storeId,request_key:requestKey,payload,proposal_hash:digest(payload)};
   await tx.query('INSERT INTO finance_history_v2.correction_proposals VALUES($1,$2,$3,$4,$5,$6,$7)',[p.proposal_id,p.store_id,p.request_key,JSON.stringify(payload),p.proposal_hash,user.id,h.now().toISOString()]);return summary(p);
  });},
  async review({requestKey,proposalHash,decision,note},authorization){return transaction(authorization,async(tx,user)=>{
   ensure(['approve','reject'].includes(decision)&&typeof note==='string'&&note.trim().length>0&&note.length<=2000,'Explicit review decision/note required');
   const p=await proposal(tx,requestKey,proposalHash),old=(await tx.query('SELECT * FROM finance_history_v2.correction_reviews WHERE proposal_id=$1',[p.proposal_id])).rows[0];
   if(old){ensure(old.proposal_hash===proposalHash&&old.decision===decision&&old.note===note&&old.reviewed_by===user.id,'Immutable review decision changed');return {state:'reviewed',decision,replay:true};}
   await tx.query('INSERT INTO finance_history_v2.correction_reviews VALUES($1,$2,$3,$4,$5,$6)',[p.proposal_id,proposalHash,decision,note,user.id,h.now().toISOString()]);return {state:'reviewed',decision};
  });},
  async publish({requestKey,proposalHash,expectedVersionId,failAt=null,loseAcknowledgement=false},authorization){
   ensure([null,'after-overlay','before-selection','before-commit'].includes(failAt),'Invalid failure injection');
   const result=await transaction(authorization,async(tx,user)=>{
    const p=await proposal(tx,requestKey,proposalHash),receipt=await checkedReceipt(tx,p);if(receipt)return {state:receipt.selected?'selected':'committed',...receipt,replay:true};
    ensure(p.payload.expectedVersionId===expectedVersionId,'Correction expected version differs');
    const review=(await tx.query('SELECT * FROM finance_history_v2.correction_reviews WHERE proposal_id=$1',[p.proposal_id])).rows[0];ensure(review?.decision==='approve'&&review.proposal_hash===proposalHash,'Explicit approval required before publication');
    const scope=p.payload.scope;await tx.query('SELECT version_id FROM finance_history_v2.version_heads WHERE store_id=$1 AND date_from=$2 AND date_to=$3 FOR UPDATE',[h.storeId,scope.from,scope.to]);
    const current=await readHistoryInTransaction(tx,scope,{now:h.now,selection:{edition:HISTORY_EDITION,versionId:expectedVersionId}});ensure(current.state==='supported','Selected version changed; compare-and-set refused');
    const base=(await tx.query('SELECT * FROM finance_history_v2.seals WHERE store_id=$1 AND date_from=$2 AND date_to=$3',[h.storeId,scope.from,scope.to])).rows[0];
    const previous=await historyOverlays(tx,scope,expectedVersionId,base.snapshot_id),raw=(await tx.query('SELECT body,row_hash FROM finance_history_v2.events WHERE store_id=$1 AND source_id=$2',[h.storeId,p.payload.eventId])).rows[0];
    const before=previous.overlays.get(p.payload.eventId)||raw;
    ensure(before&&digest(before.body)===before.row_hash&&before.row_hash===p.payload.beforeHash&&digest(amendedExpense(before.body,p.payload.amountPence))===p.payload.afterHash&&digest(p.payload.afterBody)===p.payload.afterHash,'Reviewed source changed');
    const id=p.payload.versionId,overlays=new Map(previous.overlays);overlays.set(p.payload.eventId,{body:p.payload.afterBody,row_hash:p.payload.afterHash,source_id:p.payload.eventId});
    await tx.query('INSERT INTO finance_history_v2.correction_overlays VALUES($1,$2,$3,$4,$5,$6,$7)',[id,h.storeId,p.payload.eventId,p.payload.beforeHash,JSON.stringify(p.payload.afterBody),p.payload.afterHash,p.proposal_id]);
    if(failAt==='after-overlay')throw Error('Injected correction failure after overlay');
    const coverage=(await tx.query("SELECT * FROM finance_history_v2.coverage WHERE store_id=$1 AND date_from=$2 AND date_to=$3 AND kind='month'",[h.storeId,scope.from,scope.to])).rows[0];
    const computed=await calculateHistorySources(tx,scope,coverage,{overlays}),manifest={...coverage.source_manifest,observedAt:h.now().toISOString(),salesRevision:computed.salesRevision,costRevision:computed.costRevision,versionId:id,parentVersionId:expectedVersionId,proposalHash};
    await tx.query('INSERT INTO finance_history_v2.correction_versions VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,h.storeId,scope.from,scope.to,expectedVersionId,p.proposal_id,computed.salesRevision,computed.costRevision,JSON.stringify(manifest),digest(manifest)]);
    if(failAt==='before-selection')throw Error('Injected correction failure before selection');
    const selectionId=stableId('history-correction-selection',requestKey+id);
    await tx.query('INSERT INTO finance_history_v2.correction_selections VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[selectionId,h.storeId,scope.from,scope.to,expectedVersionId,id,proposalHash,user.id,h.now().toISOString()]);
    const selected=await tx.query('INSERT INTO finance_history_v2.version_heads AS h VALUES($1,$2,$3,$4,$5) ON CONFLICT(store_id,date_from,date_to) DO UPDATE SET version_id=EXCLUDED.version_id,selection_id=EXCLUDED.selection_id WHERE h.version_id=$6 RETURNING version_id',[h.storeId,scope.from,scope.to,id,selectionId,expectedVersionId]);ensure(selected.rows.length===1,'Selected version changed; atomic compare-and-set refused');
    await tx.query('INSERT INTO finance_history_v2.invalidations VALUES($1,$2) ON CONFLICT(snapshot_id) DO NOTHING',[base.snapshot_id,'Explicit reviewed expense correction selected; original evidence retained']);
    const audit={requestKey,proposalHash,versionId:id,parentVersionId:expectedVersionId,selectionId,manifestHash:digest(manifest),observedAt:h.now().toISOString(),remoteApplied:false};
    await tx.query('INSERT INTO finance_history_v2.correction_receipts VALUES($1,$2,$3,$4,$5,$6)',[h.storeId,requestKey,proposalHash,id,selectionId,JSON.stringify(audit)]);
    if(failAt==='before-commit')throw Error('Injected correction failure before commit');return {state:'selected',versionId:id,receipt:audit,replay:false};
   });
   if(loseAcknowledgement){const error=Error('Correction commit acknowledgement uncertain; reconcile the immutable request');error.code='HISTORY_COMMIT_ACK_UNKNOWN';throw error;}return result;
  },
  async reconcile({requestKey,proposalHash},authorization){return transaction(authorization,async tx=>{
   const p=await proposal(tx,requestKey,proposalHash),receipt=await checkedReceipt(tx,p);if(receipt)return receipt;
   const rows=(await tx.query('SELECT version_id FROM finance_history_v2.correction_overlays WHERE version_id=$1 UNION ALL SELECT version_id FROM finance_history_v2.correction_versions WHERE version_id=$1',[p.payload.versionId])).rows;
   return rows.length?{outcome:'conflict',versionId:p.payload.versionId,selected:false}:{outcome:'not-committed',versionId:p.payload.versionId,selected:false};
  },{readonly:true});}
 };
}
