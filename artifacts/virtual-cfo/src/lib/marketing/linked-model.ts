import type { composeHistoryMonth } from '../v11/history-composition.ts';

type ReviewedMonth = NonNullable<ReturnType<typeof composeHistoryMonth>>;
const ratio = (numerator: number | null, denominator: number | null) => numerator !== null && denominator !== null && denominator > 0 ? numerator / denominator : null;
/** All amounts remain integer pence from the validated same-month composition.
 * Customer identity, acquisition allocation and response curves are intentionally absent. */
export function linkedMarketingMetrics(month: ReviewedMonth | null) {
  if (!month) return null;
  const profitConflict = month.view.primary.issues.some(issue => /does not reconcile|profit is withheld|Profit evidence does not match|Profit and sales evidence conflict/.test(issue));
  const profit = profitConflict ? null : month.input.profit;
  const component = (key: 'advertising' | 'contributionBeforeMarketing' | 'overheads' | 'da') => {
    const metric = profit?.[key];
    return metric?.state === 'ready' && Number.isSafeInteger(metric.value) ? metric.value : null;
  };
  const advertising = component('advertising'), beforeAds = month.view.primary.result.metrics.contributionBeforeMarketing;
  const overheadIncludingDA = component('overheads'), da = component('da');
  const overheads = overheadIncludingDA !== null && da !== null && Number.isSafeInteger(overheadIncludingDA - da) ? overheadIncludingDA - da : null;
  const revenue = month.amounts.turnover, contribution = month.amounts.contribution, ebitda = month.amounts.ebitda;
  const advertisingCapacity = beforeAds !== null && overheads !== null && Number.isSafeInteger(beforeAds - overheads) ? beforeAds - overheads : null;
  return { revenue, advertising, beforeAds, overheads, contribution, ebitda, orders: month.originalOrders,
    poas: ratio(beforeAds, advertising), roas: ratio(revenue, advertising),
    contributionPerOrder: ratio(contribution, month.originalOrders), advertisingCapacity,
    breakEvenPoas: ratio(beforeAds, advertisingCapacity), breakEvenRoas: ratio(revenue, advertisingCapacity),
    // No identity or matched acquisition evidence is present in this reporting contract.
    cac: null, firstOrderContribution: null, maturePaybackDays: null,
  };
}
