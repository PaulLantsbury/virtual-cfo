import test from 'node:test';
import assert from 'node:assert/strict';
import { createMetaAdsApiRepository, createMetaAdsCollectorRepository } from './meta-ads-repository.mjs';

const userId = '11111111-1111-4111-8111-111111111111';
const storeId = '22222222-2222-4222-8222-222222222222';
const digest = Buffer.alloc(32, 0xab);
const input = Object.freeze({
  selectionHandleDigest: digest,
  userId,
  storeId,
  now: '2026-11-21T12:00:00.000Z',
});

function repoWith(result) {
  const calls = [];
  const options = {
    rpc: { async call(name, args) { calls.push([name, args]); return result; } },
    credentialEnvelope: { decrypt() { throw new Error('not used'); } },
    apiVersion: 'v27.0',
  };
  return { api: createMetaAdsApiRepository(options), collector: createMetaAdsCollectorRepository(options), calls };
}

test('Meta API repository exposes fixed owner-bound one-use pending selection cancellation RPC', async () => {
  const { api, collector, calls } = repoWith([{ completed: true }]);
  assert.deepEqual(await api.cancelPendingSelection(input), { cancelled: true });
  assert.deepEqual(calls, [[
    'meta_ads_v1.worker_cancel_pending_selection',
    [`\\x${digest.toString('hex')}`, userId, storeId, input.now],
  ]]);
  assert.equal(typeof collector.repository.cancelPendingSelection, 'undefined', 'collector role has no pending OAuth cancellation surface');
});

test('Meta cancellation repository returns safe false for expired or mismatched selections', async () => {
  const { api } = repoWith([{ completed: false }]);
  assert.deepEqual(await api.cancelPendingSelection(input), { cancelled: false });
});

test('Meta cancellation repository fails closed on malformed RPC results and invalid input', async () => {
  const malformed = repoWith([{ completed: 'true' }]).api;
  await assert.rejects(malformed.cancelPendingSelection(input), /persistence unavailable/);
  const absentRow = repoWith([]).api;
  await assert.rejects(absentRow.cancelPendingSelection(input), /persistence unavailable/);
  const invalid = repoWith([{ completed: true }]).api;
  await assert.rejects(invalid.cancelPendingSelection({ ...input, selectionHandleDigest: Buffer.alloc(31) }), /persistence unavailable/);
});
