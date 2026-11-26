import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleAdsCollectorRepository } from './google-ads-collector-repository.mjs';

const storeId = '11111111-1111-4111-8111-111111111111';
const connectionId = '22222222-2222-4222-8222-222222222222';
const customerId = '1234567890';
const runId = '33333333-3333-4333-8333-333333333333';
const envelope = { decrypt() { return 'mock-refresh-token-not-returned'; } };

function repoWith(handler) {
  const calls = [];
  return {
    calls,
    repository: createGoogleAdsCollectorRepository({
      credentialEnvelope: envelope,
      rpc: { async call(name, args) { calls.push({ name, args }); return handler(name, args); } },
    }),
  };
}

test('Google collector repository lists only validated store/connection/customer accounts', async () => {
  const { repository, calls } = repoWith((name) => name === 'google_ads_v1.worker_list_active_accounts'
    ? [{ store_id: storeId, connection_id: connectionId, customer_id: customerId,
      login_customer_id: null, currency: 'GBP', timezone_name: 'Europe/London' }]
    : [{ completed: true }]);
  const rows = await repository.listActiveAccounts('2026-11-21T12:00:00.000Z');
  assert.deepEqual(rows, [{ storeId, connectionId, customerId, loginCustomerId: null, currency: 'GBP', timeZone: 'Europe/London' }]);
  assert.equal(calls[0].name, 'google_ads_v1.worker_list_active_accounts');
  assert.deepEqual(calls[0].args, ['2026-11-21T12:00:00.000Z']);
});

test('Google collector repository returns only the matching encrypted credential envelope', async () => {
  const ciphertext = Buffer.from('encrypted-refresh-token');
  const encryptedDek = Buffer.from('encrypted-data-key');
  const { repository, calls } = repoWith((name) => name === 'google_ads_v1.worker_get_credential_envelope'
    ? [{ store_id: storeId, connection_id: connectionId, customer_id: customerId, login_customer_id: null,
      active: true, credential_expires_at: null, ciphertext: `\\x${ciphertext.toString('hex')}`,
      encrypted_dek: encryptedDek, key_version: 'v1', algorithm: 'AES-256-GCM' }]
    : []);
  const value = await repository.getCredentialEnvelope({ storeId, connectionId, customerId });
  assert.deepEqual(value.ciphertext, ciphertext);
  assert.deepEqual(value.encryptedDek, encryptedDek);
  assert.equal(Object.hasOwn(value, 'refreshToken'), false);
  assert.deepEqual(calls[0], { name: 'google_ads_v1.worker_get_credential_envelope', args: [storeId, connectionId, customerId] });
});

test('Google collector repository refuses mismatched account identity and never forwards arbitrary RPC names', async () => {
  const { repository, calls } = repoWith(() => [{ store_id: storeId, connection_id: connectionId,
    customer_id: '9999999999', login_customer_id: null, active: true, currency: 'GBP', timezone_name: 'Europe/London' }]);
  await assert.rejects(repository.getSelectedAccount({ storeId, connectionId, customerId }), /unavailable/);
  assert.equal(calls[0].name, 'google_ads_v1.worker_get_selected_account');
});

test('Google collector repository maps idempotent run claims and exact coverage payload', async () => {
  const { repository, calls } = repoWith((name) => {
    if (name === 'google_ads_v1.worker_begin_collection_run') return [{ run_id: runId, already_complete: false, already_running: false, claimed: true }];
    if (name === 'google_ads_v1.worker_complete_collection_run') return [{ completed: true }];
    return [{ completed: true }];
  });
  const claim = await repository.beginRun({
    idempotencyKey: 'google_accept:1234567890:2026-11-01:2026-11-01:r0',
    storeId, connectionId, customerId, requestedFrom: '2026-11-01', requestedTo: '2026-11-01',
    currency: 'GBP', timeZone: 'Europe/London', apiVersion: 'v26', startedAt: '2026-11-21T12:00:00.000Z',
  });
  assert.deepEqual(claim, { runId, alreadyComplete: false, alreadyRunning: false, claimed: true });
  await repository.completeRun({
    runId, idempotencyKey: 'google_accept:1234567890:2026-11-01:2026-11-01:r0', status: 'complete',
    requestedFrom: '2026-11-01', requestedTo: '2026-11-01', observedAt: '2026-11-21T12:00:00.000Z', pagesRead: 1,
    source: { provider: 'google_ads' }, coverage: [{ date: '2026-11-01', state: 'provider_row', spendMicros: '700' }],
  });
  assert.equal(calls[1].name, 'google_ads_v1.worker_complete_collection_run');
  assert.equal(JSON.parse(calls[1].args[7]).provider, 'google_ads');
  assert.deepEqual(JSON.parse(calls[1].args[8]), [{ date: '2026-11-01', coverageState: 'provider_row', spendMicros: '700' }]);
  await repository.failRun({ runId, safeFailure: 'provider_unavailable', finishedAt: '2026-11-21T12:00:00.000Z' });
  assert.equal(calls[2].name, 'google_ads_v1.worker_fail_collection_run');
});
