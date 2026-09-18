import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCashControlReadiness } from './xeroMerchantApi.ts';

const id = '11111111-1111-4111-8111-111111111111';
const ready = { storeId: id, state: 'ready', asOf: '2026-09-18T18:00:00.000Z' };

test('cash readiness accepts a bounded, value-free same-store status shape', () => {
  const parsed = parseCashControlReadiness(ready);
  assert.deepEqual(parsed, ready);
  assert.equal(Object.isFrozen(parsed), true);
});

test('cash readiness rejects amounts, cross-store retention and invalid ready evidence', () => {
  for (const invalid of [
    { ...ready, balance: 10320 },
    { ...ready, state: 'ready', asOf: null },
    { ...ready, retainedStoreId: 'not-a-store-id' },
    { ...ready, detail: 'x'.repeat(501) },
    { ...ready, state: 'unknown' },
  ]) assert.equal(parseCashControlReadiness(invalid), null);
});
