import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const runner = 'deployments/nightly-staging/run-meta-ads-acceptance.mjs';

function runRunner(env, args = []) {
  return spawnSync(process.execPath, [runner, ...args], {
    cwd: repoRoot,
    env: { PATH: process.env.PATH ?? '', ...env },
    encoding: 'utf8',
    timeout: 10_000,
  });
}

test('Meta acceptance runner is disabled when activation flags are absent', () => {
  const result = runRunner({});
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '{"state":"disabled"}\n');
  assert.equal(result.stderr, '');
});

test('Meta acceptance runner fails closed outside staging without importing runtime', () => {
  const result = runRunner({
    NIGHT_SCOUT_META_ADS_COLLECTOR_RUNTIME_ENABLED: 'true',
    NIGHT_SCOUT_META_ADS_COLLECTOR_ENABLED: 'true',
    NIGHT_SCOUT_META_ADS_ACCEPTANCE_ENABLED: 'true',
    NIGHT_SCOUT_RUNTIME_ENV: 'production',
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^Meta Ads staging acceptance collection unavailable; review the staging checklist\n$/);
  assert.doesNotMatch(result.stderr, /secret|token|https?:\/\//i);
});

test('Meta acceptance runner rejects CLI account/date overrides before provider work', () => {
  const result = runRunner({}, ['--account-id', '123456789']);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^Meta Ads staging acceptance collection unavailable; review the staging checklist\n$/);
});
