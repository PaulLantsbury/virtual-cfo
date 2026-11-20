/** Pure compiler + newly-created in-memory PostgreSQL only. No connection URL or network executor. */
import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';
import {prepareSupplementalPublication,generateRestrictedSupplementReadAccess,prepareSupplementalSingleCallSql} from './supplemental-publication.mjs';
import {compileSupplementalPlan} from './supplemental-plan.mjs';import {generate,summarise} from './generator.mjs';
import {buildAcquisitionSource} from './acquisition-source.mjs';import {historySourceAsOf,HISTORY_EDITION} from './history-context.mjs';
import {stableId,RESERVED_SYNTHETIC_IDENTITY as identity} from './staging-payload.mjs';import {supplementalDigest} from './supplemental-reader.mjs';import {profitEvidenceDigest as digest} from '../financial-v1/profit-evidence-reader.mjs';
const observedAt='2026-11-20T18:00:00Z',now=new Date('2026-11-20T19:00:00Z');
const fixture=generate({from:'2024-11-01',asOf:'2025-01-01'}),acquisition=buildAcquisitionSource(generate({from:'2024-01-01',asOf:'2025-01-01'}));
function financial(from,to){const t=summarise(fixture,from,to),versionId=stableId('publication-test-financial',from),scope={storeId:identity.storeId,currency:'GBP',from,to};return {state:'supported',contract:'history-v2-proposal',versionId,snapshotId:versionId,scope,salesRevision:'a'.repeat(64),costRevision:'b'.repeat(64),metadata:{versionId,edition:HISTORY_EDITION,anchor:'2024-11-01',formulaVersion:'night-scout-v11-2026-10-30',sourceBasis:'synthetic-local',verification:'canonical-source-revision-only',sourceAsOf:historySourceAsOf(to),observedAt:'2026-11-20T17:00:00Z'},sales:{grossProductSales:t.gross,discounts:t.discounts,netProductSales:t.netProduct,netShipping:t.shipping,originalOrders:t.orders,aov:{value:(t.gross-t.discounts)/t.orders,reason:null},provenance:scope},components:{cogs:t.cogs,variableCosts:t.variableCosts,advertising:t.marketing,overheadIncludingDA:t.overheads,depreciationAmortisation:t.da},profit:{state:'complete',grossProfit:t.grossProfit,contributionBeforeMarketing:t.contribution+t.marketing,contribution:t.contribution,ebitda:t.ebitda}};}
const reports=[financial('2024-11-01','2024-11-30'),financial('2024-12-01','2024-12-31')];
const plan=compileSupplementalPlan({financialReports:reports,cashFixture:fixture,acquisitionSource:acquisition,observedAt},{now});
const proposal=()=>prepareSupplementalPublication(plan,{expectedPlanHash:plan.planHash,expectedRecords:4});
const handles=new WeakSet();
/** Branded local-only rehearsal: a caller cannot supply a remote/general DB handle. */
async function localRehearsal(){const db=await PGlite.create();try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE placeholder_read_parent NOLOGIN;CREATE ROLE placeholder_report_reader NOLOGIN INHERIT;
 CREATE TABLE public.stores(id uuid PRIMARY KEY);CREATE TABLE public.store_memberships(user_id uuid,store_id uuid);
 CREATE SCHEMA finance_history_v2;CREATE TABLE finance_history_v2.seals(snapshot_id uuid PRIMARY KEY,store_id uuid,date_from date,date_to date,sales_revision text,cost_revision text);
 CREATE TABLE finance_history_v2.invalidations(snapshot_id uuid PRIMARY KEY);CREATE TABLE finance_history_v2.version_heads(store_id uuid,date_from date,date_to date,version_id uuid,selection_id uuid);
 CREATE TABLE finance_history_v2.correction_versions(version_id uuid PRIMARY KEY,store_id uuid,date_from date,date_to date,sales_revision text,cost_revision text);
 CREATE TABLE finance_history_v2.correction_selections(selection_id uuid PRIMARY KEY,store_id uuid,date_from date,date_to date,previous_version_id uuid,version_id uuid);
 GRANT SELECT ON public.stores,public.store_memberships TO placeholder_read_parent;GRANT placeholder_read_parent TO placeholder_report_reader;`);
 await db.query('INSERT INTO public.stores VALUES($1)',[identity.storeId]);await db.query('INSERT INTO public.store_memberships VALUES($1,$2)',['90000000-0000-4000-8000-000000000001',identity.storeId]);
 for(const r of reports)await db.query('INSERT INTO finance_history_v2.seals VALUES($1,$2,$3,$4,$5,$6)',[r.versionId,identity.storeId,r.scope.from,r.scope.to,r.salesRevision,r.costRevision]);
 await db.exec(await readFile(new URL('./supplemental-schema.sql',import.meta.url),'utf8'));
 const handle=Object.freeze({db,kind:'fresh-local-pglite-only'});handles.add(handle);return handle;
 }catch(e){await db.close();throw e;}}
async function rehearse(handle,p,{failBeforeCommit=false}={}){assert.ok(handles.has(handle),'Only newly-created local rehearsal handles are accepted');try{for(const statement of p.statements){if(failBeforeCommit&&statement.label==='commit')throw Error('Injected local interruption');await handle.db.query(statement.text,statement.values);}}catch(e){await handle.db.exec('ROLLBACK');throw e;}}
const rows=h=>h.db.query('SELECT * FROM finance_review_supplement_v1.snapshots ORDER BY snapshot_id');
test('reviewed compiler emits deterministic immutable parameterised bounded transaction and refuses unreviewed hashes/counts',()=>{
 const p=proposal();assert.equal(p.planHash,plan.planHash);assert.equal(p.expectedRecords,4);assert.equal(p.remoteApplied,false);assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.statements)&&Object.isFrozen(p.statements[4].values));
 assert.equal(p.statements[0].text,'BEGIN');assert.equal(p.statements.at(-1).text,'COMMIT');assert.ok(p.statements.some(s=>s.text.includes('ON CONFLICT DO NOTHING')));
 for(const s of p.statements){assert.doesNotMatch(s.text,/INSERT INTO (public|finance_history_v2)/);assert.doesNotMatch(s.text,/UPDATE|DELETE|TRUNCATE|CREATE ROLE|ALTER ROLE/);assert.equal(s.text.includes('eligible-cash-v1'),false);}
 assert.equal(JSON.stringify(proposal()),JSON.stringify(p));
 for(const opts of [{},{expectedPlanHash:'a'.repeat(64),expectedRecords:4},{expectedPlanHash:plan.planHash,expectedRecords:3},{expectedPlanHash:plan.planHash,expectedRecords:49},{expectedPlanHash:plan.planHash,expectedRecords:4,expectedStore:stableId('other','store')}])assert.throws(()=>prepareSupplementalPublication(plan,opts));
 const changed=structuredClone(plan);changed.records[0].body.payload.extra='unreviewed';assert.throws(()=>prepareSupplementalPublication(changed,{expectedPlanHash:plan.planHash,expectedRecords:4}),/hash/);
});
test('publication commits all reviewed rows once; unchanged replay preserves every original body/hash/index',async()=>{
 const h=await localRehearsal();try{await rehearse(h,proposal());const before=(await rows(h)).rows;assert.equal(before.length,4);await rehearse(h,proposal());assert.deepEqual((await rows(h)).rows,before);for(const r of before)assert.equal(r.store_id,identity.storeId);}finally{await h.db.close();}
});
test('same-key baseline conflicts abort with no mutation, while interruption rolls all prior inserts back',async()=>{
 const h=await localRehearsal();try{
  await assert.rejects(rehearse({},proposal()),/newly-created/);
  await assert.rejects(rehearse(h,proposal(),{failBeforeCommit:true}),/interruption/);assert.equal((await rows(h)).rows.length,0);
  await rehearse(h,proposal());const before=(await rows(h)).rows;
  const later=compileSupplementalPlan({financialReports:reports,cashFixture:fixture,acquisitionSource:acquisition,observedAt:'2026-11-20T18:30:00Z'},{now});
  await assert.rejects(rehearse(h,prepareSupplementalPublication(later,{expectedPlanHash:later.planHash,expectedRecords:4})),/division by zero/);assert.deepEqual((await rows(h)).rows,before);
  // Owner invalidation is a changed baseline; publication must not resurrect it.
  await h.db.query('UPDATE finance_review_supplement_v1.snapshots SET invalidated=true WHERE snapshot_id=$1',[plan.records[0].snapshot_id]);const invalidated=(await rows(h)).rows;
  await assert.rejects(rehearse(h,proposal()),/division by zero/);assert.deepEqual((await rows(h)).rows,invalidated);assert.notDeepEqual(invalidated,before);
 }finally{await h.db.close();}
});
test('changed current financial authority in a later row aborts the entire publication transaction',async()=>{
 const h=await localRehearsal();try{
  await h.db.query('INSERT INTO finance_history_v2.invalidations VALUES($1)',[reports[1].versionId]);
  await assert.rejects(rehearse(h,proposal()),/matching financial evidence/);assert.equal((await rows(h)).rows.length,0);
 }finally{await h.db.close();}
});
test('read grant proposal preserves existing readonly inheritance and grants only scoped SELECT/USAGE; rollback removes only added access',async()=>{
 const h=await localRehearsal();try{
  const p=generateRestrictedSupplementReadAccess('placeholder_report_reader',{expectedStore:identity.storeId});assert.equal(p.remoteApplied,false);assert.doesNotMatch(p.commitSql,/GRANT (INSERT|UPDATE|DELETE|CREATE)|CREATE ROLE|ALTER ROLE|GRANT.*finance_history_v2/);
  await h.db.exec(p.commitSql);
  assert.equal((await h.db.query("SELECT has_table_privilege('placeholder_report_reader','finance_review_supplement_v1.snapshots','SELECT') ok")).rows[0].ok,true);
  for(const permission of ['INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES'])assert.equal((await h.db.query("SELECT has_table_privilege('placeholder_report_reader','finance_review_supplement_v1.snapshots',$1) ok",[permission])).rows[0].ok,false);
  assert.equal((await h.db.query("SELECT pg_has_role('placeholder_report_reader','placeholder_read_parent','MEMBER') ok")).rows[0].ok,true);
  await assert.rejects(h.db.exec(p.commitSql),/Existing supplemental access differs/);await h.db.exec('ROLLBACK');
  await h.db.exec(p.rollbackSql);assert.equal((await h.db.query("SELECT has_schema_privilege('placeholder_report_reader','finance_review_supplement_v1','USAGE') ok")).rows[0].ok,false);
  assert.equal((await h.db.query("SELECT has_table_privilege('placeholder_report_reader','public.store_memberships','SELECT') ok")).rows[0].ok,true);
 }finally{await h.db.close();}
});
test('grant proposal refuses unsafe role strings/store, privileged or effectively writing roles, browser grants and damaged RLS',async()=>{
 for(const role of ['postgres','anon','authenticated','service_role','public','pg_monitor','pg_read_all_data','x;GRANT ALL','"role"','a'])assert.throws(()=>generateRestrictedSupplementReadAccess(role,{expectedStore:identity.storeId}));
 assert.throws(()=>generateRestrictedSupplementReadAccess('placeholder_report_reader',{expectedStore:stableId('other','store')}));
 const h=await localRehearsal();try{
  const p=generateRestrictedSupplementReadAccess('placeholder_report_reader',{expectedStore:identity.storeId});
  await h.db.exec('GRANT UPDATE ON public.stores TO placeholder_read_parent');await assert.rejects(h.db.exec(p.commitSql),/remain read-only/);await h.db.exec('ROLLBACK');await h.db.exec('REVOKE UPDATE ON public.stores FROM placeholder_read_parent');
  await h.db.exec('CREATE ROLE placeholder_write_parent NOLOGIN;GRANT UPDATE ON public.stores TO placeholder_write_parent;ALTER ROLE placeholder_report_reader NOINHERIT;GRANT placeholder_write_parent TO placeholder_report_reader');await assert.rejects(h.db.exec(p.commitSql),/remain read-only/);await h.db.exec('ROLLBACK');await h.db.exec('REVOKE placeholder_write_parent FROM placeholder_report_reader;ALTER ROLE placeholder_report_reader INHERIT');
  await h.db.exec('ALTER ROLE placeholder_report_reader BYPASSRLS');await assert.rejects(h.db.exec(p.commitSql),/restricted server role/);await h.db.exec('ROLLBACK');await h.db.exec('ALTER ROLE placeholder_report_reader NOBYPASSRLS');
  await h.db.exec('GRANT USAGE ON SCHEMA finance_review_supplement_v1 TO anon');await assert.rejects(h.db.exec(p.commitSql),/remain denied/);await h.db.exec('ROLLBACK');await h.db.exec('REVOKE USAGE ON SCHEMA finance_review_supplement_v1 FROM anon');
  await h.db.exec('ALTER POLICY supplement_member_read ON finance_review_supplement_v1.snapshots USING(true)');await assert.rejects(h.db.exec(p.commitSql),/membership RLS/);await h.db.exec('ROLLBACK');
  await h.db.exec('ALTER TABLE finance_review_supplement_v1.snapshots DISABLE ROW LEVEL SECURITY');await assert.rejects(h.db.exec(p.commitSql),/membership RLS/);await h.db.exec('ROLLBACK');
 }finally{await h.db.close();}
});

async function rehearseSingleCall(handle,artifact){assert.ok(handles.has(handle),'Only newly-created local rehearsal handles are accepted');try{await handle.db.exec(artifact.sql);}catch(e){await handle.db.exec('ROLLBACK');throw e;}}
const single=()=>prepareSupplementalSingleCallSql(plan,{expectedPlanHash:plan.planHash,expectedRecords:4});
test('single-call SQL embeds reviewed JSON once and commits/replays atomically below byte cap',async()=>{
 const artifact=single();
 assert.equal(artifact.remoteApplied,false);assert.equal(artifact.expectedRecords,4);assert.ok(Object.isFrozen(artifact));assert.ok(artifact.sqlBytes<1900000&&artifact.toolArgumentBytes<1900000);
 assert.equal((artifact.sql.match(/jsonb_to_recordset/g)||[]).length,3);assert.equal((artifact.sql.match(/INSERT INTO pg_temp.night_scout_supplement_review_buffer_v1/g)||[]).length,1);
 // A full source-payload marker occurs once, while later phases name the buffer only.
 assert.equal(artifact.sql.split('eligible-cash-v1').length-1,2); // One per cash record, never repeated per phase.
 assert.equal(artifact.sql.includes("E'[{"),true); // Explicit E-literal; quoted/backslash case is tested separately.
 const h=await localRehearsal();try{await rehearseSingleCall(h,artifact);const before=(await rows(h)).rows;assert.equal(before.length,4);await rehearseSingleCall(h,artifact);assert.deepEqual((await rows(h)).rows,before);
 assert.equal((await h.db.query("SELECT to_regclass('pg_temp.night_scout_supplement_review_buffer_v1') AS buffer")).rows[0].buffer,null);
 }finally{await h.db.close();}
 for(const maxBytes of [1,100,2000000,NaN])assert.throws(()=>prepareSupplementalSingleCallSql(plan,{expectedPlanHash:plan.planHash,expectedRecords:4,maxBytes}));
});
test('single-call escape literals preserve apostrophes/backslashes/injection-shaped reviewed text when initial standard strings are off',async()=>{
 const quoted=structuredClone(plan),probe="Owner's \\folder'); DROP TABLE public.stores; -- \\u0027 \\n";
 const row=quoted.records.find(r=>r.kind==='acquisition');row.body.payload.limitations.push(probe);row.body_hash=supplementalDigest(row.body);row.snapshot_id=stableId('supplemental-v1',`${row.kind}:${row.store_id}:${row.date_from}:${row.date_to}:${row.financial_version}:${row.body_hash}`);
 quoted.hashes.records=digest(quoted.records);const {planHash,...artifact}=quoted;quoted.planHash=digest(artifact);
 const sql=prepareSupplementalSingleCallSql(quoted,{expectedPlanHash:quoted.planHash,expectedRecords:4});
 const h=await localRehearsal();try{await h.db.exec('SET standard_conforming_strings=off');await rehearseSingleCall(h,sql);
 const stored=(await rows(h)).rows.find(r=>r.snapshot_id===row.snapshot_id);assert.equal(stored.body.payload.limitations.at(-1),probe);assert.equal((await h.db.query('SELECT count(*)::int AS n FROM public.stores')).rows[0].n,1);
 assert.equal((await h.db.query("SHOW standard_conforming_strings")).rows[0].standard_conforming_strings,'off');
 }finally{await h.db.close();}
});
test('single-call conflicts and financial failure roll back all rows; pre-existing temp table is not clobbered',async()=>{
 const h=await localRehearsal();try{
 await h.db.query('INSERT INTO finance_history_v2.invalidations VALUES($1)',[reports[1].versionId]);await assert.rejects(rehearseSingleCall(h,single()),/matching financial evidence/);assert.equal((await rows(h)).rows.length,0);
 await h.db.exec('DELETE FROM finance_history_v2.invalidations');await rehearseSingleCall(h,single());await h.db.query('UPDATE finance_review_supplement_v1.snapshots SET invalidated=true WHERE snapshot_id=$1',[plan.records[0].snapshot_id]);const before=(await rows(h)).rows;
 await assert.rejects(rehearseSingleCall(h,single()),/division by zero/);assert.deepEqual((await rows(h)).rows,before);
 await h.db.exec("CREATE TEMP TABLE night_scout_supplement_review_buffer_v1(marker text); INSERT INTO night_scout_supplement_review_buffer_v1 VALUES('preserve-existing')");
 await assert.rejects(rehearseSingleCall(h,single()),/already exists/);assert.equal((await h.db.query('SELECT marker FROM pg_temp.night_scout_supplement_review_buffer_v1')).rows[0].marker,'preserve-existing');assert.deepEqual((await rows(h)).rows,before);
 }finally{await h.db.close();}
});
