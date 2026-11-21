/** Independent disposable PostgreSQL rehearsal. Actual schema, SQL, restricted
 * role and RLS; fictional Auth and canonical-financial ports are explicit seams.
 * No network, hosted connection, grants outside PGlite or activation command. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {prepareCustomerActivationManifest} from './customer-activation-manifest.mjs';
import {prepareCustomerSummaryVersions} from './customer-summary-version.mjs';
import {supplementalDigest as digest} from './supplemental-reader.mjs';
import {createCustomerSidecarService} from './customer-sidecar-reader.mjs';
import {reviewedBrowserMonth} from '../../artifacts/virtual-cfo/tests/reviewed-pages.test-fixture.ts';
const reviewer='61000000-0000-4000-8000-000000000001',outsider='61000000-0000-4000-8000-000000000002';
const uid=(prefix,index)=>`${prefix}000000-0000-4000-8000-${String(index).padStart(12,'0')}`;
const paths={storage:'experiments/synthetic-company/customer-sidecar-storage.sql',recovery:'experiments/synthetic-company/customer-sidecar-recovery.sql',reader:'experiments/synthetic-company/customer-sidecar-reader.mjs'};
const observedAt='2026-11-20T12:00:00Z',selectedAt='2026-11-21T10:00:00Z',reviewedAt='2026-11-21T12:00:00Z';
const fingerprint=async(db,table)=>JSON.stringify((await db.query(`SELECT to_jsonb(t)::text value FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows);
async function setup(){
 const db=await PGlite.create();try{
 await db.exec(`CREATE ROLE activation_reader NOLOGIN NOINHERIT;CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN;CREATE TABLE public.stores(id uuid PRIMARY KEY);CREATE TABLE public.store_memberships(user_id uuid,store_id uuid,PRIMARY KEY(user_id,store_id));CREATE SCHEMA finance_history_v2;CREATE TABLE finance_history_v2.seals(snapshot_id uuid PRIMARY KEY,store_id uuid,date_from date,date_to date,sales_revision text,cost_revision text);CREATE TABLE finance_history_v2.invalidations(snapshot_id uuid PRIMARY KEY);CREATE TABLE finance_history_v2.version_heads(store_id uuid,date_from date,date_to date,version_id uuid,selection_id uuid);CREATE TABLE finance_history_v2.correction_versions(version_id uuid PRIMARY KEY,store_id uuid,date_from date,date_to date,sales_revision text,cost_revision text);CREATE TABLE finance_history_v2.correction_selections(selection_id uuid PRIMARY KEY,store_id uuid,date_from date,date_to date,previous_version_id uuid,version_id uuid);`);
 const samples=[];
 for(let i=0;i<24;i++){
  const from=new Date(Date.UTC(2024,10+i,1)).toISOString().slice(0,10),f=structuredClone(reviewedBrowserMonth(from,i));
  const version=uid('82',i+1);f.response.versionId=f.response.snapshotId=f.response.metadata.versionId=version;f.acquisition.financial.snapshotId=version;
  const activity=f.acquisition.customerActivity;delete f.acquisition.customerActivity;samples.push({f,activity,version});
 }
 const store=samples[0].f.response.scope.storeId;await db.query('INSERT INTO public.stores VALUES($1)',[store]);await db.query('INSERT INTO public.store_memberships VALUES($1,$2)',[reviewer,store]);
 await db.exec(await readFile(new URL('./supplemental-schema.sql',import.meta.url),'utf8'));
 for(const kind of ['storage','recovery'])await db.exec(await readFile(new URL('./customer-sidecar-'+kind+'.sql',import.meta.url),'utf8'));
 const baseRows=[],baseSnapshots=[];
 for(let i=0;i<24;i++){
  const {f,version}=samples[i],s=f.response.scope;
  await db.query('INSERT INTO finance_history_v2.seals VALUES($1,$2,$3,$4,$5,$6)',[version,store,s.from,s.to,f.response.salesRevision,f.response.costRevision]);
  for(const [j,kind] of ['cash','acquisition'].entries()){
   const body={contract:'reviewed-supplement-v1',kind,scope:{...s,timezone:'Europe/London'},financialVersionId:version,salesRevision:f.response.salesRevision,costRevision:f.response.costRevision,sourceBasis:'synthetic-local',observedAt,payload:kind==='acquisition'?f.acquisition:{fixtureOnly:true}};
   const bodyHash=digest(body),baseSnapshotId=uid('72',i*2+j+1);baseRows.push({body,bodyHash});baseSnapshots.push({baseBodyHash:bodyHash,baseSnapshotId});
   await db.query('INSERT INTO finance_review_supplement_v1.snapshots(snapshot_id,store_id,date_from,date_to,kind,financial_version,sales_revision,cost_revision,body,body_hash,observed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)',[baseSnapshotId,store,s.from,s.to,kind,version,body.salesRevision,body.costRevision,JSON.stringify(body),bodyHash,observedAt]);
  }
 }
 // Only a disposable fixture role receives read permissions, never a browser role.
 await db.exec('GRANT USAGE ON SCHEMA finance_customer_sidecar_v1,finance_review_supplement_v1,finance_history_v2 TO activation_reader;GRANT SELECT ON ALL TABLES IN SCHEMA finance_customer_sidecar_v1,finance_review_supplement_v1,finance_history_v2 TO activation_reader;GRANT SELECT ON public.store_memberships TO activation_reader;');
 const base=baseRows[47],sample=samples[23],scope=sample.f.response.scope;
 const candidates=[{baseBodyHash:base.bodyHash,financial:{scope:structuredClone(base.body.scope),financialVersionId:base.body.financialVersionId,salesRevision:base.body.salesRevision,costRevision:base.body.costRevision},activity:sample.activity}];
 const proposal=prepareCustomerSummaryVersions({baseRows,candidates}),side=proposal.operations[0],baseId=baseSnapshots[47].baseSnapshotId;
 const artifacts={},expectedArtifactHashes={};for(const [key,path] of Object.entries(paths)){const text=await readFile(new URL('./'+path.split('/').at(-1),import.meta.url));const sha256=createHash('sha256').update(text).digest('hex');artifacts[key]={path,content:text.toString('utf8'),sha256};expectedArtifactHashes[key]=sha256;}
 const input={sourceRevision:'a'.repeat(40),artifacts,expectedArtifactHashes,baseRows,expectedInventoryHash:digest([...baseRows].sort((a,b)=>a.bodyHash.localeCompare(b.bodyHash))),candidates,baseSnapshots:baseSnapshots.filter((_,i)=>i%2===1),selections:[{baseBodyHash:base.bodyHash,sidecarVersionId:side.versionId,selectedBy:reviewer,selectedAt}],existingSidecars:[],existingSelections:[],withdrawals:[],reviewedAt};
 let who=reviewer;
 const auth={auth:{getUser:async()=>({data:{user:{id:who,is_anonymous:false}}})}};
 const service=createCustomerSidecarService({transaction:fn=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE activation_reader');return fn(tx);})},auth,{now:()=>new Date(reviewedAt),readHistory:async(tx,s,opts)=>{
  const role=(await tx.query("SELECT current_user name,rolsuper,rolbypassrls,current_setting('transaction_read_only') readonly FROM pg_roles WHERE rolname=current_user")).rows[0];assert.deepEqual(role,{name:'activation_reader',rolsuper:false,rolbypassrls:false,readonly:'on'});
  // The SQL checks current authority of fictional seals. This deliberately does
  // not pretend to recompute the full canonical journal through history-reader.
  const rows=(await tx.query('SELECT s.sales_revision,s.cost_revision FROM finance_history_v2.seals s WHERE snapshot_id=$1 AND store_id=$2 AND date_from=$3 AND date_to=$4 AND NOT EXISTS(SELECT 1 FROM finance_history_v2.invalidations i WHERE i.snapshot_id=s.snapshot_id) AND NOT EXISTS(SELECT 1 FROM finance_history_v2.version_heads h WHERE h.store_id=s.store_id AND h.date_from=s.date_from AND h.date_to=s.date_to)',[opts.selection.versionId,s.storeId,s.from,s.to])).rows;
  return rows.length===1?{...structuredClone(sample.f.response),salesRevision:rows[0].sales_revision,costRevision:rows[0].cost_revision}:{state:'unavailable'};
 }});
 const request={financialSelection:{edition:sample.f.response.metadata.edition,versionId:sample.version},baseSnapshotId:baseId,sidecarVersionId:side.versionId};
 return {db,input,side,base,baseId,scope,reviewer,request,user:id=>who=id,read:()=>service.read(scope,'Bearer disposable',request)};
 }catch(e){await db.close();throw e;}
}
async function localApply(h,{failAfter}={}){
 const manifest=prepareCustomerActivationManifest(h.input);
 await h.db.transaction(async tx=>{
  const operation=manifest.proposal.operations[0],selection=manifest.selections[0],b=operation.body,s=b.scope;
  assert.equal(operation.versionId,h.side.versionId);assert.equal(selection.baseSnapshotId,h.baseId);
  const inventory=(await tx.query('SELECT body,body_hash FROM finance_review_supplement_v1.snapshots')).rows.map(r=>({body:r.body,bodyHash:r.body_hash})).sort((a,b)=>a.bodyHash.localeCompare(b.bodyHash));assert.equal(digest(inventory),manifest.protectedInventory.hash);
  const current=(await tx.query('SELECT body_hash FROM finance_review_supplement_v1.snapshots WHERE snapshot_id=$1',[h.baseId])).rows[0];assert.equal(current.body_hash,b.baseBodyHash);
  await tx.query('INSERT INTO finance_customer_sidecar_v1.versions VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)',[operation.versionId,selection.baseSnapshotId,b.baseBodyHash,s.storeId,b.financialVersionId,s.from,s.to,b.salesRevision,b.costRevision,JSON.stringify(b)]);
  if(failAfter==='candidate')throw Error('Injected rollback after candidate');
  await tx.query('INSERT INTO finance_customer_sidecar_v1.selections VALUES($1,$2,$3,$4)',[selection.baseSnapshotId,selection.sidecarVersionId,selection.selectedBy,selection.selectedAt]);
  if(failAfter==='selection')throw Error('Injected rollback after selection');
 });return manifest;
}
test('bounded manifest candidate and selection commit atomically without changing protected48 or financial seals',async()=>{
 const h=await setup();try{const original=await fingerprint(h.db,'finance_review_supplement_v1.snapshots'),finance=await fingerprint(h.db,'finance_history_v2.seals');assert.equal((await h.read()).state,'unavailable');
 const manifest=await localApply(h);assert.equal(manifest.activationAllowed,false);assert.equal((await h.read()).state,'supported');assert.equal((await h.db.query('SELECT count(*)::int n FROM finance_review_supplement_v1.snapshots')).rows[0].n,48);assert.equal(await fingerprint(h.db,'finance_review_supplement_v1.snapshots'),original);assert.equal(await fingerprint(h.db,'finance_history_v2.seals'),finance);
 }finally{await h.db.close();}
});
test('failure after candidate or selection rolls back both new relations and preserves every protected record',async()=>{
 const h=await setup();try{const before=await fingerprint(h.db,'finance_review_supplement_v1.snapshots');for(const failAfter of ['candidate','selection']){await assert.rejects(localApply(h,{failAfter}),/Injected rollback/);for(const table of ['versions','selections'])assert.equal((await h.db.query(`SELECT count(*)::int n FROM finance_customer_sidecar_v1.${table}`)).rows[0].n,0);assert.equal((await h.read()).state,'unavailable');assert.equal(await fingerprint(h.db,'finance_review_supplement_v1.snapshots'),before);}}finally{await h.db.close();}
});
test('committed withdrawal denies activity under actual restricted role and preserves immutable archive',async()=>{
 const h=await setup();try{await localApply(h);const before=await fingerprint(h.db,'finance_review_supplement_v1.snapshots'),archive=await fingerprint(h.db,'finance_customer_sidecar_v1.versions'),selection=await fingerprint(h.db,'finance_customer_sidecar_v1.selections');
 const withdrawalInput={...h.input,selections:[],existingSidecars:[{versionId:h.side.versionId,body:h.side.body}],existingSelections:h.input.selections,withdrawals:[{baseBodyHash:h.base.bodyHash,sidecarVersionId:h.side.versionId,withdrawnBy:reviewer,withdrawnAt:'2026-11-21T11:00:00Z',reasonCode:'owner-withdrawal'}]};
 const recovery=prepareCustomerActivationManifest(withdrawalInput),w=recovery.withdrawals[0];assert.equal(recovery.activationAllowed,false);assert.equal(recovery.counts.newSidecars,0);
 await h.db.query('INSERT INTO finance_customer_sidecar_v1.withdrawals VALUES($1,$2,$3,$4,$5)',[w.baseSnapshotId,w.sidecarVersionId,w.withdrawnBy,w.withdrawnAt,w.reasonCode]);
 assert.equal((await h.read()).state,'unavailable');assert.equal(await fingerprint(h.db,'finance_customer_sidecar_v1.versions'),archive);assert.equal(await fingerprint(h.db,'finance_customer_sidecar_v1.selections'),selection);assert.equal(await fingerprint(h.db,'finance_review_supplement_v1.snapshots'),before);h.user(outsider);await assert.rejects(h.read,/membership/);
 }finally{await h.db.close();}
});

test('artifact tampering fails before writes and nonmember selection rolls a candidate back in actual SQL',async()=>{const h=await setup();try{const before=await fingerprint(h.db,'finance_review_supplement_v1.snapshots');h.input.artifacts.reader.content+='\n// changed';await assert.rejects(localApply(h),/Artifact bytes\/hash mismatch/);h.input.artifacts.reader.content=h.input.artifacts.reader.content.slice(0,-11);h.input.selections[0].selectedBy=outsider;const manifest=prepareCustomerActivationManifest(h.input);assert.equal(manifest.activationAllowed,false,'Syntactically valid reviewer is not membership proof');await assert.rejects(localApply(h),/selected|publication|member|matching/i);assert.equal((await h.db.query('SELECT count(*)::int n FROM finance_customer_sidecar_v1.versions')).rows[0].n,0);assert.equal((await h.db.query('SELECT count(*)::int n FROM finance_customer_sidecar_v1.selections')).rows[0].n,0);assert.equal(await fingerprint(h.db,'finance_review_supplement_v1.snapshots'),before);}finally{await h.db.close();}});
