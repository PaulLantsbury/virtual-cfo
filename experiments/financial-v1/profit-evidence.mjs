/**
 * Pure proposed monthly profit-evidence contract; no database/network/UI calls.
 * NOT an adapter for the current verified_sales_source response. A future
 * authorised reader must supply sales and cost evidence from ONE consistent
 * source snapshot. Matching snapshot/revision strings validate declarations;
 * this function cannot independently prove the reader's transaction, source
 * completeness, historical cost facts or permissions. Canonical line/recovery
 * IDs and alias deduplication are the future reader's responsibility: assigning
 * multiple IDs to one physical source event cannot be detected from IDs alone.
 *
 * Money: exact safe integer minor units in one supported two-decimal currency.
 * First scope: complete calendar month, actual supported landed unit costs,
 * whole units, actual classified monthly expenses. Recovery recognition is its
 * evidenced saleable-stock date, independent of refund date. No allocations,
 * estimates, FX, credit/correction posting, cash forecasts or live integration.
 * Cost failures preserve separately validated sales and unrelated subtotals.
 */
export const PROFIT_EVIDENCE_VERSION = 'profit-evidence-v1';
const expenseGroups = ['variableCosts', 'advertising', 'overheads'];
const ready = value => ({ value, state: 'ready', reason: null });
const unavailable = reason => ({ value: null, state: 'unavailable', reason });
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
function ensure(condition, message) { if (!condition) throw new Error(message); }
function integer(value, nonnegative = false) {
  ensure(Number.isSafeInteger(value) && (!nonnegative || value >= 0), 'Invalid or unsupported monetary precision');
  return value;
}
function add(a, b) { return integer(a + b); }
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (y < 1 || m < 1 || m > 12 || d < 1) return false;
  return d <= monthDays(y, m);
}
function monthDays(y, m) { return [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28,31,30,31,30,31,31,30,31,30,31][m - 1]; }
function fullMonth(from, to) {
  if (!date(from) || !date(to) || from > to || from.slice(0, 7) !== to.slice(0, 7) || !from.endsWith('-01')) return false;
  const [y, m] = from.split('-').map(Number);
  return Number(to.slice(8)) === monthDays(y, m);
}
function attempt(fn) {
  try { return ready(fn()); } catch (error) { return unavailable(error instanceof Error ? error.message : 'Evidence unavailable'); }
}
function derive(inputs, fn) {
  const blocked = inputs.find(input => input.value === null);
  return blocked ? unavailable(blocked.reason) : attempt(() => fn(...inputs.map(input => input.value)));
}
function validateScope(scope) {
  ensure(scope && nonempty(scope.storeId) && nonempty(scope.currency), 'Reporting scope unavailable');
  ensure(Intl.supportedValuesOf('currency').includes(scope.currency), 'Unsupported currency');
  const digits = new Intl.NumberFormat('en-GB', { style: 'currency', currency: scope.currency }).resolvedOptions();
  ensure(digits.minimumFractionDigits === 2 && digits.maximumFractionDigits === 2, 'Unsupported currency precision');
  ensure(date(scope.from) && date(scope.to) && scope.from <= scope.to, 'Invalid reporting dates');
}
function sameScope(record, scope) {
  return record?.storeId === scope.storeId && record?.currency === scope.currency;
}
function verifiedSales(input, scope) {
  validateScope(scope);
  ensure(nonempty(input.snapshotId) && input.sales?.snapshotId === input.snapshotId, 'Sales snapshot mismatch');
  const sales = input.sales.value;
  ensure(sales && sameScope(sales.provenance, scope) && sales.provenance.from === scope.from && sales.provenance.to === scope.to, 'Sales scope mismatch');
  ensure(nonempty(sales.provenance.coverageEvidence), 'Sales coverage evidence unavailable');
  integer(sales.netProductSales); integer(sales.netShipping);
  integer(sales.originalOrders, true);
  // Upstream verified sales adapter retains responsibility for tax/eligibility
  // evidence validation and its remaining arithmetic. No sales are recomputed.
  return sales;
}
function validateEvidence(record, scope) {
  ensure(record && sameScope(record, scope), 'Cost evidence store/currency mismatch');
  ensure(record.basis === 'actual', 'Actual cost evidence required');
  ensure(nonempty(record.evidenceRef), 'Cost source evidence missing');
  ensure(nonempty(record.sourceRevision) && record.sourceRevision === record.observedRevision, 'Stale or missing source revision');
}
function uniqueIds(rows) {
  ensure(Array.isArray(rows), 'Evidence records missing');
  const ids = new Set();
  for (const row of rows) {
    ensure(row && nonempty(row.id) && !ids.has(row.id), 'Missing or duplicate evidence ID');
    ids.add(row.id);
  }
  return [...ids];
}
function coverage(evidence, name, ids, scope, snapshotId) {
  const c = evidence.coverage?.[name];
  ensure(c?.complete === true && sameScope(c, scope) && c.from === scope.from && c.to === scope.to, `${name} coverage incomplete or mismatched`);
  ensure(c.snapshotId === snapshotId && c.revision === evidence.revision && nonempty(c.evidenceRef), `${name} coverage stale or unsupported`);
  ensure(Array.isArray(c.sourceIds) && c.sourceIds.every(nonempty) && new Set(c.sourceIds).size === c.sourceIds.length, `${name} source manifest invalid`);
  ensure(c.sourceIds.length === ids.length && ids.every(id => c.sourceIds.includes(id)), `${name} source manifest mismatch`);
}

