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
