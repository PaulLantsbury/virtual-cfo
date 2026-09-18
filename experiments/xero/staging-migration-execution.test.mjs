import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const sql=read('db-migrations/staging/20260918_apply_xero_staging.sql');

test('staging Xero installer is atomic, one-shot and preserves the worker boundary',()=>{
  const executable=sql.replace(/^--.*$/gm,'');
  assert.match(sql,/^BEGIN;/m); assert.match(sql,/COMMIT;\s*$/);
  assert.match(sql,/SET LOCAL lock_timeout/); assert.match(sql,/SET LOCAL statement_timeout/);
  assert.match(sql,/xero_v1 already exists; do not reapply/);
  assert.match(sql,/REVOKE ALL ON ALL TABLES IN SCHEMA xero_v1 FROM PUBLIC,anon,authenticated/);
  assert.doesNotMatch(executable,/GRANT[\s\S]*\b(worker|service_role)\b/i);
  assert.doesNotMatch(executable,/CREATE ROLE|ALTER ROLE|GRANT\s+.*\s+TO\s+(?!authenticated\b)/i);
});

test('installer keeps credential envelopes browser-inaccessible and mapping reads member-scoped',()=>{
  assert.match(sql,/credential_envelopes[\s\S]*?ENABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(sql,/CREATE POLICY[^;]*(credential_envelopes|credential_audit)/i);
  for(const table of ['connections','account_directories','mapping_versions','mapping_selections','mapping_audit']) assert.match(sql,new RegExp(`GRANT SELECT ON [^;]*${table}`));
  assert.match(sql,/xero_connection_member_read[\s\S]*store_memberships/);
});
