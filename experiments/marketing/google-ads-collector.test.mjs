import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleAdsSpendCollector } from './google-ads-collector.mjs';

const storeId = '11111111-1111-4111-8111-111111111111';
const connectionId = '22222222-2222-4222-8222-222222222222';
const customerId = '1234567890';
const runId = '33333333-3333-4333-8333-333333333333';
const now = () => new Date('2026-11-21T16:00:00.000Z');
const account = Object.freeze({ storeId, connectionId, customerId, loginCustomerId: null, active: true, currency: 'GBP', timeZone: 'Europe/London' });
const completed = Object.freeze({ accessToken: 'mock_access_token_123456', expiresAt: '2026-11-21T17:00:00.000Z' });
const base = { storeId, connectionId, customerId, from: '2026-11-01', to: '2026-11-02', idempotencyKey: 'google_accept:fixed:range:r0' };

function fixture(readerResult) {
  const calls = [];
  const collector = createGoogleAdsSpendCollector({
    credentialProvider: {
      async getSelectedAccount(input) { calls.push(['account', input]); return account; },
      async getAccessToken(input) { calls.push(['token', input]); return completed; },
    },
    repository: {
      async beginRun(input) { calls.push(['begin', input]); return { runId, claimed: true, alreadyComplete: false, alreadyRunning: false }; },
      async completeRun(input) { calls.push(['complete', input]); },
      async failRun(input) { calls.push(['fail', input]); },
    },
    reader: async (input) => { calls.push(['reader', input]); return readerResult; },
    now,
  });
  return { collector, calls };
}

const readerResult = Object.freeze({
  provider: 'google_ads', customerId, loginCustomerId: null, currency: 'GBP', timeZone: 'Europe/London',
  requestedFrom: base.from, requestedTo: base.to, pagesRead: 1, retrievedAt: '2026-11-21T15:00:00.000Z',
  rows: [
    { provider: 'google_ads', customerId, loginCustomerId: null, date: base.from, currency: 'GBP', timeZone: 'Europe/London', spendMicros: '1234567' },
    { provider: 'google_ads', customerId, loginCustomerId: null, date: base.to, currency: 'GBP', timeZone: 'Europe/London', spendMicros: '0' },
  ],
  missingDates: [],
});

test('Google collector bounds the requested window and clips to the last completed account-local day', async () => {
  const { collector, calls } = fixture(readerResult);
  const result = await collector.collect(base);
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.coverage.map(({ date, state, spendMicros }) => ({ date, state, spendMicros })), [
    { date: base.from, state: 'provider_row', spendMicros: '1234567' },
    { date: base.to, state: 'provider_row', spendMicros: '0' },
  ]);
  assert.equal(calls.find(([name]) => name === 'begin')[1].requestedTo, base.to);
  assert.equal(calls.find(([name]) => name === 'reader')[1].to, base.to);
  assert.deepEqual(calls.find(([name]) => name === 'complete')[1].source, {
    provider: 'google_ads', customerId, loginCustomerId: null, storeId, connectionId,
    currency: 'GBP', timeZone: 'Europe/London', apiVersion: 'v26',
  });
});

test('Google collector stores absent days as null/no_row and never invents zero spend', async () => {
  const { collector, calls } = fixture({ ...readerResult,
    rows: [readerResult.rows[0]], missingDates: [base.to],
  });
  const result = await collector.collect(base);
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.coverage[1], { date: base.to, state: 'no_row', spendMicros: null });
  assert.equal(calls.find(([name]) => name === 'complete')[1].status, 'partial');
});

test('Google collector rejects windows longer than 14 days before run creation', async () => {
  const { collector, calls } = fixture(readerResult);
  await assert.rejects(collector.collect({ ...base, from: '2026-10-19', to: '2026-11-02' }), /unavailable/);
  assert.equal(calls.some(([name]) => name === 'begin'), false);
});

test('Google collector refuses today and future dates in the account timezone', async () => {
  const { collector, calls } = fixture(readerResult);
  await assert.rejects(collector.collect({ ...base, from: '2026-11-21', to: '2026-11-21' }), /unavailable/);
  assert.equal(calls.some(([name]) => name === 'begin'), false);
});

test('Google collector rejects a selected-account or currency/timezone mismatch', async () => {
  let accountResult = { ...account, customerId: '9999999999' };
  const calls = [];
  const collector = createGoogleAdsSpendCollector({
    credentialProvider: {
      async getSelectedAccount() { return accountResult; },
      async getAccessToken() { return completed; },
    },
    repository: {
      async beginRun(input) { calls.push(['begin', input]); return { runId, claimed: true }; },
      async completeRun() { calls.push(['complete']); },
      async failRun(input) { calls.push(['fail', input]); },
    }, reader: async () => readerResult, now,
  });
  await assert.rejects(collector.collect(base), /unavailable/);
  assert.equal(calls.some(([name]) => name === 'begin'), false);
  accountResult = account;
  const mismatch = fixture({ ...readerResult, currency: 'USD' });
  await assert.rejects(mismatch.collector.collect(base), /unavailable/);
  assert.equal(mismatch.calls.some(([name]) => name === 'complete'), false);
  assert.equal(mismatch.calls.some(([name]) => name === 'fail'), true);
});

test('Google collector refuses incomplete coverage, duplicate days, and unsafe micros', async () => {
  for (const invalid of [
    { ...readerResult, missingDates: [] , rows: [readerResult.rows[0]] },
    { ...readerResult, rows: [...readerResult.rows, readerResult.rows[0]] },
    { ...readerResult, rows: [{ ...readerResult.rows[0], spendMicros: '9223372036854775808' }, readerResult.rows[1]] },
  ]) {
    const { collector, calls } = fixture(invalid);
    await assert.rejects(collector.collect(base), /unavailable/);
    assert.equal(calls.some(([name]) => name === 'complete'), false);
    assert.equal(calls.some(([name]) => name === 'fail'), true);
  }
});
