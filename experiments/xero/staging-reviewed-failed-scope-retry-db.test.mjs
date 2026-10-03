import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration=file=>readFileSync(new URL(`../../db-migrations/staging/${file}`,import.meta.url),'utf8');
const owner='10000000-0000-4000-8000-000000000001',store='20000000-0000-4000-8000-000000000001',connection='30000000-0000-4000-8000-000000000001';
const accounts=[['r','Revenue','REVENUE'],['f','Fees','EXPENSE'],['a','Ads','EXPENSE'],['s','Software','EXPENSE'],['c','Cash','BANK']].map(([accountId,accountName,accountType])=>({accountId,accountName,accountType,accountStatus:'ACTIVE'}));
const mapping=['revenue:r','processingFee:f','advertising:a','software:s','includedCash:c'].map(value=>{const [category,accountId]=value.split(':');return {category,accountId};});

async function preparedDb(){
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE night_scout_import_service NOLOGIN;CREATE ROLE night_scout_import_login LOGIN NOINHERIT CONNECTION LIMIT 1 PASSWORD NULL;GRANT night_scout_import_service TO night_scout_import_login;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT NULL::uuid$$;CREATE TABLE public.stores(id uuid PRIMARY KEY);CREATE TABLE public.store_memberships(user_id uuid,store_id uuid,PRIMARY KEY(user_id,store_id));`);
 for(const file of ['20260918_apply_xero_staging.sql','20260918_grant_xero_worker_access.sql','20260918_grant_xero_bootstrap_access.sql','20260924_bind_xero_bootstrap_connection_id.sql','20260925_xero_single_refresh_job.sql'])await db.exec(migration(file));
 await db.query('INSERT INTO auth.users VALUES($1)',[owner]);await db.query('INSERT INTO public.stores VALUES($1)',[store]);await db.query('INSERT INTO public.store_memberships VALUES($1,$2)',[owner,store]);
 await db.exec('SET SESSION AUTHORIZATION night_scout_xero_bootstrap_login');
 const receipt=await db.query(`SELECT * FROM xero_v1.bootstrap_create_initial_connection($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::bytea,$10::bytea,$11,$12)`,[connection,store,'tenant-1',owner,'2026-09-25','2026-09-25T12:00:00Z',JSON.stringify(accounts),JSON.stringify(mapping),new Uint8Array([1]),new Uint8Array([2]),'staging-v1','AES-256-GCM']);
 await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION night_scout_import_login');
 const mappingId=receipt.rows[0].mapping_version_id;
 const lease=(await db.query('SELECT xero_v1.worker_acquire_refresh_lease($1,1,300) lease',[connection])).rows[0].lease;
 await db.query(`SELECT xero_v1.worker_record_accounting_evidence_leased($1,$2,'2026-09-01','2026-09-25','GBP',false,'failed','source_refresh_failed',NULL,now(),NULL,NULL,NULL,NULL,NULL,NULL,1,$3)`,[connection,mappingId,lease]);
 await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');
 return {db,mappingId};
}

test('reviewed failed scope is retained and may be discovered exactly once',async()=>{
 const {db,mappingId}=await preparedDb();
 try {
  await db.exec(migration('20260925_xero_reviewed_failed_scope_retry.sql'));
  assert.equal((await db.query('SELECT count(*)::int count FROM xero_v1.accounting_evidence')).rows[0].count,1,'failed evidence remains append-only');
  await db.exec('SET SESSION AUTHORIZATION night_scout_import_login');
  const job=await db.query(`SELECT * FROM xero_v1.worker_get_single_refresh_job('2026-09-01','2026-09-25','GBP',false)`);
  assert.deepEqual(job.rows,[{connection_id:connection,mapping_version_id:mappingId}]);
  await assert.rejects(db.query(`SELECT * FROM xero_v1.worker_get_single_refresh_job('2026-09-01','2026-09-25','GBP',false)`),/job unavailable|retry unavailable/i,'authorization is consumed before external work');
  await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');
  await db.query(`INSERT INTO xero_v1.accounting_evidence(connection_id,mapping_version_id,scope_from,scope_to,currency,closed_period,state,reason,retrieved_at) VALUES($1,$2,'2026-09-02','2026-09-25','GBP',false,'failed','source_refresh_failed',now())`,[connection,mappingId]);
  await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION night_scout_import_login');
  await assert.rejects(db.query(`SELECT * FROM xero_v1.worker_get_single_refresh_job('2026-09-02','2026-09-25','GBP',false)`),/job unavailable/i,'authorization cannot be used for another failed scope');
  await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');
  assert.equal((await db.query('SELECT consumed_at IS NOT NULL consumed FROM xero_v1.accounting_evidence_retry_authorizations')).rows[0].consumed,true);
  await db.exec(migration('20260925_xero_reviewed_failed_scope_retry.sql'));
  await db.exec('SET SESSION AUTHORIZATION night_scout_import_login');
  await assert.rejects(db.query(`SELECT * FROM xero_v1.worker_get_single_refresh_job('2026-09-01','2026-09-25','GBP',false)`),/job unavailable/i,'reapplying migration cannot re-arm consumed authorization');
 } finally {await db.close();}
});

test('authorization migration fails closed without the exact observed latest failure',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE night_scout_xero_bootstrap_login NOLOGIN;CREATE ROLE night_scout_import_login LOGIN;CREATE SCHEMA xero_v1;CREATE TABLE xero_v1.accounting_evidence(id uuid PRIMARY KEY,connection_id uuid,mapping_version_id uuid,scope_from date,scope_to date,currency text,closed_period boolean,state text,reason text,created_at timestamptz);CREATE TABLE xero_v1.connections(id uuid PRIMARY KEY,retired_at timestamptz);`);
  await assert.rejects(db.exec(migration('20260925_xero_reviewed_failed_scope_retry.sql')),/reviewed Xero failed scope unavailable/i);
 } finally {await db.close();}
});

