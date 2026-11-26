import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Narrow dependency doubles exercise the route contract without loading a real
// web server, database driver, Supabase client, provider, or network.
const expressStub = `
export function Router() {
  return { gets: new Map(), posts: new Map(), middleware: [],
    use(...args) { this.middleware.push(args); return this; },
    get(path, handler) { this.gets.set(path, handler); return this; },
    post(path, handler) { this.posts.set(path, handler); return this; },
  };
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

const { createGoogleAdsRouter } = await import('../src/routes/google-ads.ts');
const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const storeId = '22222222-2222-4222-8222-222222222222';
const otherStoreId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const connectionId = '33333333-3333-4333-8333-333333333333';
const selectionHandle = 'h'.repeat(43);
const origin = 'https://night-scout-xero-staging.onrender.com';
const cookieName = 'ns_google_ads_selection';

function response() {
  return {
    code: 200, body: undefined, redirectTo: undefined, headers: {},
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    redirect(code, url) { this.code = code; this.redirectTo = url; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    cookie(name, value, options) { this.cookies ??= []; this.cookies.push({ name, value, options }); return this; },
    clearCookie(name, options) { this.clearedCookies ??= []; this.clearedCookies.push({ name, options }); return this; },
  };
}

function route(service, authenticate = async (authorization) => authorization === 'Bearer test-token' ? ({ userId, isOwner: true }) : null) {
  const router = createGoogleAdsRouter({ service, authenticate, allowedOrigins: [origin] });
  for (const routes of [router.gets, router.posts]) {
    for (const [path, handler] of routes) {
      routes.set(path, async (req, res) => {
        for (const args of router.middleware) {
          const middleware = args.at(-1);
          if (typeof middleware !== 'function' || middleware.length === 4) continue;
          let continued = false;
          middleware(req, res, () => { continued = true; });
          if (!continued) return;
        }
        return handler(req, res);
      });
    }
  }
  return router;
}

function request({ headers = {}, body, query = {} } = {}) {
  return { headers, body, query };
}

function assertPrivateResponse(res) {
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.headers['Referrer-Policy'], 'no-referrer');
}

test('Google connect requires the allowed origin and authenticated owner before starting OAuth', async () => {
  const started = [];
  const router = route({ async start(identity, input) { started.push({ identity, input }); return { url: `https://accounts.google.com/o/oauth2/v2/auth?scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fadwords&response_type=code&code_challenge_method=S256&state=${'s'.repeat(43)}` }; } });
  assert.equal(typeof router.posts.get('/connect'), 'function');

  const rejectedOrigin = response();
  await router.posts.get('/connect')(request({ headers: { origin: 'https://attacker.example', authorization: 'Bearer test-token' }, body: { storeId } }), rejectedOrigin);
  assert.equal(rejectedOrigin.code, 403);
  assert.equal(started.length, 0);

  const rejectedAuth = response();
  await router.posts.get('/connect')(request({ headers: { origin, authorization: 'Bearer invalid' }, body: { storeId } }), rejectedAuth);
  assert.equal(rejectedAuth.code, 401);
  assert.equal(started.length, 0);

  const accepted = response();
  await router.posts.get('/connect')(request({ headers: { origin, authorization: 'Bearer test-token' }, body: { storeId } }), accepted);
  assert.equal(accepted.code, 200);
  assert.equal(new URL(accepted.body.url).origin, 'https://accounts.google.com');
  assert.deepEqual(started, [{ identity: { userId, isOwner: true }, input: { storeId } }]);
  assertPrivateResponse(accepted);
});

test('Google callback puts only the one-use selection handle in a protected cookie, never in its URL', async () => {
  const completed = [];
  const providerCode = 'mock-provider-code-do-not-reflect';
  const providerError = 'private-google-error-do-not-reflect';
  const router = route({
    async complete(input) { completed.push(['complete', input]); return { status: 'account_selection_required', selectionHandle }; },
    async deny(input) { completed.push(['deny', input]); return { status: 'cancelled' }; },
  });
  const callback = router.gets.get('/callback');
  const success = response();
  await callback(request({ query: { state: 's'.repeat(43), code: providerCode } }), success);
  assert.equal(success.code, 303);
  assert.equal(typeof success.redirectTo, 'string');
  for (const secret of [providerCode, selectionHandle, providerError]) assert.equal(success.redirectTo.includes(secret), false);
  assert.match(success.headers['Set-Cookie'], new RegExp(`^${cookieName}=${selectionHandle};`));
  assert.match(success.headers['Set-Cookie'], /HttpOnly/);
  assert.match(success.headers['Set-Cookie'], /Secure/);
  assert.match(success.headers['Set-Cookie'], /SameSite=Lax/);
  assertPrivateResponse(success);

  const denied = response();
  await callback(request({ query: { state: 'd'.repeat(43), error: 'access_denied', error_description: providerError } }), denied);
  assert.equal(denied.code, 303);
  for (const secret of ['access_denied', providerError, selectionHandle]) assert.equal(denied.redirectTo.includes(secret), false);
  assert.match(denied.headers['Set-Cookie'], new RegExp(`^${cookieName}=;`));
  assert.deepEqual(completed, [
    ['complete', { state: 's'.repeat(43), code: providerCode }],
    ['deny', { state: 'd'.repeat(43) }],
  ]);
});

