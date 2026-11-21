/** Independent disposable PostgreSQL rehearsal. Actual schema, SQL, restricted
 * role and RLS; fictional Auth and canonical-financial ports are explicit seams.
 * No network, hosted connection, grants outside PGlite or activation command. */
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
export async function setupCustomerPublicationFixture(){
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
