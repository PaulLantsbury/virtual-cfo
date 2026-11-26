import test from 'node:test';
import assert from 'node:assert/strict';
import { createMetaOAuthProtocol } from './meta-oauth-protocol.mjs';
import { createMetaOAuthService } from './meta-oauth-service.mjs';
import { createMetaCredentialEnvelope } from './meta-credential-envelope.mjs';
import { createMetaSpendCollector } from './meta-spend-collector.mjs';

const appId = '123456789012345';
const appSecret = 'mock-meta-app-secret-only-for-this-test';
const redirectUri = 'https://staging.example.test/api/meta-ads/callback';
const shortToken = 'mock-short-access-token-value';
const longToken = 'mock-long-lived-access-token-value';
const userId = '11111111-1111-4111-8111-111111111111';
const storeId = '22222222-2222-4222-8222-222222222222';
const connectionId = '33333333-3333-4333-8333-333333333333';
const accountId = '12345678901';
const fixedNow = () => new Date('2026-11-21T12:00:00.000Z');

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('Meta OAuth requests ads_read only and rejects additional granted permissions', async () => {
  const protocol = createMetaOAuthProtocol({
    appId,
    appSecret,
    apiVersion: 'v25.0',
    redirectUri,
  }, async () => jsonResponse({ data: [
    { permission: 'ads_read', status: 'granted' },
    { permission: 'public_profile', status: 'granted' },
  ] }));

  const state = 's'.repeat(43);
  const authorization = new URL(protocol.authorizationUrl(state));
  assert.equal(authorization.origin, 'https://www.facebook.com');
  assert.equal(authorization.searchParams.get('scope'), 'ads_read');
  assert.equal(authorization.searchParams.get('state'), state);
  assert.equal(authorization.searchParams.get('response_type'), 'code');
  assert.deepEqual(await protocol.assertAdsReadGranted(longToken), {
    adsReadGranted: true,
    grantedScopes: ['ads_read', 'public_profile'],
  });

  const broadened = createMetaOAuthProtocol({
    appId,
    appSecret,
    apiVersion: 'v25.0',
    redirectUri,
  }, async () => jsonResponse({ data: [
    { permission: 'ads_read', status: 'granted' },
    { permission: 'email', status: 'granted' },
  ] }));
  await assert.rejects(broadened.assertAdsReadGranted(longToken), (error) =>
    error.message === 'Meta Ads connection unavailable' && !error.message.includes(longToken));
});

test('Meta OAuth exchange errors discard poisoned upstream URL/body details and forbid redirects', async () => {
  const code = 'synthetic-oauth-code';
  for (const responseMode of ['throw', 'http-error', 'invalid-json']) {
    let calls = 0;
    const protocol = createMetaOAuthProtocol({ appId, appSecret, apiVersion: 'v25.0', redirectUri }, async (url, options) => {
      calls += 1;
      assert.equal(url.origin, 'https://graph.facebook.com');
      assert.equal(url.pathname, '/v25.0/oauth/access_token');
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      // Meta's documented GET exchange has sensitive query values. This test
      // proves error projection only, not hosting or outbound trace redaction.
      assert.equal(url.searchParams.get('client_secret'), appSecret);
      if (responseMode === 'throw') throw new Error(`${url} ${shortToken}`);
      if (responseMode === 'http-error') return jsonResponse({ error: `${code} ${appSecret} ${shortToken}` }, 400);
      return new Response(`${code} ${appSecret} ${shortToken}`, { status: 200 });
    });
    for (const invoke of [() => protocol.exchangeCode(code), () => protocol.exchangeForLongLivedToken(shortToken)]) {
      await assert.rejects(invoke(), (error) => {
        assert.equal(error.message, 'Meta Ads connection unavailable');
        assert.equal(error.cause, undefined);
        assert.ok(!String(error.stack).includes(appSecret));
        assert.ok(!String(error.stack).includes(shortToken));
        assert.ok(!String(error.stack).includes(code));
        return true;
      });
    }
    assert.equal(calls, 2, 'failed exchanges are never retried');
  }
});

