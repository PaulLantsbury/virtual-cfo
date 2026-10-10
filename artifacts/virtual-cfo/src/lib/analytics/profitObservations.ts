import type { ProfitMetric, ProfitReport } from './useProfitReporting';

export type ProfitObservation = {
  id: string;
  title: string;
  observation: string;
  driver: string;
  impact: string;
  action: string;
  evidence: string;
};

/** A presentation of one shared snapshot, with no recalculation or business thresholds. */
export function buildProfitObservations({ report, scope, loading = false, reason }: {
  report: ProfitReport | null;
  scope: ProfitReport['scope'];
  loading?: boolean;
  reason?: string | null;
}): { status: string; cards: ProfitObservation[] } {
  if (loading) return { status: 'Checking the selected month’s profit evidence…', cards: [] };
  if (!report) return { status: reason || 'Profit observations need supporting evidence for the selected month.', cards: [] };
  if (!Object.entries(scope).every(([key, value]) => report.scope[key as keyof typeof scope] === value)) {
    return { status: 'Profit observations do not match the selected store, currency or period.', cards: [] };
  }
  const money = (metric: ProfitMetric) => metric.state === 'ready' && typeof metric.value === 'number' && Number.isFinite(metric.value)
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: scope.currency }).format(metric.value / 100)
    : null;
  const input = (label: string, metric: ProfitMetric) => `${label}: ${money(metric) ?? 'unavailable'}.`;
  const definitions = [
    { id: 'gross-profit', title: 'Gross profit', metric: report.grossProfit,
      driver: `${input('Historical costs of sales', report.originalCosts)} ${input('Saleable-stock cost recovery', report.recoveredCosts)} ${input('Net cost of goods sold', report.cogs)} Recoveries follow the evidenced stock-return date, independently of the refund date.`,
      action: 'Inspect the sales and historical-cost breakdown in Profit Overview.' },
    { id: 'contribution', title: 'Contribution after marketing', metric: report.contribution,
      driver: `${input('Contribution before marketing', report.contributionBeforeMarketing)} ${input('Advertising spend', report.advertising)} Before-marketing contribution already includes net shipping revenue and variable operating costs.`,
      action: 'Inspect the variable costs and advertising evidence in Profit Overview.' },
    { id: 'operating-profit', title: 'Operating profit', metric: report.operatingProfit,
      driver: `${input('Operating overheads', report.overheads)} ${input('Depreciation and amortisation within overheads', report.da)} ${input('EBITDA', report.ebitda)} EBITDA adds back that depreciation and amortisation; it is not available cash.`,
      action: 'Inspect the classified overheads and EBITDA breakdown in Profit Overview.' },
  ];
  return {
    status: `Selected month: ${scope.from} – ${scope.to} · ${scope.currency}. These are reported amounts, not changes against another month.`,
    cards: definitions.map(({ id, title, metric, driver, action }) => {
      const amount = money(metric);
      return {
        id, title,
        observation: amount === null ? `${title} is unavailable for the selected month.` : `${title} for the selected month is ${amount}.`,
        driver,
        impact: amount === null ? 'No supported amount can be stated for this subtotal.' : `${amount} of ${title.toLowerCase()} in this month; this is not an estimated saving or future outcome.`,
        action,
        evidence: amount === null
          ? metric.reason || 'Required evidence is incomplete. Earlier supported subtotals remain available.'
          : 'This subtotal has supporting evidence in the selected report. This does not certify other subtotals or constitute a financial review approval.',
      };
    }),
  };
}
