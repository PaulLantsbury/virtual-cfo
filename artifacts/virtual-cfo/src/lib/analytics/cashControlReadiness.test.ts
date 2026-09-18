import test from 'node:test';
import assert from 'node:assert/strict';
import { cashControlReadinessView } from './cashControlReadiness.ts';

test('Cash Control never treats an incomplete mapping or missing evidence as a zero cash balance', () => {
  for (const state of ['not_connected', 'mapping_incomplete', 'evidence_incomplete', 'review_required', 'denied'] as const) {
    const view = cashControlReadinessView({ state, storeId: 'store-a' });
    assert.equal(view.canShowActualCash, false);
    assert.match(view.message, /Unsettled processor funds stay separate/);
  }
});

test('a stale cash snapshot can only be retained for the same store and is never current', () => {
  const sameStore = cashControlReadinessView({ state: 'stale', storeId: 'store-a', retainedStoreId: 'store-a', asOf: '2026-09-18T09:00:00Z' });
  assert.equal(sameStore.canShowActualCash, true);
  assert.equal(sameStore.isRetained, true);
  assert.match(sameStore.message, /must not be presented as current/);

  const otherStore = cashControlReadinessView({ state: 'stale', storeId: 'store-a', retainedStoreId: 'store-b' });
  assert.equal(otherStore.canShowActualCash, false);
  assert.match(otherStore.message, /another store/);
});

test('ready state describes methodology without deriving a cash figure', () => {
  const view = cashControlReadinessView({ state: 'ready', storeId: 'store-a' });
  assert.equal(view.canShowActualCash, true);
  assert.match(view.message, /dated, unrestricted balances/);
  assert.doesNotMatch(view.message, /£/);
});
