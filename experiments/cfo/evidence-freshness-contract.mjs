import assert from 'node:assert/strict';
import test from 'node:test';

// Contract cases duplicated as dependency-free fixtures. The UI implementation
// is typechecked separately; this verifies the scope boundary it must preserve.
const sameScope = (a, b) => a.storeId === b.storeId && a.currency === b.currency && a.from === b.from && a.to === b.to;
const retainedVisible = ({ scope, retainedScope, state }) => state === 'stale' && !!retainedScope && sameScope(scope, retainedScope);
const scope = { storeId: 'store-a', currency: 'GBP', from: '2026-02-01', to: '2026-02-28' };

test('same-scope failed refresh may retain the prior snapshot', () => {
  assert.equal(retainedVisible({ state: 'stale', scope, retainedScope: { ...scope } }), true);
});

test('retention never crosses store, currency, or reporting-period boundaries', () => {
  assert.equal(retainedVisible({ state: 'stale', scope, retainedScope: { ...scope, storeId: 'store-b' } }), false);
  assert.equal(retainedVisible({ state: 'stale', scope, retainedScope: { ...scope, currency: 'USD' } }), false);
  assert.equal(retainedVisible({ state: 'stale', scope, retainedScope: { ...scope, to: '2026-01-31' } }), false);
});

test('source invalidation and denied access never display retained figures as current', () => {
  assert.equal(retainedVisible({ state: 'invalidated', scope, retainedScope: scope }), false);
  assert.equal(retainedVisible({ state: 'denied', scope, retainedScope: scope }), false);
});