test('pending Google account selections expose IDs only and are read with the authenticated owner, store, and cookie handle', async () => {
  const calls = [];
  const router = route({ async readAccountSelections(identity, input) {
    calls.push({ identity, input });
    if (input.storeId !== storeId) throw new Error('owner/store-bound pending selection');
    return { status: 'account_selection_required', accounts: [{ customerId: '1234567890', loginCustomerId: null }, { customerId: '9876543210', loginCustomerId: '1234500000' }], expiresAt: '2026-11-21T15:00:00.000Z' };
  } });
  const handler = router.gets.get('/account-selections');
  const res = response();
  await handler(request({
    headers: { authorization: 'Bearer test-token' },
    query: { storeId },
    headers: { authorization: 'Bearer test-token', cookie: `${cookieName}=${selectionHandle}` },
    cookies: { [cookieName]: selectionHandle },
  }), res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { status: 'account_selection_required', accounts: [
    { customerId: '1234567890', loginCustomerId: null },
    { customerId: '9876543210', loginCustomerId: '1234500000' },
  ], expiresAt: '2026-11-21T15:00:00.000Z' });
  assert.doesNotMatch(JSON.stringify(res.body), /name|email|token|credential|refresh/i);
  assert.deepEqual(calls, [{ identity: { userId, isOwner: true }, input: { storeId, selectionHandle } }]);
  assertPrivateResponse(res);

  const mismatchedStore = response();
  await handler(request({ headers: { authorization: 'Bearer test-token', cookie: `${cookieName}=${selectionHandle}` }, cookies: { [cookieName]: selectionHandle }, query: { storeId: otherStoreId } }), mismatchedStore);
  assert.notEqual(mismatchedStore.code, 200, 'selection must remain bound to its originating store');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].identity.userId, userId);
  assert.equal(calls[1].input.storeId, otherStoreId, 'the requested store must be passed through so storage can enforce its binding');

  const nonOwnerRouter = route({ async readAccountSelections() { throw new Error('must not be called'); } }, async () => ({ userId: otherUserId, isOwner: false }));
  const nonOwner = response();
  await nonOwnerRouter.gets.get('/account-selections')(request({ headers: { authorization: 'Bearer test-token', cookie: `${cookieName}=${selectionHandle}` }, cookies: { [cookieName]: selectionHandle }, query: { storeId } }), nonOwner);
  assert.equal(nonOwner.code, 401);
});

test('account selection clears its one-use cookie only after successful selection', async () => {
  const service = { async selectAccount(_identity, input) {
    if (input.storeId === otherStoreId) throw new Error('bound selection rejected');
    return { status: 'connected', customerId: '1234567890', loginCustomerId: null, currency: 'GBP', timeZone: 'Europe/London', connectedAt: '2026-11-21T15:00:00.000Z' };
  } };
  const handler = route(service).posts.get('/select-account');
  const payload = { storeId, customerId: '1234567890' };
  const failure = response();
  await handler(request({ headers: { origin, authorization: 'Bearer test-token', cookie: `${cookieName}=${selectionHandle}` }, cookies: { [cookieName]: selectionHandle }, body: { ...payload, storeId: otherStoreId } }), failure);
  assert.notEqual(failure.code, 200);
  assert.equal(failure.clearedCookies?.length ?? 0, 0, 'failed selection must preserve its retry handle');

  const success = response();
  await handler(request({ headers: { origin, authorization: 'Bearer test-token', cookie: `${cookieName}=${selectionHandle}` }, cookies: { [cookieName]: selectionHandle }, body: payload }), success);
  assert.equal(success.code, 200);
  assert.match(success.headers['Set-Cookie'], new RegExp(`^${cookieName}=;`));
  assert.match(success.headers['Set-Cookie'], /HttpOnly/);
  assert.match(success.headers['Set-Cookie'], /Secure/);
  assert.match(success.headers['Set-Cookie'], /SameSite=Lax/);
  assertPrivateResponse(success);
});

test('Google status and disconnect hide provider/auth failures and protect responses from caching/referrers', async () => {
  const sensitive = 'Google invalid_grant refresh_token private stack detail';
  const router = route({
    async readStatus() { throw new Error(sensitive); },
    async disconnect() { throw new Error(sensitive); },
  });
  const status = response();
  await router.gets.get('/status')(request({ headers: { authorization: 'Bearer test-token' }, query: { storeId } }), status);
  assert.notEqual(status.code, 200);
  assert.doesNotMatch(JSON.stringify(status.body), /invalid_grant|refresh_token|private stack/i);
  assertPrivateResponse(status);

  const disconnect = response();
  await router.posts.get('/disconnect')(request({ headers: { origin, authorization: 'Bearer test-token' }, body: { storeId, connectionId } }), disconnect);
  assert.notEqual(disconnect.code, 200);
  assert.doesNotMatch(JSON.stringify(disconnect.body), /invalid_grant|refresh_token|private stack/i);
  assertPrivateResponse(disconnect);

  const unauthenticatedRouter = route({ async readStatus() { throw new Error('must not be called'); }, async disconnect() { throw new Error('must not be called'); } }, async () => { throw new Error(sensitive); });
  const authFailure = response();
  await unauthenticatedRouter.gets.get('/status')(request({ headers: { authorization: 'Bearer test-token' }, query: { storeId } }), authFailure);
  assert.equal(authFailure.code, 401);
  assert.doesNotMatch(JSON.stringify(authFailure.body), /invalid_grant|refresh_token|private stack/i);
  assertPrivateResponse(authFailure);
});
