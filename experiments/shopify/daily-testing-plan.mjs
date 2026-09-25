import { createHash } from 'node:crypto';

// Semantic proposal only: this module has no source, database or scheduler adapter.
export const DAILY_TESTING_PROGRAMME_VERSION = 'night-scout-daily-proposal-v1';
const TIME_ZONE = 'Europe/London';
const ROUTES = new Set(['shopify-development', 'synthetic-financial']);
const ORDER_TYPES = {
  A: { grossProductsPence: 12000, productDiscountPence: 1200, productVatPence: 2160, netShippingPence: 600, shippingVatPence: 120, units: 1 },
  B: { grossProductsPence: 8000, productDiscountPence: 800, productVatPence: 1440, netShippingPence: 300, shippingVatPence: 60, units: 2 },
  C: { grossProductsPence: 6000, productDiscountPence: 0, productVatPence: 0, netShippingPence: 0, shippingVatPence: 0, units: 1 },
};

function dateValue(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Explicit startMonday YYYY-MM-DD is required');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== value) throw new Error('Invalid calendar date');
  return date;
}

function nextDate(date, days) {
  const result = dateValue(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

// Fixed 18:00 generation and 02:00 collection avoid London's repeated/missing 01:xx.
function londonTimestamp(localDate, hour) {
  const nominal = Date.parse(`${localDate}T${hour}:00:00Z`);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  let instant = nominal;
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = Object.fromEntries(formatter.formatToParts(instant).map(({ type, value }) => [type, value]));
    const localAsUtc = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    const correction = nominal - localAsUtc;
    if (correction === 0) {
      const offsetMinutes = (nominal - instant) / 60_000;
      if (offsetMinutes !== 0 && offsetMinutes !== 60) throw new Error('Unsupported London offset');
      return { local: `${localDate}T${hour}:00:00${offsetMinutes === 60 ? '+01:00' : '+00:00'}`, utc: new Date(instant).toISOString() };
    }
    instant += correction;
  }
  throw new Error('Unable to resolve London scenario time');
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function sumWeek(actions) {
  const totals = {
    originalOrders: 0, grossProductsPence: 0, productDiscountPence: 0,
    originalProductSalesPence: 0, originalNetShippingPence: 0,
    productRefundPence: 0, shippingRefundPence: 0, refundVatPence: 0, refundCashPence: 0,
  };
  for (const action of actions) {
    const amounts = action.amounts;
    if (action.kind === 'create-order') {
      totals.originalOrders++;
      totals.grossProductsPence += amounts.grossProductsPence;
      totals.productDiscountPence += amounts.productDiscountPence;
      totals.originalProductSalesPence += amounts.grossProductsPence - amounts.productDiscountPence;
      totals.originalNetShippingPence += amounts.netShippingPence;
    } else {
      totals.productRefundPence += amounts.productRefundPence;
      totals.shippingRefundPence += amounts.shippingRefundPence;
      totals.refundVatPence += amounts.productRefundVatPence + amounts.shippingRefundVatPence;
      totals.refundCashPence += amounts.refundCashPence;
    }
  }
  return {
    ...totals,
    netProductSalesPence: totals.originalProductSalesPence - totals.productRefundPence,
    netShippingPence: totals.originalNetShippingPence - totals.shippingRefundPence,
    originalAovPence: totals.originalProductSalesPence / totals.originalOrders,
  };
}

/** Build a bounded, disabled semantic plan. This cannot activate or execute it. */
export function buildDailyTestingPlan(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('Plan options are required');
  const allowed = new Set(['startMonday', 'targetStore', 'route']);
  for (const key of Object.keys(options)) if (!allowed.has(key)) throw new Error(`Unsupported plan option: ${key}`);
  const { startMonday, targetStore, route } = options;
  if (dateValue(startMonday).getUTCDay() !== 1) throw new Error('startMonday must be a Monday');
  if (typeof targetStore !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(targetStore)) throw new Error('Explicit non-secret targetStore identifier is required');
  if (!ROUTES.has(route)) throw new Error('Explicit supported route is required');
  const programmeId = `${DAILY_TESTING_PROGRAMME_VERSION}/${route}/${targetStore}/${startMonday}`;
  const days = [];
  const weeklyExpectedSales = [];
  for (let cycle = 1; cycle <= 2; cycle++) {
    const monday = nextDate(startMonday, (cycle - 1) * 7);
    const cycleId = `${programmeId}/cycle-${cycle}`;
    const actionId = (date, code) => `${cycleId}/${date}/${code}`;
    const mondayA = actionId(monday, 'order-A');
    const mondayB = actionId(monday, 'order-B');
    const cycleActions = [];
    for (let weekday = 0; weekday < 7; weekday++) {
      const localDate = nextDate(monday, weekday);
      const generation = londonTimestamp(localDate, '18');
      const collection = londonTimestamp(nextDate(localDate, 1), '02');
      const actions = [];
      const addAction = (code, payload) => {
        const action = {
          id: actionId(localDate, code), programmeVersion: DAILY_TESTING_PROGRAMME_VERSION,
          route, targetStore, cycleId, localDate, plannedAt: generation.local, currency: 'GBP',
          test: route === 'shopify-development', synthetic: true,
          status: 'planned', ...payload,
        };
        action.inputDigest = createHash('sha256').update(JSON.stringify(action)).digest('hex');
        actions.push(action);
        cycleActions.push(action);
      };
      const orderTypes = weekday === 0 ? ['A', 'B'] : weekday === 1 ? ['C'] : weekday === 5 ? ['A', 'C'] : [];
      for (const type of orderTypes) addAction(`order-${type}`, {
        kind: 'create-order', scenario: type, amounts: { ...ORDER_TYPES[type] }, dependencies: [],
        requiredEvidence: route === 'shopify-development'
          ? ['confirmed-test-method-without-live-payment', 'recorded-tax-and-discount-splits']
          : ['invented-original-payment-evidence', 'recorded-tax-and-discount-splits'],
      });
      if (weekday === 2 || weekday === 4) {
        const partial = weekday === 2;
        addAction(partial ? 'refund-A-partial' : 'refund-B-full', {
          kind: 'refund-order', scenario: partial ? 'A-partial' : 'B-full',
          dependencies: [partial ? mondayA : mondayB],
          originalOrderActionId: partial ? mondayA : mondayB,
          requiresConfirmedSourceOrderId: true, requiresRemainingRefundVerification: true,
          restock: false, costRecoveryPence: 0,
          amounts: partial
            ? { productRefundPence: 2000, productRefundVatPence: 400, shippingRefundPence: 100, shippingRefundVatPence: 20, refundCashPence: 2520 }
            : { productRefundPence: 7200, productRefundVatPence: 1440, shippingRefundPence: 300, shippingRefundVatPence: 60, refundCashPence: 9000 },
        });
      }
      days.push({
        cycle, cycleId, localDate, generation, expectedCollection: collection, actions,
        noMutation: actions.length === 0,
        expectedCollectionOutcome: actions.length === 0 ? 'completed-unchanged-within-identical-reporting-scope' : 'collect-and-verify-source-actions',
      });
    }
    weeklyExpectedSales.push({ cycle, cycleId, basis: 'proposed-synthetic-equivalent-only', ...sumWeek(cycleActions) });
  }
  const actions = days.flatMap(day => day.actions);
  const counts = { orders: actions.filter(action => action.kind === 'create-order').length, refunds: actions.filter(action => action.kind === 'refund-order').length };
  if (counts.orders !== 10 || counts.refunds !== 4 || days.length !== 14) throw new Error('Programme cap invariant failed');
  return freeze({
    programmeId, programmeVersion: DAILY_TESTING_PROGRAMME_VERSION, mode: 'plan-only', enabled: false,
    route, targetStore, timeZone: TIME_ZONE, currency: 'GBP', startMonday,
    finalScenarioDate: nextDate(startMonday, 13), finalExpectedCollectionDate: nextDate(startMonday, 14),
    activationRequired: true, timestampsArePlannedNotSourceEventEvidence: true,
    caps: { days: 14, orders: 10, refunds: 4 }, counts, days, weeklyExpectedSales,
    eligibleFinancialEvents: route === 'shopify-development' ? 0 : null,
    weeklyProfitAsserted: false,
    safeguards: {
      livePayments: false, customerContact: false, fulfilment: false, inventoryChanges: false,
      automaticRestock: false, orderEdits: false, automaticBackdating: false,
      missedGeneration: 'skip-and-record', uncertainWrite: 'stop-and-reconcile',
      duplicateProtection: 'requires-durable-atomic-reservation-and-verified-source-reconciliation',
      sourceMutationsImplemented: false, databaseWritesImplemented: false, schedulerImplemented: false,
    },
  });
}
