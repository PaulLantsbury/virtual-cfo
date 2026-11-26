import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Runtime tests use narrow package stubs and injected DB/auth dependencies.
// They do not exercise real pg, Supabase, Express, or external provider access.
const pgStub = `export default { Pool: class { constructor() { throw new Error('unexpected default pool'); } } };`;
const supabaseStub = `export function createClient() { throw new Error('unexpected default auth client'); }`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const code = specifier === 'pg' ? pgStub
      : specifier === '@supabase/supabase-js' ? supabaseStub : null;
    if (code !== null) return { url: `data:text/javascript,${encodeURIComponent(code)}`, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const { createGoogleAdsRuntime } = await import('../src/lib/google-ads-runtime.mjs');
const { createGoogleAdsReportRuntime } = await import('../src/lib/google-ads-report-runtime.mjs');

const userId = '11111111-1111-4111-8111-111111111111';
const storeId = '22222222-2222-4222-8222-222222222222';
const otherStoreId = '44444444-4444-4444-8444-444444444444';
const customerId = '1234567890';
const connectedAt = '2026-11-21T12:00:00.000Z';
const callback = 'https://night-scout-xero-staging.onrender.com/api/google-ads/callback';
const origin = 'https://night-scout-xero-staging.onrender.com';
const apiRole = 'night_scout_google_ads_api_login';
const reportRole = 'night_scout_google_ads_report_login';
const project = 'bioalckltvkhlczusdvl';

function validApiEnv(overrides = {}) {
  return {
    NIGHT_SCOUT_GOOGLE_ADS_API_RUNTIME_ENABLED: 'true',
    NIGHT_SCOUT_RUNTIME_ENV: 'staging',
    NIGHT_SCOUT_GOOGLE_ADS_STAGING_PROJECT_REF: project,
    NIGHT_SCOUT_STAGING_CA_PEM: '-----BEGIN CERTIFICATE-----\nsynthetic-ca\n-----END CERTIFICATE-----',
    NIGHT_SCOUT_GOOGLE_ADS_ENVELOPE_MASTER_KEY: 'synthetic-envelope-master-key-material-32-bytes',
    NIGHT_SCOUT_GOOGLE_ADS_ENVELOPE_KEY_VERSION: 'v1',
    NIGHT_SCOUT_GOOGLE_ADS_PKCE_KEY: 'synthetic-pkce-key-material-at-least-32-bytes',
    NIGHT_SCOUT_REVIEW_AUTH_URL: `https://${project}.supabase.co`,
    NIGHT_SCOUT_REVIEW_PUBLIC_KEY: 'synthetic-publishable-key-material-long-enough',
    NIGHT_SCOUT_GOOGLE_ADS_CLIENT_ID: '123456789012-abcdefghijklmnopqrst.apps.googleusercontent.com',
    NIGHT_SCOUT_GOOGLE_ADS_CLIENT_SECRET: 'synthetic-client-secret',
    NIGHT_SCOUT_GOOGLE_ADS_REDIRECT_URI: callback,
    NIGHT_SCOUT_GOOGLE_ADS_ALLOWED_ORIGIN: origin,
    NIGHT_SCOUT_GOOGLE_ADS_STAGING_OWNER_ID: userId,
    NIGHT_SCOUT_GOOGLE_ADS_STAGING_STORE_ID: storeId,
    NIGHT_SCOUT_GOOGLE_ADS_API_DATABASE_URL: `postgresql://${apiRole}:mock-password@db.${project}.supabase.co:5432/postgres`,
    ...overrides,
  };
}

function validReportEnv(overrides = {}) {
  return {
    NIGHT_SCOUT_GOOGLE_ADS_REPORT_RUNTIME_ENABLED: 'true',
    NIGHT_SCOUT_RUNTIME_ENV: 'staging',
    NIGHT_SCOUT_GOOGLE_ADS_STAGING_PROJECT_REF: project,
    NIGHT_SCOUT_STAGING_CA_PEM: '-----BEGIN CERTIFICATE-----\nsynthetic-ca\n-----END CERTIFICATE-----',
    NIGHT_SCOUT_REVIEW_AUTH_URL: `https://${project}.supabase.co`,
    NIGHT_SCOUT_REVIEW_PUBLIC_KEY: 'synthetic-publishable-key-material-long-enough',
    NIGHT_SCOUT_GOOGLE_ADS_STAGING_OWNER_ID: userId,
    NIGHT_SCOUT_GOOGLE_ADS_STAGING_STORE_ID: storeId,
    NIGHT_SCOUT_GOOGLE_ADS_REPORT_DATABASE_URL: `postgresql://${reportRole}:mock-password@db.${project}.supabase.co:5432/postgres`,
    ...overrides,
  };
}

function poolFor(role, queryHandler = async () => ({ rows: [] })) {
  const calls = [];
  let ended = false;
  const pool = {
    async query(sql, args) {
      calls.push({ sql, args });
      if (sql.startsWith('SELECT session_user::text')) {
        return { rows: [{ session_user: role, current_user: role }] };
      }
      return queryHandler(sql, args);
    },
    async end() { ended = true; },
  };
  return { pool, calls, wasEnded: () => ended };
}

test('Google API and report runtimes are disabled by default and reject incomplete config before opening a pool', async () => {
  let poolCalls = 0;
  const dependencies = { createPool() { poolCalls += 1; throw new Error('unexpected pool creation'); } };
  assert.equal(await createGoogleAdsRuntime({}, dependencies), undefined);
  assert.equal(await createGoogleAdsReportRuntime({}, dependencies), undefined);
  await assert.rejects(createGoogleAdsRuntime({ NIGHT_SCOUT_GOOGLE_ADS_API_RUNTIME_ENABLED: 'true' }, dependencies), /unavailable/);
  await assert.rejects(createGoogleAdsReportRuntime({ NIGHT_SCOUT_GOOGLE_ADS_REPORT_RUNTIME_ENABLED: 'true' }, dependencies), /unavailable/);
  assert.equal(poolCalls, 0);
});

test('Google OAuth runtime pins its API role, owner/store, TLS, callback, and fixed OAuth RPCs', async () => {
  const db = poolFor(apiRole, async (sql, args) => {
    if (sql.includes('worker_create_oauth_state')) return { rows: [{ created: true }] };
    if (sql.includes('worker_read_store_status')) return { rows: [] };
    throw new Error('private database detail must be hidden');
  });
  let poolOptions;
  const runtime = await createGoogleAdsRuntime(validApiEnv(), {
    createPool(options) { poolOptions = options; return db.pool; },
    createAuthClient(authUrl, key, options) {
      assert.equal(authUrl, `https://${project}.supabase.co`);
      assert.match(key, /^synthetic-publishable-key/);
      assert.equal(options.auth.persistSession, false);
      return { auth: { getUser: async (token) => token === 'auth-token'
        ? { data: { user: { id: userId } }, error: null }
        : { data: { user: null }, error: new Error('private auth detail') } } };
    },
    fetchImpl: async () => assert.fail('runtime setup and status must not call Google'),
  });
  try {
    assert.equal(poolOptions.ssl.rejectUnauthorized, true);
    assert.match(poolOptions.connectionString, new RegExp(`^postgresql://${apiRole}:`));
    assert.equal(poolOptions.max, 1);
    assert.deepEqual(runtime.allowedOrigins, [origin]);
    assert.deepEqual(await runtime.authenticate('Bearer auth-token'), { userId, isOwner: true });
    await assert.rejects(runtime.authenticate('Bearer wrong-token'), /unavailable/);

    const started = await runtime.service.start({ userId, isOwner: true }, { storeId });
    const authUrl = new URL(started.url);
    assert.equal(authUrl.searchParams.get('scope'), 'https://www.googleapis.com/auth/adwords');
    assert.equal(authUrl.searchParams.get('redirect_uri'), callback);
    assert.equal(authUrl.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(db.calls.filter((call) => call.sql.includes('worker_create_oauth_state')).length, 1);
    const stateCall = db.calls.find((call) => call.sql.includes('worker_create_oauth_state'));
    assert.equal(stateCall.args[1], userId);
    assert.equal(stateCall.args[2], storeId);
    assert.equal(typeof stateCall.args[0], 'string');
    assert.notEqual(stateCall.args[0], authUrl.searchParams.get('state'));

    const beforeMismatch = db.calls.length;
    await assert.rejects(runtime.service.start({ userId, isOwner: true }, { storeId: otherStoreId }), /unavailable/);
    assert.equal(db.calls.length, beforeMismatch, 'non-pinned store must fail before the RPC');

    const status = await runtime.service.readStatus({ userId, isOwner: true }, { storeId });
    assert.deepEqual(status.connections, []);
    assert.ok(db.calls.some((call) => call.sql.includes('worker_read_store_status')));
    assert.ok(db.calls.every((call) => !/worker_read_daily_spend|credential_envelopes|daily_spend_observations/.test(call.sql)));
  } finally {
    await runtime.close();
  }
});

test('Google API runtime rejects an unexpected database login and closes the pool', async () => {
  const db = poolFor('wrong_login');
  await assert.rejects(createGoogleAdsRuntime(validApiEnv(), {
    createPool: () => db.pool,
    createAuthClient: () => assert.fail('auth client must not be created after role mismatch'),
  }), /unavailable/);
  assert.equal(db.wasEnded(), true);
  assert.equal(db.calls.length, 1);
});

test('Google report runtime uses a separate report role, validates owner/store, and reads stored spend only', async () => {
  const db = poolFor(reportRole, async (sql, args) => {
    if (!sql.includes('worker_read_daily_spend')) throw new Error('unexpected report RPC');
    return { rows: [{
      customer_id: customerId,
      login_customer_id: null,
      currency: 'GBP',
      timezone_name: 'Europe/London',
      spend_date: args[2],
      coverage_state: 'provider_row',
      spend_micros: '1234567890123456789',
      observed_at: new Date('2026-11-21T11:00:00.000Z'),
      run_id: '33333333-3333-4333-8333-333333333333',
      run_status: 'complete',
      run_started_at: new Date('2026-11-21T10:00:00.000Z'),
    }] };
  });
  let poolOptions;
  const runtime = await createGoogleAdsReportRuntime(validReportEnv(), {
    createPool(options) { poolOptions = options; return db.pool; },
    createAuthClient: (authUrl, key) => {
      assert.equal(authUrl, `https://${project}.supabase.co`);
      assert.match(key, /^synthetic-publishable-key/);
      return { auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) } };
    },
    fetchImpl: async () => assert.fail('reporting must not call Google'),
  });
  try {
    assert.equal(poolOptions.ssl.rejectUnauthorized, true);
    assert.match(poolOptions.connectionString, new RegExp(`^postgresql://${reportRole}:`));
    assert.equal(poolOptions.application_name, 'night-scout-google-ads-report-staging');
    assert.deepEqual(await runtime.authenticate('Bearer auth-token'), { userId, isOwner: true });

    await assert.rejects(runtime.service.readSpend({ userId, isOwner: true }, {
      storeId: otherStoreId, from: '2026-11-20', to: '2026-11-20',
    }), /unavailable/);
    assert.equal(db.calls.length, 1, 'only session identity query should have run for mismatch');

    const report = await runtime.service.readSpend({ userId, isOwner: true }, {
      storeId, from: '2026-11-20', to: '2026-11-20',
    });
    assert.equal(report.status, 'available');
    assert.equal(report.days[0].spendMicros, '1234567890123456789');
    const spendCall = db.calls.find((call) => call.sql.includes('worker_read_daily_spend'));
    assert.ok(spendCall);
    assert.deepEqual(spendCall.args.slice(0, 4), [userId, storeId, '2026-11-20', '2026-11-20']);
    assert.equal(db.calls.some((call) => /worker_(create|consume|activate|disconnect)|credential_envelopes/.test(call.sql)), false);
  } finally {
    await runtime.close();
  }
});

test('Google report runtime returns a safe error when its fixed RPC fails', async () => {
  const db = poolFor(reportRole, async () => { throw new Error('sensitive SQL, password, or credential detail'); });
  const runtime = await createGoogleAdsReportRuntime(validReportEnv(), {
    createPool: () => db.pool,
    createAuthClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) } }),
    fetchImpl: async () => assert.fail('report failure must not call Google'),
  });
  try {
    await assert.rejects(runtime.service.readSpend({ userId, isOwner: true }, {
      storeId, from: '2026-11-20', to: '2026-11-20',
    }), (error) => error.message === 'Google Ads spend reporting unavailable'
      && !/sensitive|password|credential/.test(error.message));
  } finally {
    await runtime.close();
  }
});
