import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const sql=f=>readFileSync(new URL(`../../db-migrations/staging/${f}`,import.meta.url),'utf8');
const owner='10000000-0000-4000-8000-000000000001',store='20000000-0000-4000-8000-000000000001',connection='30000000-0000-4000-8000-000000000001';
const accounts=[['r','Revenue','REVENUE'],['f','Fees','EXPENSE'],['a','Ads','EXPENSE'],['s','Software','EXPENSE'],['c','Cash','BANK']].map(([accountId,accountName,accountType])=>({accountId,accountName,accountType,accountStatus:'ACTIVE'}));
const mapping=['revenue:r','processingFee:f','advertising:a','software:s','includedCash:c'].map(x=>{const [category,accountId]=x.split(':');return {category,accountId};});

async function prepared(){const db=new PGlite();
 await db.exec(`CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN;CREATE ROLE night_scout_import_service NOLOGIN;CREATE ROLE night_scout_import_login LOGIN NOINHERIT CONNECTION LIMIT 1 PASSWORD NULL;GRANT night_scout_import_service TO night_scout_import_login;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT NULL::uuid$$;CREATE TABLE public.stores(id uuid PRIMARY KEY);CREATE TABLE public.store_memberships(user_id uuid,store_id uuid,PRIMARY KEY(user_id,store_id));`);
 for(const f of ['20260918_apply_xero_staging.sql','20260918_grant_xero_worker_access.sql','20260918_grant_xero_bootstrap_access.sql','20260924_bind_xero_bootstrap_connection_id.sql','20260925_xero_single_refresh_job.sql','20260925_xero_merchant_readiness.sql'])await db.exec(sql(f));
 await db.query('INSERT INTO auth.users VALUES($1)',[owner]);await db.query('INSERT INTO public.stores VALUES($1)',[store]);await db.query('INSERT INTO public.store_memberships VALUES($1,$2)',[owner,store]);
 await db.exec('SET SESSION AUTHORIZATION night_scout_xero_bootstrap_login');
 const receipt=await db.query(`SELECT * FROM xero_v1.bootstrap_create_initial_connection($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::bytea,$10::bytea,$11,$12)`,[connection,store,'tenant-1',owner,'2026-09-25','2026-09-25T12:00:00Z',JSON.stringify(accounts),JSON.stringify(mapping),new Uint8Array([1]),new Uint8Array([2]),'staging-v1','AES-256-GCM']);
 const mappingId=receipt.rows[0].mapping_version_id;
 const fail=async()=>{await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION night_scout_import_login');const lease=(await db.query('SELECT xero_v1.worker_acquire_refresh_lease($1,1,300) lease',[connection])).rows[0].lease;await db.query(`SELECT xero_v1.worker_record_accounting_evidence_leased($1,$2,'2026-09-01','2026-09-25','GBP',false,'failed','source_refresh_failed',NULL,clock_timestamp(),NULL,NULL,NULL,NULL,NULL,NULL,1,$3)`,[connection,mappingId,lease]);await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');};
 await fail();await db.exec(sql('20260925_xero_reviewed_failed_scope_retry.sql'));await db.exec('SET SESSION AUTHORIZATION night_scout_import_login');await db.query(`SELECT * FROM xero_v1.worker_get_single_refresh_job('2026-09-01','2026-09-25','GBP',false)`);await fail();await db.exec(sql('20260928_xero_second_reviewed_failed_scope_retry.sql'));await db.exec('SET SESSION AUTHORIZATION night_scout_import_login');await db.query(`SELECT * FROM xero_v1.worker_get_single_refresh_job('2026-09-01','2026-09-25','GBP',false)`);await fail();
 return {db,mappingId};}

