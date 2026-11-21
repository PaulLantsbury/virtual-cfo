/** Independent pure provenance checks. Fictional records and actors only; no SQL,
 * remote access, source publication, authentication or authority claims. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareCustomerActivationManifest as manifest} from './customer-activation-manifest.mjs';
import {prepareCustomerSummaryVersions as sidecars} from './customer-summary-version.mjs';
import {supplementalDigest as digest} from './supplemental-reader.mjs';
import {RESERVED_SYNTHETIC_IDENTITY as identity} from './staging-payload.mjs';
const hash='a'.repeat(64),actor='61000000-0000-4000-8000-000000000001',other='61000000-0000-4000-8000-000000000002',financial='81000000-0000-4000-8000-000000000001';
function fixture(){
 const baseRows=[];
 for(let i=0;i<24;i++)for(const kind of ['cash','acquisition']){
  const from=new Date(Date.UTC(2024,10+i,1)).toISOString().slice(0,10),to=new Date(Date.UTC(2024,11+i,0)).toISOString().slice(0,10);
  const body={contract:'reviewed-supplement-v1',kind,scope:{storeId:identity.storeId,currency:'GBP',timezone:'Europe/London',from,to},financialVersionId:financial,salesRevision:hash,costRevision:hash,sourceBasis:'synthetic-local',observedAt:'2026-11-20T10:00:00Z',payload:kind==='cash'?{fixtureOnly:true}:{policy:'synthetic-identity-and-spend-v1',coverage:{identifiedFirstOrders:1,identifiedRepeatOrders:1},source:{ordersHash:hash}}};baseRows.push({body,bodyHash:digest(body)});
 }
 const chosen=[baseRows[1],baseRows[3]],candidates=chosen.map(b=>({baseBodyHash:b.bodyHash,financial:{scope:structuredClone(b.body.scope),financialVersionId:financial,salesRevision:hash,costRevision:hash},activity:{contract:'synthetic-customer-activity-v1',policy:'synthetic-identity-and-spend-v1',scope:{from:b.body.scope.from,to:b.body.scope.to},identifiedCustomers:1,uniqueReturningCustomers:1,identifiedOrders:2,sourceHash:hash,basis:'Distinct synthetic customer identifiers; independent fixture'}}));
 const p=sidecars({baseRows,candidates}),existingSidecars=p.operations.map(({versionId,body})=>({versionId,body})),existingSelections=p.operations.map((o,i)=>({baseBodyHash:o.body.baseBodyHash,sidecarVersionId:o.versionId,selectedBy:actor,selectedAt:'2026-11-21T10:00:00Z'})),baseSnapshots=chosen.map((b,i)=>({baseBodyHash:b.bodyHash,baseSnapshotId:`71000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`}));
 const artifacts={},expectedArtifactHashes={};for(const [key,file]of [['storage','customer-sidecar-storage.sql'],['recovery','customer-sidecar-recovery.sql'],['reader','customer-sidecar-reader.mjs']]){const content=readFileSync(new URL(file,import.meta.url),'utf8'),sha256=createHash('sha256').update(content).digest('hex');artifacts[key]={path:'experiments/synthetic-company/'+file,content,sha256};expectedArtifactHashes[key]=sha256;}
 return {sourceRevision:'a'.repeat(40),reviewedAt:'2026-11-21T12:00:00Z',artifacts,expectedArtifactHashes,baseRows,expectedInventoryHash:p.baseInventoryHash,candidates,existingSidecars,existingSelections,baseSnapshots,selections:[],withdrawals:[{baseBodyHash:existingSelections[0].baseBodyHash,sidecarVersionId:existingSelections[0].sidecarVersionId,withdrawnBy:actor,withdrawnAt:'2026-11-21T11:00:00Z',reasonCode:'owner-withdrawal'}]};
}
test('independent: prior selection provenance is retained and actor/time substitutions change both candidate and package hashes',()=>{
 const f=fixture(),before=digest(f),original=manifest(f);assert.equal(digest(f),before);assert.equal(original.existingSelectionPreconditions.length,2);assert.ok(Object.isFrozen(original.existingSelectionPreconditions[0]));
 for(const mutate of [x=>x.existingSelections[0].selectedBy=other,x=>x.existingSelections[0].selectedAt='2026-11-21T09:00:00Z',x=>x.baseSnapshots[0].baseSnapshotId='72000000-0000-4000-8000-000000000001']){const changed=structuredClone(f);mutate(changed);const result=manifest(changed);assert.notEqual(result.candidateHash,original.candidateHash);assert.notEqual(result.packageHash,original.packageHash);assert.equal(result.activationAllowed,false);}
});
test('independent: readback ordering is canonical while exact tuple facts remain bound',()=>{
 const f=fixture(),a=manifest(f);f.existingSelections.reverse();const b=manifest(f);assert.deepEqual(a.existingSelectionPreconditions,b.existingSelectionPreconditions);assert.equal(a.candidateHash,b.candidateHash);assert.equal(a.packageHash,b.packageHash);
 const expected=f.existingSelections.map(row=>({...row,baseSnapshotId:f.baseSnapshots.find(s=>s.baseBodyHash===row.baseBodyHash).baseSnapshotId})).sort((x,y)=>x.baseSnapshotId.localeCompare(y.baseSnapshotId));assert.deepEqual(b.existingSelectionPreconditions,expected);
});
test('independent: prior hosted-header assertions cannot be reused after changing an existing selection precondition',()=>{
 const f=fixture(),original=manifest(f);f.hostedEvidence=Object.fromEntries(['catalog','authority','reportingRole','transactionReceipt'].map(key=>[key,{state:'verified',receiptHash:'e'.repeat(64),observedAt:'2026-11-21T11:30:00Z',sourceRevision:f.sourceRevision,baseInventoryHash:f.expectedInventoryHash,candidateHash:original.candidateHash}]));
 assert.equal(manifest(f).suppliedHostedHeadersComplete,true);f.existingSelections[0].selectedBy=other;assert.throws(()=>manifest(f),/Hosted gate receipt/);
});

// Actual SQL counterexample for a stale-authority publication. These adapter
// callbacks mirror the draft protocol suite; they do not simulate live authority.
import {setupCustomerPublicationFixture} from './customer-publication-fixture.mjs';
import {prepareCustomerPublicationPlan,createCustomerPublicationProtocol} from './customer-publication-protocol.mjs';
async function protocolFixture(h){
 await h.db.exec('CREATE TABLE independent_publication_receipts(protocol_hash text PRIMARY KEY,body jsonb NOT NULL)');
 const seals=async(tx,store)=>(await tx.query('SELECT to_jsonb(s) value FROM finance_history_v2.seals s WHERE store_id=$1 ORDER BY snapshot_id',[store])).rows.map(r=>r.value);
 const protectedState=async(tx,store)=>{const snapshots=(await tx.query('SELECT to_jsonb(s) value FROM finance_review_supplement_v1.snapshots s WHERE store_id=$1 ORDER BY snapshot_id',[store])).rows.map(r=>r.value),financial={};for(const table of ['seals','invalidations','version_heads','correction_versions','correction_selections'])financial[table]=(await tx.query(`SELECT to_jsonb(t) value FROM finance_history_v2.${table} t ORDER BY to_jsonb(t)::text`)).rows.map(r=>r.value);return {snapshots,financial};};
 const financialSealHash=digest(await seals(h.db,h.scope.storeId)),protectedStateHash=digest(await protectedState(h.db,h.scope.storeId));
 const port={purpose:'disposable-local-rehearsal',financialSeals:seals,protectedState,authority:async(tx,expected)=>{const s=expected.scope;const rows=(await tx.query('SELECT snapshot_id FROM finance_history_v2.seals f WHERE snapshot_id=$1 AND store_id=$2 AND date_from=$3 AND date_to=$4 AND sales_revision=$5 AND cost_revision=$6 AND NOT EXISTS(SELECT 1 FROM finance_history_v2.invalidations i WHERE i.snapshot_id=f.snapshot_id) AND NOT EXISTS(SELECT 1 FROM finance_history_v2.version_heads v WHERE v.store_id=f.store_id AND v.date_from=f.date_from AND v.date_to=f.date_to)',[expected.financialVersionId,s.storeId,s.from,s.to,expected.salesRevision,expected.costRevision])).rows;return rows.length===1?expected:{state:'unavailable'};},transaction:fn=>h.db.transaction(fn),readback:fn=>h.db.transaction(fn),readReceipt:async(tx,key)=>(await tx.query('SELECT body FROM independent_publication_receipts WHERE protocol_hash=$1',[key])).rows[0]?.body??null,appendReceipt:(tx,row)=>tx.query('INSERT INTO independent_publication_receipts VALUES($1,$2::jsonb)',[row.protocolHash,JSON.stringify(row)])};
 return {execute:input=>{const plan=prepareCustomerPublicationPlan(input,financialSealHash,protectedStateHash);return createCustomerPublicationProtocol(port).execute(input,{...plan.binding,protocolHash:plan.protocolHash});}};
}
test('independent: invalidated canonical financial selection refuses publication both before and after authority capture',async()=>{
 for(const when of ['before','after']){const h=await setupCustomerPublicationFixture();try{
  const invalidate=()=>h.db.query('INSERT INTO finance_history_v2.invalidations VALUES($1)',[h.request.financialSelection.versionId]);
  if(when==='before')await invalidate();const p=await protocolFixture(h);if(when==='after')await invalidate();
  const result=await p.execute(h.input);assert.notEqual(result.state,'applied-confirmed','Stale current financial authority must refuse publication');assert.equal(result.retryAllowed,false);
  assert.equal((await h.db.query('SELECT count(*)::int n FROM finance_customer_sidecar_v1.versions')).rows[0].n,0);
 }finally{await h.db.close();}}
});
test('independent: protocol compares prior reviewer and timestamp with actual immutable selection before withdrawal',async()=>{
 const h=await setupCustomerPublicationFixture();try{const p=await protocolFixture(h);assert.equal((await p.execute(h.input)).state,'applied-confirmed');const recovery={...h.input,selections:[],existingSidecars:[{versionId:h.side.versionId,body:h.side.body}],existingSelections:structuredClone(h.input.selections),withdrawals:[{baseBodyHash:h.base.bodyHash,sidecarVersionId:h.side.versionId,withdrawnBy:h.reviewer,withdrawnAt:'2026-11-21T11:00:00Z',reasonCode:'owner-withdrawal'}]};
 for(const mutate of [x=>x.existingSelections[0].selectedBy=other,x=>x.existingSelections[0].selectedAt='2026-11-21T09:00:00Z']){const changed=structuredClone(recovery);mutate(changed);assert.equal((await p.execute(changed)).state,'conflict');assert.equal((await h.db.query('SELECT count(*)::int n FROM finance_customer_sidecar_v1.withdrawals')).rows[0].n,0);}assert.equal((await h.read()).state,'supported');
 }finally{await h.db.close();}
});