test('Meta OAuth response reader cancels an oversized response stream at its byte cap', async () => {
  let cancelled = false;
  const protocol = createMetaOAuthProtocol({
    appId,
    appSecret,
    apiVersion: 'v25.0',
    redirectUri,
  }, async () => new Response(new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array(64_001));
    },
    cancel() { cancelled = true; },
  }), { status: 200 }));

  await assert.rejects(protocol.assertAdsReadGranted(longToken), /Meta Ads connection unavailable/);
  assert.equal(cancelled, true);
});

function oauthRepository() {
  const states = new Map();
  const pending = new Map();
  const calls = { createdState: [], consumedState: [], createdPending: [], cancelled: [], activated: [] };
  return {
    calls,
    hasPending(key) { return pending.has(key); },
    expirePending(key) { const item = pending.get(key); if (item) item.expiresAt = '2026-11-21T11:59:00.000Z'; },
    async createOAuthState(input) {
      calls.createdState.push(input);
      states.set(input.stateDigest.toString('hex'), { userId: input.userId, storeId: input.storeId });
    },
    async consumeOAuthState({ stateDigest }) {
      const key = stateDigest.toString('hex');
      calls.consumedState.push(key);
      const value = states.get(key) ?? null;
      states.delete(key);
      return value;
    },
    async createPendingConnection(input) {
      calls.createdPending.push(input);
      pending.set(input.selectionHandleDigest.toString('hex'), {
        userId: input.userId,
        storeId: input.storeId,
        connectionId: input.connectionId,
        accounts: input.accounts,
        expiresAt: input.selectionExpiresAt,
        envelope: input.encryptedCredential,
      });
      return { created: true };
    },
    async readPendingSelection({ selectionHandleDigest, userId: requestingUser, storeId: requestingStore }) {
      const item = pending.get(selectionHandleDigest.toString('hex'));
      if (item?.userId !== requestingUser || item?.storeId !== requestingStore) return null;
      return { accounts: item.accounts, expiresAt: item.expiresAt };
    },
    async cancelPendingSelection(input) {
      calls.cancelled.push(input);
      const key = input.selectionHandleDigest.toString('hex');
      const item = pending.get(key);
      if (item?.userId !== input.userId || item?.storeId !== input.storeId
        || Date.parse(item.expiresAt) <= Date.parse(input.now)) return { cancelled: false };
      pending.delete(key);
      return { cancelled: true };
    },
    async activateSelectedAccount(input) {
      calls.activated.push(input);
      const key = input.selectionHandleDigest.toString('hex');
      const item = pending.get(key);
      if (item?.userId !== input.userId || item?.storeId !== input.storeId
        || Date.parse(item.expiresAt) <= Date.parse(input.now)
        || !item.accounts.some((candidate) => candidate.accountId === input.accountId)) return null;
      pending.delete(key);
      return {
        accountId: input.accountId,
        currency: 'GBP',
        timeZone: 'Europe/London',
        connectedAt: input.now,
      };
    },
    async disconnectConnection() { return { disconnected: true }; },
    async readStoreStatus() { return []; },
  };
}

