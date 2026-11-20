import test from 'node:test';
import assert from 'node:assert/strict';
import { composeHistoryMonth } from '../v11/history-composition.ts';
import { HISTORY_EDITION, type HistorySelection } from '../v11/history-supported.ts';
import { reviewedPlanBaseline } from './reviewed-plan-baseline.ts';

const sha = (c: string) => String.fromCharCode(97 + Number(c) % 6).repeat(64);
const anchor = '2024-11-01';
function fixture(from: string, index: number) {
  const to = new Date(Date.UTC(+from.slice(0, 4), +from.slice(5, 7), 0)).toISOString().slice(0, 10);
  const selection: HistorySelection = { storeId: 'd7500000-0000-4000-8000-000000000009', currency: 'GBP', timezone: 'Europe/London', edition: HISTORY_EDITION, anchor, versionId: `version-${index}`, period: { from, to } };
  const scope = { storeId: selection.storeId, currency: 'GBP', from, to };
  const response = { state: 'supported', versionId: selection.versionId, contract: 'history-v2-proposal', scope, snapshotId: selection.versionId,
    salesRevision: sha(String(index + 1)), costRevision: sha(String(index + 4)), metadata: { versionId: selection.versionId, edition: HISTORY_EDITION, anchor,
      sourceAsOf: new Date(Date.parse(`${new Date(Date.parse(`${to}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)}T00:00:00Z`)
        - Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hourCycle: 'h23' }).format(new Date(`${new Date(Date.parse(`${to}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)}T00:00:00Z`))) * 3_600_000).toISOString(),
      observedAt: '2026-11-20T12:00:00Z', formulaVersion: 'night-scout-v11-2026-10-30', sourceBasis: 'synthetic-local', verification: 'canonical-source-revision-only' },
    sales: { grossProductSales: 12000, discounts: 2000, netProductSales: 9000, netShipping: 500, originalOrders: 10 + index,
      aov: { value: 1000, reason: null }, provenance: scope },
    components: { cogs: 4500, variableCosts: 1000, advertising: 500 + index * 100, overheadIncludingDA: 2000, depreciationAmortisation: 100 },
    profit: { state: 'complete', grossProfit: 4500, contributionBeforeMarketing: 4000, contribution: 4000 - (500 + index * 100), ebitda: 1600 - index * 100 } };
  const month = composeHistoryMonth(response, selection)!;
  const payload = { contract: 'synthetic-acquisition-v1', state: 'supported', profile: 'uk-gifts-v2', policy: 'synthetic-identity-and-spend-v1', scope: { ...scope, timezone: 'Europe/London' },
    financial: { snapshotId: selection.versionId, edition: HISTORY_EDITION, anchor, salesRevision: response.salesRevision, costRevision: response.costRevision, formulaVersion: response.metadata.formulaVersion },
    source: { from: '2024-01-01', through: to, sourceHash: sha(String(index + 7)), ordersHash: sha(String(index + 8)), refundsHash: sha(String(index + 9)), allocationHash: sha(String(index + 10)), synthetic: true },
    coverage: { originalOrders: response.sales.originalOrders, identifiedFirstOrders: response.sales.originalOrders - 3, identifiedRepeatOrders: 1, guestOrders: 1, unknownOrders: 1, paidFirstCustomers: 4 },
    customerActivity: { contract: 'synthetic-customer-activity-v1', policy: 'synthetic-identity-and-spend-v1', scope: { from, to }, identifiedCustomers: 7, uniqueReturningCustomers: 1,
      identifiedOrders: response.sales.originalOrders - 2, sourceHash: sha(String(index + 8)), basis: 'Distinct synthetic customer identifiers.' },
    spend: { advertising: 500 + index * 100, acquisition: 200, retention: 200, unallocated: 100 + index * 100 },
    revenue: { netProductSales: 9000, identifiedFirst: 5000, identifiedRepeat: 2000, guest: 1000, unknown: 1000 },
    metrics: { cac: null, firstOrderContribution: null, maturePaybackDays: null }, limitations: ['Test fixture.'],
    economics: { policy: 'synthetic-order-cost-allocation-v1', first: { contract: 'synthetic-first-order-economics-v1', policy: 'synthetic-order-cost-allocation-v1',
      scope: { from, to, observedThrough: to, currency: 'GBP', timezone: 'Europe/London' }, customers: 4, netProductSales: 4000, netShipping: 400, cogs: 2000, variableCosts: 400,
      repeatMarketingCosts: 0, contributionBeforeMarketing: 2000, acquisitionSpend: 200, acquisitionMetricsState: 'supported',
      source: { costSourceHash: sha(String(index + 11)), acquisitionSourceHash: sha(String(index + 7)), allocationHash: sha(String(index + 12)) }, basis: 'Allocated first-order economics.' },
      mature: null, dependencies: [], source: { costSourceHash: sha(String(index + 11)), allocationHash: sha(String(index + 12)), repeatMarketingHash: sha(String(index + 13)) } } };
  return { month, acquisition: payload };
}

test('builds weighted 30-day baseline from exactly three complete matched month proofs', () => {
  const result = reviewedPlanBaseline([fixture('2025-01-01', 0), fixture('2025-02-01', 1), fixture('2025-03-01', 2)]);
  assert.ok(result);
  assert.equal(result.baseline30.days, 30);
  const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-12);
  near(result.baseline30.advertising, ((500 / 31) + (600 / 28 * 2) + (700 / 31 * 3)) / 6 * 30 / 100);
  near(result.baseline30.acquisitionSpend, 200 / 100 * 30 * (1 / 31 + 2 / 28 + 3 / 31) / 6);
  near(result.baseline30.customers, 4 * 30 * (1 / 31 + 2 / 28 + 3 / 31) / 6);
  assert.deepEqual(result.sourcePeriod, { from: '2025-01-01', to: '2025-03-31', calendarDays: 90, months: 3 });
  assert.deepEqual(result.bindings.months.map(x => x.versionId), ['version-0', 'version-1', 'version-2']);
  assert.equal(result.bindings.months[1].salesRevision, sha('2'));
});

test('missing, gapped, cross-company, or mismatched acquisition evidence is unavailable', () => {
  const valid = [fixture('2025-01-01', 0), fixture('2025-02-01', 1), fixture('2025-03-01', 2)];
  assert.equal(reviewedPlanBaseline(valid.slice(0, 2)), null);
  assert.equal(reviewedPlanBaseline([valid[0], fixture('2025-03-01', 1), valid[2]]), null);
  const missing = structuredClone(valid); delete (missing[1].acquisition as any).economics;
  assert.equal(reviewedPlanBaseline(missing), null);
  const mismatch = structuredClone(valid); (mismatch[0].acquisition as any).financial.costRevision = sha('f');
  assert.equal(reviewedPlanBaseline(mismatch), null);
  const company = structuredClone(valid); (company[1].month as any).selection.storeId = 'other-company';
  assert.equal(reviewedPlanBaseline(company), null);
});
