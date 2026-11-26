import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';

// The checkout intentionally has no installed Express/pg/Supabase packages.
// These narrow test doubles exercise route/runtime dependency contracts only;
// they do not claim to test Express parsing, PostgreSQL, Supabase, or the network.
const expressStub = `
export function Router() {
  const router = { gets: new Map(), posts: new Map(), middleware: [],
    use(...args) { this.middleware.push(args); return this; },
    get(path, handler) { this.gets.set(path, handler); return this; },
    post(path, handler) { this.posts.set(path, handler); return this; },
  };
  return router;
}
export function json() { return (_req, _res, next) => next(); }
`;
const pgStub = `export default { Pool: class { constructor() { throw new Error('unexpected default Pool use'); } } };`;
const supabaseStub = `export function createClient() { throw new Error('unexpected default auth client use'); }`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const code = specifier === 'express' ? expressStub
      : specifier === 'pg' ? pgStub
        : specifier === '@supabase/supabase-js' ? supabaseStub : null;
    if (code !== null) return { url: `data:text/javascript,${encodeURIComponent(code)}`, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const { createMetaAdsRouter } = await import('../src/routes/meta-ads.ts');
const { createMetaAdsSpendReportRouter } = await import('../src/routes/meta-ads-spend-report.ts');
const { createMetaAdsRuntime } = await import('../src/lib/meta-ads-runtime.mjs');
const { createMetaAdsReportRuntime } = await import('../src/lib/meta-ads-report-runtime.mjs');
const { createMetaAdsCollectorRuntime } = await import('../src/lib/meta-ads-collector-runtime.mjs');

const userId = '11111111-1111-4111-8111-111111111111';
const storeId = '22222222-2222-4222-8222-222222222222';
const connectionId = '33333333-3333-4333-8333-333333333333';
const accountId = '123456789';
const origin = 'https://night-scout-xero-staging.onrender.com';
const callbackUrl = `${origin}/api/meta-ads/callback`;

function response() {
  return {
    code: 200,
    body: undefined,
    redirectTo: undefined,
    headers: {},
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    redirect(code, url) { this.code = code; this.redirectTo = url; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
  };
}

test('Meta connect route authenticates owner, checks origin, and only returns ads_read OAuth URL', async () => {
  const seen = [];
  const service = {
    async start(identity, input) {
      seen.push({ identity, input });
      return { url: `https://www.facebook.com/v23.0/dialog/oauth?scope=ads_read&response_type=code&state=${'a'.repeat(43)}` };
    },
  };
  const router = createMetaAdsRouter({
    service,
    authenticate: async (authorization) => authorization === 'Bearer safe-test-token' ? { userId, isOwner: true } : null,
    allowedOrigins: [origin],
  });
  const handler = router.posts.get('/connect');
  const badOrigin = response();
  await handler({ headers: { origin: 'https://attacker.example', authorization: 'Bearer safe-test-token' }, body: { storeId } }, badOrigin);
  assert.equal(badOrigin.code, 403);
  assert.equal(seen.length, 0);

  const accepted = response();
  await handler({ headers: { origin, authorization: 'Bearer safe-test-token' }, body: { storeId } }, accepted);
  assert.equal(accepted.code, 200);
  assert.equal(new URL(accepted.body.url).searchParams.get('scope'), 'ads_read');
  assert.deepEqual(seen, [{ identity: { userId, isOwner: true }, input: { storeId } }]);
});

test('Meta callback puts only a fixed marker in the redirect and protects the selection handle in a cookie', async () => {
  const calls = [];
  const router = createMetaAdsRouter({
    service: {
      async complete(input) { calls.push(['complete', input]); return { status: 'account_selection_required', selectionHandle: 'b'.repeat(43) }; },
      async deny(input) { calls.push(['deny', input]); return { status: 'cancelled' }; },
    },
    authenticate: async () => ({ userId, isOwner: true }),
    allowedOrigins: [origin],
  });
  const handler = router.gets.get('/callback');
  const state = 'a'.repeat(43);
  const code = 'mock-auth-code-123456789';
  const completed = response();
  await handler({ query: { state, code } }, completed);
  assert.equal(completed.code, 303);
  assert.equal(completed.redirectTo, '/settings?metaSelection=select');
  assert.doesNotMatch(completed.redirectTo, new RegExp(code));
  assert.doesNotMatch(completed.redirectTo, /b{43}/);
  assert.match(completed.headers['Set-Cookie'], /^ns_meta_ads_selection=b{43}; Max-Age=900; Path=\/api\/meta-ads; HttpOnly; Secure; SameSite=Lax$/);

  const denied = response();
  await handler({ query: { state, error: 'access_denied', error_description: 'private provider detail' } }, denied);
  assert.equal(denied.code, 303);
  assert.equal(denied.redirectTo, '/settings?metaConnect=cancelled');
  assert.doesNotMatch(denied.redirectTo, /private provider detail|access_denied/);
  assert.match(denied.headers['Set-Cookie'], /^ns_meta_ads_selection=; Max-Age=0;.*Path=\/api\/meta-ads; HttpOnly; Secure; SameSite=Lax$/);
  assert.deepEqual(calls, [
    ['complete', { state, code }],
    ['deny', { state }],
  ]);
});

test('Meta selection reads and posts use the protected cookie, bind owner/store, and clear only on success', async () => {
  const handle = 'c'.repeat(43);
  const calls = [];
  const router = createMetaAdsRouter({
    service: {
      async readSelection(identity, input) { calls.push(['read', identity, input]); return { status: 'selection_required', accounts: [{ accountId, currency: 'GBP', timeZone: 'Europe/London' }], expiresAt: '2026-11-21T15:15:00.000Z' }; },
      async selectAccount(identity, input) { calls.push(['select', identity, input]); if (input.accountId === '999999999') throw new Error('selection unavailable'); return { status: 'connected', accountId, currency: 'GBP', timeZone: 'Europe/London', connectedAt: '2026-11-21T15:00:00.000Z' }; },
    },
    authenticate: async () => ({ userId, isOwner: true }),
    allowedOrigins: [origin],
  });
  const selectionHandler = router.gets.get('/selection');
  const selection = response();
  await selectionHandler({ query: { storeId }, headers: { authorization: 'Bearer safe-test-token', cookie: `ns_meta_ads_selection=${handle}` } }, selection);
  assert.equal(selection.code, 200);
  assert.deepEqual(calls[0], ['read', { userId, isOwner: true }, { storeId, selectionHandle: handle }]);
  const attemptedQueryHandle = response();
  await selectionHandler({ query: { storeId, selectionHandle: handle }, headers: { authorization: 'Bearer safe-test-token' } }, attemptedQueryHandle);
  assert.equal(attemptedQueryHandle.code, 400);
  const duplicateCookie = response();
  await selectionHandler({ query: { storeId }, headers: { authorization: 'Bearer safe-test-token', cookie: `ns_meta_ads_selection=${handle}; ns_meta_ads_selection=${handle}` } }, duplicateCookie);
  assert.equal(duplicateCookie.code, 404);

  const selectHandler = router.posts.get('/select-account');
  const failed = response();
  await selectHandler({ headers: { origin, authorization: 'Bearer safe-test-token', cookie: `ns_meta_ads_selection=${handle}` }, body: { storeId, accountId: '999999999' } }, failed);
  assert.equal(failed.code, 409);
  assert.equal(failed.headers['Set-Cookie'], undefined, 'a retryable selection failure keeps the short-lived handle cookie');

  const success = response();
  await selectHandler({ headers: { origin, authorization: 'Bearer safe-test-token', cookie: `ns_meta_ads_selection=${handle}` }, body: { storeId, accountId } }, success);
  assert.equal(success.code, 200);
  assert.deepEqual(calls.at(-1), ['select', { userId, isOwner: true }, { storeId, selectionHandle: handle, accountId }]);
  assert.match(success.headers['Set-Cookie'], /^ns_meta_ads_selection=; Max-Age=0;.*Path=\/api\/meta-ads; HttpOnly; Secure; SameSite=Lax$/);

  const extraBody = response();
  await selectHandler({ headers: { origin, authorization: 'Bearer safe-test-token', cookie: `ns_meta_ads_selection=${handle}` }, body: { storeId, accountId, selectionHandle: handle } }, extraBody);
  assert.equal(extraBody.code, 400);
});

test('Meta account-selection cancellation clears only the matching short-lived cookie', async () => {
  const handle = 'd'.repeat(43);
  const calls = [];
  const router = createMetaAdsRouter({
    service: { async cancelPendingSelection(identity, input) { calls.push([identity, input]); return { status: 'cancelled' }; } },
    authenticate: async () => ({ userId, isOwner: true }),
    allowedOrigins: [origin],
  });
  const handler = router.posts.get('/selection/cancel');
  const result = response();
  await handler({ headers: { origin, authorization: 'Bearer safe-test-token', cookie: `ns_meta_ads_selection=${handle}` }, body: { storeId } }, result);
  assert.equal(result.code, 200);
  assert.deepEqual(result.body, { status: 'cancelled' });
  assert.deepEqual(calls, [[{ userId, isOwner: true }, { storeId, selectionHandle: handle }]]);
  assert.match(result.headers['Set-Cookie'], /^ns_meta_ads_selection=; Max-Age=0;.*Path=\/api\/meta-ads; HttpOnly; Secure; SameSite=Lax$/);

  const unavailableRouter = createMetaAdsRouter({
    service: { async cancelPendingSelection() { return { status: 'unavailable' }; } },
    authenticate: async () => ({ userId, isOwner: true }),
    allowedOrigins: [origin],
  });
  const rejected = response();
  await unavailableRouter.posts.get('/selection/cancel')({
    headers: { origin, authorization: 'Bearer safe-test-token', cookie: `ns_meta_ads_selection=${handle}` },
    body: { storeId },
  }, rejected);
  assert.equal(rejected.code, 409);
  assert.equal(rejected.headers['Set-Cookie'], undefined, 'failed server-side cancellation must leave cookie for retry or expiry');
});

test('Meta report route accepts only authenticated store/date queries and returns service-shaped evidence', async () => {
  let called = false;
  const report = Object.freeze({
    status: 'available', storeId, from: '2026-11-10', to: '2026-11-10',
    account: { providerAccountId: accountId, currency: 'GBP', timeZone: 'Europe/London' },
    days: [{ date: '2026-11-10', coverageState: 'provider_row', spendMinor: '1000', observedAt:'2026-11-11T10:00:00Z',runId:connectionId,runStatus:'complete',runStartedAt:'2026-11-11T09:59:00Z' }],
    lineage:{storeId,accountId,connectionId,from:'2026-11-10',to:'2026-11-10',version:`sha256:${'a'.repeat(64)}`},
    connectionState:'expired',reauthorizationRequired:true,evidenceAvailability:'available',observationFreshness:'unknown',
  });
  const router = createMetaAdsSpendReportRouter({
    authenticate: async () => ({ userId, isOwner: true }),
    service: { async readSpend(identity, input) { called = true; assert.equal(identity.userId, userId); return { ...report, ...input }; } },
  });
  const handler = router.gets.get('/spend');
  const bad = response();
  await handler({ query: { storeId, from: '2026-11-10', to: '2026-11-10', accountId }, headers: { authorization: 'Bearer safe-test-token' } }, bad);
  assert.equal(bad.code, 400);
  assert.equal(called, false);

  const good = response();
  router.middleware[0][1]({}, good, () => {});
  await handler({ query: { storeId, from: '2026-11-10', to: '2026-11-10' }, headers: { authorization: 'Bearer safe-test-token' } }, good);
  assert.equal(good.code, 200);
  assert.equal(good.body.days[0].spendMinor, '1000');
  assert.equal(good.headers['Cache-Control'], 'no-store');
});

function validReportEnvironment(overrides = {}) {
  return {
    NIGHT_SCOUT_META_ADS_REPORT_RUNTIME_ENABLED: 'true',
    NIGHT_SCOUT_RUNTIME_ENV: 'staging',
    NIGHT_SCOUT_META_ADS_STAGING_PROJECT_REF: 'bioalckltvkhlczusdvl',
    NIGHT_SCOUT_STAGING_CA_PEM: '-----BEGIN CERTIFICATE-----\nmock-cert\n-----END CERTIFICATE-----',
    NIGHT_SCOUT_REVIEW_AUTH_URL: 'https://bioalckltvkhlczusdvl.supabase.co',
    NIGHT_SCOUT_REVIEW_PUBLIC_KEY: 'mock-publishable-key-with-more-than-20-bytes',
    NIGHT_SCOUT_META_ADS_STAGING_OWNER_ID: userId,
    NIGHT_SCOUT_META_ADS_STAGING_STORE_ID: storeId,
    NIGHT_SCOUT_META_ADS_REPORT_DATABASE_URL: 'postgresql://night_scout_meta_ads_report_login:mock-password@db.bioalckltvkhlczusdvl.supabase.co:5432/postgres',
    ...overrides,
  };
}

function validApiEnvironment(overrides = {}) {
  return {
    NIGHT_SCOUT_META_ADS_API_RUNTIME_ENABLED: 'true',
    NIGHT_SCOUT_RUNTIME_ENV: 'staging',
    NIGHT_SCOUT_META_ADS_STAGING_PROJECT_REF: 'bioalckltvkhlczusdvl',
    NIGHT_SCOUT_STAGING_CA_PEM: '-----BEGIN CERTIFICATE-----\nmock-cert\n-----END CERTIFICATE-----',
    NIGHT_SCOUT_META_ADS_ENVELOPE_MASTER_KEY: 'synthetic-test-master-key-material-32-bytes-min',
    NIGHT_SCOUT_META_ADS_ENVELOPE_KEY_VERSION: 'v1',
    NIGHT_SCOUT_META_ADS_API_VERSION: 'v23.0',
    NIGHT_SCOUT_REVIEW_AUTH_URL: 'https://bioalckltvkhlczusdvl.supabase.co',
    NIGHT_SCOUT_REVIEW_PUBLIC_KEY: 'mock-publishable-key-with-more-than-20-bytes',
    NIGHT_SCOUT_META_ADS_APP_ID: '123456789012345',
    NIGHT_SCOUT_META_ADS_APP_SECRET: 'synthetic-test-app-secret-material-24',
    NIGHT_SCOUT_META_ADS_REDIRECT_URI: callbackUrl,
    NIGHT_SCOUT_META_ADS_STAGING_OWNER_ID: userId,
    NIGHT_SCOUT_META_ADS_STAGING_STORE_ID: storeId,
    NIGHT_SCOUT_META_ADS_ALLOWED_ORIGIN: origin,
    NIGHT_SCOUT_META_ADS_API_DATABASE_URL: 'postgresql://night_scout_meta_ads_api_login:mock-password@db.bioalckltvkhlczusdvl.supabase.co:5432/postgres',
    ...overrides,
  };
}

test('Meta runtimes stay disabled by default and reject incomplete enabled config before pool creation', async () => {
  let createPoolCalls = 0;
  const dependencies = { createPool() { createPoolCalls += 1; throw new Error('must not connect'); } };
  assert.equal(await createMetaAdsRuntime({}, dependencies), undefined);
  assert.equal(await createMetaAdsReportRuntime({}, dependencies), undefined);
  assert.equal(await createMetaAdsCollectorRuntime({}, dependencies), undefined);
  await assert.rejects(createMetaAdsRuntime({ NIGHT_SCOUT_META_ADS_API_RUNTIME_ENABLED: 'true' }, dependencies), /unavailable/);
  await assert.rejects(createMetaAdsReportRuntime({ NIGHT_SCOUT_META_ADS_REPORT_RUNTIME_ENABLED: 'true' }, dependencies), /unavailable/);
  await assert.rejects(createMetaAdsCollectorRuntime({ NIGHT_SCOUT_META_ADS_COLLECTOR_RUNTIME_ENABLED: 'true' }, dependencies), /unavailable/);
  assert.equal(createPoolCalls, 0);
});

test('Meta report runtime pins role/store and shapes exact stored spend without a provider call', async () => {
  const queryCalls = [];
  const pool = {
    async query(sql, args) {
      queryCalls.push({ sql, args });
      if (sql.startsWith('SELECT session_user::text')) {
        return { rows: [{ session_user: 'night_scout_meta_ads_report_login', current_user: 'night_scout_meta_ads_report_login' }] };
      }
      return { rows: [{
        provider_account_id: accountId,
        connection_id: connectionId, account_selection_id: storeId, selected_at: '2026-11-09T12:00:00.000001Z',
        connection_status: 'connected', reauthorization_required: false,
        currency: 'GBP',
        timezone_name: 'Europe/London',
        spend_date: '2026-11-10',
        coverage_state: 'provider_row',
        spend_minor: '123456789',
        observed_at: new Date('2026-11-11T12:00:00.000Z'),
        run_id: connectionId,
        run_status: 'complete',
        run_started_at: new Date('2026-11-11T11:00:00.000Z'),
      }] };
    },
    async end() {},
  };
  const runtime = await createMetaAdsReportRuntime(validReportEnvironment(), {
    createPool(options) {
      assert.equal(options.ssl.rejectUnauthorized, true);
      return pool;
    },
    createAuthClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) } }),
  });
  try {
    const identity = await runtime.authenticate('Bearer safe-test-token');
    const result = await runtime.service.readSpend(identity, { storeId, from: '2026-11-10', to: '2026-11-10' });
    assert.equal(result.status, 'available');
    assert.equal(result.days[0].spendMinor, '123456789');
    assert.equal(result.account.providerAccountId, accountId);
    assert.equal(queryCalls.length, 2);
    assert.match(queryCalls[1].sql, /worker_read_daily_spend/);
    assert.deepEqual(queryCalls[1].args.slice(0, 4), [userId, storeId, '2026-11-10', '2026-11-10']);
    await assert.rejects(runtime.service.readSpend(identity, { storeId: connectionId, from: '2026-11-10', to: '2026-11-10' }), /unavailable/);
    assert.equal(queryCalls.length, 2, 'a store mismatch must fail before the SQL read');
  } finally {
    await runtime.close();
  }
});