test('retry capability is private and verifier is status-only',()=>{
 const sql=migration('20260925_xero_reviewed_failed_scope_retry.sql');
 const verifier=migration('verify-xero-reviewed-retry-2026-09-25.sql');
 assert.match(sql,/REVOKE ALL ON xero_v1\.accounting_evidence_retry_authorizations FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/consumed_at=clock_timestamp\(\)/);
 assert.match(sql,/latest\.state='failed' AND latest\.reason='source_refresh_failed'/);
 assert.doesNotMatch(verifier,/AS\s+evidence_id|SELECT\s+ae\.id/i);
 assert.doesNotMatch(verifier,/booked_revenue|tenant_id|ciphertext|encrypted_dek/i);
});

test('second reviewed retry preserves the consumed authorization and arms only the newest failure',async()=>{
 const {db,mappingId}=await preparedDb();
 try {
  await db.exec(migration('20260925_xero_reviewed_failed_scope_retry.sql'));
  await db.exec('SET SESSION AUTHORIZATION night_scout_import_login');
  await db.query(`SELECT * FROM xero_v1.worker_get_single_refresh_job('2026-09-01','2026-09-25','GBP',false)`);
  const lease=(await db.query('SELECT xero_v1.worker_acquire_refresh_lease($1,1,300) lease',[connection])).rows[0].lease;
  await db.query(`SELECT xero_v1.worker_record_accounting_evidence_leased($1,$2,'2026-09-01','2026-09-25','GBP',false,'failed','source_refresh_failed',NULL,clock_timestamp(),NULL,NULL,NULL,NULL,NULL,NULL,1,$3)`,[connection,mappingId,lease]);
  await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');

  await db.exec(migration('20260928_xero_second_reviewed_failed_scope_retry.sql'));
  const status=(await db.query(migration('verify-xero-second-reviewed-retry-2026-09-28.sql'))).rows[0];
  assert.deepEqual(status,{
   exactly_two_reviewed_retries:true,
   exactly_one_retry_consumed:true,
   exactly_one_retry_unconsumed:true,
   current_latest_failure_authorized:true
  });
  await db.exec('SET SESSION AUTHORIZATION night_scout_import_login');
  assert.equal((await db.query(`SELECT count(*)::int count FROM xero_v1.worker_get_single_refresh_job('2026-09-01','2026-09-25','GBP',false)`)).rows[0].count,1);
  await assert.rejects(db.query(`SELECT * FROM xero_v1.worker_get_single_refresh_job('2026-09-01','2026-09-25','GBP',false)`),/job unavailable|retry unavailable/i);
 } finally {await db.close();}
});

