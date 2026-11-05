/** Explicit, member-authorised v2 version resolution. Never selects an arbitrary latest seal. */
import {amendedExpense} from './history-expense-correction.mjs';
import {profitEvidenceDigest as digest} from '../financial-v1/profit-evidence-reader.mjs';
import {HISTORY_EDITION} from './history-context.mjs';
const ensure=(ok,message)=>{if(!ok)throw Error(message);};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export function validHistorySelection(selection){return !!selection&&Object.keys(selection).sort().join(',')==='edition,versionId'&&selection.edition===HISTORY_EDITION&&uuid(selection.versionId);}
export async function historyVersionChain(tx,scope,versionId,baseId){
 const chain=[];const seen=new Set();let current=versionId;
 while(current!==baseId){ensure(uuid(current)&&!seen.has(current)&&chain.length<64,'Invalid correction ancestry');seen.add(current);
  const row=(await tx.query('SELECT *,date_from::text scope_from,date_to::text scope_to FROM finance_history_v2.correction_versions WHERE version_id=$1 AND store_id=$2',[current,scope.storeId])).rows[0];
  ensure(row&&row.scope_from===scope.from&&row.scope_to===scope.to&&row.manifest_hash===digest(row.source_manifest),'Correction version scope/manifest mismatch');
  const overlay=(await tx.query('SELECT * FROM finance_history_v2.correction_overlays WHERE version_id=$1 AND store_id=$2',[current,scope.storeId])).rows[0];
  const proposal=(await tx.query('SELECT * FROM finance_history_v2.correction_proposals WHERE proposal_id=$1 AND store_id=$2',[row.proposal_id,scope.storeId])).rows[0];
  const review=(await tx.query('SELECT * FROM finance_history_v2.correction_reviews WHERE proposal_id=$1',[row.proposal_id])).rows[0];
  const selection=(await tx.query('SELECT *,date_from::text scope_from,date_to::text scope_to FROM finance_history_v2.correction_selections WHERE version_id=$1 AND store_id=$2',[current,scope.storeId])).rows[0];
  ensure(overlay&&digest(overlay.body)===overlay.row_hash&&overlay.proposal_id===row.proposal_id&&proposal&&digest(proposal.payload)===proposal.proposal_hash&&review?.decision==='approve'&&review.proposal_hash===proposal.proposal_hash&&selection?.proposal_hash===proposal.proposal_hash&&selection.previous_version_id===row.parent_version_id&&selection.scope_from===scope.from&&selection.scope_to===scope.to,'Correction approval/selection evidence missing');
  const p=proposal.payload;ensure(p.edition===HISTORY_EDITION&&digest(p.scope)===digest(scope)&&digest(p.intent.scope)===digest(scope)&&p.intent.expectedVersionId===p.expectedVersionId&&p.intent.eventId===p.eventId&&p.intent.amountPence===p.amountPence&&p.intent.reason===p.reason&&digest(p.afterBody)===overlay.row_hash&&p.type==='expense-accrual-amount'&&p.expectedVersionId===row.parent_version_id&&p.versionId===current&&p.eventId===overlay.source_id&&p.beforeHash===overlay.previous_hash&&p.afterHash===overlay.row_hash,'Correction source lineage differs');
  chain.push({...row,overlay});current=row.parent_version_id;
 }
 return chain.reverse();
}
export async function historyOverlays(tx,scope,versionId,baseId){
 const chain=await historyVersionChain(tx,scope,versionId,baseId),overlays=new Map();
 for(const v of chain){const o=v.overlay,prior=overlays.get(o.source_id)||(await tx.query('SELECT source_id,body,row_hash FROM finance_history_v2.events WHERE store_id=$1 AND source_id=$2',[scope.storeId,o.source_id])).rows[0];ensure(prior&&digest(prior.body)===prior.row_hash&&prior.row_hash===o.previous_hash,'Correction predecessor changed');const proposal=(await tx.query('SELECT payload FROM finance_history_v2.correction_proposals WHERE proposal_id=$1',[v.proposal_id])).rows[0];ensure(digest(amendedExpense(prior.body,proposal.payload.amountPence))===o.row_hash,'Correction does not match approved typed financial change');overlays.set(o.source_id,{source_id:o.source_id,body:o.body,row_hash:o.row_hash});}
 return {chain,overlays};
}
export async function resolveHistorySelection(tx,scope,base,selection){
 const head=(await tx.query('SELECT * FROM finance_history_v2.version_heads WHERE store_id=$1 AND date_from=$2 AND date_to=$3',[scope.storeId,scope.from,scope.to])).rows[0];
 if(selection!==undefined&&!validHistorySelection(selection))return null;
 const chosen=selection?.versionId||base.snapshot_id;
 if(head&&(!selection||chosen!==head.version_id))return null;
 if((await tx.query('SELECT selection_id FROM finance_history_v2.correction_selections WHERE store_id=$1 AND previous_version_id=$2',[scope.storeId,chosen])).rows.length)return null;
 if(!head&&chosen!==base.snapshot_id)return null;
 if(chosen===base.snapshot_id){const invalid=(await tx.query('SELECT snapshot_id FROM finance_history_v2.invalidations WHERE snapshot_id=$1',[chosen])).rows.length;return invalid?null:{versionId:chosen,seal:base,overlays:new Map(),kind:'base'};}
 const {chain,overlays}=await historyOverlays(tx,scope,chosen,base.snapshot_id),seal=chain.at(-1);
 ensure(seal&&head.selection_id===(await tx.query('SELECT selection_id FROM finance_history_v2.correction_selections WHERE version_id=$1',[chosen])).rows[0]?.selection_id,'Selected version pointer mismatch');
 return {versionId:chosen,seal,overlays,kind:'expense-correction'};
}