test('Meta API runtime pins its database role and owner identity without provider access', async () => {
  let poolOptions;
  let authToken;
  const pool = {
    async query(sql) {
      assert.match(sql, /^SELECT session_user::text/);
      return { rows: [{ session_user: 'night_scout_meta_ads_api_login', current_user: 'night_scout_meta_ads_api_login' }] };
    },
    async end() {},
  };
  const runtime = await createMetaAdsRuntime(validApiEnvironment(), {
    createPool(options) { poolOptions = options; return pool; },
    createAuthClient(url, key) {
      assert.equal(url, 'https://bioalckltvkhlczusdvl.supabase.co');
      assert.match(key, /^mock-publishable/);
      return { auth: { getUser: async (token) => { authToken = token; return { data: { user: { id: userId } }, error: null }; } } };
    },
    fetchImpl: async () => assert.fail('OAuth/provider fetch must not happen during runtime creation or authentication'),
  });
  try {
    assert.equal(poolOptions.ssl.rejectUnauthorized, true);
    assert.equal(poolOptions.max, 1);
    assert.deepEqual(runtime.allowedOrigins, [origin]);
    assert.deepEqual(await runtime.authenticate('Bearer safe-test-token'), { userId, isOwner: true });
    assert.equal(authToken, 'safe-test-token');
  } finally {
    await runtime.close();
  }
});