test('second reviewed retry fails closed while an earlier authorization is unconsumed',async()=>{
 const {db}=await preparedDb();
 try {
  await db.exec(migration('20260925_xero_reviewed_failed_scope_retry.sql'));
  await assert.rejects(db.exec(migration('20260928_xero_second_reviewed_failed_scope_retry.sql')),/prior Xero retry authorization unavailable/i);
 } finally {await db.close();}
});

test('second retry verifier remains status-only',()=>{
 const verifier=migration('verify-xero-second-reviewed-retry-2026-09-28.sql');
 assert.doesNotMatch(verifier,/AS\s+evidence_id|SELECT\s+ae\.id\s+AS/i);
 assert.doesNotMatch(verifier,/booked_revenue|tenant_id|ciphertext|encrypted_dek/i);
});

test('third reviewed retry appends one authorization for the newest failure only',async()=>{
 const {db,mappingId}=await preparedDb();
 try {
  await db.exec(migration('20260925_xero_reviewed_failed_scope_retry.sql'));
  await db.exec('SET SESSION AUTHORIZATION night_scout_import_login');
  await db.query(`SELECT * FROM xero_v1.worker_get_single_refresh_job('2026-09-01','2026-09-25','GBP',false)`);
  let lease=(await db.query('SELECT xero_v1.worker_acquire_refresh_lease($1,1,300) lease',[connection])).rows[0].lease;
  await db.query(`SELECT xero_v1.worker_record_accounting_evidence_leased($1,$2,'2026-09-01','2026-09-25','GBP',false,'failed','source_refresh_failed',NULL,clock_timestamp(),NULL,NULL,NULL,NULL,NULL,NULL,1,$3)`,[connection,mappingId,lease]);
  await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');
  await db.exec(migration('20260928_xero_second_reviewed_failed_scope_retry.sql'));
  await db.exec('SET SESSION AUTHORIZATION night_scout_import_login');
  await db.query(`SELECT * FROM xero_v1.worker_get_single_refresh_job('2026-09-01','2026-09-25','GBP',false)`);
  lease=(await db.query('SELECT xero_v1.worker_acquire_refresh_lease($1,1,300) lease',[connection])).rows[0].lease;
  await db.query(`SELECT xero_v1.worker_record_accounting_evidence_leased($1,$2,'2026-09-01','2026-09-25','GBP',false,'failed','source_refresh_failed',NULL,clock_timestamp(),NULL,NULL,NULL,NULL,NULL,NULL,1,$3)`,[connection,mappingId,lease]);
  await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');

  await db.exec(migration('20261003_xero_third_reviewed_failed_scope_retry.sql'));
  const status=(await db.query(migration('verify-xero-third-reviewed-retry-2026-10-03.sql'))).rows[0];
  assert.deepEqual(status,{
   exactly_three_reviewed_retries:true,
   exactly_two_retries_consumed:true,
   exactly_one_retry_unconsumed:true,
   current_latest_failure_authorized:true
  });
  assert.equal((await db.query('SELECT count(*)::int count FROM xero_v1.accounting_evidence')).rows[0].count,3,'all failures remain append-only');
  await db.exec('SET SESSION AUTHORIZATION night_scout_import_login');
  assert.equal((await db.query(`SELECT count(*)::int count FROM xero_v1.worker_get_single_refresh_job('2026-09-01','2026-09-25','GBP',false)`)).rows[0].count,1);
  await assert.rejects(db.query(`SELECT * FROM xero_v1.worker_get_single_refresh_job('2026-09-01','2026-09-25','GBP',false)`),/job unavailable|retry unavailable/i);
  await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');
  await assert.rejects(db.exec(migration('20261003_xero_third_reviewed_failed_scope_retry.sql')),/prior Xero retry authorizations unavailable|already authorized/i,'migration replay cannot re-arm the consumed authorization');
 } finally {await db.close();}
});

test('third reviewed retry fails closed until both earlier authorizations are consumed',async()=>{
 const {db}=await preparedDb();
 try {
  await db.exec(migration('20260925_xero_reviewed_failed_scope_retry.sql'));
  await assert.rejects(db.exec(migration('20261003_xero_third_reviewed_failed_scope_retry.sql')),/prior Xero retry authorizations unavailable/i);
 } finally {await db.close();}
});

