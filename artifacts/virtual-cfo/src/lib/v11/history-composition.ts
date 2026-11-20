import { historySupportedInput, type HistorySelection } from './history-supported.ts';
import { supportedSlice } from './supported-slice.ts';

export const HISTORY_SERIES = [
  ['netProductSales', 'Net product sales'], ['netShipping', 'Net shipping'], ['turnover', 'Net turnover'],
  ['grossProfit', 'Product gross profit'], ['contribution', 'Contribution after marketing (CM3)'],
  ['operatingProfit', 'Operating profit'], ['ebitda', 'EBITDA'],
] as const;
export type HistorySeriesId = typeof HISTORY_SERIES[number][0];
function immutable<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}
/** One verified month; charts, commentary and evidence all consume this same composition. */
export function composeHistoryMonth(raw: unknown, selection: HistorySelection) {
  // Own the evidence snapshot: later cache/selection mutations cannot change displayed scope.
  raw = structuredClone(raw);
  selection = structuredClone(selection);
  const input = historySupportedInput(raw, selection), view = supportedSlice(input);
  if (!view.primary.context) return null;
  const metrics = view.primary.result.metrics;
  const da = input.profit?.da.state === 'ready' ? input.profit.da.value : null;
  const operatingProfit = metrics.ebitda !== null && da !== null && Number.isSafeInteger(metrics.ebitda - da) ? metrics.ebitda - da : null;
  const amounts: Record<HistorySeriesId, number | null> = {
    netProductSales: metrics.netProductSales, netShipping: metrics.netShipping, turnover: metrics.revenue,
    grossProfit: metrics.grossProfit, contribution: metrics.cm3, operatingProfit, ebitda: metrics.ebitda,
  };
  return immutable({ input, view, selection, amounts, originalOrders: input.sales!.originalOrders,
    originalProductSales: input.sales!.grossProductSales - input.sales!.discounts,
    context: view.primary.context,
    evidence: { financialProfile: 'uk-gifts-v2' as const, edition: selection.edition, anchor: selection.anchor, versionId: selection.versionId,
      salesRevision: (raw as any).salesRevision as string, costRevision: (raw as any).costRevision as string,
      observedAt: (raw as any).metadata.observedAt as string, verification: 'canonical-source-revision-only' as const,
      coverage: input.sales!.provenance.coverageEvidence, costCoverage: input.profit?.state ?? 'unavailable' },
  });
}
/** Preparation for an explicit multi-month selection. No fetching or implicit latest-version selection. */
export function composeHistorySeries(entries: { response: unknown; selection: HistorySelection }[]) {
  const months = entries.map(entry => composeHistoryMonth(entry.response, entry.selection));
  if (!months.length || months.some(month => !month)) return null;
  const verified = months as NonNullable<typeof months[number]>[];
  const first = verified[0].selection;
  for (let i = 0; i < verified.length; i++) {
    const selection = verified[i].selection;
    if (selection.storeId !== first.storeId || selection.edition !== first.edition || selection.anchor !== first.anchor
      || selection.currency !== first.currency || selection.timezone !== first.timezone) return null;
    if (i) {
      const next = new Date(`${verified[i - 1].selection.period.to}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
      if (next.toISOString().slice(0, 10) !== selection.period.from) return null;
    }
  }
  const sum = (values: (number | null)[]) => values.some(value => value === null) ? null : Number(values.reduce<bigint>((total, value) => total + BigInt(value!), 0n));
  const amounts = Object.fromEntries(HISTORY_SERIES.map(([id]) => [id, sum(verified.map(month => month.amounts[id]))])) as Record<HistorySeriesId, number | null>;
  const originalOrders = sum(verified.map(month => month.originalOrders))!;
  const originalProductSales = sum(verified.map(month => month.originalProductSales))!;
  if (![originalOrders, originalProductSales, ...Object.values(amounts).filter(value => value !== null)].every(Number.isSafeInteger)) return null;
  const ratio = (numerator: number | null, denominator: number) => numerator !== null && denominator > 0 ? numerator / denominator : null;
  return { months: verified, amounts, originalOrders,
    perOrder: Object.fromEntries(HISTORY_SERIES.map(([id]) => [id, ratio(amounts[id], originalOrders)])),
    aov: ratio(originalProductSales, originalOrders),
    grossMargin: ratio(amounts.grossProfit, amounts.netProductSales ?? 0),
    contributionMargin: ratio(amounts.contribution, amounts.turnover ?? 0), operatingMargin: ratio(amounts.operatingProfit, amounts.turnover ?? 0),
    ebitdaMargin: ratio(amounts.ebitda, amounts.turnover ?? 0) };
}
