import test from 'node:test';
import assert from 'node:assert/strict';
import { cfoEvidenceFromReporting, cfoEvidenceView, type CfoEvidenceScope } from './cfoEvidence.ts';

const scope: CfoEvidenceScope = { storeId: 'store-a', currency: 'GBP', from: '2026-08-01', to: '2026-08-31' };

test('reporting adapter distinguishes checking from supported evidence without inventing a result', () => {
  const loading = cfoEvidenceFromReporting({ scope, loading: true, hasSupportedEvidence: false });
  assert.equal(loading.state, 'unavailable');
  assert.match(cfoEvidenceView(loading).message, /still being checked/);
  assert.equal(cfoEvidenceView(loading).showFigures, false);

  const ready = cfoEvidenceFromReporting({ scope, loading: false, hasSupportedEvidence: true });
  assert.equal(ready.state, 'supported');
  assert.equal(cfoEvidenceView(ready).showFigures, true);
});

test('source invalidation and access denial override an otherwise successful reporting result', () => {
  for (const state of ['invalidated', 'denied'] as const) {
    const result = cfoEvidenceFromReporting({ scope, loading: false, hasSupportedEvidence: true, freshness: { state } });
    assert.equal(result.state, state);
    assert.equal(cfoEvidenceView(result).showFigures, false);
  }
});

test('a stale result can only display when its retained scope exactly matches', () => {
  const retained = cfoEvidenceFromReporting({ scope, loading: false, hasSupportedEvidence: true, freshness: { state: 'stale', retainedScope: scope, dataThrough: '2026-08-31' } });
  assert.equal(cfoEvidenceView(retained).isRetained, true);
  assert.equal(cfoEvidenceView(retained).showFigures, true);

  const wrongStore = cfoEvidenceFromReporting({ scope, loading: false, hasSupportedEvidence: true, freshness: { state: 'stale', retainedScope: { ...scope, storeId: 'store-b' } } });
  const view = cfoEvidenceView(wrongStore);
  assert.equal(view.state, 'unavailable');
  assert.equal(view.showFigures, false);
});