test('reviewed reauthorization rotates in place once and preserves provenance',async()=>{const {db}=await prepared();try{
 await db.exec(sql('20260928_xero_reviewed_reauthorization.sql'));
 assert.deepEqual((await db.query(sql('verify-xero-reviewed-reauthorization-2026-09-28.sql'))).rows[0],{exactly_one_reauthorization:true,reauthorization_unconsumed:true,no_replacement_recorded:true,readiness_uses_reauthorization:true,readiness_contract_preserved:true,readiness_authenticated_execute:true,readiness_anon_denied:true});
 await db.exec(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '${owner}'::uuid$$;SET SESSION AUTHORIZATION authenticated`);
 assert.equal((await db.query('SELECT public.xero_merchant_readiness($1) value',[store])).rows[0].value.connection.status,'reauthorization_required');
 await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION night_scout_xero_bootstrap_login');
 const target=await db.query('SELECT * FROM xero_v1.bootstrap_get_reauthorization_target($1,$2,$3)',[store,'tenant-1',owner]);assert.deepEqual(target.rows,[{connection_id:connection,credential_version:1}]);
 const replaced=await db.query('SELECT * FROM xero_v1.bootstrap_reauthorize_connection($1,$2,$3,$4,$5,$6::bytea,$7::bytea,$8,$9)',[connection,store,'tenant-1',owner,1,new Uint8Array([7]),new Uint8Array([8]),'staging-v1','AES-256-GCM']);assert.deepEqual(replaced.rows,[{connection_id:connection,credential_version:2}]);
 assert.equal((await db.query('SELECT count(*)::int n FROM xero_v1.bootstrap_get_reauthorization_target($1,$2,$3)',[store,'tenant-1',owner])).rows[0].n,0);
 await assert.rejects(db.query('SELECT * FROM xero_v1.bootstrap_reauthorize_connection($1,$2,$3,$4,$5,$6::bytea,$7::bytea,$8,$9)',[connection,store,'tenant-1',owner,1,new Uint8Array([9]),new Uint8Array([9]),'staging-v1','AES-256-GCM']),/reauthorization unavailable/i);
 await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION authenticated');assert.equal((await db.query('SELECT public.xero_merchant_readiness($1) value',[store])).rows[0].value.connection.status,'active');await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');
 assert.equal((await db.query('SELECT count(*)::int n FROM xero_v1.connections')).rows[0].n,1);assert.equal((await db.query('SELECT count(*)::int n FROM xero_v1.mapping_versions')).rows[0].n,1);assert.equal((await db.query('SELECT count(*)::int n FROM xero_v1.accounting_evidence')).rows[0].n,3);assert.equal((await db.query('SELECT version FROM xero_v1.credential_envelopes')).rows[0].version,2);
 }finally{await db.close();}});

test('reauthorization is bootstrap-only, tenant pinned, and verifier status-only',()=>{const migration=sql('20260928_xero_reviewed_reauthorization.sql'),verify=sql('verify-xero-reviewed-reauthorization-2026-09-28.sql');assert.match(migration,/session_user<>'night_scout_xero_bootstrap_login'/);assert.match(migration,/c\.tenant_id=trim\(p_tenant_id\)/);assert.match(migration,/ra\.allowed_owner_id=p_owner_id/);assert.match(migration,/store_memberships/);assert.match(migration,/consumed_at=clock_timestamp\(\)/);assert.match(migration,/WHEN v_reauthorization THEN 'reauthorization_required'/);assert.match(migration,/CREATE OR REPLACE FUNCTION public\.xero_merchant_readiness/);assert.doesNotMatch(verify,/failure_evidence_id|allowed_owner_id|ciphertext|tenant_id/i);});

test('second reviewed reauthorization is version-pinned, one-shot and preserves history',async()=>{const {db,mappingId}=await prepared();try{
 await db.exec(sql('20260928_xero_reviewed_reauthorization.sql'));
 await db.exec('SET SESSION AUTHORIZATION night_scout_xero_bootstrap_login');
 await db.query('SELECT * FROM xero_v1.bootstrap_reauthorize_connection($1,$2,$3,$4,1,$5::bytea,$6::bytea,$7,$8)',[connection,store,'tenant-1',owner,new Uint8Array([7]),new Uint8Array([8]),'staging-v1','AES-256-GCM']);
 await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');
 await db.exec(sql('20261003_xero_third_reviewed_failed_scope_retry.sql'));
 await db.exec(sql('20261003_xero_connection_preflight_evidence.sql'));
 await db.exec(sql('20261003_xero_connection_preflight_job.sql'));
 await db.exec('SET SESSION AUTHORIZATION night_scout_import_login');
 await db.query(`SELECT * FROM xero_v1.worker_get_single_refresh_job('2026-09-01','2026-09-25','GBP',false)`);
 const lease=(await db.query('SELECT xero_v1.worker_acquire_refresh_lease($1,2,300) lease',[connection])).rows[0].lease;
 await db.query(`SELECT xero_v1.worker_record_accounting_evidence_leased($1,$2,'2026-09-01','2026-09-25','GBP',false,'failed','source_refresh_failed',NULL,clock_timestamp(),NULL,NULL,NULL,NULL,NULL,NULL,2,$3)`,[connection,mappingId,lease]);
 const preflightLease=(await db.query('SELECT xero_v1.worker_acquire_refresh_lease($1,2,300) lease',[connection])).rows[0].lease;
 await db.query(`SELECT xero_v1.worker_store_refresh_envelope_leased($1,$2::bytea,$3::bytea,$4,$5,2,3,$6)`,[connection,new Uint8Array([11]),new Uint8Array([12]),'staging-v1','AES-256-GCM',preflightLease]);
 await db.query(`SELECT xero_v1.worker_record_connection_preflight($1,3,'failed','connection','reconnect_required',NULL,false,$2)`,[connection,preflightLease]);
 await db.query('SELECT xero_v1.worker_release_refresh_lease($1,3,$2)',[connection,preflightLease]);
 await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');
 await db.exec(sql('20261003_xero_second_reviewed_reauthorization.sql'));
 assert.deepEqual((await db.query(sql('verify-xero-second-reviewed-reauthorization-2026-10-03.sql'))).rows[0],{exactly_one_authorization:true,authorization_unconsumed:true,no_replacement_recorded:true,readiness_uses_second_authorization:true,bootstrap_lookup_execute:true,bootstrap_replace_execute:true,authenticated_lookup_denied:true,worker_replace_denied:true});
 await db.exec('SET SESSION AUTHORIZATION night_scout_xero_bootstrap_login');
 assert.deepEqual((await db.query('SELECT * FROM xero_v1.bootstrap_get_reauthorization_target($1,$2,$3)',[store,'tenant-1',owner])).rows,[{connection_id:connection,credential_version:3}]);
 await assert.rejects(db.query('SELECT * FROM xero_v1.bootstrap_reauthorize_connection($1,$2,$3,$4,2,$5::bytea,$6::bytea,$7,$8)',[connection,store,'tenant-1',owner,new Uint8Array([13]),new Uint8Array([14]),'staging-v1','AES-256-GCM']),/reauthorization unavailable/i);
 await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION night_scout_import_login');
 const activeLease=(await db.query('SELECT xero_v1.worker_acquire_refresh_lease($1,3,300) lease',[connection])).rows[0].lease;
 await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION night_scout_xero_bootstrap_login');
 assert.equal((await db.query('SELECT count(*)::int n FROM xero_v1.bootstrap_get_reauthorization_target($1,$2,$3)',[store,'tenant-1',owner])).rows[0].n,0);
 await assert.rejects(db.query('SELECT * FROM xero_v1.bootstrap_reauthorize_connection($1,$2,$3,$4,3,$5::bytea,$6::bytea,$7,$8)',[connection,store,'tenant-1',owner,new Uint8Array([13]),new Uint8Array([14]),'staging-v1','AES-256-GCM']),/reauthorization unavailable/i);
 await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION night_scout_import_login');await db.query('SELECT xero_v1.worker_release_refresh_lease($1,3,$2)',[connection,activeLease]);
 await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION night_scout_xero_bootstrap_login');
 assert.deepEqual((await db.query('SELECT * FROM xero_v1.bootstrap_reauthorize_connection($1,$2,$3,$4,3,$5::bytea,$6::bytea,$7,$8)',[connection,store,'tenant-1',owner,new Uint8Array([13]),new Uint8Array([14]),'staging-v1','AES-256-GCM'])).rows,[{connection_id:connection,credential_version:4}]);
 await assert.rejects(db.query('SELECT * FROM xero_v1.bootstrap_reauthorize_connection($1,$2,$3,$4,3,$5::bytea,$6::bytea,$7,$8)',[connection,store,'tenant-1',owner,new Uint8Array([15]),new Uint8Array([16]),'staging-v1','AES-256-GCM']),/reauthorization unavailable/i);
 await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');
 assert.equal((await db.query('SELECT count(*)::int n FROM xero_v1.connections')).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int n FROM xero_v1.mapping_versions')).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int n FROM xero_v1.accounting_evidence')).rows[0].n,4);
 assert.equal((await db.query('SELECT count(*)::int n FROM xero_v1.xero_reauthorization_authorizations')).rows[0].n,1);
 assert.equal((await db.query('SELECT version FROM xero_v1.credential_envelopes')).rows[0].version,4);
 // A later reviewed retry and its failed refresh remain immutable. A new
 // reconnect receipt on the then-current credential is the only third gate.
 await db.exec('SET SESSION AUTHORIZATION night_scout_import_login');
 const fourthFailureLease=(await db.query('SELECT xero_v1.worker_acquire_refresh_lease($1,4,300) lease',[connection])).rows[0].lease;
 await db.query(`SELECT xero_v1.worker_record_accounting_evidence_leased($1,$2,'2026-09-01','2026-09-25','GBP',false,'failed','source_refresh_failed',NULL,clock_timestamp(),NULL,NULL,NULL,NULL,NULL,NULL,4,$3)`,[connection,mappingId,fourthFailureLease]);
 const connectedLease=(await db.query('SELECT xero_v1.worker_acquire_refresh_lease($1,4,300) lease',[connection])).rows[0].lease;
 await db.query(`SELECT xero_v1.worker_record_connection_preflight($1,4,'connected','organisation','ok',NULL,true,$2)`,[connection,connectedLease]);
 await db.query('SELECT xero_v1.worker_release_refresh_lease($1,4,$2)',[connection,connectedLease]);
 await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');
 await db.exec(sql('20261003_xero_fourth_reviewed_failed_scope_retry.sql'));
 await db.exec('SET SESSION AUTHORIZATION night_scout_import_login');
 await db.query(`SELECT * FROM xero_v1.worker_get_single_refresh_job('2026-09-01','2026-09-25','GBP',false)`);
 const unavailableLease=(await db.query('SELECT xero_v1.worker_acquire_refresh_lease($1,4,300) lease',[connection])).rows[0].lease;
 await db.query(`SELECT xero_v1.worker_record_accounting_evidence_leased($1,$2,'2026-09-01','2026-09-25','GBP',false,'failed','accounting_evidence_unavailable',NULL,clock_timestamp(),NULL,NULL,NULL,NULL,NULL,NULL,4,$3)`,[connection,mappingId,unavailableLease]);
 const reconnectLease=(await db.query('SELECT xero_v1.worker_acquire_refresh_lease($1,4,300) lease',[connection])).rows[0].lease;
 await db.query(`SELECT xero_v1.worker_store_refresh_envelope_leased($1,$2::bytea,$3::bytea,$4,$5,4,5,$6)`,[connection,new Uint8Array([17]),new Uint8Array([18]),'staging-v1','AES-256-GCM',reconnectLease]);
 await db.query(`SELECT xero_v1.worker_record_connection_preflight($1,5,'failed','connection','reconnect_required',NULL,false,$2)`,[connection,reconnectLease]);
 await db.query('SELECT xero_v1.worker_release_refresh_lease($1,5,$2)',[connection,reconnectLease]);
 await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');
 await db.exec(sql('20261009_xero_third_reviewed_reauthorization.sql'));
 assert.deepEqual((await db.query(sql('verify-xero-third-reviewed-reauthorization-2026-10-09.sql'))).rows[0],{exactly_one_authorization:true,authorization_unconsumed:true,no_replacement_recorded:true,readiness_uses_third_authorization:true,bootstrap_lookup_execute:true,bootstrap_replace_execute:true,authenticated_lookup_denied:true,worker_replace_denied:true});
 await db.exec('SET SESSION AUTHORIZATION night_scout_xero_bootstrap_login');
 assert.deepEqual((await db.query('SELECT * FROM xero_v1.bootstrap_get_reauthorization_target($1,$2,$3)',[store,'tenant-1',owner])).rows,[{connection_id:connection,credential_version:5}]);
 await assert.rejects(db.query('SELECT * FROM xero_v1.bootstrap_reauthorize_connection($1,$2,$3,$4,4,$5::bytea,$6::bytea,$7,$8)',[connection,store,'tenant-1',owner,new Uint8Array([19]),new Uint8Array([20]),'staging-v1','AES-256-GCM']),/reauthorization unavailable/i);
 assert.deepEqual((await db.query('SELECT * FROM xero_v1.bootstrap_reauthorize_connection($1,$2,$3,$4,5,$5::bytea,$6::bytea,$7,$8)',[connection,store,'tenant-1',owner,new Uint8Array([19]),new Uint8Array([20]),'staging-v1','AES-256-GCM'])).rows,[{connection_id:connection,credential_version:6}]);
 await assert.rejects(db.query('SELECT * FROM xero_v1.bootstrap_reauthorize_connection($1,$2,$3,$4,5,$5::bytea,$6::bytea,$7,$8)',[connection,store,'tenant-1',owner,new Uint8Array([21]),new Uint8Array([22]),'staging-v1','AES-256-GCM']),/reauthorization unavailable/i);
 await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');
 assert.equal((await db.query('SELECT count(*)::int n FROM xero_v1.connections')).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int n FROM xero_v1.mapping_versions')).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int n FROM xero_v1.accounting_evidence')).rows[0].n,6);
 assert.equal((await db.query('SELECT count(*)::int n FROM xero_v1.connection_preflight_evidence')).rows[0].n,3);
 assert.equal((await db.query('SELECT version FROM xero_v1.credential_envelopes')).rows[0].version,6);

 // The final accounting retry is allowed only after the reconnect has been
 // consumed and the replacement credential itself passes organisation preflight.
 await db.exec('SET SESSION AUTHORIZATION night_scout_import_login');
 const finalPreflightLease=(await db.query('SELECT xero_v1.worker_acquire_refresh_lease($1,6,300) lease',[connection])).rows[0].lease;
 await db.query(`SELECT xero_v1.worker_record_connection_preflight($1,6,'connected','organisation','ok',NULL,true,$2)`,[connection,finalPreflightLease]);
 await db.query('SELECT xero_v1.worker_release_refresh_lease($1,6,$2)',[connection,finalPreflightLease]);
 await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');
 await db.exec(sql('20261009_xero_fifth_reviewed_failed_scope_retry.sql'));
 assert.deepEqual((await db.query(sql('verify-xero-fifth-reviewed-retry-2026-10-09.sql'))).rows[0],{
  exactly_five_reviewed_retries:true,exactly_four_retries_consumed:true,
  exactly_one_retry_unconsumed:true,current_latest_failure_authorized:true,
  current_credential_preflight_supported:true,reviewed_reconnect_consumed:true
 });
 await db.exec('SET SESSION AUTHORIZATION night_scout_import_login');
 assert.equal((await db.query(`SELECT count(*)::int n FROM xero_v1.worker_get_single_refresh_job('2026-09-01','2026-09-25','GBP',false)`)).rows[0].n,1);
 await assert.rejects(db.query(`SELECT * FROM xero_v1.worker_get_single_refresh_job('2026-09-01','2026-09-25','GBP',false)`),/job unavailable|retry unavailable/i);
 await db.exec('RESET SESSION AUTHORIZATION;SET SESSION AUTHORIZATION postgres');
 await assert.rejects(db.exec(sql('20261009_xero_fifth_reviewed_failed_scope_retry.sql')),/prior Xero retry authorizations unavailable|already authorized/i);
 }finally{await db.close();}});

test('second reauthorization remains bootstrap-only and verifier is status-only',()=>{const migration=sql('20261003_xero_second_reviewed_reauthorization.sql'),verify=sql('verify-xero-second-reviewed-reauthorization-2026-10-03.sql');assert.match(migration,/target_credential_version=p_expected_version/);assert.match(migration,/ce\.version=ra\.target_credential_version/);assert.match(migration,/session_user<>'night_scout_xero_bootstrap_login'/);assert.match(migration,/REVOKE ALL[\s\S]*service_role/);assert.doesNotMatch(verify,/failure_evidence_id|allowed_owner_id|ciphertext|tenant_id|connection_id/i);});

test('third reauthorization requires both consumed predecessors and has a status-only verifier',()=>{const migration=sql('20261009_xero_third_reviewed_reauthorization.sql'),verify=sql('verify-xero-third-reviewed-reauthorization-2026-10-09.sql');assert.match(migration,/v_first<>1 OR v_first_consumed<>1 OR v_second<>1 OR v_second_consumed<>1/);assert.match(migration,/pe\.reason='reconnect_required'/);assert.match(migration,/ce\.version=pe\.credential_version/);assert.match(migration,/target_credential_version=p_expected_version/);assert.match(migration,/xero_third_reauthorization_authorizations/);assert.doesNotMatch(verify,/preflight_evidence_id|allowed_owner_id|ciphertext|tenant_id|connection_id/i);});

test('fifth retry is exact-state gated, one-shot and status-only',()=>{const migration=sql('20261009_xero_fifth_reviewed_failed_scope_retry.sql'),verify=sql('verify-xero-fifth-reviewed-retry-2026-10-09.sql');assert.match(migration,/ae\.reason='accounting_evidence_unavailable'/);assert.match(migration,/authorization_count<>4 OR consumed_count<>4/);assert.match(migration,/third_reauthorization_count<>1 OR third_reauthorization_consumed<>1/);assert.match(migration,/pe\.credential_version=current_credential_version/);assert.match(migration,/pe\.checked_at>latest_failure_at/);assert.match(migration,/latest\.reason IN \('source_refresh_failed','accounting_evidence_unavailable'\)/);assert.match(migration,/INSERT INTO xero_v1\.accounting_evidence_retry_authorizations/);assert.doesNotMatch(migration,/DELETE\s+FROM\s+xero_v1\.accounting_evidence_retry_authorizations/i);assert.doesNotMatch(verify,/AS\s+evidence_id|tenant_id|ciphertext|encrypted_dek|provider_status\s+AS|connection_id\s+AS/i);});
