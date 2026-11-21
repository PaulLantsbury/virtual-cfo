/** Pure bounded preparation: no executor, SQL connection, credentials or activation. */
import {createHash} from 'node:crypto';
import {supplementalDigest as digest} from './supplemental-reader.mjs';
import {prepareCustomerSummaryVersions} from './customer-summary-version.mjs';
const fail=(ok,m)=>{if(!ok)throw Error(m);};
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const stamp=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,19)===v.slice(0,19);
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const paths={storage:'experiments/synthetic-company/customer-sidecar-storage.sql',recovery:'experiments/synthetic-company/customer-sidecar-recovery.sql',reader:'experiments/synthetic-company/customer-sidecar-reader.mjs'};
export function prepareCustomerActivationManifest(input){
 // Strict bounded JSON descriptor validation precedes reads; clone eliminates caller mutation.
 digest(input);input=structuredClone(input);
 const {sourceRevision,artifacts,expectedArtifactHashes,baseRows,expectedInventoryHash,candidates,baseSnapshots,selections=[],withdrawals=[],existingSelections=[],existingSidecars=[],reviewedAt,hostedEvidence={}}=input;
 fail(typeof sourceRevision==='string'&&/^[a-f0-9]{40}$/.test(sourceRevision)&&stamp(reviewedAt),'Exact source revision and review instant required');
 const files={};
 for(const key of Object.keys(paths)){
  const f=artifacts?.[key];fail(f&&f.path===paths[key]&&typeof f.content==='string'&&f.content.length>0&&sha(f.sha256)&&sha(expectedArtifactHashes?.[key]),'Exact storage/recovery/reader file bytes and anchors required');
  const hash=createHash('sha256').update(f.content,'utf8').digest('hex');fail(hash===f.sha256&&hash===expectedArtifactHashes[key],'Artifact bytes/hash mismatch');files[key]={path:f.path,sha256:hash};
 }
 fail(Array.isArray(candidates)&&candidates.length>=1&&candidates.length<=24&&Array.isArray(existingSidecars)&&existingSidecars.length<=24,'Bounded acquisition candidate subset required');
 const proposal=prepareCustomerSummaryVersions({baseRows,candidates,existingSidecars});
 fail(sha(expectedInventoryHash)&&proposal.baseInventoryHash===expectedInventoryHash,'Independent complete48 inventory hash mismatch');
 const bases=new Map(baseRows.map(r=>[r.bodyHash,r.body])),planned=new Map(proposal.operations.map(o=>[o.body.baseBodyHash,o]));
 fail(Array.isArray(baseSnapshots)&&baseSnapshots.length>=1&&baseSnapshots.length<=24&&Array.isArray(selections)&&Array.isArray(withdrawals)&&Array.isArray(existingSelections)&&selections.length<=24&&withdrawals.length<=24&&existingSelections.length<=24,'Bounded snapshot/selection plans required');
 const snapshots=new Map(),ids=new Set();
 for(const row of baseSnapshots){fail(row&&sha(row.baseBodyHash)&&bases.get(row.baseBodyHash)?.kind==='acquisition'&&uuid(row.baseSnapshotId)&&!snapshots.has(row.baseBodyHash)&&!ids.has(row.baseSnapshotId),'Exact unique acquisition snapshot mapping required');snapshots.set(row.baseBodyHash,row.baseSnapshotId);ids.add(row.baseSnapshotId);}
 const existing=new Map(existingSidecars.map(v=>[v.body.baseBodyHash,v])),selected=new Map();
 for(const row of existingSelections){const v=existing.get(row.baseBodyHash);fail(v&&v.versionId===row.sidecarVersionId&&snapshots.has(row.baseBodyHash)&&uuid(row.selectedBy)&&stamp(row.selectedAt)&&Date.parse(row.selectedAt)<=Date.parse(reviewedAt)&&Date.parse(row.selectedAt)>=Date.parse(bases.get(row.baseBodyHash).observedAt)&&!selected.has(row.baseBodyHash),'Invalid existing selected tuple readback');selected.set(row.baseBodyHash,row);}
 const touched=new Set(),select=[];
 for(const row of selections){const op=planned.get(row.baseBodyHash),base=bases.get(row.baseBodyHash);fail(op&&op.versionId===row.sidecarVersionId&&snapshots.has(row.baseBodyHash)&&!selected.has(row.baseBodyHash)&&!touched.has(row.baseBodyHash)&&uuid(row.selectedBy)&&stamp(row.selectedAt)&&Date.parse(row.selectedAt)>=Date.parse(base.observedAt)&&Date.parse(row.selectedAt)<=Date.parse(reviewedAt),'Selection must name one exact unselected planned acquisition version');touched.add(row.baseBodyHash);select.push({baseBodyHash:row.baseBodyHash,baseSnapshotId:snapshots.get(row.baseBodyHash),sidecarVersionId:row.sidecarVersionId,selectedBy:row.selectedBy,selectedAt:row.selectedAt});}
 const withdraw=[];
 for(const row of withdrawals){const prior=selected.get(row.baseBodyHash);fail(prior&&prior.sidecarVersionId===row.sidecarVersionId&&snapshots.has(row.baseBodyHash)&&!touched.has(row.baseBodyHash)&&uuid(row.withdrawnBy)&&stamp(row.withdrawnAt)&&Date.parse(row.withdrawnAt)>=Date.parse(prior.selectedAt)&&Date.parse(row.withdrawnAt)<=Date.parse(reviewedAt)&&['source-correction','scope-error','owner-withdrawal'].includes(row.reasonCode),'Withdrawal must name one exact previously selected tuple and reason');touched.add(row.baseBodyHash);withdraw.push({baseBodyHash:row.baseBodyHash,baseSnapshotId:snapshots.get(row.baseBodyHash),sidecarVersionId:row.sidecarVersionId,withdrawnBy:row.withdrawnBy,withdrawnAt:row.withdrawnAt,reasonCode:row.reasonCode});}
 fail(touched.size>=1&&touched.size<=24,'At least one bounded selection or withdrawal required');
 fail([...planned].every(([key,op])=>op.action!=='propose-add'||touched.has(key)&&!selected.has(key)),'New sidecars require an explicit matching selection plan');
 const candidateHash=digest({sourceRevision,files,baseInventoryHash:expectedInventoryHash,operations:proposal.operations,selections:select,withdrawals:withdraw});
 const gates=['catalog','authority','reportingRole','transactionReceipt'];const blockers=[];const evidence={};
 for(const gate of gates){const r=hostedEvidence[gate];if(!r){blockers.push('Missing independently verified hosted '+gate+' receipt');continue;}fail(r&&r.state==='verified'&&sha(r.receiptHash)&&stamp(r.observedAt)&&Date.parse(r.observedAt)<=Date.parse(reviewedAt)&&r.sourceRevision===sourceRevision&&r.baseInventoryHash===expectedInventoryHash&&r.candidateHash===candidateHash&&Date.parse(reviewedAt)-Date.parse(r.observedAt)<=86400000,'Hosted gate receipt must bind exact source and inventory');evidence[gate]={state:r.state,receiptHash:r.receiptHash,observedAt:r.observedAt,sourceRevision:r.sourceRevision,baseInventoryHash:r.baseInventoryHash,candidateHash:r.candidateHash};}
 const manifest={contract:'customer-activation-manifest-v1',state:'prepared-only',remoteApplied:false,activationAllowed:false,executorIncluded:false,sourceRevision,reviewedAt,candidateHash,files,protectedInventory:{rows:48,hash:expectedInventoryHash,updateAllowed:false,invalidateAllowed:false,recreateAllowed:false},proposal,selections:select,withdrawals:withdraw,counts:{candidateBases:planned.size,newSidecars:proposal.operations.filter(o=>o.action==='propose-add').length,unchangedSidecars:proposal.operations.filter(o=>o.action==='unchanged').length,selections:select.length,withdrawals:withdraw.length},planHashes:{sidecars:digest(proposal.operations),selections:digest(select),withdrawals:digest(withdraw)},hostedEvidence:evidence,hostedEvidenceBasis:'supplied-header-assertions-only',blockers,suppliedHostedHeadersComplete:blockers.length===0,hostedReviewComplete:false};
 return freeze({...manifest,packageHash:digest(manifest)});
}
