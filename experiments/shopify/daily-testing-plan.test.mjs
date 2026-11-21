import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyTestingPlan } from './daily-testing-plan.mjs';

const options = { startMonday: '2026-09-21', targetStore: 'invented-store', route: 'synthetic-financial' };
const allActions = plan => plan.days.flatMap(day => day.actions);

test('explicit validated Monday, target and route; activation and scope overrides refuse', () => {
  for (const input of [undefined, null, [], {}, { ...options, startMonday: '2026-09-22' },
    { ...options, startMonday: '2026-02-30' }, { ...options, startMonday: '2026-9-21' },
    { ...options, targetStore: '' }, { ...options, targetStore: ' token with whitespace ' },
    { ...options, route: 'production' }, { ...options, enabled: true },
    { ...options, timeZone: 'UTC' }, { ...options, days: 15 }]) {
    assert.throws(() => buildDailyTestingPlan(input));
  }
});

test('exact two-week bounded proposal remains disabled, with explicit final collection', () => {
  const plan = buildDailyTestingPlan(options);
  assert.equal(plan.enabled, false);
  assert.equal(plan.mode, 'plan-only');
  assert.equal(plan.activationRequired, true);
  assert.deepEqual(plan.caps, { days: 14, orders: 10, refunds: 4 });
  assert.deepEqual(plan.counts, { orders: 10, refunds: 4 });
  assert.equal(plan.days.length, 14);
  assert.equal(plan.finalScenarioDate, '2026-10-04');
  assert.equal(plan.finalExpectedCollectionDate, '2026-10-05');
  assert.equal(plan.weeklyProfitAsserted, false);
  assert.equal(plan.timestampsArePlannedNotSourceEventEvidence, true);
  assert.deepEqual(plan.safeguards, {
    livePayments: false, customerContact: false, fulfilment: false, inventoryChanges: false,
    automaticRestock: false, orderEdits: false, automaticBackdating: false,
    missedGeneration: 'skip-and-record', uncertainWrite: 'stop-and-reconcile',
    duplicateProtection: 'requires-durable-atomic-reservation-and-verified-source-reconciliation',
    sourceMutationsImplemented: false, databaseWritesImplemented: false, schedulerImplemented: false,
  });
  assert.throws(() => { plan.enabled = true; }, TypeError);
  assert.throws(() => { plan.days[0].actions[0].amounts.grossProductsPence = 0; }, TypeError);
});

test('stable action identity/digest, route/store/programme isolation, and no real source identifiers', () => {
  const first = buildDailyTestingPlan(options);
  assert.deepEqual(first, buildDailyTestingPlan({ route: options.route, targetStore: options.targetStore, startMonday: options.startMonday }));
  const actions = allActions(first);
  assert.equal(new Set(actions.map(action => action.id)).size, 14);
  assert.equal(new Set(actions.map(action => action.inputDigest)).size, 14);
  for (const action of actions) {
    assert.match(action.inputDigest, /^[a-f0-9]{64}$/);
    assert.equal(action.status, 'planned');
    assert.equal(action.currency, 'GBP');
    assert.equal(action.synthetic, true);
    assert.equal(Object.hasOwn(action, 'sourceOrderId'), false);
  }
  for (const override of [{ targetStore: 'other-store' }, { route: 'shopify-development' }, { startMonday: '2026-09-28' }]) {
    const other = allActions(buildDailyTestingPlan({ ...options, ...override }));
    assert.ok(other.every(action => !actions.some(original => original.id === action.id || original.inputDigest === action.inputDigest)));
  }
});

test('Thursday/Sunday no-change days have no actions but still expect next-day completed collection', () => {
  const plan = buildDailyTestingPlan(options);
  assert.deepEqual(plan.days.map(day => day.actions.length), [2, 1, 1, 0, 1, 2, 0, 2, 1, 1, 0, 1, 2, 0]);
  assert.deepEqual(plan.days.filter(day => day.noMutation).map(day => day.localDate), ['2026-09-24', '2026-09-27', '2026-10-01', '2026-10-04']);
  for (const day of plan.days.filter(day => day.noMutation)) {
    assert.deepEqual(day.actions, []);
    assert.equal(day.expectedCollectionOutcome, 'completed-unchanged-within-identical-reporting-scope');
    assert.match(day.expectedCollection.local, /T02:00:00\+01:00$/);
  }
});

