import { useState, type ReactNode } from 'react';
import { MetricCard, Verdict, Notice } from '../../components/v11/primitives';
import './workspace.css';
import { supportedSlice } from '../../lib/v11/supported-slice';
import type { ReportingAdapterInput } from '../../lib/v11/reporting-adapter';
import type { DateRange } from '../../lib/v11/types';

const amount = (pence: number | null, currency: string) => pence === null ? 'Unavailable' : new Intl.NumberFormat('en-GB', {style:'currency',currency}).format(pence / 100);
/** Prepared authenticated-page composition point. Caller must use authorised reader data and canonical metadata. */
export function SupportedReportingSlice({ current, comparison = null, preparedView, additionalEvidence }: {
  current: ReportingAdapterInput;
  additionalEvidence?: ReactNode;
  preparedView?: ReturnType<typeof supportedSlice>;
  comparison?: { period: DateRange; input: ReportingAdapterInput | null } | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const calculated = supportedSlice(current, comparison);
  // A prepared result is an optimisation hint, never authority for a different scope or amount.
  const view = preparedView && JSON.stringify(preparedView) === JSON.stringify(calculated) ? preparedView : calculated;
  const title = view.primary.state === 'stale'
    ? 'Review the dated retained evidence.'
    : view.primary.context ? view.primary.result.metrics.ebitda === null ? 'Sales are supported; profit evidence is incomplete.' : `Selected-period EBITDA: ${amount(view.primary.result.metrics.ebitda, current.expected.currency)}.`
    : 'Evidence is unavailable for this period.';
  return <section className="v11-workspace" aria-label="Supported profit and sales evidence">
    <Verdict eyebrow="Supported reader slice" title={title}
      description={view.primary.context ? `Next, inspect the same figures and source context in Explore the Numbers. ${view.comparisonAvailable ? 'A matching comparison is selected.' : 'No supported comparison is selected.'} Cash and broader diagnostics are outside this slice.` : 'Check the selected month and source coverage before drawing financial conclusions.'}
      action={<button className="v11-explore" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>Explore the Numbers</button>} />
    <p className="v11-context-caption">{current.expected.period.from} – {current.expected.period.to} · {current.expected.currency} · {current.expected.timezone}</p>
    {view.primary.issues.map(issue => <Notice key={issue}>{issue}</Notice>)}
    {view.comparisonIssue && <Notice>{view.comparisonIssue}</Notice>}
    <div className="v11-card-grid four">{view.metrics.map(metric => <MetricCard key={metric.id} title={metric.label} value={amount(metric.valuePence, current.expected.currency)} detail={`${current.mode === 'per-order' ? 'Per original eligible order' : 'Selected period total'}${metric.id === 'netProductSales' || metric.id === 'grossProfit' ? ' · excludes shipping and VAT' : ' · excludes VAT'}`} />)}</div>
    <p className="v11-context-caption">{current.mode === 'per-order' ? 'Revenue per original eligible order' : 'Net turnover'}: {amount(view.primary.result.metrics.revenue, current.expected.currency)} = net product sales + net shipping ({amount(view.primary.result.metrics.netShipping, current.expected.currency)}). VAT is excluded; turnover and product sales are different measures.</p>
    {expanded && <div className="v11-panel">
      {additionalEvidence}
      <p>Business: {current.expected.storeId} · Snapshot: {view.primary.context?.snapshotId ?? 'Unavailable'} · As of: {view.primary.context?.snapshotAsOf ?? 'Unavailable'} · Formula: {view.primary.context?.formulaVersion ?? 'Unavailable'}</p>
      <p>Source basis: {view.primary.source}. Source freshness refers to the verified canonical revision; provider collection and scheduled checks are unverified. Comparison snapshot: {view.comparison?.context?.snapshotId ?? 'Unavailable'} · Comparison as of: {view.comparison?.context?.snapshotAsOf ?? 'Unavailable'}.</p>
      <p>Amounts are {current.mode === 'per-order' ? 'per original eligible order' : 'period totals'}. Missing values remain unavailable. Cash and marketing attribution are outside this slice.</p>
      <div className="v11-table-scroll" role="region" aria-label="Displayed figures evidence table" tabIndex={0} style={{overflowX: 'auto', maxWidth: '100%'}}><table className="v11-table"><caption>Evidence for the displayed figures</caption><thead><tr><th>Metric</th><th>Current</th><th>Comparison</th><th>Change</th><th>Formula</th></tr></thead><tbody>{view.metrics.map(metric => <tr key={metric.id}><th scope="row">{metric.label}</th><td>{amount(metric.valuePence, current.expected.currency)}</td><td>{amount(metric.comparisonPence, current.expected.currency)}</td><td>{amount(metric.changePence, current.expected.currency)}</td><td>{metric.formula}</td></tr>)}</tbody></table></div>
    </div>}
  </section>;
}