test('Meta cancellation traverses real service, repository and fixed RPC with owner/store binding', async () => {
  const queries = [];
  const selectionHandle = 'synthetic-selection-handle-'.repeat(2);
  let completed = true;
  const runtime = await createMetaAdsRuntime(validApiEnvironment(), {
    createPool: () => ({
      async query(sql, args) {
        if (sql.startsWith('SELECT session_user::text')) {
          return { rows: [{ session_user: 'night_scout_meta_ads_api_login', current_user: 'night_scout_meta_ads_api_login' }] };
        }
        queries.push({ sql, args });
        assert.equal(sql, 'SELECT * FROM meta_ads_v1.worker_cancel_pending_selection($1,$2,$3,$4)');
        return { rows: [{ completed }] };
      },
      async end() {},
    }),
    createAuthClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) } }),
    fetchImpl: async () => assert.fail('Cancellation must never contact Meta'),
  });
  try {
    const identity = await runtime.authenticate('Bearer synthetic-token');
    await assert.rejects(runtime.service.cancelPendingSelection(identity, { storeId: connectionId, selectionHandle }), /unavailable/);
    await assert.rejects(runtime.service.cancelPendingSelection({ userId: connectionId, isOwner: true }, { storeId, selectionHandle }), /unavailable/);
    assert.equal(queries.length, 0, 'wrong owner or store must fail before SQL');
    assert.deepEqual(await runtime.service.cancelPendingSelection(identity, { storeId, selectionHandle }), { status: 'cancelled' });
    assert.equal(queries.length, 1);
    assert.deepEqual(queries[0].args.slice(0, 3), [`\\x${createHash('sha256').update(selectionHandle).digest('hex')}`, userId, storeId]);
    assert.ok(Number.isFinite(Date.parse(queries[0].args[3])));
    assert.ok(!JSON.stringify(queries).includes(selectionHandle), 'SQL receives only the handle digest');
    completed = false;
    await assert.rejects(runtime.service.cancelPendingSelection(identity, { storeId, selectionHandle }), /unavailable/);
    assert.equal(queries.length, 2, 'a missing/expired selection cannot report success');
  } finally {
    await runtime.close();
  }
});

