// Isolated calculation prototype. No database, network, app or fixture imports.
// Money inputs/outputs are integer minor units unless explicitly a ratio.
const amount = value => {
  if (!Number.isSafeInteger(value)) throw new Error('Missing or invalid integer money/count');
  return value;
};
const positive = value => {
  amount(value);
  if (value < 0) throw new Error('Expected non-negative amount/count');
  return value;
};
const sum = values => values.reduce((a, b) => amount(a + amount(b)), 0);
const date = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('Invalid resolved date');
  return value;
};
const divide = (n, d) => d > 0 ? { value: n / d, reason: null } : { value: null, reason: 'Non-positive denominator policy unresolved' };

/** Tax basis and the actual tax component must both be supplied. */
export function excludingTax(value, tax, basis) {
  positive(value); positive(tax);
  if (!['inclusive', 'exclusive'].includes(basis)) throw new Error('Tax basis unresolved');
  if (basis === 'inclusive' && tax > value) throw new Error('Tax exceeds inclusive amount');
  return basis === 'inclusive' ? value - tax : value;
}

export function normaliseSale({ gross, grossVat, discount, discountVat, shipping, shippingVat, basis }) {
  const grossProductExVat = excludingTax(gross, grossVat, basis);
  const discountExVat = excludingTax(discount, discountVat, basis);
  const netShipping = excludingTax(shipping, shippingVat, basis);
  if (discountExVat > grossProductExVat || discountVat > grossVat) throw new Error('Discount exceeds sale');
  const netProductSales = grossProductExVat - discountExVat;
  const productVat = grossVat - discountVat;
  return { grossProductExVat, discountExVat, netProductSales, netShipping, productVat, shippingVat,
    customerCharge: sum([netProductSales, netShipping, productVat, shippingVat]),
    aov: divide(netProductSales, 1), discountRate: divide(discountExVat, grossProductExVat) };
}

/** Uses historical cost only; current catalogue prices are not an input. */
export function historicCogs({ unitsSold, historicUnitCost, saleableUnitsReturned }) {
  positive(unitsSold); positive(saleableUnitsReturned);
  if (saleableUnitsReturned > unitsSold) throw new Error('Returned quantity exceeds sold quantity');
  if (historicUnitCost === null) return { originalCogs: null, saleableCostReversal: null, netCogs: null, state: 'incomplete' };
  positive(historicUnitCost);
  const originalCogs = amount(unitsSold * historicUnitCost);
  const saleableCostReversal = amount(saleableUnitsReturned * historicUnitCost);
  return { originalCogs, saleableCostReversal, netCogs: originalCogs - saleableCostReversal, state: 'complete' };
}

/** Adapter must resolve store-local event dates and order eligibility first.
 * Refunds retain orderId but are selected by their own event date. Cost reversals
 * must already be supported by saleable stock recovery in the same period;
 * unresolved return timing is represented by null, never assumed zero.
 */
