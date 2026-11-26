import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleAdsOAuthProtocol, GOOGLE_ADS_OAUTH_SCOPE } from './google-ads-oauth-protocol.mjs';
import { createGoogleAdsOAuthCredentialEnvelope } from './google-ads-oauth-credential-envelope.mjs';
import { createGoogleAdsOAuthService } from './google-ads-oauth-service.mjs';
import { listGoogleAdsDirectCustomerIds, verifyGoogleAdsDirectAdvertiser } from './google-ads-account-discovery.mjs';
import { readGoogleAdsDailySpend } from './google-ads-spend-reader.mjs';

const clientId = '123456789012-abcdefghijklmno.apps.googleusercontent.com';
const clientSecret = 'mock-client-secret-1234567890';
const redirectUri = 'https://staging.example.test/api/google-ads/callback';
const accessToken = 'mock-access-token-1234567890';
const refreshToken = 'mock-refresh-token-1234567890';
const userId = '11111111-1111-4111-8111-111111111111';
const storeId = '22222222-2222-4222-8222-222222222222';
const customerId = '1234567890';
const otherCustomerId = '1234567891';
const fixedNow = () => new Date('2026-11-21T12:00:00.000Z');

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function mockRepository() {
  const states = new Map();
  const pending = new Map();
  const calls = { createState: [], consumeState: [], createPending: [], readPending: [], activate: [] };
  return {
    calls,
    async createOAuthState(input) {
      calls.createState.push(input);
      states.set(input.stateDigest.toString('hex'), { userId: input.userId, storeId: input.storeId });
    },
    async consumeOAuthState({ stateDigest }) {
      calls.consumeState.push(stateDigest.toString('hex'));
      const key = stateDigest.toString('hex');
      const value = states.get(key) ?? null;
      states.delete(key);
      return value;
    },
    async createPendingConnection(input) {
      calls.createPending.push(input);
      pending.set(input.selectionHandleDigest.toString('hex'), {
        connectionId: input.connectionId,
        userId: input.userId,
        storeId: input.storeId,
        ciphertext: input.encryptedCredential.ciphertext,
        encryptedDek: input.encryptedCredential.encryptedDek,
        algorithm: input.encryptedCredential.algorithm,
        keyVersion: input.encryptedCredential.keyVersion,
        accountSelections: input.accountSelections,
        selectionExpiresAt: input.selectionExpiresAt,
      });
      return { created: true };
    },
    async readPendingCredential(input) {
      calls.readPending.push(input);
      const item = pending.get(input.selectionHandleDigest.toString('hex'));
      return item?.userId === input.userId && item?.storeId === input.storeId ? item : null;
    },
    async activateSelectedAccount(input) {
      calls.activate.push(input);
      pending.delete(input.selectionHandleDigest.toString('hex'));
      return {
        customerId: input.customerId,
        loginCustomerId: input.loginCustomerId,
        currency: input.currency,
        timeZone: input.timeZone,
        connectedAt: input.now,
      };
    },
    async disconnectConnection() { return { disconnected: true }; },
    async readStoreStatus() { return []; },
  };
}

test('OAuth protocol requests only Ads scope with state and S256 PKCE; rejects scope expansion safely', async () => {
  const protocol = createGoogleAdsOAuthProtocol({ clientId, clientSecret, redirectUri }, async (_url, options) => {
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.equal(new Headers(options.headers).has('developer-token'), false);
    const form = new URLSearchParams(options.body);
    assert.equal(form.get('grant_type'), 'authorization_code');
    assert.equal(form.get('client_secret'), clientSecret);
    return jsonResponse({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: GOOGLE_ADS_OAUTH_SCOPE,
    });
  });
  const state = 'a'.repeat(43);
  const url = new URL(protocol.authorizationUrl(state, Buffer.alloc(32, 8)));
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('scope'), GOOGLE_ADS_OAUTH_SCOPE);
  assert.equal(url.searchParams.get('state'), state);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('response_type'), 'code');

  const tokenSet = await protocol.exchangeCode('mock-auth-code-123456789', state, Buffer.alloc(32, 8));
  assert.equal(tokenSet.refreshToken, refreshToken);
  assert.deepEqual(tokenSet.grantedScopes, [GOOGLE_ADS_OAUTH_SCOPE]);

  const broadened = createGoogleAdsOAuthProtocol({ clientId, clientSecret, redirectUri }, async () => jsonResponse({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: `${GOOGLE_ADS_OAUTH_SCOPE} email`,
  }));
  await assert.rejects(broadened.exchangeCode('mock-auth-code-123456789', state, Buffer.alloc(32, 8)),
    (error) => error.message === 'Google Ads connection unavailable' && !error.message.includes(refreshToken));
});

