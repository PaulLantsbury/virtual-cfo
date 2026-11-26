import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleAdsSpendReportRepository } from './google-ads-report-repository.mjs';

const userId = '11111111-1111-4111-8111-111111111111';
const storeId = '22222222-2222-4222-8222-222222222222';
const customerId = '1234567890';
const runId = '33333333-3333-4333-8333-333333333333';
const now = () => new Date('2026-11-21T12:00:00.000Z');

function rpcReturning(rows) {
  const calls = [];
  return {
    calls,
    async call(name, args) {
      calls.push({ name, args });
      return rows;
    },
  };
}

test('report repository uses the fixed bounded RPC and preserves exact integer micros', async () => {
  const rpc = rpcReturning([{
    customer_id: customerId,
    login_customer_id: null,
    currency: 'GBP',
    timezone_name: 'Europe/London',
    spend_date: '2026-11-20',
    coverage_state: 'provider_row',
    spend_micros: '1234567890123456789',
    observed_at: '2026-11-21T11:00:00.000Z',
    run_id: runId,
    run_status: 'complete',
    run_started_at: '2026-11-21T10:00:00.000Z',
  }]);
  const repository = createGoogleAdsSpendReportRepository({ rpc, now });
  const report = await repository.readSpend({ userId }, {
    storeId,
    from: '2026-11-20',
    to: '2026-11-20',
  });

  assert.deepEqual(rpc.calls, [{
    name: 'google_ads_v1.worker_read_daily_spend',
    args: [userId, storeId, '2026-11-20', '2026-11-20', '2026-11-21T12:00:00.000Z'],
  }]);
  assert.equal(report.status, 'available');
  assert.equal(report.account.customerId, customerId);
  assert.equal(report.days[0].spendMicros, '1234567890123456789');
  assert.equal(typeof report.days[0].spendMicros, 'string');
  assert.equal(report.days[0].coverageState, 'provider_row');
});

test('report repository preserves account-day unknown coverage and distinguishes no selected account', async () => {
  const reportRpc = rpcReturning([{
    customer_id: customerId,
    login_customer_id: null,
    currency: 'GBP',
    timezone_name: 'Europe/London',
    spend_date: '2026-11-20',
    coverage_state: null,
    spend_micros: null,
    observed_at: null,
    run_id: null,
    run_status: null,
    run_started_at: null,
  }]);
  const report = await createGoogleAdsSpendReportRepository({ rpc: reportRpc, now }).readSpend({ userId }, {
    storeId, from: '2026-11-20', to: '2026-11-20',
  });
  assert.equal(report.status, 'available');
  assert.equal(report.days[0].coverageState, 'not_collected');
  assert.equal(report.days[0].spendMicros, null);

  const disconnectedRpc = rpcReturning([{
    customer_id: null,
    login_customer_id: null,
    currency: null,
    timezone_name: null,
    spend_date: '2026-11-20',
    coverage_state: null,
    spend_micros: null,
    observed_at: null,
    run_id: null,
    run_status: null,
    run_started_at: null,
  }]);
  const disconnected = await createGoogleAdsSpendReportRepository({ rpc: disconnectedRpc, now }).readSpend({ userId }, {
    storeId, from: '2026-11-20', to: '2026-11-20',
  });
  assert.equal(disconnected.status, 'not_connected');
  assert.deepEqual(disconnected.days, []);
});

test('report repository rejects malformed or excessive ranges before calling storage', async () => {
  const rpc = rpcReturning([]);
  const repository = createGoogleAdsSpendReportRepository({ rpc, now });
  await assert.rejects(repository.readSpend({ userId }, {
    storeId, from: '2026-11-21', to: '2026-11-20',
  }), /unavailable/);
  await assert.rejects(repository.readSpend({ userId }, {
    storeId, from: '2026-01-01', to: '2026-04-04',
  }), /unavailable/);
  assert.equal(rpc.calls.length, 0);
});
