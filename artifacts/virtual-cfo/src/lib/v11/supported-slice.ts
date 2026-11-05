import { adaptSupportedReporting, type ReportingAdapterInput } from './reporting-adapter.ts';
import { METRIC_DEFINITIONS } from './evidence.ts';
import type { DateRange, MetricId } from './types.ts';

/** Already-authorised reader results only. No fixture fallback, requests, or inferred snapshot dates. */
export function supportedSlice(current: ReportingAdapterInput, comparison: { period: DateRange; input: ReportingAdapterInput | null } | null = null) {
  const primary = adaptSupportedReporting(current);
  const candidate = comparison?.input;
  const scope = current.expected;
  const comparisonMatches = !!candidate && !!comparison && candidate.expected.storeId === scope.storeId
    && (candidate.sourceBasis ?? "shopify-operational") === (current.sourceBasis ?? "shopify-operational")
    && candidate.expected.currency === scope.currency && candidate.expected.timezone === scope.timezone
    && candidate.expected.period.from === comparison.period.from && candidate.expected.period.to === comparison.period.to
    && candidate.expected.period.to < scope.period.from && (candidate.mode ?? 'total') === (current.mode ?? 'total');
  const prior = comparisonMatches ? adaptSupportedReporting(candidate!) : null;
  // Stale retained amounts can be inspected, but do not support a new comparative verdict.
  const comparable = !!primary.context && !primary.isRetained && !!prior?.context && !prior.isRetained;
  const keys: MetricId[] = ['netProductSales', 'grossProfit', 'cm3', 'ebitda'];
  const metrics = keys.map(id => ({
    id, label: METRIC_DEFINITIONS[id].label, formula: METRIC_DEFINITIONS[id].formula,
    valuePence: primary.result.metrics[id],
    comparisonPence: comparable ? prior!.result.metrics[id] : null,
    changePence: comparable && primary.result.metrics[id] !== null && prior!.result.metrics[id] !== null
      ? primary.result.metrics[id]! - prior!.result.metrics[id]! : null,
  }));
  return { primary, comparison: prior, metrics, comparisonAvailable: comparable,
    comparisonIssue: comparison && !comparable ? 'Matching current comparison evidence is unavailable; comparative claims are withheld.' : null };
}