test('OAuth refresh accepts an omitted unchanged scope but rejects a reported scope expansion', async () => {
  const protocol = createGoogleAdsOAuthProtocol({ clientId, clientSecret, redirectUri }, async () => jsonResponse({
    access_token: accessToken, token_type: 'Bearer', expires_in: 3600,
  }));
  const refreshed = await protocol.refreshAccessToken(refreshToken);
  assert.deepEqual(refreshed.grantedScopes, [GOOGLE_ADS_OAUTH_SCOPE]);

  const expanded = createGoogleAdsOAuthProtocol({ clientId, clientSecret, redirectUri }, async () => jsonResponse({
    access_token: accessToken, token_type: 'Bearer', expires_in: 3600,
    scope: `${GOOGLE_ADS_OAUTH_SCOPE} email`,
  }));
  await assert.rejects(expanded.refreshAccessToken(refreshToken), /unavailable/);
});

test('OAuth service binds one-use state and pending account selection to the owner and store without returning tokens', async () => {
  const repository = mockRepository();
  const envelope = createGoogleAdsOAuthCredentialEnvelope(Buffer.alloc(32, 7));
  let exchanges = 0;
  let decrypts = 0;
  const protocol = {
    authorizationUrl(state) { return `https://accounts.google.com/mock?state=${state}`; },
    async exchangeCode() {
      exchanges += 1;
      return { accessToken, refreshToken, grantedScopes: [GOOGLE_ADS_OAUTH_SCOPE] };
    },
    async refreshAccessToken() { return { accessToken, grantedScopes: [GOOGLE_ADS_OAUTH_SCOPE] }; },
  };
  const credentialEnvelope = {
    encrypt: (input) => envelope.encrypt(input),
    decrypt: (input) => { decrypts += 1; return envelope.decrypt(input); },
  };
  const service = createGoogleAdsOAuthService({
    protocol,
    credentialEnvelope,
    repository,
    authorizeOwner: async ({ userId: candidateUser, storeId: candidateStore }) => candidateUser === userId && candidateStore === storeId,
    pkceKey: Buffer.alloc(32, 3),
    discoverAccounts: async () => ({ accountSelections: [{ customerId, loginCustomerId: null }] }),
    fetchImpl: async (url, options) => {
      assert.match(String(url), new RegExp(`/customers/${customerId}/googleAds:search$`));
      assert.equal(options.headers.authorization, `Bearer ${accessToken}`);
      const body = JSON.parse(options.body);
      assert.match(body.query, /customer\.currency_code, customer\.time_zone/);
      return jsonResponse({ results: [{ customer: { id: customerId, currencyCode: 'GBP', timeZone: 'Europe/London' } }] });
    },
    now: fixedNow,
  });

  const identity = { userId, isOwner: true };
  const started = await service.start(identity, { storeId });
  const state = new URL(started.url).searchParams.get('state');
  assert.equal(repository.calls.createState.length, 1);
  assert.equal(repository.calls.createState[0].userId, userId);
  assert.equal(repository.calls.createState[0].storeId, storeId);
  assert.equal(repository.calls.createState[0].stateDigest.includes(Buffer.from(state)), false);
  await assert.rejects(service.start({ userId, isOwner: false }, { storeId }), /unavailable/);

  const completed = await service.complete({ state, code: 'mock-auth-code-123456789' });
  assert.equal(completed.status, 'account_selection_required');
  assert.deepEqual(completed.accounts, [{ customerId, loginCustomerId: null }]);
  assert.equal(JSON.stringify(completed).includes(refreshToken), false);
  assert.equal(JSON.stringify(completed).includes(accessToken), false);
  assert.equal(repository.calls.createPending[0].encryptedCredential.refreshToken, undefined);
  assert.equal(envelope.decrypt({
    connectionId: repository.calls.createPending[0].connectionId,
    storeId,
    ciphertext: repository.calls.createPending[0].encryptedCredential.ciphertext,
    encryptedDek: repository.calls.createPending[0].encryptedCredential.encryptedDek,
    storedAlgorithm: repository.calls.createPending[0].encryptedCredential.algorithm,
    storedKeyVersion: repository.calls.createPending[0].encryptedCredential.keyVersion,
  }), refreshToken);

  await assert.rejects(service.selectAccount(identity, {
    storeId,
    selectionHandle: completed.selectionHandle,
    customerId: otherCustomerId,
    loginCustomerId: null,
  }), /unavailable/);
  assert.equal(decrypts, 0, 'unlisted account IDs must be rejected before decrypting the credential');

  const connected = await service.selectAccount(identity, {
    storeId,
    selectionHandle: completed.selectionHandle,
    customerId,
    loginCustomerId: null,
  });
  assert.equal(connected.status, 'connected');
  assert.equal(connected.customerId, customerId);
  assert.equal(connected.currency, 'GBP');
  assert.equal(connected.timeZone, 'Europe/London');
  assert.equal(exchanges, 1);
  assert.equal(decrypts, 1);
  await assert.rejects(service.complete({ state, code: 'mock-auth-code-123456789' }), /unavailable/);
  assert.equal(exchanges, 1, 'OAuth state must be one use');
});

