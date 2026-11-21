/** Offline rehearsal protocol only. No network/env/credential/CLI or remote adapter.
 * Injected SQL, receipt and financial ports are trusted local test seams, not authority. */
import {prepareCustomerActivationManifest} from './customer-activation-manifest.mjs';
import {supplementalDigest as hash} from './supplemental-reader.mjs';
const require=(ok,m)=>{if(!ok)throw Error(m);};
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const same=(a,b)=>hash(a)===hash(b);
const instant=x=>new Date(x).toISOString();
export function prepareCustomerPublicationPlan(input,financialSealHash,protectedStateHash){
 hash(input);require(sha(financialSealHash)&&sha(protectedStateHash),'Exact independently supplied financial and protected-state fingerprints required');
 const manifest=prepareCustomerActivationManifest(structuredClone(input));
 const preconditions=manifest.existingSelectionPreconditions??[];
 require(!manifest.withdrawals.length||preconditions.length>=manifest.withdrawals.length,'Bound prior selection provenance required');
 const binding={candidateHash:manifest.candidateHash,sourceRevision:manifest.sourceRevision,files:manifest.files,inventoryHash:manifest.protectedInventory.hash,financialSealHash,protectedStateHash,existingSelectionPreconditions:preconditions};
 return freeze({contract:'customer-publication-rehearsal-plan-v1',rehearsalOnly:true,activationAllowed:false,manifest,binding,protocolHash:hash(binding)});
}
export function createCustomerPublicationProtocol(port){
 require(port?.purpose==='disposable-local-rehearsal'&&['transaction','readback','readReceipt','appendReceipt','financialSeals','protectedState','authority'].every(k=>typeof port[k]==='function'),'Explicit disposable local transaction/readback/receipt ports required');
 async function invariant(tx,p){
  const store=p.manifest.proposal.operations[0].body.scope.storeId;
  const {rows}=await tx.query("SELECT body,body_hash,invalidated FROM finance_review_supplement_v1.snapshots WHERE store_id=$1 AND date_from>='2024-11-01' AND date_to<='2026-10-31' ORDER BY body_hash",[store]);
  require(rows.length===48&&rows.every(r=>r.invalidated===false&&hash(r.body)===r.body_hash),'Protected48 changed');
  require(hash(rows.map(r=>({body:r.body,bodyHash:r.body_hash})))===p.binding.inventoryHash,'Protected inventory fingerprint changed');
  require(hash(await port.financialSeals(tx,store))===p.binding.financialSealHash,'Unrelated financial seals changed');
  require(hash(await port.protectedState(tx,store))===p.binding.protectedStateHash,'Protected indexed metadata or unrelated financial baseline changed');
 }
 const selectRow=r=>({baseSnapshotId:r.base_snapshot_id,sidecarVersionId:r.version_id,selectedBy:r.selected_by,selectedAt:instant(r.selected_at)});
 async function inspect(tx,p){
  await invariant(tx,p);const m=p.manifest,states=[];
  for(const target of [...m.selections,...m.withdrawals]){
   const op=m.proposal.operations.find(o=>o.body.baseBodyHash===target.baseBodyHash);require(op,'Missing pinned sidecar operation');
   const expectedAuthority={state:'supported',scope:op.body.scope,financialVersionId:op.body.financialVersionId,salesRevision:op.body.salesRevision,costRevision:op.body.costRevision};
   // Publishing requires currently supported financial evidence. Withdrawal only
   // removes eligibility and must remain possible after that evidence is invalidated.
   if(m.selections.includes(target))require(same(await port.authority(tx,structuredClone(expectedAuthority)),expectedAuthority),'Current canonical financial authority changed');
   const base=(await tx.query('SELECT body_hash,body,invalidated FROM finance_review_supplement_v1.snapshots WHERE snapshot_id=$1',[target.baseSnapshotId])).rows;
   require(base.length===1&&!base[0].invalidated&&base[0].body_hash===target.baseBodyHash&&same(base[0].body.scope,op.body.scope)&&base[0].body.financialVersionId===op.body.financialVersionId,'Exact acquisition snapshot changed');
   const versions=(await tx.query('SELECT version_id,base_snapshot_id,base_body_hash,body FROM finance_customer_sidecar_v1.versions WHERE base_snapshot_id=$1 OR version_id=$2',[target.baseSnapshotId,target.sidecarVersionId])).rows;
   const selected=(await tx.query('SELECT * FROM finance_customer_sidecar_v1.selections WHERE base_snapshot_id=$1 OR version_id=$2',[target.baseSnapshotId,target.sidecarVersionId])).rows;
   const withdrawn=(await tx.query('SELECT * FROM finance_customer_sidecar_v1.withdrawals WHERE base_snapshot_id=$1 OR version_id=$2',[target.baseSnapshotId,target.sidecarVersionId])).rows;
   const versionOK=versions.length===1&&versions[0].version_id===target.sidecarVersionId&&versions[0].base_snapshot_id===target.baseSnapshotId&&versions[0].base_body_hash===target.baseBodyHash&&same(versions[0].body,op.body)&&hash(versions[0].body)===target.sidecarVersionId;
   const selectionExpected=m.selections.includes(target)?target:p.binding.existingSelectionPreconditions.find(s=>s.baseBodyHash===target.baseBodyHash);
   require(selectionExpected,'Missing exact archived selection');
   const expected={baseSnapshotId:selectionExpected.baseSnapshotId,sidecarVersionId:selectionExpected.sidecarVersionId,selectedBy:selectionExpected.selectedBy,selectedAt:instant(selectionExpected.selectedAt)};
   const selectionOK=selected.length===1&&same(selectRow(selected[0]),expected);
   if(m.selections.includes(target)){
    if(versions.length===0&&selected.length===0&&withdrawn.length===0)states.push('absent');
    else if(versionOK&&selectionOK&&withdrawn.length===0)states.push('complete');else states.push('conflict');
   }else{
    if(!versionOK||!selectionOK)states.push('conflict');
    else if(withdrawn.length===0)states.push('absent');
    else if(withdrawn.length===1&&withdrawn[0].base_snapshot_id===target.baseSnapshotId&&withdrawn[0].version_id===target.sidecarVersionId&&withdrawn[0].withdrawn_by===target.withdrawnBy&&instant(withdrawn[0].withdrawn_at)===instant(target.withdrawnAt)&&withdrawn[0].reason_code===target.reasonCode)states.push('complete');else states.push('conflict');
   }
  }
  return states.every(x=>x==='absent')?'absent':states.every(x=>x==='complete')?'complete':'conflict';
 }
 const receipt=p=>({contract:'customer-publication-rehearsal-receipt-v1',rehearsalOnly:true,protocolHash:p.protocolHash,candidateHash:p.manifest.candidateHash,sourceRevision:p.manifest.sourceRevision,inventoryHash:p.binding.inventoryHash,financialSealHash:p.binding.financialSealHash,protectedStateHash:p.binding.protectedStateHash,tuplesHash:hash({selections:p.manifest.selections,withdrawals:p.manifest.withdrawals,preconditions:p.binding.existingSelectionPreconditions})});
 async function readOutcome(p){return port.readback(async tx=>{
  await tx.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
  const state=await inspect(tx,p),saved=await port.readReceipt(tx,p.protocolHash);
  if(state==='complete'&&saved&&same(saved,receipt(p)))return 'complete';
  if(state==='absent'&&!saved)return 'absent';return 'conflict';
 });}
 return {async execute(input,pinned){
  hash(pinned);const p=prepareCustomerPublicationPlan(input,pinned.financialSealHash,pinned.protectedStateHash);
  require(pinned.protocolHash===p.protocolHash&&pinned.candidateHash===p.manifest.candidateHash&&pinned.sourceRevision===p.manifest.sourceRevision&&pinned.inventoryHash===p.binding.inventoryHash&&pinned.protectedStateHash===p.binding.protectedStateHash&&same(pinned.files,p.manifest.files),'Exact independently pinned plan required');
  let wasReplay=false;
  try{
   await port.transaction(async tx=>{
    await tx.exec('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    const state=await inspect(tx,p),saved=await port.readReceipt(tx,p.protocolHash);
    if(state==='complete'&&saved&&same(saved,receipt(p))){wasReplay=true;return;}
    require(state==='absent'&&!saved,'Conflicting, partial or withdrawn state; no replacement/retry');
    await port.checkpoint?.('preinsert',tx);
    for(const s of p.manifest.selections){
     const op=p.manifest.proposal.operations.find(o=>o.versionId===s.sidecarVersionId),b=op.body;
     await tx.query('INSERT INTO finance_customer_sidecar_v1.versions VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)',[op.versionId,s.baseSnapshotId,b.baseBodyHash,b.scope.storeId,b.financialVersionId,b.scope.from,b.scope.to,b.salesRevision,b.costRevision,JSON.stringify(b)]);
     await port.checkpoint?.('postinsert',tx);
     await tx.query('INSERT INTO finance_customer_sidecar_v1.selections VALUES($1,$2,$3,$4)',[s.baseSnapshotId,s.sidecarVersionId,s.selectedBy,s.selectedAt]);
    }
    for(const w of p.manifest.withdrawals)await tx.query('INSERT INTO finance_customer_sidecar_v1.withdrawals VALUES($1,$2,$3,$4,$5)',[w.baseSnapshotId,w.sidecarVersionId,w.withdrawnBy,w.withdrawnAt,w.reasonCode]);
    require(await inspect(tx,p)==='complete','Post-write exact tuple reconciliation failed');
    await port.appendReceipt(tx,receipt(p));await port.checkpoint?.('precommit',tx);
    require(same(await port.readReceipt(tx,p.protocolHash),receipt(p))&&await inspect(tx,p)==='complete','Durable receipt or final protected state mismatch');
   });
   const outcome=await readOutcome(p);return freeze({rehearsalOnly:true,activationAllowed:false,state:outcome==='complete'?(wasReplay?'already-applied':'applied-confirmed'):'conflict',retryAllowed:false,protocolHash:p.protocolHash});
  }catch{
   // No write is retried, including when commit may have succeeded but its ACK was lost.
   let outcome;try{outcome=await readOutcome(p);}catch{outcome='unknown';}
   return freeze({rehearsalOnly:true,activationAllowed:false,state:outcome==='complete'?'applied-confirmed-after-uncertain-ack':outcome==='absent'?'not-applied-readback-confirmed':outcome==='conflict'?'conflict':'outcome-unknown',retryAllowed:false,protocolHash:p.protocolHash});
  }
 }};
}
