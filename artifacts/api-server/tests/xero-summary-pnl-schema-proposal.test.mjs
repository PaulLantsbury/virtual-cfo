import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql = readFileSync(new URL('../../../db-migrations/proposals/xero-summary-pnl-mapping-2026-09-25.sql', import.meta.url), 'utf8');

test('P&L proposal is parallel and does not mutate deployed bootstrap mapping tables', () => {
  assert.match(sql, /CREATE TABLE xero_v1\.pnl_mapping_versions/);
  assert.match(sql, /CREATE TABLE xero_v1\.pnl_mapping_selections/);
  assert.doesNotMatch(sql, /ALTER TABLE xero_v1\.mapping_(versions|selections)/);
  assert.doesNotMatch(sql, /DROP TABLE xero_v1\.mapping_(versions|selections)/);
});

test('schema maps leaf lines only and excludes credentials, reports and amounts', () => {
  for (const leaf of ['total_revenue','cogs','fulfilment_costs','performance_marketing','salaries','other_overheads','depreciation_amortisation','interest','tax']) {
    assert.match(sql, new RegExp(`'${leaf}'`));
  }
  for (const derived of ['cm1_gross_margin','cm2_product_contribution','cm3_marketing_contribution','ebitda','profit_before_tax','profit_after_tax']) {
    assert.doesNotMatch(sql, new RegExp(`'${derived}'`));
  }
  assert.doesNotMatch(sql, /ciphertext|encrypted_dek|refresh_token|access_token|amount_minor|report_payload/i);
  assert.match(sql, /ROLLBACK;/);
});

test('browser roles receive read-only access and suggestions remain reviewable', () => {
  assert.match(sql, /REVOKE ALL[\s\S]+FROM PUBLIC,anon,authenticated/);
  assert.match(sql, /GRANT SELECT[\s\S]+TO authenticated/);
  assert.match(sql, /review_state text NOT NULL DEFAULT 'review_required'/);
  assert.doesNotMatch(sql, /GRANT (INSERT|UPDATE|DELETE)/);
});
