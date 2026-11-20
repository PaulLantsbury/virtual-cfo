/** Explicit fictional design model. No merchant/provider reads, writes or inferred attribution. */
import { DAILY_SAMPLE, aggregateDays, buildProfitPreview, shiftDay, type Granularity, type Horizon } from '../newProfitPreview.ts';
export type Comparison = 'last-year' | 'rolling' | 'none';
export type MarketingTotals = {
  revenue: number; beforeAds: number; advertising: number; acquisitionSpend: number;
  overheads: number; da: number; orders: number; customers: number;
  firstContributionTotal: number; firstRevenueTotal: number; days: number;
};
export const safeRatio = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && b > 0 ? a / b : null;
export function metrics(t: MarketingTotals) {
  const afterAds = t.beforeAds - t.advertising;
  return { cac: safeRatio(t.acquisitionSpend, t.customers), poas: safeRatio(t.beforeAds, t.advertising), roas: safeRatio(t.revenue, t.advertising), afterAds, ebitda: afterAds - t.overheads,
    firstContribution: safeRatio(t.firstContributionTotal, t.customers), firstRevenue: safeRatio(t.firstRevenueTotal, t.customers) };
}
export function scaleTotals(t: MarketingTotals, factor: number): MarketingTotals {
  return Object.fromEntries(Object.entries(t).map(([key, value]) => [key, value * factor])) as MarketingTotals;
}
export function sampleTotals(from: string, to: string): MarketingTotals {
  const days = DAILY_SAMPLE.filter(d => d.date >= from && d.date <= to);
  const expected = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  if (!days.length || days.length !== expected) throw Error('Fictional marketing range is not completely covered');
  const totals = aggregateDays(days);
  let customers = 0, firstContributionTotal = 0, firstRevenueTotal = 0;
  for (const d of days) {
    const share = d.date >= '2026-07-01' ? 0.39 : 0.43;
    const n = Math.max(1, Math.round(d.orders * share));
    customers += n;
    firstContributionTotal += n * (d.sales - d.cogs + d.shipping - d.variable) / d.orders / 100 * 0.94;
    firstRevenueTotal += n * (d.sales + d.shipping) / d.orders / 100 * 0.98;
  }
  return { revenue: (totals.sales + totals.shipping) / 100, beforeAds: (totals.grossProfit + totals.shipping - totals.variable) / 100,
    advertising: totals.advertising / 100, acquisitionSpend: totals.advertising / 100 * 0.8,
    overheads: totals.cashOverheads / 100, da: totals.da / 100, orders: totals.orders, customers, firstContributionTotal, firstRevenueTotal, days: days.length };
}
export function buildMarketingReview({ granularity, horizon, comparison }: { granularity: Granularity; horizon: Horizon; comparison: Comparison }) {
  const p = buildProfitPreview({ granularity, months: horizon });
  const current = sampleTotals(p.from, p.to);
  const referencePool = comparison === 'rolling' ? sampleTotals(p.benchmarkFrom, p.benchmarkTo) : null;
  const previous = comparison === 'none' ? null : comparison === 'rolling' ? scaleTotals(referencePool!, p.selectedCount / p.benchmarkCount)
    : sampleTotals(p.granularity === 'weekly' ? shiftDay(p.from, -364) : `${Number(p.from.slice(0,4)) - 1}${p.from.slice(4)}`, p.granularity === 'weekly' ? shiftDay(p.to,-364) : `${Number(p.to.slice(0,4)) - 1}${p.to.slice(4)}`);
  const rows = p.periods.map(period => {
    const t = sampleTotals(period.from, period.to);
    const old = comparison === 'none' ? null : comparison === 'rolling' ? referencePool! : sampleTotals(p.granularity === 'weekly' ? shiftDay(period.from,-364) : `${Number(period.from.slice(0,4))-1}${period.from.slice(4)}`, p.granularity === 'weekly' ? shiftDay(period.to,-364) : `${Number(period.to.slice(0,4))-1}${period.to.slice(4)}`);
    const m = metrics(t), r = old ? metrics(old) : null;
    return { label: period.label, from: period.from, to: period.to, totals: t, cac: m.cac, poas: m.poas, compareCac: r?.cac ?? null, comparePoas: r?.poas ?? null };
  });
  // Weighted daily rates from up to the latest three SELECTED buckets, projected over 30 days.
  const recent = rows.slice(-3); const weightTotal = recent.reduce((s, _, i) => s + i + 1, 0);
  const baseline30 = Object.fromEntries(Object.keys(current).map(key => [key,
    recent.reduce((s, row, i) => s + row.totals[key as keyof MarketingTotals] / row.totals.days * (i + 1), 0) / weightTotal * 30,
  ])) as MarketingTotals;
  baseline30.days = 30;
  const comparisonLabel = comparison === 'none' ? 'No comparison' : comparison === 'last-year' ? 'Last year' : p.granularity === 'weekly' ? 'Previous 12-week average' : 'Previous 3-month average';
  return { ...p, current, previous, rows, baseline30, comparisonLabel, recentCount: recent.length,
    referenceFrom: comparison === 'rolling' ? p.benchmarkFrom : comparison === 'none' ? null : p.granularity === 'weekly' ? shiftDay(p.from,-364) : `${Number(p.from.slice(0,4))-1}${p.from.slice(4)}`,
    referenceTo: comparison === 'rolling' ? p.benchmarkTo : comparison === 'none' ? null : p.granularity === 'weekly' ? shiftDay(p.to,-364) : `${Number(p.to.slice(0,4))-1}${p.to.slice(4)}` };
}
export function requirements(t: MarketingTotals, profitTarget: number | null) {
  if (profitTarget !== null && (!Number.isFinite(profitTarget) || profitTarget < 0)) return null;
  const forTarget = (target: number) => {
    const budget = t.beforeAds - t.overheads - target;
    const fixedOtherAds = t.advertising - t.acquisitionSpend;
    const acquisitionBudget = budget - fixedOtherAds;
    return { contribution: t.overheads + target, budget,
      cac: acquisitionBudget >= 0 ? safeRatio(acquisitionBudget, t.customers) : null,
      poas: budget > 0 ? safeRatio(t.beforeAds, budget) : null,
      roas: budget > 0 ? safeRatio(t.revenue, budget) : null };
  };
  return { breakEven: forTarget(0), target: profitTarget === null ? null : forTarget(profitTarget) };
}
export type ScenarioDirection = 'hold' | 'scale' | 'reduce';
export type ScenarioInput = { direction: ScenarioDirection; changePct: number; elasticity: number; extraOverheads: number };
export function spendScenario(base: MarketingTotals, input: ScenarioInput) {
  if (![input.changePct, input.elasticity, input.extraOverheads].every(Number.isFinite) || input.changePct < 0 || input.changePct > 80 || input.elasticity < 0 || input.elasticity > 0.85 || input.extraOverheads < 0 || !['hold','scale','reduce'].includes(input.direction)) return null;
  const b = metrics(base); if (b.cac === null || b.cac <= 0 || b.firstContribution === null || b.firstRevenue === null) return null;
  const change = input.direction === 'hold' ? 0 : input.changePct / 100 * (input.direction === 'reduce' ? -1 : 1);
  const factor = 1 + change;
  const acquisitionSpend = base.acquisitionSpend * factor;
  const cac = b.cac * factor ** input.elasticity;
  const customers = acquisitionSpend / cac;
  const newOrders = customers - base.customers;
  const volumeContribution = newOrders * b.firstContribution;
  const adChange = acquisitionSpend - base.acquisitionSpend;
  const result: MarketingTotals = { ...base, acquisitionSpend, customers,
    orders: base.orders + newOrders, revenue: base.revenue + newOrders * b.firstRevenue,
    beforeAds: base.beforeAds + volumeContribution, advertising: base.advertising + adChange,
    overheads: base.overheads + input.extraOverheads,
    firstContributionTotal: customers * b.firstContribution, firstRevenueTotal: customers * b.firstRevenue };
  const output = metrics(result);
  return { totals: result, ...output, volumeContribution, adChange, extraOverheads: input.extraOverheads, newOrders,
    delta: output.ebitda - b.ebitda, changePct: change * 100,
    marginalCac: b.cac * factor ** input.elasticity / (1 - input.elasticity) };
}
export function scenarioBridge(base: MarketingTotals, scenario: NonNullable<ReturnType<typeof spendScenario>>, perOrder: boolean) {
  const start = metrics(base).ebitda;
  const denominator = perOrder ? scenario.totals.orders : 1;
  const first = perOrder ? start / base.orders : start;
  let cursor = first;
  const rows = [{ label: 'Current trajectory', start: 0, end: first, amount: first, total: true }];
  const push = (label: string, value: number) => { const from = cursor; cursor += value; rows.push({ label, start: from, end: cursor, amount: value, total: false }); };
  if (perOrder) push('Order-count basis', start / denominator - first);
  push('First-order contribution', scenario.volumeContribution / denominator);
  push('Advertising change', -scenario.adChange / denominator);
  push('Extra fixed costs', -scenario.extraOverheads / denominator);
  rows.push({ label: 'Scenario EBITDA', start: 0, end: cursor, amount: cursor, total: true });
  return rows;
}
export function recommendation(current: MarketingTotals, previous: MarketingTotals | null, baseline30: MarketingTotals, elasticity: number) {
  const now = metrics(current), old = previous ? metrics(previous) : null, future = metrics(baseline30);
  const marginalCac = future.cac === null ? null : future.cac / (1 - elasticity);
  const deterioration = old && now.cac !== null && old.cac !== null && now.poas !== null && old.poas !== null && (now.cac > old.cac && now.poas < old.poas);
  const improving = old && now.cac !== null && old.cac !== null && now.poas !== null && old.poas !== null && now.cac < old.cac && now.poas > old.poas;
  const efficiency = !old ? 'Select a comparison to assess efficiency.' : deterioration ? 'Marketing efficiency is weakening against the comparison.' : improving ? 'Marketing efficiency is improving against the comparison.' : 'Marketing efficiency is broadly stable or mixed against the comparison.';
  const verdict = marginalCac === null || future.firstContribution === null ? 'Needs evidence' : marginalCac >= future.firstContribution ? 'Pull back / test' : deterioration || !old ? 'Hold / test' : 'Consider scaling';
  return { verdict, efficiency, marginalCac, ebitda30: future.ebitda,
    reason: verdict === 'Pull back / test' ? 'At the stated response assumption, the next customer costs more than their first-order contribution. Review the weakest activity before adding budget.'
      : verdict === 'Consider scaling' ? 'The model leaves positive contribution on extra acquisition. A controlled increase may add EBITDA if cash, stock and capacity support it.'
      : 'Keep spend controlled while validating acquisition costs and the return on the next pound. A profit-target shortfall alone is not a reason to cut profitable advertising.' };
}

/** Direction against a named benchmark; missing evidence never becomes healthy. */
export function performanceStatus(actual: number | null, benchmark: number | null, lowerBetter = false): 'good' | 'bad' | 'equal' | 'unknown' {
  if (actual === null || benchmark === null || !Number.isFinite(actual) || !Number.isFinite(benchmark)) return 'unknown';
  if (actual === benchmark) return 'equal';
  return (lowerBetter ? actual < benchmark : actual > benchmark) ? 'good' : 'bad';
}

/** Explain matched-scope ratio movements without inferring campaign causes. */
export function efficiencyDrivers(current: MarketingTotals, previous: MarketingTotals | null) {
  if (!previous) return null;
  const now = metrics(current), old = metrics(previous);
  const change = (amount: number, reference: number) => Number.isFinite(amount) && Number.isFinite(reference) && reference > 0 ? (amount / reference - 1) * 100 : null;
  return {
    cac: { actual: now.cac, previous: old.cac, numerator: change(current.acquisitionSpend, previous.acquisitionSpend), denominator: change(current.customers, previous.customers) },
    poas: { actual: now.poas, previous: old.poas, numerator: change(current.beforeAds, previous.beforeAds), denominator: change(current.advertising, previous.advertising) },
  };
}