test('refunds depend on their own cycle Monday order; full B cash and partial A tax reconcile', () => {
  const plan = buildDailyTestingPlan(options);
  const actions = allActions(plan);
  for (const refund of actions.filter(action => action.kind === 'refund-order')) {
    const order = actions.find(action => action.id === refund.originalOrderActionId);
    assert.equal(order.kind, 'create-order');
    assert.equal(order.cycleId, refund.cycleId);
    assert.equal(new Date(`${order.localDate}T00:00Z`).getUTCDay(), 1);
    assert.deepEqual(refund.dependencies, [order.id]);
    assert.equal(refund.requiresConfirmedSourceOrderId, true);
    assert.equal(refund.requiresRemainingRefundVerification, true);
    assert.equal(refund.restock, false);
    assert.equal(refund.costRecoveryPence, 0);
    const money = refund.amounts;
    assert.equal(money.refundCashPence, money.productRefundPence + money.productRefundVatPence + money.shippingRefundPence + money.shippingRefundVatPence);
    if (refund.scenario === 'B-full') {
      assert.equal(order.scenario, 'B');
      assert.equal(money.refundCashPence, 9000);
      assert.equal(money.productRefundPence, order.amounts.grossProductsPence - order.amounts.productDiscountPence);
    } else {
      assert.equal(order.scenario, 'A');
      assert.equal(money.refundCashPence, 2520);
    }
  }
  // The first cycle crosses September/October: actual local event dates remain distinct.
  assert.equal(plan.days[7].localDate, '2026-09-28');
  assert.equal(plan.days[11].actions[0].localDate, '2026-10-02');
});

test('independent hand-worked weekly integer-pence sales oracle preserves pre-refund AOV', () => {
  const plan = buildDailyTestingPlan(options);
  for (const week of plan.weeklyExpectedSales) {
    const { cycle, cycleId, basis, ...totals } = week;
    assert.equal(basis, 'proposed-synthetic-equivalent-only');
    assert.deepEqual(totals, {
      originalOrders: 5, grossProductsPence: 44000, productDiscountPence: 3200,
      originalProductSalesPence: 40800, originalNetShippingPence: 1500,
      productRefundPence: 9200, shippingRefundPence: 400, refundVatPence: 1920, refundCashPence: 11520,
      netProductSalesPence: 31600, netShippingPence: 1100, originalAovPence: 8160,
    });
    assert.ok(Object.values(totals).every(Number.isSafeInteger));
  }
  for (const action of allActions(plan)) assert.ok(Object.values(action.amounts).every(Number.isSafeInteger));
});

test('Shopify route keeps test exclusion despite the separately labelled synthetic oracle', () => {
  const plan = buildDailyTestingPlan({ ...options, route: 'shopify-development' });
  assert.equal(plan.eligibleFinancialEvents, 0);
  assert.ok(allActions(plan).every(action => action.test === true));
  const synthetic = buildDailyTestingPlan(options);
  assert.equal(synthetic.eligibleFinancialEvents, null); // No evidence has actually been imported/reviewed.
  assert.ok(allActions(synthetic).every(action => action.test === false));
});

test('London spring DST collection and generation use real calendar offsets', () => {
  const plan = buildDailyTestingPlan({ ...options, startMonday: '2026-03-23' });
  assert.deepEqual(plan.days[5].generation, { local: '2026-03-28T18:00:00+00:00', utc: '2026-03-28T18:00:00.000Z' });
  assert.deepEqual(plan.days[5].expectedCollection, { local: '2026-03-29T02:00:00+01:00', utc: '2026-03-29T01:00:00.000Z' });
  assert.deepEqual(plan.days[6].generation, { local: '2026-03-29T18:00:00+01:00', utc: '2026-03-29T17:00:00.000Z' });
});

test('London autumn DST and year boundary do not drift or backdate actions', () => {
  const plan = buildDailyTestingPlan({ ...options, startMonday: '2026-10-19' });
  assert.deepEqual(plan.days[5].generation, { local: '2026-10-24T18:00:00+01:00', utc: '2026-10-24T17:00:00.000Z' });
  assert.deepEqual(plan.days[5].expectedCollection, { local: '2026-10-25T02:00:00+00:00', utc: '2026-10-25T02:00:00.000Z' });
  const year = buildDailyTestingPlan({ ...options, startMonday: '2026-12-28' });
  assert.equal(year.days[4].localDate, '2027-01-01');
  assert.equal(year.finalExpectedCollectionDate, '2027-01-11');
});
