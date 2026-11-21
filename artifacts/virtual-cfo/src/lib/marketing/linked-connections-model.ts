import type { composeHistoryMonth } from '../v11/history-composition.ts';
import { linkedMarketingMetrics } from './linked-model.ts';

type ReviewedMonth = NonNullable<ReturnType<typeof composeHistoryMonth>>;
type Metrics = NonNullable<ReturnType<typeof linkedMarketingMetrics>>;
const financialKeys = ['revenue', 'advertising', 'beforeAds', 'overheads', 'contribution', 'ebitda'] as const;
const safe = (value: number) => Number.isSafeInteger(value) ? value : null;
const ratio = (n: number | null, d: number | null) => n !== null && d !== null && d > 0 ? n / d : null;

/** Aggregate matching, contiguous reviewed months; never average monthly ratios. */
export function linkedMarketingHistory(months: ReviewedMonth[]) {
  if (!months.length) return null;
  const first = months[0].selection;
  const rows = months.map(month => ({ month, metrics: linkedMarketingMetrics(month)! }));
  for (let i = 0; i < months.length; i++) {
    const selection = months[i].selection;
    if (selection.storeId !== first.storeId || selection.currency !== first.currency || selection.timezone !== first.timezone || selection.edition !== first.edition || selection.anchor !== first.anchor) return null;
    if (i) {
      const next = new Date(`${months[i - 1].selection.period.to}T12:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      if (next.toISOString().slice(0, 10) !== selection.period.from) return null;
    }
  }
  const sum = (key: typeof financialKeys[number]) => {
    const values = rows.map(row => row.metrics[key]);
    return values.some(value => value === null) ? null : safe(Number(values.reduce<bigint>((total, value) => total + BigInt(value!), 0n)));
  };
  const totals = Object.fromEntries(financialKeys.map(key => [key, sum(key)])) as Pick<Metrics, typeof financialKeys[number]>;
  const orders = safe(Number(rows.reduce((total, row) => total + BigInt(row.metrics.orders), 0n)));
  if (orders === null) return null;
  return { rows, totals: { ...totals, orders, poas: ratio(totals.beforeAds, totals.advertising), roas: ratio(totals.revenue, totals.advertising) } };
}

/** Historical fixed-sales thresholds, not marginal CAC or permission to spend. */
export function linkedMarketingThresholds(base: Metrics | null, target: number | null) {
  if (!base || target !== null && (!Number.isSafeInteger(target) || target < 0)) return null;
  const capacity = base.beforeAds !== null && base.overheads !== null ? safe(base.beforeAds - base.overheads - (target ?? 0)) : null;
  return { capacity, poas: ratio(base.beforeAds, capacity), roas: ratio(base.revenue, capacity),
    contributionNeeded: base.overheads === null ? null : safe(base.overheads + (target ?? 0)),
    targetGap: target === null || base.ebitda === null ? null : safe(target - base.ebitda) };
}

/** One selected historical month held as a baseline; no customer/allocation/response facts invented. */
export function linkedFinancialScenario(base: Metrics | null, input: { advertisingChangePct: number; contributionChangePct: number; extraOverheads: number }) {
  if (!base || base.beforeAds === null || base.advertising === null || base.overheads === null || base.ebitda === null
    || !Number.isFinite(input.advertisingChangePct) || input.advertisingChangePct < -100 || input.advertisingChangePct > 500
    || !Number.isFinite(input.contributionChangePct) || input.contributionChangePct < -100 || input.contributionChangePct > 500
    || !Number.isSafeInteger(input.extraOverheads) || input.extraOverheads < 0) return null;
  const advertising = safe(Math.round(base.advertising * (1 + input.advertisingChangePct / 100)));
  const beforeAds = safe(Math.round(base.beforeAds * (1 + input.contributionChangePct / 100)));
  const overheads = safe(base.overheads + input.extraOverheads);
  if (advertising === null || beforeAds === null || overheads === null) return null;
  const contribution = safe(beforeAds - advertising);
  const ebitda = contribution === null ? null : safe(contribution - overheads);
  if (ebitda === null) return null;
  const difference = safe(ebitda - base.ebitda);
  return difference === null ? null : { advertising, beforeAds, overheads, contribution, ebitda, difference,
    contributionEffect: beforeAds - base.beforeAds, advertisingEffect: base.advertising - advertising, overheadEffect: -input.extraOverheads };
}
