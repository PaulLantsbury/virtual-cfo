import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../../db-migrations/staging/20260918_grant_xero_worker_access.sql',import.meta.url),'utf8');
const executable=sql.replace(/^--.*$/gm,'');

test('staging worker access is repeatable, target-specific and requires the existing constrained login',()=>{
  assert.match(sql,/^BEGIN;/m); assert.match(sql,/COMMIT;\s*$/);
  assert.match(sql,/current_user = 'night_scout_import_login'/);
  assert.match(sql,/rolcanlogin AND NOT rolinherit AND NOT rolsuper/);
  assert.match(sql,/NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication/);
  assert.match(sql,/NOT rolbypassrls AND rolconnlimit = 1/);
  assert.match(sql,/xero_v1\.credential_envelopes/);
  assert.doesNotMatch(executable,/CREATE ROLE|ALTER ROLE|DROP\s+(?:SCHEMA|TABLE|ROLE)/i);
});

test('worker is granted only fixed-search-path security-definer operations, never table access',()=>{
  for(const name of ['worker_get_refresh_envelope','worker_store_refresh_envelope','worker_record_credential_refresh_failure','worker_record_accounting_evidence']) {
    assert.match(sql,new RegExp(`CREATE OR REPLACE FUNCTION xero_v1\\.${name}[\\s\\S]*?SECURITY DEFINER[\\s\\S]*?SET search_path = pg_catalog, xero_v1`));
    assert.match(sql,new RegExp(`GRANT EXECUTE ON FUNCTION xero_v1\\.${name}`));
  }
  assert.match(sql,/REVOKE ALL ON ALL TABLES IN SCHEMA xero_v1 FROM night_scout_import_login/);
  assert.doesNotMatch(executable,/GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|ALL)\s+ON[^;]*TO\s+night_scout_import_login/i);
  assert.doesNotMatch(executable,/GRANT[^;]*TO\s+(?:anon|authenticated)/i);
});

test('credential rotation is monotonic and evidence remains bounded and append-only',()=>{
  assert.match(sql,/WHERE EXCLUDED\.version = e\.version \+ 1/);
  assert.match(sql,/credential envelope version must be first or exactly one greater/);
  assert.match(sql,/active Xero connection is required/);
  assert.match(sql,/INSERT INTO xero_v1\.accounting_evidence/);
  assert.match(sql,/INSERT INTO xero_v1\.accounting_evidence_audit/);
  assert.doesNotMatch(executable,/raw_report|transaction|shopify|access_token|refresh_token/i);
});
