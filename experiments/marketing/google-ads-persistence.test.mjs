import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleAdsApiRepository } from './google-ads-repository.mjs';
import { createGoogleAdsSpendReportRepository } from './google-ads-report-repository.mjs';

const userId = '11111111-1111-4111-8111-111111111111';
const storeId = '22222222-2222-4222-8222-222222222222';
const connectionId = '33333333-3333-4333-8333-333333333333';
const customerId = '1234567890';
const loginCustomerId = '1234567891';
const scope = 'https://www.googleapis.com/auth/adwords';

test('OAuth-state RPC persists only the digest and carries exact user/store binding', async () => {
  const calls = [];
  const repository = createGoogleAdsApiRepository({
    rpc: { async call(name, args) { calls.push({ name, args }); return [{ created: true }]; } },
  });
  const digest = Buffer.alloc(32, 9);
  await repository.createOAuthState({
    stateDigest: digest,
    userId,
    storeId,
    expiresAt: '2026-11-21T12:10:00.000Z',
  });

  assert.deepEqual(calls, [{
    name: 'google_ads_v1.worker_create_oauth_state',
    args: [`\\x${digest.toString('hex')}`, userId, storeId, '2026-11-21T12:10:00.000Z'],
  }]);
  assert.equal(JSON.stringify(calls).includes(digest.toString('base64url')), false);
});

test('pending-connection RPC stores an encrypted envelope and exact account pair, never a plaintext refresh token', async () => {
  const calls = [];
  const repository = createGoogleAdsApiRepository({
    rpc: { async call(name, args) { calls.push({ name, args }); return [{ created: true }]; } },
  });
  const refreshToken = 'mock-refresh-token-must-not-reach-rpc';
  const ciphertext = Buffer.from([1, 2, 3, 4, 5]);
  const encryptedDek = Buffer.from([6, 7, 8, 9]);
  const selectionHandleDigest = Buffer.alloc(32, 3);
  const result = await repository.createPendingConnection({
    connectionId,
    userId,
    storeId,
    grantedScopes: [scope],
    oauthAppPublishingStatus: 'testing',
    encryptedCredential: {
      ciphertext,
      encryptedDek,
      algorithm: 'AES-256-GCM',
      keyVersion: 'google-ads-staging-v1',
      refreshToken,
    },
    selectionHandleDigest,
    selectionExpiresAt: '2026-11-21T12:15:00.000Z',
    accountSelections: [{ customerId, loginCustomerId }],
  });

  assert.deepEqual(result, { created: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'google_ads_v1.worker_create_pending_connection');
  assert.equal(calls[0].args[0], connectionId);
  assert.equal(calls[0].args[1], userId);
  assert.equal(calls[0].args[2], storeId);
  assert.deepEqual(calls[0].args[3], [scope]);
  assert.equal(calls[0].args[5], `\\x${ciphertext.toString('hex')}`);
  assert.equal(calls[0].args[6], `\\x${encryptedDek.toString('hex')}`);
  assert.equal(calls[0].args[9], `\\x${selectionHandleDigest.toString('hex')}`);
  assert.equal(calls[0].args[11], JSON.stringify([{ customerId, loginCustomerId }]));
  assert.equal(JSON.stringify(calls).includes(refreshToken), false);
});

test('pending credential response maps encrypted bytea and exact account selection without exposing errors', async () => {
  const cipher = Buffer.from([1, 2, 3, 4]);
  const dek = Buffer.from([5, 6, 7, 8]);
  let count = 0;
  const repository = createGoogleAdsApiRepository({
    rpc: {
      async call(name, args) {
        assert.equal(name, 'google_ads_v1.worker_read_pending_credential');
        assert.deepEqual(args.slice(1, 3), [userId, storeId]);
        if (count++ > 0) throw new Error('sensitive token/password must not escape');
        return [{
          connection_id: connectionId,
          oauth_app_publishing_status: 'testing',
          reauthorize_by: new Date('2026-11-27T12:00:00.000Z'),
          credential_expires_at: new Date('2026-11-28T12:00:00.000Z'),
          ciphertext: `\\x${cipher.toString('hex')}`,
          encrypted_dek: `\\x${dek.toString('hex')}`,
          key_version: 'google-ads-staging-v1',
          algorithm: 'AES-256-GCM',
          credential_version: 1,
          selection_expires_at: new Date('2026-11-21T12:15:00.000Z'),
          account_selections: [{ customerId, loginCustomerId }],
        }];
      },
    },
  });
  const input = {
    selectionHandleDigest: Buffer.alloc(32, 4),
    userId,
    storeId,
    now: '2026-11-21T12:00:00.000Z',
  };
  const result = await repository.readPendingCredential(input);
  assert.deepEqual(result.ciphertext, cipher);
  assert.deepEqual(result.encryptedDek, dek);
  assert.deepEqual(result.accountSelections, [{ customerId, loginCustomerId }]);
  await assert.rejects(repository.readPendingCredential(input), (error) => {
    assert.equal(error.message, 'Google Ads persistence unavailable');
    assert.equal(error.message.includes('sensitive token'), false);
    return true;
  });
});

test('invalid store and date bounds are rejected before the report RPC', async () => {
  const calls = [];
  const repository = createGoogleAdsSpendReportRepository({
    rpc: { async call(name, args) { calls.push({ name, args }); return []; } },
    now: () => new Date('2026-11-21T12:00:00.000Z'),
  });
  await assert.rejects(repository.readSpend({ userId }, {
    storeId: 'not-a-store', from: '2026-11-20', to: '2026-11-20',
  }), /unavailable/);
  await assert.rejects(repository.readSpend({ userId }, {
    storeId, from: '2026-11-21', to: '2026-11-20',
  }), /unavailable/);
  assert.equal(calls.length, 0);
});
