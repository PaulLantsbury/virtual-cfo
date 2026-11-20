/** Real PostgreSQL semantics in a newly-created in-memory PGlite only. */
import test from 'node:test';import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';
import {supplementalDigest} from './supplemental-reader.mjs';
import {RESERVED_SYNTHETIC_IDENTITY as identity} from './staging-payload.mjs';
const member='80000000-0000-4000-8000-000000000001',other='80000000-0000-4000-8000-000000000002';
const version='81000000-0000-4000-8000-000000000001',otherVersion='81000000-0000-4000-8000-000000000002';
const snapshot='82000000-0000-4000-8000-000000000001',otherSnapshot='82000000-0000-4000-8000-000000000002';
const otherStore='83000000-0000-4000-8000-000000000001';
const insertSql=`INSERT INTO finance_review_supplement_v1.snapshots(snapshot_id,store_id,date_from,date_to,kind,financial_version,sales_revision,cost_revision,body,body_hash,observed_at) VALUES($1,$2,'2026-10-01','2026-10-31',$3,$4,$5,$6,$7::jsonb,$8,$9)`;
function record({id=snapshot,store=identity.storeId,financialVersion=version,kind='cash'}={}){const body={contract:'reviewed-supplement-v1',kind,scope:{storeId:store,currency:'GBP',timezone:'Europe/London',from:'2026-10-01',to:'2026-10-31'},financialVersionId:financialVersion,salesRevision:'a'.repeat(64),costRevision:'b'.repeat(64),sourceBasis:'synthetic-local',observedAt:'2026-11-20T17:00:00Z',payload:{contract:'test-only',pence:1}};return {body,args:()=>[id,store,kind,financialVersion,body.salesRevision,body.costRevision,JSON.stringify(body),supplementalDigest(body),body.observedAt]};}
async function setup(){const db=await PGlite.create();try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE supplement_test_reader NOLOGIN NOINHERIT;CREATE TABLE public.stores(id uuid PRIMARY KEY);CREATE TABLE public.store_memberships(user_id uuid NOT NULL,store_id uuid NOT NULL,PRIMARY KEY(user_id,store_id));CREATE SCHEMA finance_history_v2;
 CREATE TABLE finance_history_v2.seals(snapshot_id uuid PRIMARY KEY,store_id uuid,date_from date,date_to date,sales_revision text,cost_revision text);
 CREATE TABLE finance_history_v2.invalidations(snapshot_id uuid PRIMARY KEY);
 CREATE TABLE finance_history_v2.version_heads(store_id uuid,date_from date,date_to date,version_id uuid,selection_id uuid);
 CREATE TABLE finance_history_v2.correction_versions(version_id uuid PRIMARY KEY,store_id uuid,date_from date,date_to date,sales_revision text,cost_revision text);
 CREATE TABLE finance_history_v2.correction_selections(selection_id uuid PRIMARY KEY,store_id uuid,date_from date,date_to date,previous_version_id uuid,version_id uuid);
 `);
 await db.query('INSERT INTO public.stores VALUES($1),($2)',[identity.storeId,otherStore]);await db.query('INSERT INTO public.store_memberships VALUES($1,$2),($3,$4)',[member,identity.storeId,other,otherStore]);
 await db.query("INSERT INTO finance_history_v2.seals VALUES($1,$2,'2026-10-01','2026-10-31',$3,$4)",[version,identity.storeId,'a'.repeat(64),'b'.repeat(64)]);
 await db.exec(await readFile(new URL('./supplemental-schema.sql',import.meta.url),'utf8'));return db;
 }catch(e){await db.close();throw e;}}
async function asReader(db,user,fn){return db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE supplement_test_reader');await tx.query("SELECT set_config('night_scout.profit_user_id',$1,true)",[user]);return fn(tx);});}
test('schema begins private; only explicit local read grant plus matching member context exposes evidence',async()=>{
 const db=await setup();try{
  const r=record();await db.query(insertSql,r.args());
  for(const role of ['anon','authenticated','service_role','supplement_test_reader']){
   assert.equal((await db.query("SELECT has_schema_privilege($1,'finance_review_supplement_v1','USAGE') ok",[role])).rows[0].ok,false);
   assert.equal((await db.query("SELECT has_table_privilege($1,'finance_review_supplement_v1.snapshots','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER') ok",[role])).rows[0].ok,false);
  }
  await assert.rejects(asReader(db,member,tx=>tx.query('SELECT * FROM finance_review_supplement_v1.snapshots')),/permission denied/);
  // Disposable test grants only: proposal itself creates none.
  await db.exec('GRANT USAGE ON SCHEMA finance_review_supplement_v1 TO supplement_test_reader;GRANT SELECT ON finance_review_supplement_v1.snapshots,public.store_memberships TO supplement_test_reader');
  assert.equal((await asReader(db,member,tx=>tx.query('SELECT * FROM finance_review_supplement_v1.snapshots'))).rows.length,1);
  for(const user of [other,''])assert.equal((await asReader(db,user,tx=>tx.query('SELECT * FROM finance_review_supplement_v1.snapshots'))).rows.length,0);
  for(const sql of ['INSERT INTO finance_review_supplement_v1.snapshots SELECT * FROM finance_review_supplement_v1.snapshots','UPDATE finance_review_supplement_v1.snapshots SET invalidated=true','DELETE FROM finance_review_supplement_v1.snapshots','TRUNCATE finance_review_supplement_v1.snapshots'])await assert.rejects(asReader(db,member,tx=>tx.exec(sql)),/permission denied/);
  await db.exec('CREATE TABLE finance_review_supplement_v1.future_fixture(id int)');
  for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("SELECT has_table_privilege($1,'finance_review_supplement_v1.future_fixture','SELECT,INSERT,UPDATE,DELETE') ok",[role])).rows[0].ok,false);
 }finally{await db.close();}
});
test('insertion rejects other company, wrong financial version/revision, invalidated base and duplicates',async()=>{
 const db=await setup();try{
  for(const r of [record({store:otherStore}),record({financialVersion:otherVersion})])await assert.rejects(db.query(insertSql,r.args()));
  const stale=record();stale.body.salesRevision='c'.repeat(64);await assert.rejects(db.query(insertSql,stale.args()),/matching financial evidence/);
  await db.query('INSERT INTO finance_history_v2.invalidations VALUES($1)',[version]);await assert.rejects(db.query(insertSql,record().args()),/matching financial evidence/);
  await db.exec('DELETE FROM finance_history_v2.invalidations');await db.query(insertSql,record().args());await assert.rejects(db.query(insertSql,record({id:otherSnapshot}).args()),/duplicate key/);
 }finally{await db.close();}
});
test('envelope/index equality, complete period, null types and observed boundary are checked in PostgreSQL',async()=>{
 const db=await setup();try{
  for(const change of [b=>{b.scope.timezone='UTC';},b=>{b.contract=null;},b=>{b.payload=null;},b=>{b.kind='acquisition';},b=>{b.scope.from='2026-10-02';},b=>{b.observedAt='2026-10-31T00:00:00Z';},b=>{b.extra='x';},b=>{b.observedAt='not-date';}]){const r=record();change(r.body);await assert.rejects(db.query(insertSql,r.args()));}
  const r=record();await assert.rejects(db.query(insertSql.replace("'2026-10-01','2026-10-31'","'2026-10-02','2026-10-31'"),r.args()));
 }finally{await db.close();}
});
test('only immutable owner one-way invalidation is possible; payload edits, removal and restricted invalidation are denied',async()=>{
 const db=await setup();try{
  await db.query(insertSql,record().args());
  for(const sql of ["UPDATE finance_review_supplement_v1.snapshots SET body_hash=repeat('e',64)",'DELETE FROM finance_review_supplement_v1.snapshots','TRUNCATE finance_review_supplement_v1.snapshots'])await assert.rejects(db.exec(sql),/immutable|invalidation/);
  await db.exec('GRANT USAGE ON SCHEMA finance_review_supplement_v1 TO supplement_test_reader;GRANT SELECT,UPDATE ON finance_review_supplement_v1.snapshots TO supplement_test_reader;GRANT SELECT ON public.store_memberships TO supplement_test_reader');
  await asReader(db,member,tx=>tx.exec('UPDATE finance_review_supplement_v1.snapshots SET invalidated=true'));
  assert.equal((await db.query('SELECT invalidated FROM finance_review_supplement_v1.snapshots')).rows[0].invalidated,false);
  await db.exec('CREATE POLICY fixture_update_only ON finance_review_supplement_v1.snapshots FOR UPDATE TO supplement_test_reader USING(true) WITH CHECK(true)');
  await assert.rejects(asReader(db,member,tx=>tx.exec('UPDATE finance_review_supplement_v1.snapshots SET invalidated=true')),/row-level security|invalidation/);
  await db.exec('UPDATE finance_review_supplement_v1.snapshots SET invalidated=true');
  assert.equal((await asReader(db,member,tx=>tx.query('SELECT * FROM finance_review_supplement_v1.snapshots'))).rows.length,0);
  await assert.rejects(db.exec('UPDATE finance_review_supplement_v1.snapshots SET invalidated=false'),/invalidation/);
 }finally{await db.close();}
});
test('current correction head is accepted; old base and superseded correction are refused',async()=>{
 const db=await setup();try{
  const sel='84000000-0000-4000-8000-000000000001';
  await db.query("INSERT INTO finance_history_v2.correction_versions VALUES($1,$2,'2026-10-01','2026-10-31',$3,$4)",[otherVersion,identity.storeId,'a'.repeat(64),'b'.repeat(64)]);
  await db.query("INSERT INTO finance_history_v2.correction_selections VALUES($1,$2,'2026-10-01','2026-10-31',$3,$4)",[sel,identity.storeId,version,otherVersion]);
  await db.query("INSERT INTO finance_history_v2.version_heads VALUES($1,'2026-10-01','2026-10-31',$2,$3)",[identity.storeId,otherVersion,sel]);
  await assert.rejects(db.query(insertSql,record().args()),/matching financial evidence/);
  await db.query(insertSql,record({financialVersion:otherVersion}).args());
  await db.exec('DELETE FROM finance_history_v2.version_heads');
  await assert.rejects(db.query(insertSql,record({id:otherSnapshot,kind:'acquisition',financialVersion:otherVersion}).args()),/matching financial evidence/);
 }finally{await db.close();}
});