test('third retry verifier remains status-only',()=>{
 const migrationSql=migration('20261003_xero_third_reviewed_failed_scope_retry.sql');
 const verifier=migration('verify-xero-third-reviewed-retry-2026-10-03.sql');
 assert.match(migrationSql,/authorization_count<>2 OR consumed_count<>authorization_count/);
 assert.match(migrationSql,/INSERT INTO xero_v1\.accounting_evidence_retry_authorizations/);
 assert.doesNotMatch(migrationSql,/UPDATE\s+xero_v1\.accounting_evidence_retry_authorizations|DELETE\s+FROM\s+xero_v1\.accounting_evidence_retry_authorizations/i);
 assert.doesNotMatch(verifier,/AS\s+evidence_id|SELECT\s+ae\.id\s+AS/i);
 assert.doesNotMatch(verifier,/booked_revenue|tenant_id|ciphertext|encrypted_dek/i);
});

test('fourth reviewed retry requires a newer supported preflight for the current credential',async()=>{
 const {db,mappingId}=await preparedDb();
 try {
  const failure=async()=>{
   await db.exec('SET SESSION AUTHORIZATION night_scout_import_login');
   const lease=(await db.query('SELECT xero_v1.worker_acquire_refresh_lease($1,1,300) lease',[connection])).rows[0].lease;
   await db.query(`SELECT xero_v1.worker_record_accounting_evidence_leased($1,$2,'2026-09-01','2026-09-25','GBP',false,'failed','source_refresh_failed',NULL,clock_timestamp(),NULL,NULL,NULL,NULL,NULL,NULL,1,$3)`,[connection,mappingId,lease]);
   await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');
  };
  for(const file of ['20260925_xero_reviewed_failed_scope_retry.sql','20260928_xero_second_reviewed_failed_scope_retry.sql','20261003_xero_third_reviewed_failed_scope_retry.sql']){
   await db.exec(migration(file));
   await db.exec('SET SESSION AUTHORIZATION night_scout_import_login');
   await db.query(`SELECT * FROM xero_v1.worker_get_single_refresh_job('2026-09-01','2026-09-25','GBP',false)`);
   await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');
   await failure();
  }
  await db.exec(migration('20261003_xero_connection_preflight_evidence.sql'));
  await assert.rejects(db.exec(migration('20261003_xero_fourth_reviewed_failed_scope_retry.sql')),/successful Xero connection preflight required/i);
  await db.exec('ROLLBACK');

  await db.exec('SET SESSION AUTHORIZATION night_scout_import_login');
  const lease=(await db.query('SELECT xero_v1.worker_acquire_refresh_lease($1,1,300) lease',[connection])).rows[0].lease;
  assert.equal((await db.query(`SELECT xero_v1.worker_record_connection_preflight($1,1,'connected','organisation','ok',NULL,true,$2) recorded`,[connection,lease])).rows[0].recorded,true);
  await db.query('SELECT xero_v1.worker_release_refresh_lease($1,1,$2)',[connection,lease]);
  await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');

  await db.exec(migration('20261003_xero_fourth_reviewed_failed_scope_retry.sql'));
  assert.deepEqual((await db.query(migration('verify-xero-fourth-reviewed-retry-2026-10-03.sql'))).rows[0],{
   exactly_four_reviewed_retries:true,exactly_three_retries_consumed:true,
   exactly_one_retry_unconsumed:true,current_latest_failure_authorized:true,
   current_credential_preflight_supported:true
  });
  assert.equal((await db.query('SELECT count(*)::int count FROM xero_v1.accounting_evidence')).rows[0].count,4);
 } finally {await db.close();}
});

