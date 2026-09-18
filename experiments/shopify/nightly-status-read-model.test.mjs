import test from 'node:test';
import assert from 'node:assert/strict';
import { projectNightlyStatus } from './nightly-status-read-model.mjs';

const now = '2026-09-19T01:20:00.000Z'; // 02:20 London BST, after the 15 minute window.
const input = overrides => ({ now, timezone: 'Europe/London', historyState: 'available', claim: null, latestAttempt: null, ...overrides });
const scope = { from: '2026-08-19', to: '2026-09-18' };
const claim = (state = 'completed') => ({ localDate: '2026-09-19', state, scheduledAt: '2026-09-19T01:00:00.000Z', ...scope });
const completed = { state: 'completed', startedAt: '2026-09-19T01:00:03.000Z', finishedAt: '2026-09-19T01:01:00.000Z', ...scope, resultCode: 'replay' };

test('projects the agreed 31 completed London calendar-date scope and a missing run without creating a catch-up', () => {
  const result = projectNightlyStatus(input());
  assert.deepEqual(result.reportingScope, { ...scope, timezone: 'Europe/London', calendarDays: 31 });
  assert.equal(result.state, 'missing_run_requires_review');
  assert.equal(result.retryPermitted, false);
  assert.equal(result.coverageCertified, false);
  assert.ok(Object.isFrozen(result));
});

test('distinguishes not-due, open schedule and completed-but-review-only states', () => {
  assert.equal(projectNightlyStatus(input({ now: '2026-09-19T00:59:59.000Z' })).state, 'scheduled_not_due');
  assert.equal(projectNightlyStatus(input({ now: '2026-09-19T01:05:00.000Z' })).state, 'scheduled_window_open');
  const result = projectNightlyStatus(input({ claim: claim(), latestAttempt: completed }));
  assert.equal(result.state, 'completed_requires_review');
  assert.equal(result.resultCode, 'replay');
  assert.equal(result.financeImported, false);
});

test('unavailable, unresolved and inconsistent durable evidence fail safe', () => {
  assert.equal(projectNightlyStatus(input({ historyState: 'unavailable' })).state, 'history_unavailable');
  assert.equal(projectNightlyStatus(input({ claim: claim('unconfirmed') })).state, 'run_unconfirmed');
  assert.equal(projectNightlyStatus(input({ latestAttempt: { ...completed, state: 'running', finishedAt: null, resultCode: null } })).state, 'run_unconfirmed');
  assert.equal(projectNightlyStatus(input({ claim: { ...claim(), to: '2026-09-17' } })).state, 'claim_scope_mismatch');
  assert.equal(projectNightlyStatus(input({ latestAttempt: { ...completed, to: '2026-09-17' } })).state, 'attempt_scope_mismatch');
});

test('rejects omitted, malformed or untrustworthy inputs rather than presenting a reassuring state', () => {
  assert.throws(() => projectNightlyStatus({ now, timezone: 'Europe/London', historyState: 'available', claim: null }));
  assert.throws(() => projectNightlyStatus(input({ claim: { ...claim(), scheduledAt: '2026-09-19T02:00:00.000Z' } })));
  assert.throws(() => projectNightlyStatus(input({ claim: null, latestAttempt: { ...completed, resultCode: null } })));
  assert.throws(() => projectNightlyStatus(input({ historyState: 'unavailable', claim: claim() })));
});