test('Meta OAuth state and account selection are one-use, owner/store-bound, and never return token material', async () => {
  const repository = oauthRepository();
  const envelope = createMetaCredentialEnvelope(Buffer.alloc(32, 9));
  let exchanges = 0;
  let grantsChecked = 0;
  const protocol = {
    authorizationUrl(state) { return `https://www.facebook.com/mock?state=${state}`; },
    async exchangeCode(code) {
      exchanges += 1;
      assert.equal(code, 'mock-meta-auth-code');
      return { accessToken: shortToken, expiresInSeconds: 3600 };
    },
    async exchangeForLongLivedToken(token) {
      assert.equal(token, shortToken);
      return {
        accessToken: longToken,
        expiresInSeconds: 60 * 86400,
        expiresAt: '2027-01-20T12:00:00.000Z',
      };
    },
    async assertAdsReadGranted(token) {
      assert.ok([shortToken, longToken].includes(token));
      grantsChecked += 1;
      return { adsReadGranted: true, grantedScopes: ['ads_read'] };
    },
  };
  const service = createMetaOAuthService({
    protocol,
    credentialEnvelope: envelope,
    repository,
    authorizeOwner: async ({ userId: candidateUser, storeId: candidateStore }) =>
      candidateUser === userId && candidateStore === storeId,
    apiVersion: 'v25.0',
    fetchImpl: async () => jsonResponse({ data: [{
      id: `act_${accountId}`,
      account_id: accountId,
      currency: 'GBP',
      timezone_name: 'Europe/London',
    }] }),
    now: fixedNow,
  });
  const identity = { userId, isOwner: true };

  await assert.rejects(service.start({ userId, isOwner: false }, { storeId }), /unavailable/);
  const started = await service.start(identity, { storeId });
  const state = new URL(started.url).searchParams.get('state');
  assert.equal(repository.calls.createdState.length, 1);
  assert.equal(repository.calls.createdState[0].userId, userId);
  assert.equal(repository.calls.createdState[0].storeId, storeId);
  assert.equal(repository.calls.createdState[0].stateDigest.includes(Buffer.from(state)), false);

  const completed = await service.complete({ state, code: 'mock-meta-auth-code' });
  assert.equal(completed.status, 'account_selection_required');
  assert.deepEqual(completed.accounts, [{ accountId, currency: 'GBP', timeZone: 'Europe/London' }]);
  assert.equal(grantsChecked, 2);
  assert.equal(JSON.stringify(completed).includes(shortToken), false);
  assert.equal(JSON.stringify(completed).includes(longToken), false);
  assert.equal(JSON.stringify(completed).includes(appSecret), false);
  assert.deepEqual(repository.calls.createdPending[0].grantedScope, ['ads_read']);
  const saved = repository.calls.createdPending[0];
  assert.equal(saved.encryptedCredential.accessToken, undefined);
  assert.equal(envelope.decrypt({
    connectionId: saved.connectionId,
    storeId,
    ciphertext: saved.encryptedCredential.ciphertext,
    encryptedDek: saved.encryptedCredential.encryptedDek,
    storedKeyVersion: saved.encryptedCredential.keyVersion,
    storedAlgorithm: saved.encryptedCredential.algorithm,
  }), longToken);

  const cancelledStart = await service.start(identity, { storeId });
  const cancelledState = new URL(cancelledStart.url).searchParams.get('state');
  const cancelledSelection = await service.complete({ state: cancelledState, code: 'mock-meta-auth-code' });
  const cancelledDigest = repository.calls.createdPending.at(-1).selectionHandleDigest.toString('hex');
  const cancelled = await service.cancelPendingSelection(identity, {
    storeId,
    selectionHandle: cancelledSelection.selectionHandle,
  });
  assert.deepEqual(cancelled, { status: 'cancelled' });
  assert.equal(repository.calls.cancelled.at(-1).userId, userId);
  assert.equal(repository.calls.cancelled.at(-1).storeId, storeId);
  assert.equal(repository.hasPending(cancelledDigest), false, 'cancellation removes the pending encrypted envelope record');
  await assert.rejects(service.cancelPendingSelection(identity, {
    storeId: '44444444-4444-4444-8444-444444444444',
    selectionHandle: cancelledSelection.selectionHandle,
  }), /unavailable/);
  await assert.rejects(service.cancelPendingSelection({ userId, isOwner: false }, {
    storeId,
    selectionHandle: cancelledSelection.selectionHandle,
  }), /unavailable/);
  await assert.rejects(service.cancelPendingSelection(identity, {
    storeId,
    selectionHandle: cancelledSelection.selectionHandle,
  }), /unavailable/, 'a cancelled selection handle cannot be consumed twice');

  const expiredStart = await service.start(identity, { storeId });
  const expiredState = new URL(expiredStart.url).searchParams.get('state');
  const expiredSelection = await service.complete({ state: expiredState, code: 'mock-meta-auth-code' });
  const expiredDigest = repository.calls.createdPending.at(-1).selectionHandleDigest.toString('hex');
  repository.expirePending(expiredDigest);
  await assert.rejects(service.cancelPendingSelection(identity, {
    storeId,
    selectionHandle: expiredSelection.selectionHandle,
  }), /unavailable/);
  assert.equal(repository.hasPending(expiredDigest), true, 'expired pending records remain for expiry cleanup');

  await assert.rejects(service.selectAccount(identity, {
    storeId: '44444444-4444-4444-8444-444444444444',
    selectionHandle: completed.selectionHandle,
    accountId,
  }), /unavailable/);
  const selected = await service.selectAccount(identity, {
    storeId,
    selectionHandle: completed.selectionHandle,
    accountId,
  });
  assert.equal(selected.status, 'connected');
  assert.equal(selected.accountId, accountId);
  assert.equal(selected.currency, 'GBP');
  await assert.rejects(service.complete({ state, code: 'mock-meta-auth-code' }), /unavailable/);
  assert.equal(exchanges, 3, 'each valid state is consumed once before exchanging the authorization code');
});

