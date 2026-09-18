import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../db-migrations/staging/20260918_grant_xero_bootstrap_access.sql',import.meta.url),'utf8');
const executable=sql.replace(/^--.*$/gm,'');
test('bootstrap access is staging atomic and distinct from refresh worker',()=>{
 assert.match(sql,/^BEGIN;/m);assert.match(sql,/COMMIT;\s*$/);assert.match(sql,/CREATE ROLE night_scout_xero_bootstrap_login LOGIN NOINHERIT/);assert.match(sql,/PASSWORD NULL/);assert.match(sql,/rolconnlimit=1/);assert.match(sql,/session_user <> 'night_scout_xero_bootstrap_login'/);assert.match(sql,/REVOKE ALL ON ALL TABLES IN SCHEMA xero_v1 FROM night_scout_xero_bootstrap_login/);
 assert.match(sql,/REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC,anon,authenticated,night_scout_import_login/);assert.match(sql,/GRANT EXECUTE ON FUNCTION[\s\S]*TO night_scout_xero_bootstrap_login/);
 assert.doesNotMatch(executable,/GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|ALL)\s+ON\s+(?:ALL TABLES|xero_v1\.)[^;]*TO\s+night_scout_xero_bootstrap_login/i);
});
test('bootstrap RPC atomically persists bounded metadata, v1 mapping and envelope only',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION xero_v1\.bootstrap_create_initial_connection/);assert.match(sql,/SECURITY DEFINER/);assert.match(sql,/INSERT INTO xero_v1\.connections/);assert.match(sql,/INSERT INTO xero_v1\.account_directories/);assert.match(sql,/INSERT INTO xero_v1\.mapping_versions/);assert.match(sql,/INSERT INTO xero_v1\.mapping_selections/);assert.match(sql,/INSERT INTO xero_v1\.credential_envelopes/);assert.match(sql,/p_algorithm <> 'AES-256-GCM'/);assert.match(sql,/complete Xero mapping required/);assert.match(sql,/account_status='ACTIVE'/);assert.match(sql,/store_memberships WHERE user_id=p_owner_id AND store_id=p_store_id/);
 assert.doesNotMatch(executable,/access_token|refresh_token|authorization_code/i);
});