export function tradingPeriod({ events, storeId, currency, from, to, coverageComplete }) {
  date(from); date(to);
  if (from > to || !storeId || !currency) throw new Error('Invalid period scope');
  if (coverageComplete !== true) throw new Error('Trading coverage incomplete');
  const seen = new Set();
  const selected = events.filter(event => {
    if (event.storeId !== storeId) return false;
    if (!event.id || seen.has(event.id)) throw new Error('Missing or duplicate event id');
    seen.add(event.id);
    date(event.date);
    return event.date >= from && event.date <= to;
  });
  let grossProductSales = 0, discounts = 0, originalOrders = 0, originalSales = 0;
  let netShipping = 0, productRefundExVat = 0, productRefundVat = 0, shippingRefundExVat = 0, shippingRefundVat = 0, cashRefunded = 0;
  const costs = [];
  let hasRefundActivity = false;
  const orders = new Set();
  for (const e of selected) {
    if (e.currency !== currency) throw new Error('Currency mismatch or missing currency');
    if (!e.orderId) throw new Error('Original order link required');
    if (e.type === 'sale') {
      if (typeof e.eligible !== 'boolean') throw new Error('Order eligibility unresolved');
      if (!e.eligible) continue;
      if (orders.has(e.orderId)) throw new Error('Duplicate original order');
      orders.add(e.orderId);
      const g = positive(e.grossProductExVat), d = positive(e.discountExVat);
      if (d > g) throw new Error('Discount exceeds sale');
      grossProductSales = sum([grossProductSales, g]); discounts = sum([discounts, d]);
      originalSales = sum([originalSales, g - d]); originalOrders++;
      netShipping = sum([netShipping, positive(e.netShipping)]);
      costs.push(e.historicCost === null ? null : positive(e.historicCost));
    } else if (e.type === 'refund') {
      hasRefundActivity = true;
      const product = excludingTax(e.productCash, e.productVat, 'inclusive');
      const shipping = excludingTax(e.shippingCash, e.shippingVat, 'inclusive');
      productRefundExVat = sum([productRefundExVat, product]); productRefundVat = sum([productRefundVat, e.productVat]);
      shippingRefundExVat = sum([shippingRefundExVat, shipping]); shippingRefundVat = sum([shippingRefundVat, e.shippingVat]);
      cashRefunded = sum([cashRefunded, e.productCash, e.shippingCash]);
      netShipping = sum([netShipping, -shipping]);
      if (typeof e.saleableReturn !== 'boolean') throw new Error('Product recovery unresolved');
      if (!e.saleableReturn && e.costReversal !== 0) throw new Error('Unrecovered product cannot reverse cost');
      costs.push(e.costReversal === null ? null : -positive(e.costReversal));
    } else throw new Error('Unsupported event type');
  }
  return { grossProductSales, discounts, originalOrders, aov: divide(originalSales, originalOrders),
    netProductSales: sum([originalSales, -productRefundExVat]), netShipping,
    productRefundExVat, productRefundVat, shippingRefundExVat, shippingRefundVat, cashRefunded,
    cogs: costs.includes(null) ? null : sum(costs), hasRefundActivity,
    hasActivity: originalOrders > 0 || hasRefundActivity, discountRate: divide(discounts, grossProductSales) };
}

export function profitBridge({ netProductSales, netShipping, cogs, variableCosts, advertising, overheadIncludingDA, depreciationAmortisation }) {
  amount(netProductSales); amount(netShipping);
  const revenueDenominator = sum([netProductSales, netShipping]);
  const fields = [cogs, variableCosts, advertising, overheadIncludingDA, depreciationAmortisation];
  // No dependent headline can imply complete profit when a required input is missing.
  if (fields.some(x => x === null)) return { revenueDenominator, state: 'incomplete', grossProfit: null, contributionBeforeMarketing: null, contribution: null, operatingProfit: null, ebitda: null, contributionMargin: { value: null, reason: 'Missing cost input' }, operatingMargin: { value: null, reason: 'Missing cost input' } };
  fields.forEach(amount);
  if (depreciationAmortisation < 0 || depreciationAmortisation > overheadIncludingDA) throw new Error('DA must be included once within overhead');
  const grossProfit = amount(netProductSales - cogs);
  const contributionBeforeMarketing = sum([grossProfit, netShipping, -variableCosts]);
  const contribution = amount(contributionBeforeMarketing - advertising);
  const operatingProfit = amount(contribution - overheadIncludingDA);
  return { revenueDenominator, state: 'complete', grossProfit, contributionBeforeMarketing, contribution, operatingProfit,
    ebitda: sum([operatingProfit, depreciationAmortisation]), contributionMargin: divide(contribution, revenueDenominator), operatingMargin: divide(operatingProfit, revenueDenominator) };
}