test('Meta collector runtime uses only its pinned login and does not require OAuth app credentials', async () => {
  const queries = [];
  const pool = {
    async query(sql, args) {
      queries.push({ sql, args });
      if (sql.startsWith('SELECT session_user::text')) {
        return { rows: [{ session_user: 'night_scout_meta_ads_collector_login', current_user: 'night_scout_meta_ads_collector_login' }] };
      }
      return { rows: [] };
    },
    async end() {},
  };
  const runtime = await createMetaAdsCollectorRuntime({
    NIGHT_SCOUT_META_ADS_COLLECTOR_RUNTIME_ENABLED: 'true',
    NIGHT_SCOUT_RUNTIME_ENV: 'staging',
    NIGHT_SCOUT_META_ADS_STAGING_PROJECT_REF: 'bioalckltvkhlczusdvl',
    NIGHT_SCOUT_STAGING_CA_PEM: '-----BEGIN CERTIFICATE-----\nmock-cert\n-----END CERTIFICATE-----',
    NIGHT_SCOUT_META_ADS_ENVELOPE_MASTER_KEY: 'synthetic-test-master-key-material-32-bytes-min',
    NIGHT_SCOUT_META_ADS_ENVELOPE_KEY_VERSION: 'v1',
    NIGHT_SCOUT_META_ADS_API_VERSION: 'v23.0',
    NIGHT_SCOUT_META_ADS_COLLECTOR_DATABASE_URL: 'postgresql://night_scout_meta_ads_collector_login:mock-password@db.bioalckltvkhlczusdvl.supabase.co:5432/postgres',
  }, {
    createPool(options) {
      assert.equal(options.ssl.rejectUnauthorized, true);
      assert.equal(options.application_name, 'night-scout-meta-ads-collector-staging');
      return pool;
    },
    fetchImpl: async () => assert.fail('Collector runtime creation must not contact Meta'),
  });
  try {
    assert.equal(typeof runtime.collector.collect, 'function');
    assert.deepEqual(await runtime.listActiveAccounts(), []);
    assert.equal(queries.length, 2);
    assert.match(queries[1].sql, /worker_list_active_accounts/);
  } finally {
    await runtime.close();
  }
});