test('preflight evidence is private, bounded, append-only and exact-lease protected',async()=>{
 const {db}=await preparedDb();
 try {
  await db.exec(migration('20261003_xero_connection_preflight_evidence.sql'));
  await db.exec('SET SESSION AUTHORIZATION night_scout_import_login');
  const version=1;
  await assert.rejects(db.query(`SELECT xero_v1.worker_record_connection_preflight($1,$2,'connected','organisation','ok',NULL,true,now())`,[connection,version]),/lease unavailable/i);
  const lease=(await db.query('SELECT xero_v1.worker_acquire_refresh_lease($1,$2,300) lease',[connection,version])).rows[0].lease;
  await assert.rejects(db.query(`SELECT xero_v1.worker_record_connection_preflight($1,$2,'connected','connection','ok',NULL,true,$3)`,[connection,version,lease]));
  await assert.rejects(db.query(`SELECT xero_v1.worker_record_connection_preflight($1,$2,'connected','organisation','ok',200,true,$3)`,[connection,version,lease]));
  assert.equal((await db.query(`SELECT xero_v1.worker_record_connection_preflight($1,$2,'failed','connection','forbidden',403::smallint,NULL,$3) recorded`,[connection,version,lease])).rows[0].recorded,true);
  await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');
  assert.equal((await db.query('SELECT count(*)::int count FROM xero_v1.connection_preflight_evidence')).rows[0].count,1);
 } finally {await db.close();}
 const sql=migration('20261003_xero_connection_preflight_evidence.sql');
 const fourth=migration('20261003_xero_fourth_reviewed_failed_scope_retry.sql');
 const verifier=migration('verify-xero-fourth-reviewed-retry-2026-10-03.sql');
 assert.match(sql,/REVOKE ALL ON xero_v1\.connection_preflight_evidence\s+FROM PUBLIC,anon,authenticated/);
 assert.doesNotMatch(sql,/UPDATE\s+xero_v1\.connection_preflight_evidence|DELETE\s+FROM\s+xero_v1\.connection_preflight_evidence/i);
 assert.match(fourth,/credential_version=current_credential_version/);
 assert.match(fourth,/checked_at>latest_failure_at/);
 assert.doesNotMatch(fourth,/UPDATE\s+xero_v1\.accounting_evidence_retry_authorizations|DELETE\s+FROM\s+xero_v1\.accounting_evidence_retry_authorizations/i);
 assert.doesNotMatch(verifier,/AS\s+evidence_id|tenant_id|ciphertext|encrypted_dek|provider_status\s+AS/i);
});

test('connection preflight discovery is worker-only, fail-closed, and independent of accounting retries',async()=>{
 const {db,mappingId}=await preparedDb();
 try {
  await db.exec(migration('20261003_xero_connection_preflight_job.sql'));
  await db.exec('SET SESSION AUTHORIZATION night_scout_import_login');
  assert.deepEqual((await db.query('SELECT * FROM xero_v1.worker_get_single_connection_preflight_job()')).rows,
   [{connection_id:connection,mapping_version_id:mappingId}]);
  await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION authenticated');
  await assert.rejects(db.query('SELECT * FROM xero_v1.worker_get_single_connection_preflight_job()'),/permission denied|worker capability/i);
  await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');
  await db.query('INSERT INTO xero_v1.connections(id,store_id,tenant_id) VALUES($1,$2,$3)',
   ['40000000-0000-4000-8000-000000000001',store,'tenant-2']);
  await db.query(`INSERT INTO xero_v1.credential_envelopes(connection_id,ciphertext,encrypted_dek,key_version,algorithm,version)
   VALUES($1,$2,$3,'staging-v1','AES-256-GCM',1)`,['40000000-0000-4000-8000-000000000001',new Uint8Array([1]),new Uint8Array([2])]);
  await db.exec('SET SESSION AUTHORIZATION night_scout_import_login');
  // The second connection has no complete mapping, so it is not a candidate.
  assert.equal((await db.query('SELECT count(*)::int count FROM xero_v1.worker_get_single_connection_preflight_job()')).rows[0].count,1);
  await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');
  await db.query('UPDATE xero_v1.connections SET retired_at=clock_timestamp() WHERE id=$1',[connection]);
  await db.exec('SET SESSION AUTHORIZATION night_scout_import_login');
  await assert.rejects(db.query('SELECT * FROM xero_v1.worker_get_single_connection_preflight_job()'),/preflight job unavailable/i);
 } finally {await db.close();}
 const sql=migration('20261003_xero_connection_preflight_job.sql');
 assert.doesNotMatch(sql,/accounting_evidence(?:_retry_authorizations)?/i);
 assert.match(sql,/account_status='ACTIVE'/);
 assert.match(sql,/candidate_count<>1/);
 assert.match(sql,/REVOKE ALL ON FUNCTION xero_v1\.worker_get_single_connection_preflight_job\(\)/);
 assert.match(sql,/rolname='service_role'/);
});