/** Daily fractions are retained; allocation of fractional pennies is deferred. */
export function allocateRecurringOverhead(months, from, to) {
  date(from); date(to); if (from > to) throw new Error('Invalid allocation period');
  const map = new Map();
  for (const m of months) {
    if (!/^\d{4}-\d{2}$/.test(m.month) || map.has(m.month)) throw new Error('Invalid or duplicate month');
    date(`${m.month}-01`); positive(m.amount); map.set(m.month, m.amount);
  }
  const components = new Map();
  for (let d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const month = d.toISOString().slice(0, 7);
    if (!map.has(month)) return { value: null, allocated: true, reason: 'Missing monthly overhead' };
    components.set(month, (components.get(month) ?? 0) + 1);
  }
  const portions = [...components].map(([month, days]) => {
    const [y,m] = month.split('-').map(Number); const denominator = new Date(Date.UTC(y,m,0)).getUTCDate();
    return { month, numerator: amount(map.get(month) * days), denominator };
  });
  const fractional = portions.some(p => p.numerator % p.denominator !== 0);
  return { value: fractional ? null : sum(portions.map(p => p.numerator / p.denominator)), portions, allocated: true,
    reason: fractional ? 'Fractional-penny allocation policy unresolved' : null };
}

export function cashPosition({ accounts, asOf, currency, coverageComplete }) {
  date(asOf); if (!currency || coverageComplete !== true) throw new Error('Cash coverage incomplete');
  const seen = new Set(); const totals = { availableCash: 0, restricted: 0, unsettled: 0 };
  for (const a of accounts) {
    if (!a.id || seen.has(a.id)) throw new Error('Missing or duplicate account'); seen.add(a.id);
    if (a.date !== asOf || a.currency !== currency) throw new Error('Cash date/currency mismatch');
    amount(a.balance);
    const key = { unrestricted: 'availableCash', restricted: 'restricted', unsettled: 'unsettled' }[a.kind];
    if (!key) throw new Error('Account classification unresolved');
    totals[key] = sum([totals[key], a.balance]);
  }
  if (!accounts.length) throw new Error('No account balances');
  return { ...totals, asOf, currency };
}

export function cashMovement({ externalInflows, externalOutflows, internalTransfers, includedAccountIds }) {
  positive(externalInflows); positive(externalOutflows);
  const ids = new Set();
  for (const t of internalTransfers) {
    positive(t.amount);
    if (!t.id || ids.has(t.id) || t.from === t.to || !includedAccountIds.includes(t.from) || !includedAccountIds.includes(t.to)) throw new Error('Internal transfer not reconciled');
    ids.add(t.id);
  }
  return { netMovement: amount(externalInflows - externalOutflows), internalTransferConsolidatedMovement: 0 };
}

export function cashRunway({ availableCash, months, throughMonth }) {
  amount(availableCash); date(`${throughMonth}-01`);
  const pending = reason => ({ months: null, state: 'incomplete', reason });
  if (availableCash < 0) return pending('Negative cash policy unresolved');
  if (months.length !== 3) return pending('Three complete months required');
  const end = new Date(`${throughMonth}-01T00:00:00Z`);
  const expected = [2,1,0].map(back => new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth()-back,1)).toISOString().slice(0,7));
  if (months.some((m,i) => m.month !== expected[i] || m.complete !== true || m.exceptionalFlowsReviewed !== true)) return pending('Consecutive complete reviewed months required');
  const movements = months.map(m => amount(m.netMovement));
  const total = sum(movements);
  if (total > 0) return { months: null, state: 'Not currently burning cash', averageMonthlyBurn: -total / 3 };
  if (total === 0) return pending('Zero burn policy unresolved');
  return { months: availableCash / (-total / 3), state: 'burning', averageMonthlyBurn: -total / 3 };
}

export function separateImpacts({ oneOffInventoryCashRelease, recurringMonthlyContributionImprovement }) {
  positive(oneOffInventoryCashRelease); amount(recurringMonthlyContributionImprovement);
  return { oneOffCashRelease: oneOffInventoryCashRelease, monthlyContributionImprovement: recurringMonthlyContributionImprovement,
    additionToAvailableCash: 0, combinedMonthlyImpactAllowed: false };
}
