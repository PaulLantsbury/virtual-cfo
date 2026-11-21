/** Disposable PGlite actual SQL/schema integration. Auth and canonical history are
 * explicit trusted test seams; this is not hosted JWT/provider acceptance. */
import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';
import {createCustomerSidecarService} from './customer-sidecar-reader.mjs';import {supplementalDigest as digest} from './supplemental-reader.mjs';import {reviewedBrowserMonth} from '../../artifacts/virtual-cfo/tests/reviewed-pages.test-fixture.ts';
const uid='60000000-0000-4000-8000-000000000001',bid='70000000-0000-4000-8000-000000000001',vid='80000000-0000-4000-8000-000000000001';
async function fixture({mixedHash=false}={}){
 const db=await PGlite.create();try{
 const f=structuredClone(reviewedBrowserMonth('2025-03-01',2));f.response.versionId=f.response.snapshotId=f.response.metadata.versionId=vid;f.acquisition.financial.snapshotId=vid;const activity=f.acquisition.customerActivity;delete f.acquisition.customerActivity;const scope=f.response.scope;
 await db.exec(`CREATE ROLE customer_fixture_reader NOLOGIN NOINHERIT;CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN;CREATE TABLE public.stores(id uuid PRIMARY KEY);CREATE TABLE public.store_memberships(user_id uuid,store_id uuid,PRIMARY KEY(user_id,store_id));CREATE SCHEMA finance_history_v2;CREATE TABLE finance_history_v2.seals(snapshot_id uuid PRIMARY KEY,store_id uuid,date_from date,date_to date,sales_revision text,cost_revision text);CREATE TABLE finance_history_v2.invalidations(snapshot_id uuid PRIMARY KEY);CREATE TABLE finance_history_v2.version_heads(store_id uuid,date_from date,date_to date,version_id uuid,selection_id uuid);CREATE TABLE finance_history_v2.correction_versions(version_id uuid PRIMARY KEY,store_id uuid,date_from date,date_to date,sales_revision text,cost_revision text);CREATE TABLE finance_history_v2.correction_selections(selection_id uuid PRIMARY KEY,store_id uuid,date_from date,date_to date,previous_version_id uuid,version_id uuid);`);
 await db.query('INSERT INTO public.stores VALUES($1)',[scope.storeId]);await db.query('INSERT INTO public.store_memberships VALUES($1,$2)',[uid,scope.storeId]);
 await db.exec(await readFile(new URL('./supplemental-schema.sql',import.meta.url),'utf8'));await db.exec(await readFile(new URL('./customer-sidecar-storage.sql',import.meta.url),'utf8'));await db.exec(await readFile(new URL('./customer-sidecar-recovery.sql',import.meta.url),'utf8'));
 const body={contract:'reviewed-supplement-v1',kind:'acquisition',scope:structuredClone(f.acquisition.scope),financialVersionId:vid,salesRevision:f.response.salesRevision,costRevision:f.response.costRevision,sourceBasis:'synthetic-local',observedAt:'2026-11-20T12:00:00Z',payload:f.acquisition};
 for(let i=1;i<=48;i++){
 const version=i===1?vid:`80000000-0000-4000-8000-${String(i).padStart(12,'0')}`,snapshot=i===1?bid:`70000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
 await db.query('INSERT INTO finance_history_v2.seals VALUES($1,$2,$3,$4,$5,$6)',[version,scope.storeId,scope.from,scope.to,body.salesRevision,body.costRevision]);
 const b=i===1?body:{...body,kind:'cash',financialVersionId:version,payload:{fixtureOnly:true}};
 await db.query('INSERT INTO finance_review_supplement_v1.snapshots(snapshot_id,store_id,date_from,date_to,kind,financial_version,sales_revision,cost_revision,body,body_hash,observed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)',[snapshot,scope.storeId,scope.from,scope.to,b.kind,version,b.salesRevision,b.costRevision,JSON.stringify(b),digest(b),b.observedAt]);
 }
 const side={contract:'synthetic-customer-summary-sidecar-v1',baseBodyHash:digest(body),scope:body.scope,financialVersionId:vid,salesRevision:body.salesRevision,costRevision:body.costRevision,activity},id=mixedHash?'d'.repeat(64):digest(side);
 await db.query('INSERT INTO finance_customer_sidecar_v1.versions VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)',[id,bid,digest(body),scope.storeId,vid,scope.from,scope.to,body.salesRevision,body.costRevision,JSON.stringify(side)]);
 await db.query("INSERT INTO finance_customer_sidecar_v1.selections VALUES($1,$2,$3,'2026-11-21T10:00:00Z')",[bid,id,uid]);
 // Local-only explicit read grants. Proposed SQL itself grants no runtime access.
 await db.exec('GRANT USAGE ON SCHEMA finance_customer_sidecar_v1,finance_review_supplement_v1 TO customer_fixture_reader;GRANT SELECT ON ALL TABLES IN SCHEMA finance_customer_sidecar_v1,finance_review_supplement_v1 TO customer_fixture_reader;GRANT SELECT ON public.store_memberships TO customer_fixture_reader;');
 let user=uid;const auth={auth:{getUser:async()=>({data:{user:{id:user,is_anonymous:false}}})}};
 const port={transaction:fn=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE customer_fixture_reader');return fn(tx);})};let canonicalCalls=0;
 const service=createCustomerSidecarService(port,auth,{now:()=>new Date('2026-11-21T12:00:00Z'),readHistory:async(tx,s,opts)=>{canonicalCalls++;assert.deepEqual(s,scope);assert.equal(opts.selection.versionId,vid);assert.equal((await tx.query("SELECT current_setting('transaction_read_only') v")).rows[0].v,'on');const role=(await tx.query('SELECT current_user name,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];assert.deepEqual(role,{name:'customer_fixture_reader',rolsuper:false,rolbypassrls:false});return structuredClone(f.response);}});
 const request={financialSelection:{edition:f.response.metadata.edition,versionId:vid},baseSnapshotId:bid,sidecarVersionId:id};
 return {db,scope,request,activity,financial:f.response,run:()=>service.read(scope,'Bearer fixture',request),user:v=>user=v,canonicalCalls:()=>canonicalCalls};
 }catch(e){await db.close();throw e;}}
const original=db=>db.query('SELECT * FROM finance_review_supplement_v1.snapshots ORDER BY snapshot_id');
test('actual schemas, RLS and reader SQL return explicit selected activity and preserve original48',async()=>{const h=await fixture();try{const before=await original(h.db),r=await h.run();assert.equal(r.state,'supported');assert.deepEqual(r.activity,h.activity);assert.equal(h.canonicalCalls(),1);assert.equal(before.rows.length,48);assert.deepEqual(await original(h.db),before);}finally{await h.db.close();}});
test('real membership denial precedes canonical seam; invalidated base becomes unavailable',async()=>{const h=await fixture();try{h.user('60000000-0000-4000-8000-000000000002');await assert.rejects(h.run,/membership/);assert.equal(h.canonicalCalls(),0);h.user(uid);assert.equal((await h.run()).state,'supported');await h.db.query('UPDATE finance_review_supplement_v1.snapshots SET invalidated=true WHERE snapshot_id=$1',[bid]);assert.equal((await h.run()).state,'unavailable');}finally{await h.db.close();}});
test('wrong selected version and changed canonical revision never borrow existing activity',async()=>{const h=await fixture();try{const before=await original(h.db),id=h.request.sidecarVersionId;h.request.sidecarVersionId='f'.repeat(64);assert.equal((await h.run()).state,'unavailable');h.request.sidecarVersionId=id;h.financial.costRevision='e'.repeat(64);assert.equal((await h.run()).state,'unavailable');assert.deepEqual(await original(h.db),before);}finally{await h.db.close();}});

test('stored structurally valid row with incorrect content hash is withheld by trusted reader',async()=>{const h=await fixture({mixedHash:true});try{const before=await original(h.db);assert.equal((await h.run()).state,'unavailable');assert.deepEqual(await original(h.db),before);}finally{await h.db.close();}});

const archive=db=>db.query('SELECT version_id,base_snapshot_id,body FROM finance_customer_sidecar_v1.versions ORDER BY version_id');
const selections=db=>db.query('SELECT * FROM finance_customer_sidecar_v1.selections ORDER BY base_snapshot_id');
const withdraw=(db,id)=>db.query("INSERT INTO finance_customer_sidecar_v1.withdrawals(base_snapshot_id,version_id,withdrawn_by,withdrawn_at,reason_code) SELECT $1,$2,$3,GREATEST(selected_at,statement_timestamp()-interval '1 second'),'owner-withdrawal' FROM finance_customer_sidecar_v1.selections WHERE base_snapshot_id=$1",[bid,id,uid]);
test('actual restricted-role reader withholds committed withdrawal and rollback leaves prior activity intact',async()=>{
 const h=await fixture();try{
  const before=await original(h.db),versions=await archive(h.db),chosen=await selections(h.db);
  assert.equal((await h.run()).state,'supported');
  await assert.rejects(h.db.transaction(async tx=>{await withdraw(tx,h.request.sidecarVersionId);throw Error('Injected rollback before commit');}),/Injected rollback/);
  assert.equal((await h.db.query('SELECT count(*)::int n FROM finance_customer_sidecar_v1.withdrawals')).rows[0].n,0);assert.equal((await h.run()).state,'supported');
  await withdraw(h.db,h.request.sidecarVersionId);const result=await h.run();assert.equal(result.state,'unavailable');assert.equal(result.activity,undefined);
  assert.deepEqual(await original(h.db),before);assert.deepEqual(await archive(h.db),versions);assert.deepEqual(await selections(h.db),chosen);
  await assert.rejects(withdraw(h.db,h.request.sidecarVersionId));
  for(const sql of ['DELETE FROM finance_customer_sidecar_v1.withdrawals','UPDATE finance_customer_sidecar_v1.withdrawals SET reason_code=reason_code','TRUNCATE finance_customer_sidecar_v1.withdrawals'])await assert.rejects(h.db.exec(sql),/immutable/i);
 }finally{await h.db.close();}
});
test('effective readonly role has scoped SELECT only; browser/public roles gain no access and nonmembers see no withdrawal',async()=>{
 const h=await fixture();try{
  const before=await original(h.db);
  for(const table of ['versions','selections','withdrawals']){
   for(const role of ['anon','authenticated','service_role']){
    const r=(await h.db.query("SELECT has_table_privilege($1,$2,'SELECT') allowed,has_schema_privilege($1,'finance_customer_sidecar_v1','USAGE') usage",[role,'finance_customer_sidecar_v1.'+table])).rows[0];assert.equal(r.allowed,false);assert.equal(r.usage,false);
   }
   for(const privilege of ['INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal((await h.db.query('SELECT has_table_privilege($1,$2,$3) allowed',['customer_fixture_reader','finance_customer_sidecar_v1.'+table,privilege])).rows[0].allowed,false);
   const publicGrants=(await h.db.query("SELECT count(*)::int n FROM information_schema.role_table_grants WHERE table_schema='finance_customer_sidecar_v1' AND table_name=$1 AND grantee='PUBLIC'",[table])).rows[0].n;assert.equal(publicGrants,0);
  }
  await withdraw(h.db,h.request.sidecarVersionId);
  const read=who=>h.db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE customer_fixture_reader');await tx.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');await tx.query("SELECT set_config('night_scout.profit_user_id',$1,true)",[who]);return (await tx.query('SELECT base_snapshot_id FROM finance_customer_sidecar_v1.withdrawals')).rows;});
  assert.equal((await read(uid)).length,1);assert.equal((await read('60000000-0000-4000-8000-000000000002')).length,0);
  await assert.rejects(h.db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE customer_fixture_reader');await tx.exec('SET TRANSACTION READ ONLY');await tx.exec('DELETE FROM finance_customer_sidecar_v1.withdrawals');}),/permission|read-only/i);
  assert.deepEqual(await original(h.db),before);
 }finally{await h.db.close();}
});