test('account discovery accepts only well-formed direct customer IDs and verifies the selected advertiser', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/customers:listAccessibleCustomers')) {
      return jsonResponse({ resourceNames: [`customers/${customerId}`] });
    }
    return jsonResponse({ results: [{ customer: { id: customerId, manager: false } }] });
  };
  const discovered = await listGoogleAdsDirectCustomerIds({ accessToken, fetchImpl });
  assert.deepEqual(discovered.customerIds, [customerId]);
  const verified = await verifyGoogleAdsDirectAdvertiser({
    accessToken,
    customerId,
    directlyAccessibleCustomerIds: discovered.customerIds,
    fetchImpl,
  });
  assert.deepEqual(verified, { customerId, relationship: 'direct' });
  assert.equal(calls.every(({ options }) => options.redirect === 'error'), true);
  assert.equal(calls.every(({ options }) => !new Headers(options.headers).has('developer-token')), true);
  await assert.rejects(listGoogleAdsDirectCustomerIds({
    accessToken,
    fetchImpl: async () => jsonResponse({ resourceNames: [`customers/${customerId}`, `customers/${customerId}`] }),
  }), /unavailable/);
  await assert.rejects(verifyGoogleAdsDirectAdvertiser({
    accessToken,
    customerId: otherCustomerId,
    directlyAccessibleCustomerIds: [customerId],
    fetchImpl,
  }), /unavailable/);
});

test('spend reader returns exact micros and missing-day coverage using bounded date-only queries', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options, body: JSON.parse(options.body) });
    if (calls.length === 1) return jsonResponse({ results: [{ customer: {
      id: customerId, currencyCode: 'GBP', timeZone: 'Europe/London',
    } }] });
    return jsonResponse({ results: [{
      customer: { id: customerId, currencyCode: 'GBP', timeZone: 'Europe/London' },
      segments: { date: '2026-11-20' },
      metrics: { costMicros: '1234567' },
    }] });
  };
  const report = await readGoogleAdsDailySpend({
    accessToken,
    customerId,
    from: '2026-11-20',
    to: '2026-11-21',
    fetchImpl,
  });
  assert.equal(report.currency, 'GBP');
  assert.equal(report.timeZone, 'Europe/London');
  assert.deepEqual(report.rows.map((row) => [row.date, row.spendMicros]), [['2026-11-20', '1234567']]);
  assert.deepEqual(report.missingDates, ['2026-11-21']);
  assert.equal(calls.length, 2);
  assert.equal(calls.every(({ options }) => options.redirect === 'error'), true);
  assert.equal(calls.every(({ options }) => !new Headers(options.headers).has('developer-token')), true);
  assert.match(calls[1].body.query, /metrics\.cost_micros/);
  assert.doesNotMatch(calls[1].body.query, /campaign|ad_group|keyword|conversion|click|impression/i);
  await assert.rejects(readGoogleAdsDailySpend({
    accessToken, customerId, from: '2026-01-01', to: '2026-04-04', fetchImpl,
  }), /unavailable/);
  await assert.rejects(readGoogleAdsDailySpend({
    accessToken, customerId, from: '2026-11-21', to: '2026-11-20', fetchImpl,
  }), /unavailable/);
});

test('safe connection status leaves unavailable collection timestamps explicitly unknown', async () => {
  const repository = {
    ...mockRepository(),
    async readStoreStatus() {
      return [{
        connectionId: '33333333-3333-4333-8333-333333333333',
        status: 'connected',
        oauthAppPublishingStatus: 'testing',
        reauthorizeBy: '2026-11-27T12:00:00.000Z',
        customerId,
        loginCustomerId: null,
        currency: 'GBP',
        timeZone: 'Europe/London',
        lastCollectedThrough: null,
        updatedAt: null,
      }];
    },
  };
  const service = createGoogleAdsOAuthService({
    protocol: {
      authorizationUrl() { return 'https://accounts.google.com/mock'; },
      async exchangeCode() { throw new Error('unused'); },
      async refreshAccessToken() { throw new Error('unused'); },
    },
    credentialEnvelope: { encrypt() { throw new Error('unused'); }, decrypt() { throw new Error('unused'); } },
    repository,
    authorizeOwner: async () => true,
    pkceKey: Buffer.alloc(32, 5),
    now: fixedNow,
  });
  const status = await service.readStatus({ userId, isOwner: true }, { storeId });
  assert.equal(status.connections[0].lastCollectedThrough, null);
  assert.equal(status.connections[0].updatedAt, null);
});