test('Meta collector clips reads to completed account-local days and refuses a mismatched selected account', async () => {
  const calls = { begin: [], read: [], complete: [], fail: [] };
  const collector = createMetaSpendCollector({
    credentialProvider: {
      async getSelectedAccount(input) {
        return {
          provider: 'meta_ads',
          accountId,
          currency: 'GBP',
          timeZone: 'Europe/London',
          apiVersion: 'v25.0',
          input,
        };
      },
      async getAccessToken() {
        return { accessToken: longToken, tokenExpiresAt: '2027-01-20T12:00:00.000Z' };
      },
    },
    repository: {
      async beginRun(input) { calls.begin.push(input); return { runId: connectionId, claimed: true }; },
      async completeRun(input) { calls.complete.push(input); },
      async failRun(input) { calls.fail.push(input); },
    },
    reader: async (input) => {
      calls.read.push(input);
      return {
        provider: 'meta_ads',
        accountId,
        currency: 'GBP',
        timeZone: 'Europe/London',
        requestedFrom: input.from,
        requestedTo: input.to,
        pagesRead: 1,
        rows: [{ provider: 'meta_ads', accountId, date: input.from, currency: 'GBP', spendMinor: '1234' }],
        missingDates: [],
        retrievedAt: '2026-11-21T12:00:00.000Z',
      };
    },
    now: fixedNow,
  });

  const input = {
    storeId,
    connectionId,
    accountId,
    from: '2026-11-20',
    to: '2026-11-21',
    idempotencyKey: `meta_accept:${accountId}:2026-11-20:2026-11-21:r0`,
  };
  const result = await collector.collect(input);
  assert.equal(result.status, 'complete');
  assert.equal(result.to, '2026-11-20');
  assert.equal(calls.read[0].to, '2026-11-20');
  assert.equal(calls.complete.length, 1);
  assert.equal(JSON.stringify(calls.complete[0]).includes(longToken), false);

  const mismatch = createMetaSpendCollector({
    credentialProvider: {
      async getSelectedAccount() {
        return { provider: 'meta_ads', accountId: '10987654321', currency: 'GBP', timeZone: 'Europe/London', apiVersion: 'v25.0' };
      },
      async getAccessToken() { throw new Error('must not be called'); },
    },
    repository: {
      async beginRun() { throw new Error('must not begin a run'); },
      async completeRun() {},
      async failRun() {},
    },
    reader: async () => { throw new Error('must not read provider'); },
    now: fixedNow,
  });
  await assert.rejects(mismatch.collect(input), /Meta Ads collection unavailable/);
});
