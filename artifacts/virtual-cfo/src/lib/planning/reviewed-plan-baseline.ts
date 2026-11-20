import { acquisitionFinancialContext, acquisitionView, type ReviewedMonth } from '../marketing/acquisition-evidence.ts';
import { linkedMarketingMetrics } from '../marketing/linked-model.ts';
import type { MarketingTotals } from '../marketing/review-model.ts';

export type ReviewedPlanBaselineInput = { month: ReviewedMonth; acquisition: unknown };
export type ReviewedPlanBaseline = {
  baseline30: MarketingTotals;
  sourcePeriod: { from: string; to: string; calendarDays: number; months: 3 };
  bindings: {
    company: string; currency: 'GBP'; timezone: 'Europe/London'; edition: string; anchor: string;
    months: {
      from: string; to: string; days: number; weight: 1 | 2 | 3;
      versionId: string; salesRevision: string; costRevision: string;
      acquisitionSourceHash: string; ordersHash: string; refundsHash: string; allocationHash: string;
      economicsSource: { costSourceHash: string; allocationHash: string; repeatMarketingHash: string };
      matureCohort: boolean;
    }[];
  };
};

const dayMs = 86_400_000;
const date = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T12:00:00Z`)) && new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;
const daysIn = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / dayMs) + 1;
const completeMonth = (from: string, to: string) => date(from) && date(to) && from.endsWith('-01')
  && to === new Date(Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)), 0)).toISOString().slice(0, 10);
const addDay = (v: string) => new Date(Date.parse(`${v}T12:00:00Z`) + dayMs).toISOString().slice(0, 10);
const money = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);

/** Pure fail-closed Plan baseline from three exact reviewed months and their matching acquisition proofs. */
export function reviewedPlanBaseline(entries: ReviewedPlanBaselineInput[]): ReviewedPlanBaseline | null {
  if (!Array.isArray(entries) || entries.length !== 3) return null;
  const first = entries[0]?.month;
  if (!first) return null;
  const anchor = first.selection.anchor;
  const company = first.selection.storeId;
  const edition = first.selection.edition;
  const currency = first.selection.currency;
  const timezone = first.selection.timezone;
  const weights = [1, 2, 3] as const;
  const bindings: ReviewedPlanBaseline['bindings']['months'] = [];
  const weighted: Record<keyof MarketingTotals, number> = {
    revenue: 0, beforeAds: 0, advertising: 0, acquisitionSpend: 0, overheads: 0, da: 0,
    orders: 0, customers: 0, firstContributionTotal: 0, firstRevenueTotal: 0, days: 0,
  };
  let totalCalendarDays = 0;
  let sourceFrom = '', sourceTo = '';

  for (let i = 0; i < 3; i++) {
    const entry = entries[i], month = entry?.month;
    if (!month || !entry.acquisition) return null;
    const sel = month.selection, from = sel.period.from, to = sel.period.to;
    if (sel.storeId !== company || sel.currency !== currency || sel.timezone !== timezone || sel.edition !== edition || sel.anchor !== anchor
      || !completeMonth(from, to) || !month.context || month.evidence.versionId !== sel.versionId
      || month.evidence.edition !== edition || month.evidence.anchor !== anchor) return null;
    if (i === 0) sourceFrom = from;
    if (i > 0 && addDay(entries[i - 1].month.selection.period.to) !== from) return null;
    sourceTo = to;

    const profit = month.input.profit;
    const requiredCosts = profit ? [profit.cogs, profit.variableCosts, profit.advertising, profit.overheads, profit.da,
      profit.contributionBeforeMarketing, profit.contribution, profit.ebitda] : [];
    if (profit?.state !== 'complete' || requiredCosts.some(component => component?.state !== 'ready' || !money(component.value))) return null;
    const metrics = linkedMarketingMetrics(month);
    const ctx = acquisitionFinancialContext(month);
    const view = ctx ? acquisitionView(entry.acquisition, ctx) : null;
    if (!metrics || !view || metrics.revenue === null || metrics.beforeAds === null || metrics.advertising === null
      || metrics.overheads === null || !money(profit.da.value) || !money(metrics.orders) || metrics.orders < 0
      || !view.economicsView || !view.economics || !view.economics.first || view.economics.first.acquisitionMetricsState !== 'supported'
      || view.coverage.paidFirstCustomers <= 0) return null;

    const acq = view;
    const econ = view.economics.first;
    const source = view.economics.source;
    const days = daysIn(from, to), weight = weights[i];
    if (days < 28 || days > 31 || !Number.isSafeInteger(days)) return null;
    const amountsPence: Record<keyof Omit<MarketingTotals, 'days' | 'orders' | 'customers'>, number> = {
      revenue: metrics.revenue,
      beforeAds: metrics.beforeAds,
      advertising: metrics.advertising,
      acquisitionSpend: acq.spend.acquisition,
      overheads: metrics.overheads,
      da: profit.da.value,
      firstContributionTotal: econ.contributionBeforeMarketing,
      firstRevenueTotal: econ.netProductSales + econ.netShipping,
    };
    if (Object.values(amountsPence).some(v => !money(v)) || !Number.isSafeInteger(econ.netProductSales + econ.netShipping)) return null;
    const dailyWeight = weight / days;
    // Source money is integer pence; convert each pence amount explicitly to pounds before scaling to 30 days.
    for (const [key, pence] of Object.entries(amountsPence) as [keyof typeof amountsPence, number][]) weighted[key] += (pence / 100) * dailyWeight;
    weighted.orders += metrics.orders * dailyWeight;
    weighted.customers += view.coverage.paidFirstCustomers * dailyWeight;
    weighted.days += days * dailyWeight;
    totalCalendarDays += days;
    bindings.push({ from, to, days, weight, versionId: sel.versionId, salesRevision: month.evidence.salesRevision,
      costRevision: month.evidence.costRevision, acquisitionSourceHash: view.source.sourceHash, ordersHash: view.source.ordersHash,
      refundsHash: view.source.refundsHash, allocationHash: view.source.allocationHash,
      economicsSource: { ...source }, matureCohort: view.economics.mature !== null });
  }

  const multiplier = 30 / 6;
  const baseline30 = Object.fromEntries(Object.entries(weighted).map(([key, amount]) => [key, key === 'days' ? 30 : amount * multiplier])) as MarketingTotals;
  if (baseline30.days !== 30 || Object.values(baseline30).some(v => !Number.isFinite(v))) return null;
  return { baseline30, sourcePeriod: { from: sourceFrom, to: sourceTo, calendarDays: totalCalendarDays, months: 3 },
    bindings: { company, currency: 'GBP', timezone: 'Europe/London', edition, anchor, months: bindings } };
}
