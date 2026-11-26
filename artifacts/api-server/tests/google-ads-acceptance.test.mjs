import test from 'node:test';
import assert from 'node:assert/strict';
import { runGoogleAdsAcceptance } from '../../../experiments/marketing/google-ads-acceptance.mjs';

const storeId = '11111111-1111-4111-8111-111111111111';
const connectionId = '22222222-2222-4222-8222-222222222222';
const runId = '33333333-3333-4333-8333-333333333333';
const customerId = '1234567890';
const now = () => new Date('2026-11-21T16:00:00.000Z');
const baseEnv = {
  NIGHT_SCOUT_RUNTIME_ENV: 'staging',
  NIGHT_SCOUT_GOOGLE_ADS_COLLECTOR_RUNTIME_ENABLED: 'true',
  NIGHT_SCOUT_GOOGLE_ADS_COLLECTOR_ENABLED: 'true',
  NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_ENABLED: 'true',
  NIGHT_SCOUT_GOOGLE_ADS_STAGING_STORE_ID: storeId,
  NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_STORE_ID: storeId,
  NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_FROM: '2026-11-01',
  NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_TO: '2026-11-02',
};
const accounts = [{ storeId, connectionId, customerId, loginCustomerId: null, currency: 'GBP', timeZone: 'Europe/London' }];

function runtimeWith(result) {
  const calls = [];
  return {
    calls,
    runtime: {
      async listActiveAccounts() { return accounts; },
      async close() { calls.push(['close']); },
      collector: { async collect(input) { calls.push(['collect', input]); return result; } },
    },
  };
}

test('Google acceptance is disabled unless every explicit staging opt-in is enabled', async () => {
  let created = false;
  const result = await runGoogleAdsAcceptance({ env: {}, createRuntime: async () => { created = true; }, now });
  assert.deepEqual(result, { state: 'disabled' });
  assert.equal(created, false);
});

test('Google acceptance disables outside staging and rejects mismatched store or excessive ranges', async () => {
  const result = runtimeWith({ status: 'complete', runId, from: baseEnv.NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_FROM,
    to: baseEnv.NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_TO, observedAt: '2026-11-21T15:00:00.000Z', coverage: [] });
  const nonStaging = await runGoogleAdsAcceptance({ env: { ...baseEnv, NIGHT_SCOUT_RUNTIME_ENV: 'production' }, createRuntime: async () => result.runtime, now });
  assert.deepEqual(nonStaging, { state: 'disabled' });
  for (const env of [
    { ...baseEnv, NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_STORE_ID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    { ...baseEnv, NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_FROM: '2026-10-19' },
  ]) {
    await assert.rejects(runGoogleAdsAcceptance({ env, createRuntime: async () => result.runtime, now }), /unavailable/);
  }
  assert.equal(result.calls.length, 0);
});

test('Google acceptance selects the exact store account and produces a positive-spend reconciliation summary', async () => {
  const fixture = runtimeWith({
    status: 'complete', runId,
    from: baseEnv.NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_FROM,
    to: baseEnv.NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_TO,
    observedAt: '2026-11-21T15:00:00.000Z',
    coverage: [
      { date: '2026-11-01', state: 'provider_row', spendMicros: '1234567' },
      { date: '2026-11-02', state: 'provider_row', spendMicros: '0' },
    ],
  });
  const result = await runGoogleAdsAcceptance({ env: baseEnv, createRuntime: async () => fixture.runtime, now });
  assert.equal(result.state, 'complete');
  assert.equal(result.positiveSpendObserved, true);
  assert.deepEqual(result.coverage, { provider_row: 2, no_row: 0 });
  assert.deepEqual(fixture.calls[0], ['collect', {
    storeId, connectionId, customerId,
    from: baseEnv.NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_FROM,
    to: baseEnv.NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_TO,
    idempotencyKey: 'google_accept:1234567890:2026-11-01:2026-11-02:r0',
  }]);
  assert.deepEqual(fixture.calls.at(-1), ['close']);
  assert.equal(Object.hasOwn(result, 'totalSpendMicros'), false, 'runner summary should not put spend amounts in host logs');
});

test('Google acceptance reports zero spend and missing coverage without calling it positive acceptance', async () => {
  const fixture = runtimeWith({
    status: 'partial', runId,
    from: baseEnv.NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_FROM,
    to: baseEnv.NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_TO,
    observedAt: '2026-11-21T15:00:00.000Z',
    coverage: [
      { date: '2026-11-01', state: 'provider_row', spendMicros: '0' },
      { date: '2026-11-02', state: 'no_row', spendMicros: null },
    ],
  });
  const result = await runGoogleAdsAcceptance({ env: baseEnv, createRuntime: async () => fixture.runtime, now });
  assert.equal(result.state, 'zero_spend');
  assert.equal(result.positiveSpendObserved, false);
  assert.deepEqual(result.coverage, { provider_row: 1, no_row: 1 });
});

test('Google acceptance closes the runtime even when collection fails', async () => {
  const fixture = runtimeWith(null);
  fixture.runtime.collector.collect = async () => { throw new Error('private provider detail'); };
  await assert.rejects(runGoogleAdsAcceptance({ env: baseEnv, createRuntime: async () => fixture.runtime, now }), /private provider detail/);
  assert.deepEqual(fixture.calls.at(-1), ['close']);
});
