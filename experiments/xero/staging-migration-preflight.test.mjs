import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const sha256 = text => createHash('sha256').update(text).digest('hex');
const preflight = read('db-migrations/staging/preflight-xero-staging-2026-09-18.sql');
const mapping = read('db-migrations/proposals/xero-mapping-store-2026-09-18.sql');
const credential = read('db-migrations/proposals/xero-credential-store-2026-09-18.sql');
const guide = read('docs/xero-staging-application-2026-09-18.md');

test('Xero staging preflight is read-only and checks the required isolation boundary', () => {
  const executable = preflight.replace(/^--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const statement of executable.split(';').map(statement => statement.trim()).filter(Boolean)) {
    assert.match(statement, /^SELECT\b/i);
  }
  assert.match(preflight, /bioalckltvkhlczusdvl/);
  for (const dependency of ['public.stores', 'public.store_memberships', 'auth.users', 'gen_random_uuid', 'membership_self_read']) {
    assert.match(preflight, new RegExp(dependency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('application record pins the reviewed proposal contents and applies mapping first', () => {
  assert.match(guide, new RegExp(sha256(mapping)));
  assert.match(guide, new RegExp(sha256(credential)));
  assert.ok(guide.indexOf('Mapping store proposal') < guide.indexOf('Credential envelope proposal'));
  assert.match(guide, /not applied by this repository checkout/i);
});
