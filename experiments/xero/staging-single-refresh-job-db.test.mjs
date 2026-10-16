import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration=file=>readFileSync(new URL(`../../db-migrations/staging/${file}`,import.meta.url),'utf8');
const owner='10000000-0000-4000-8000-000000000001',store='20000000-0000-4000-8000-000000000001',connection='30000000-0000-4000-8000-000000000001';
const accounts=[['r','Revenue','REVENUE'],['f','Fees','EXPENSE'],['a','Ads','EXPENSE'],['s','Software','EXPENSE'],['c','Cash','BANK']].map(([accountId,accountName,accountType])=>({accountId,accountName,accountType,accountStatus:'ACTIVE'}));
const mapping=['revenue:r','processingFee:f','advertising:a','software:s','includedCash:c'].map(value=>{const [category,accountId]=value.split(':');return {category,accountId};});

test('worker discovers only one complete persisted refresh job and no business data',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE night_scout_import_service NOLOGIN;CREATE ROLE night_scout_import_login LOGIN NOINHERIT CONNECTION LIMIT 1 PASSWORD NULL;GRANT night_scout_import_service TO night_scout_import_login;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT NULL::uuid$$;CREATE TABLE public.stores(id uuid PRIMARY KEY);CREATE TABLE public.store_memberships(user_id uuid,store_id uuid,PRIMARY KEY(user_id,store_id));`);
  for(const file of ['20260918_apply_xero_staging.sql','20260918_grant_xero_worker_access.sql','20260918_grant_xero_bootstrap_access.sql','20260924_bind_xero_bootstrap_connection_id.sql','20260925_xero_single_refresh_job.sql'])await db.exec(migration(file));
  await db.query('INSERT INTO auth.users VALUES($1)',[owner]);await db.query('INSERT INTO public.stores VALUES($1)',[store]);await db.query('INSERT INTO public.store_memberships VALUES($1,$2)',[owner,store]);
  await db.exec('SET SESSION AUTHORIZATION night_scout_xero_bootstrap_login');
  const receipt=await db.query(`SELECT * FROM xero_v1.bootstrap_create_initial_connection($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::bytea,$10::bytea,$11,$12)`,[connection,store,'tenant-1',owner,'2026-09-24','2026-09-24T12:00:00Z',JSON.stringify(accounts),JSON.stringify(mapping),new Uint8Array([1]),new Uint8Array([2]),'staging-v1','AES-256-GCM']);
  await assert.rejects(db.query(`SELECT * FROM xero_v1.worker_get_single_refresh_job('2026-09-01','2026-09-24','GBP',false)`),/permission denied|worker capability/i);
  await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION night_scout_import_login');
  const job=await db.query(`SELECT * FROM xero_v1.worker_get_single_refresh_job('2026-09-01','2026-09-24','GBP',false)`);
  assert.deepEqual(job.rows,[{connection_id:connection,mapping_version_id:receipt.rows[0].mapping_version_id}]);
  assert.deepEqual(Object.keys(job.rows[0]).sort(),['connection_id','mapping_version_id']);
  await assert.rejects(
   db.query(`SELECT * FROM xero_v1.worker_get_single_refresh_job(current_date,current_date+1,'GBP',false)`),
   /invalid Xero refresh scope/i,
   'a near-future scope is rejected before job selection',
  );
  const mappingId=receipt.rows[0].mapping_version_id;
  const lease=(await db.query('SELECT xero_v1.worker_acquire_refresh_lease($1,1,300) lease',[connection])).rows[0].lease;
  assert.ok(lease);
  assert.equal((await db.query(`SELECT xero_v1.worker_store_refresh_envelope_leased($1,$2::bytea,$3::bytea,'staging-v1','AES-256-GCM',1,2,$4) stored`,[connection,new Uint8Array([3]),new Uint8Array([4]),lease])).rows[0].stored,true);
  const afterRotation=await db.query('SELECT * FROM xero_v1.worker_get_refresh_context($1,$2)',[connection,mappingId]);
  assert.equal(afterRotation.rows[0].version,2);assert.ok(afterRotation.rows[0].lease_expires_at,'rotation must retain the run fence');
  await assert.rejects(db.query(`SELECT xero_v1.worker_record_accounting_evidence_leased($1,$2,'2026-09-01','2026-09-24','GBP',false,'supported',NULL,'2026-09-24',now(),$3,1,2,3,4,5,2,$4)`,[connection,mappingId,'a'.repeat(64),new Date(new Date(lease).getTime()+1000)]),/fence unavailable/i);
  const evidence=(await db.query(`SELECT xero_v1.worker_record_accounting_evidence_leased($1,$2,'2026-09-01','2026-09-24','GBP',false,'supported',NULL,'2026-09-24',now(),$3,1,2,3,4,5,2,$4) id`,[connection,mappingId,'a'.repeat(64),lease])).rows[0].id;
  assert.ok(evidence);
  const completed=await db.query('SELECT * FROM xero_v1.worker_get_refresh_context($1,$2)',[connection,mappingId]);
  assert.equal(completed.rows[0].lease_expires_at,null);
  await assert.rejects(db.query(`SELECT xero_v1.worker_record_accounting_evidence_leased($1,$2,'2026-09-01','2026-09-24','GBP',false,'supported',NULL,'2026-09-24',now(),$3,1,2,3,4,5,2,$4)`,[connection,mappingId,'b'.repeat(64),lease]),/fence unavailable/i,'replay is rejected');
  await assert.rejects(db.query(`SELECT * FROM xero_v1.worker_get_single_refresh_job('2026-09-01','2026-09-24','GBP',false)`),/job unavailable/i,'a fresh invocation for a completed scope fails before Xero');
 } finally {await db.close();}
});

test('a value-free pre-rotation terminal failure closes the fence and makes the scope one-shot',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE night_scout_import_service NOLOGIN;CREATE ROLE night_scout_import_login LOGIN NOINHERIT CONNECTION LIMIT 1 PASSWORD NULL;GRANT night_scout_import_service TO night_scout_import_login;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT NULL::uuid$$;CREATE TABLE public.stores(id uuid PRIMARY KEY);CREATE TABLE public.store_memberships(user_id uuid,store_id uuid,PRIMARY KEY(user_id,store_id));`);
  for(const file of ['20260918_apply_xero_staging.sql','20260918_grant_xero_worker_access.sql','20260918_grant_xero_bootstrap_access.sql','20260924_bind_xero_bootstrap_connection_id.sql','20260925_xero_single_refresh_job.sql'])await db.exec(migration(file));
  await db.query('INSERT INTO auth.users VALUES($1)',[owner]);await db.query('INSERT INTO public.stores VALUES($1)',[store]);await db.query('INSERT INTO public.store_memberships VALUES($1,$2)',[owner,store]);
  await db.exec('SET SESSION AUTHORIZATION night_scout_xero_bootstrap_login');
  const receipt=await db.query(`SELECT * FROM xero_v1.bootstrap_create_initial_connection($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::bytea,$10::bytea,$11,$12)`,[connection,store,'tenant-1',owner,'2026-09-24','2026-09-24T12:00:00Z',JSON.stringify(accounts),JSON.stringify(mapping),new Uint8Array([1]),new Uint8Array([2]),'staging-v1','AES-256-GCM']);
  await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION night_scout_import_login');
  const lease=(await db.query('SELECT xero_v1.worker_acquire_refresh_lease($1,1,300) lease',[connection])).rows[0].lease;
  const evidence=(await db.query(`SELECT xero_v1.worker_record_accounting_evidence_leased($1,$2,'2026-08-01','2026-08-24','GBP',false,'failed','source_refresh_failed',NULL,now(),NULL,NULL,NULL,NULL,NULL,NULL,1,$3) id`,[connection,receipt.rows[0].mapping_version_id,lease])).rows[0].id;
  assert.ok(evidence);
  const context=await db.query('SELECT * FROM xero_v1.worker_get_refresh_context($1,$2)',[connection,receipt.rows[0].mapping_version_id]);
  assert.equal(context.rows[0].version,1,'pre-rotation failure cannot advance the credential');
  assert.equal(context.rows[0].lease_expires_at,null);
  await assert.rejects(db.query(`SELECT * FROM xero_v1.worker_get_single_refresh_job('2026-08-01','2026-08-24','GBP',false)`),/job unavailable/i);
  await assert.rejects(db.query(`SELECT xero_v1.worker_record_accounting_evidence_leased($1,$2,'2026-08-01','2026-08-24','GBP',false,'failed','source_refresh_failed',NULL,now(),NULL,NULL,NULL,NULL,NULL,NULL,1,$3)`,[connection,receipt.rows[0].mapping_version_id,lease]),/fence unavailable/i);
 } finally {await db.close();}
});

test('migration grants only the identifier lookup capability to the worker',()=>{
 const sql=migration('20260925_xero_single_refresh_job.sql');
 assert.match(sql,/session_user<>'night_scout_import_login'/);
 assert.match(sql,/candidate_count<>1/);
 assert.match(sql,/count\(DISTINCT ms\.category\).*5/s);
 assert.match(sql,/account_status='ACTIVE'/);
 assert.match(sql,/rotation alone is not.*completed refresh/is);
 assert.match(sql,/worker_record_accounting_evidence_leased/);
 assert.match(sql,/REVOKE EXECUTE ON FUNCTION xero_v1\.worker_record_accounting_evidence/);
 assert.match(sql,/REVOKE ALL ON FUNCTION xero_v1\.worker_get_single_refresh_job\(date,date,text,boolean\) FROM PUBLIC,anon,authenticated,night_scout_xero_bootstrap_login/);
 const lookupContract=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION xero_v1.worker_get_single_refresh_job'),sql.indexOf('-- Keep the run fence'));
 assert.doesNotMatch(lookupContract,/tenant_id|account_name|ciphertext|encrypted_dek|booked_revenue_minor/);
});