test('Meta report preserves evidence version across expiry, separates empty evidence and rejects mixed lineage',async()=>{
  const row={provider_account_id:accountId,currency:'GBP',timezone_name:'Europe/London',spend_date:'2026-11-10',
    coverage_state:'provider_row',spend_minor:'12345',observed_at:'2026-11-11T12:00:00Z',run_id:connectionId,
    run_status:'complete',run_started_at:'2026-11-11T11:00:00Z',connection_id:connectionId,
    account_selection_id:storeId,selected_at:'2026-11-09T12:00:00.000001Z',connection_status:'connected',reauthorization_required:false};
  let rows=[{...row}];
  const runtime=await createMetaAdsReportRuntime(validReportEnvironment(),{
    createPool:()=>({async query(sql){return sql.startsWith('SELECT session_user')
      ? {rows:[{session_user:'night_scout_meta_ads_report_login',current_user:'night_scout_meta_ads_report_login'}]}:{rows};},async end(){}}),
    createAuthClient:()=>({auth:{getUser:async()=>({data:{user:{id:userId}},error:null})}}),
    fetchImpl:async()=>assert.fail('stored history must not contact provider'),
  });
  try {
    const read=(to='2026-11-10')=>runtime.service.readSpend({userId,isOwner:true},{storeId,from:'2026-11-10',to});
    const current=await read();
    assert.match(current.lineage.version,/^sha256:[a-f0-9]{64}$/);
    assert.equal(current.observationFreshness,'unknown');
    rows=[{...row,connection_status:'reauthorization_required',reauthorization_required:true}];
    const expired=await read();
    assert.equal(expired.connectionState,'expired');
    assert.equal(expired.reauthorizationRequired,true);
    assert.equal(expired.evidenceAvailability,'available');
    assert.equal(expired.observationFreshness,'unknown','expiry alone cannot invent evidence freshness');
    assert.deepEqual(expired.days,current.days);
    assert.deepEqual(expired.lineage,current.lineage);
    rows=[{...rows[0],coverage_state:null,spend_minor:null,observed_at:null,run_id:null,run_status:null,run_started_at:null}];
    const empty=await read();
    assert.equal(empty.connectionState,'expired');
    assert.equal(empty.evidenceAvailability,'unavailable');
    assert.equal(empty.days[0].spendMinor,null);
    for(const patch of [{selected_at:'2026-11-09T12:00:00.000002Z'},{currency:'USD'},{timezone_name:'America/New_York'}]) {
      rows=[{...row,...patch}];
      assert.notEqual((await read()).lineage.version,current.lineage.version,'version binds exact selected instant and authoritative account metadata');
    }
    rows=[{...row},{...row,spend_date:'2026-11-11',connection_id:userId}];
    await assert.rejects(read('2026-11-11'),/unavailable/);
    rows=[{...row,connection_status:'revoked'}];
    await assert.rejects(read(),/unavailable/);
    rows=[{...row,run_id:null}];
    await assert.rejects(read(),/unavailable/);
  } finally {await runtime.close();}
});
