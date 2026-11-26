import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const pgStub = `export default { Pool: class { constructor() { throw new Error('unexpected Pool'); } } };`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'pg') return { url: `data:text/javascript,${encodeURIComponent(pgStub)}`, shortCircuit: true };
  return nextResolve(specifier, context);
} });

const { createGoogleAdsCollectorRuntime } = await import('../src/lib/google-ads-collector-runtime.mjs');
const storeId = '11111111-1111-4111-8111-111111111111';
const ownerId = '22222222-2222-4222-8222-222222222222';
const role = 'night_scout_google_ads_collector_login';
const env = {
  NIGHT_SCOUT_GOOGLE_ADS_COLLECTOR_RUNTIME_ENABLED: 'true',
  NIGHT_SCOUT_RUNTIME_ENV: 'staging',
  NIGHT_SCOUT_GOOGLE_ADS_STAGING_PROJECT_REF: 'bioalckltvkhlczusdvl',
  NIGHT_SCOUT_GOOGLE_ADS_COLLECTOR_DATABASE_URL: `postgresql://${role}:mock-password@db.bioalckltvkhlczusdvl.supabase.co:5432/postgres`,
  NIGHT_SCOUT_STAGING_CA_PEM: '-----BEGIN CERTIFICATE-----mock-----END CERTIFICATE-----',
  NIGHT_SCOUT_GOOGLE_ADS_ENVELOPE_MASTER_KEY: 'synthetic-master-key-material-at-least-32-bytes-long',
  NIGHT_SCOUT_GOOGLE_ADS_ENVELOPE_KEY_VERSION: 'v1',
  NIGHT_SCOUT_GOOGLE_ADS_CLIENT_ID: 'synthetic-client-id-1234567890.apps.googleusercontent.com',
  NIGHT_SCOUT_GOOGLE_ADS_CLIENT_SECRET: 'synthetic-client-secret-only-for-mock-tests',
  NIGHT_SCOUT_GOOGLE_ADS_REDIRECT_URI: 'https://night-scout-xero-staging.onrender.com/api/google-ads/callback',
  NIGHT_SCOUT_GOOGLE_ADS_STAGING_STORE_ID: storeId,
  NIGHT_SCOUT_GOOGLE_ADS_STAGING_OWNER_ID: ownerId,
};

test('Google collector runtime remains disabled unless its explicit staging flag is true', async () => {
  let poolCreated = false;
  assert.equal(await createGoogleAdsCollectorRuntime({}, { createPool: () => { poolCreated = true; } }), undefined);
  assert.equal(poolCreated, false);
});

test('Google collector runtime validates its dedicated role and config before starting provider work', async () => {
  let poolCreated = false;
  await assert.rejects(createGoogleAdsCollectorRuntime({ ...env, NIGHT_SCOUT_GOOGLE_ADS_STAGING_PROJECT_REF: 'wrong' }, {
    createPool: () => { poolCreated = true; },
  }), /unavailable/);
  assert.equal(poolCreated, false);
});

test('Google collector runtime pins the collector login and fixed RPC adapter without provider calls', async () => {
  const config = [];
  let closed = false;
  const pool = {
    async query(sql) {
      assert.equal(sql, 'SELECT session_user::text AS session_user, current_user::text AS current_user');
      return { rows: [{ session_user: role, current_user: role }] };
    },
    async end() { closed = true; },
  };
  let providerCalls = 0;
  const runtime = await createGoogleAdsCollectorRuntime(env, {
    createPool: (options) => { config.push(options); return pool; },
    fetchImpl: async () => { providerCalls += 1; throw new Error('no live provider call allowed'); },
    reader: async () => { providerCalls += 1; throw new Error('reader must not run during startup'); },
  });
  assert.equal(typeof runtime.collector.collect, 'function');
  assert.equal(typeof runtime.listActiveAccounts, 'function');
  assert.deepEqual(config[0].ssl, { ca: env.NIGHT_SCOUT_STAGING_CA_PEM, rejectUnauthorized: true });
  assert.equal(config[0].application_name, 'night-scout-google-ads-collector-staging');
  assert.equal(providerCalls, 0);
  await runtime.close();
  assert.equal(closed, true);
});

test('Google collector runtime closes the pool and fails closed on an unexpected database role', async () => {
  let closed = false;
  const pool = {
    async query() { return { rows: [{ session_user: 'wrong_login', current_user: 'wrong_login' }] }; },
    async end() { closed = true; },
  };
  await assert.rejects(createGoogleAdsCollectorRuntime(env, { createPool: () => pool }), /unavailable/);
  assert.equal(closed, true);
});
