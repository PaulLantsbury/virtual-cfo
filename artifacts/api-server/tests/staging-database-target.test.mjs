import test from 'node:test';
import assert from 'node:assert/strict';
import {isPinnedStagingDatabaseUrl} from '../src/lib/staging-database-target.ts';

const project = 'bioalckltvkhlczusdvl';
const pooler = 'aws-1-eu-west-1.pooler.supabase.com';

test('accepts the fixed staging direct endpoint and verified session pooler', () => {
  for (const role of ['night_scout_import_login', 'night_scout_xero_bootstrap_login']) {
    assert.equal(
      isPinnedStagingDatabaseUrl(
        `postgresql://${role}:private@db.${project}.supabase.co:5432/postgres`,
        role,
      ),
      true,
    );
    assert.equal(
      isPinnedStagingDatabaseUrl(
        `postgres://${role}.${project}:private@${pooler}:5432/postgres`,
        role,
      ),
      true,
    );
  }
});

test('rejects production, alternate poolers, transaction pooling and role crossover', () => {
  const role = 'night_scout_xero_bootstrap_login';
  const rejected = [
    `postgresql://${role}:private@db.futkktdebdygsdrcknpr.supabase.co:5432/postgres`,
    `postgresql://${role}.${project}:private@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`,
    `postgresql://${role}.${project}:private@${pooler}:6543/postgres`,
    `postgresql://${role}:private@${pooler}:5432/postgres`,
    `postgresql://night_scout_import_login.${project}:private@${pooler}:5432/postgres`,
    `postgresql://postgres.${project}:private@${pooler}:5432/postgres`,
    `postgresql://${role}.${project}:private@${pooler}:5432/postgres?sslmode=no-verify`,
    `postgresql://${role}.${project}@${pooler}:5432/postgres`,
  ];
  for (const value of rejected) {
    assert.equal(isPinnedStagingDatabaseUrl(value, role), false, value);
  }
});

