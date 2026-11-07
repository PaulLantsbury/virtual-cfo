import test from 'node:test';
import assert from 'node:assert/strict';
import { computeScenario, ZERO_SCENARIO_STATE, SCENARIO_CONTROL_RANGES } from '../src/lib/scenario-model.ts';

const model = (changes = {}) => computeScenario({ ...ZERO_SCENARIO_STATE, ...changes });

test('coherent month reconciles sales, contribution, operating profit and EBITDA', () => {
  const { baseline: b, result, deltas } = model();
  assert.deepEqual(result, b);
  assert.equal(b.orders, 1000);
  assert.equal(b.aov, 100);
  assert.equal(b.grossProductSales, 125000);
  assert.equal(b.discounts, 25000);
  assert.equal(b.productSalesBeforeRefunds, 100000);
  assert.equal(b.sales, 95000);
  assert.equal(b.shippingRevenue, 2900);
  assert.equal(b.cogs, 38000);
  assert.equal(b.grossProfit, 57000);
  assert.equal(b.variableCosts, 9000);
  assert.equal(b.contributionBeforeMarketing, 50900);
  assert.equal(b.marketing, 10000);
  assert.equal(b.contribution, 40900);
  assert.equal(b.overheads, 19000);
  assert.equal(b.operatingProfit, 21900);
  assert.equal(b.ebitda, 22900);
  assert.equal(b.cpo, 40.9);
  assert.ok(Object.values(deltas).every(value => value === 0));
  assert.equal('cash' in result, false);
  assert.equal('runway' in result, false);
});

test('order count scales original sales and relevant costs, not event refunds', () => {
  const { result: r, deltas: d } = model({ orderVolumeChange: 10 });
  assert.equal(r.orders, 1100);
  assert.equal(r.aov, 100);
  assert.equal(r.sales, 105000);
  assert.equal(r.cogs, 42000);
  assert.equal(r.variableCosts, 9900);
  assert.equal(r.contribution, 46000);
  assert.equal(r.operatingProfit, 27000);
  assert.equal(d.operatingProfit, 5100);
  assert.equal(r.productRefunds, 5000);
});

test('AOV changes original product sales once without inferred order/demand growth', () => {
  const { result: r } = model({ aovChange: 10 });
  assert.equal(r.orders, 1000);
  assert.equal(r.aov, 110);
  assert.equal(r.grossProductSales, 137500);
  assert.equal(r.discounts, 27500);
  assert.equal(r.sales, 105000);
  assert.equal(r.contribution, 50900);
  assert.equal(r.operatingProfit, 31900);
});

test('joint volume and AOV use multiplication rather than overlapping sales coefficients', () => {
  const { result: r } = model({ orderVolumeChange: 10, aovChange: 10 });
  assert.equal(r.productSalesBeforeRefunds, 121000);
  assert.equal(r.sales, 116000);
  assert.equal(r.contribution, 57000);
  assert.equal(r.operatingProfit, 38000);
});

test('marketing changes expense once in contribution and operating profit, sales unchanged', () => {
  const { result: r, deltas: d } = model({ marketingSpendChange: -10 });
  assert.equal(r.marketing, 9000);
  assert.equal(r.sales, 95000);
  assert.equal(r.contribution, 41900);
  assert.equal(r.operatingProfit, 22900);
  assert.equal(d.contribution, 1000);
  assert.equal(d.operatingProfit, 1000);
});

test('per-order shipping/processing and fulfilment affect contribution once', () => {
  assert.equal(model({ shippingChange: -1 }).deltas.contribution, 1000);
  assert.equal(model({ paymentFeeChange: -1 }).deltas.contribution, 1000);
  assert.equal(model({ fulfilmentChange: -10 }).deltas.contribution, 300);
  const { deltas: d } = model({ shippingChange: -1, paymentFeeChange: -1, fulfilmentChange: -10 });
  assert.equal(d.contribution, 2300);
  assert.equal(d.operatingProfit, 2300);
});

test('staff, software and other overhead controls are separate and preserve D&A bridge', () => {
  const { result: r, deltas: d } = model({ staffCostChange: 10, softwareChange: 10, fixedCostChange: 10 });
  assert.equal(r.staff, 13200);
  assert.equal(r.software, 2200);
  assert.equal(r.otherOverheads, 4400);
  assert.equal(d.contribution, 0);
  assert.equal(d.operatingProfit, -1800);
  assert.equal(r.ebitda - r.operatingProfit, 1000);
});

test('whole orders and monetary rounding are explicit', () => {
  const { result: r } = model({ orderVolumeChange: 0.15, aovChange: 0.123 });
  assert.equal(r.orders, 1002);
  assert.equal(r.aov, 100.12);
  assert.equal(r.productSalesBeforeRefunds, 100320.24);
});

test('a reachable adverse scenario preserves operating losses rather than clamping them', () => {
  const { result: r, deltas: d } = model({
    orderVolumeChange: -20, aovChange: -10, shippingChange: 3,
    paymentFeeChange: 2, marketingSpendChange: 30, staffCostChange: 20,
    softwareChange: 20, fulfilmentChange: 20, fixedCostChange: 20,
  });
  assert.equal(r.orders, 800);
  assert.equal(r.sales, 67000);
  assert.equal(r.contribution, 15220);
  assert.equal(r.overheads, 22600);
  assert.equal(r.operatingProfit, -7380);
  assert.equal(r.ebitda, -6380);
  assert.equal(d.operatingProfit, -29280);
});

test('all allowed-range corners retain finite amounts and profit reconciliation, including loss', () => {
  const keys = Object.keys(SCENARIO_CONTROL_RANGES);
  let losses = 0;
  for (let mask = 0; mask < 2 ** keys.length; mask++) {
    const state = Object.fromEntries(keys.map((key, i) => [key, SCENARIO_CONTROL_RANGES[key][(mask >> i) & 1]]));
    const { result: r } = computeScenario(state);
    assert.ok(Object.values(r).every(Number.isFinite));
    assert.equal(r.ebitda - r.operatingProfit, 1000);
    assert.equal(r.contribution - r.overheads, r.operatingProfit);
    if (r.operatingProfit < 0) losses++;
  }
  assert.ok(losses > 0);
});

test('invalid, missing, non-finite and unsupported model inputs fail explicitly', () => {
  for (const invalid of [null, [], {}, { ...ZERO_SCENARIO_STATE, revenueChange: 10 }]) {
    assert.throws(() => computeScenario(invalid));
  }
  for (const [key, [min, max]] of Object.entries(SCENARIO_CONTROL_RANGES)) {
    for (const value of [undefined, null, '0', NaN, Infinity, -Infinity, min - 0.01, max + 0.01]) {
      assert.throws(() => model({ [key]: value }));
    }
  }
});