export function calculateProfitEvidence(input) {
  const scope = input?.scope ?? null;
  const salesCheck = attempt(() => {
    ensure(input?.version === PROFIT_EVIDENCE_VERSION, 'Unsupported profit evidence version');
    return verifiedSales(input, scope);
  });
  const sales = salesCheck.value;
  const result = { version: PROFIT_EVIDENCE_VERSION, snapshotId: input?.snapshotId ?? null, scope, sales };
  let costError = null;
  const evidence = input?.costEvidence;
  try {
    ensure(sales, salesCheck.reason ?? 'Verified sales unavailable');
    ensure(fullMonth(scope.from, scope.to), 'Profit requires one complete calendar month');
    ensure(evidence && evidence.snapshotId === input.snapshotId && nonempty(evidence.revision), 'Cost snapshot or revision mismatch');
  } catch (error) { costError = error.message; }
  const component = fn => costError ? unavailable(costError) : attempt(fn);
  let linesById = new Map();
  const originalCosts = component(() => {
    const ids = uniqueIds(evidence.lines);
    coverage(evidence, 'productCosts', ids, scope, input.snapshotId);
    let total = 0;
    const selectedOrderIds = new Set();
    const mapped = new Map();
    for (const line of evidence.lines) {
      validateEvidence(line, scope);
      ensure(nonempty(line.orderId) && line.originalEligible === true, 'Original line eligibility/link unresolved');
      ensure(date(line.soldOn) && line.soldOn <= scope.to, 'Original line sale date unresolved');
      ensure(Number.isSafeInteger(line.quantity) && line.quantity > 0, 'Original line quantity unresolved');
      ensure(line.landedCostSupported === true, 'Historical landed cost unsupported');
      const cost = integer(integer(line.unitCostPence, true) * line.quantity, true);
      mapped.set(line.id, line);
      if (line.soldOn >= scope.from) { total = add(total, cost); selectedOrderIds.add(line.orderId); }
    }
    ensure(selectedOrderIds.size === sales.originalOrders, 'Original sale orders missing or mismatched in line evidence');
    linesById = mapped;
    return total;
  });
  const recoveredCosts = originalCosts.value === null ? unavailable(originalCosts.reason) : component(() => {
    const ids = uniqueIds(evidence.recoveries);
    coverage(evidence, 'recoveries', ids, scope, input.snapshotId);
    const recoveredQuantities = new Map();
    let total = 0;
    for (const recovery of evidence.recoveries) {
      validateEvidence(recovery, scope);
      const line = linesById.get(recovery.lineId);
      ensure(line, 'Recovery original line unavailable');
      ensure(recovery.status === 'saleable', 'Recovery disposition unresolved');
      ensure(date(recovery.recoveryOn) && recovery.recoveryOn >= line.soldOn && recovery.recoveryOn <= scope.to, 'Recovery event date unresolved');
      ensure(Number.isSafeInteger(recovery.quantity) && recovery.quantity > 0, 'Recovery quantity unresolved');
      const cumulative = add(recoveredQuantities.get(line.id) ?? 0, recovery.quantity);
      ensure(cumulative <= line.quantity, 'Cumulative recovery exceeds original line');
      recoveredQuantities.set(line.id, cumulative);
      const cost = integer(line.unitCostPence * recovery.quantity, true);
      if (recovery.recoveryOn >= scope.from) total = add(total, cost);
    }
    return total;
  });
  result.originalCosts = originalCosts;
  result.recoveredCosts = recoveredCosts;
  result.cogs = derive([originalCosts, recoveredCosts], (original, recovered) => add(original, -recovered));

  // A single source expense cannot appear under another ID/category and be
  // counted twice. Collisions block every affected component, not just the last.
  let expenseError = null;
  const duplicateSources = new Set();
  const duplicateIds = new Set();
  if (!costError) {
    try {
      ensure(Array.isArray(evidence.expenses), 'Expense evidence records missing');
      const sources = new Set(), ids = new Set();
      for (const row of evidence.expenses) {
        ensure(row && expenseGroups.includes(row.category), 'Expense classification unresolved');
        if (ids.has(row.id)) duplicateIds.add(row.id);
        if (sources.has(row.sourceId)) duplicateSources.add(row.sourceId);
        ids.add(row.id); sources.add(row.sourceId);
      }
    } catch (error) { expenseError = error.message; }
  }
  for (const name of expenseGroups) {
    result[name] = expenseError ? unavailable(expenseError) : component(() => {
      const rows = evidence.expenses.filter(row => row.category === name);
      coverage(evidence, name, uniqueIds(rows), scope, input.snapshotId);
      let total = 0;
      for (const row of rows) {
        validateEvidence(row, scope);
        ensure(nonempty(row.sourceId) && !duplicateSources.has(row.sourceId) && !duplicateIds.has(row.id), 'Expense source duplicated or missing');
        ensure(row.from === scope.from && row.to === scope.to, 'Expense period requires supported full-month amount');
        total = add(total, integer(row.amountPence, true));
      }
      return total;
    });
  }
  result.da = result.overheads.value === null ? unavailable(result.overheads.reason) : component(() => {
    const rows = evidence.expenses.filter(row => row.category === 'overheads');
    coverage(evidence, 'da', rows.map(row => row.id), scope, input.snapshotId);
    let total = 0;
    for (const row of rows) {
      integer(row.daPence, true);
      ensure(row.daPence <= row.amountPence, 'D&A must be included within its overhead amount');
      total = add(total, row.daPence);
    }
    return total;
  });
  const netSales = sales ? ready(sales.netProductSales) : unavailable(salesCheck.reason);
  const shipping = sales ? ready(sales.netShipping) : unavailable(salesCheck.reason);
  result.revenueDenominator = derive([netSales, shipping], add);
  result.grossProfit = derive([netSales, result.cogs], (value, cogs) => add(value, -cogs));
  result.contributionBeforeMarketing = derive([result.grossProfit, shipping, result.variableCosts], (profit, revenue, cost) => add(add(profit, revenue), -cost));
  result.contribution = derive([result.contributionBeforeMarketing, result.advertising], (value, cost) => add(value, -cost));
  result.operatingProfit = derive([result.contribution, result.overheads], (value, cost) => add(value, -cost));
  result.ebitda = derive([result.operatingProfit, result.da], add);
  const ratio = metric => {
    if (metric.value === null) return unavailable(metric.reason);
    if (result.revenueDenominator.value === null) return unavailable(result.revenueDenominator.reason);
    if (result.revenueDenominator.value <= 0) return unavailable('Non-positive margin denominator policy unresolved');
    return ready(metric.value / result.revenueDenominator.value);
  };
  result.contributionMargin = ratio(result.contribution);
  result.operatingMargin = ratio(result.operatingProfit);
  result.state = !sales ? 'unavailable' : result.ebitda.value === null ? 'partial' : 'complete';
  result.reason = sales ? costError : salesCheck.reason;
  return result;
}
