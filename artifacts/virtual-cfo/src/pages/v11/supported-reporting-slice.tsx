import { useState } from 'react';
import { supportedSlice } from '../../lib/v11/supported-slice';
import type { ReportingAdapterInput } from '../../lib/v11/reporting-adapter';
import type { DateRange } from '../../lib/v11/types';

const amount = (pence: number | null, currency: string) => pence === null ? 'Unavailable' : new Intl.NumberFormat('en-GB', {style:'currency',currency}).format(pence / 100);
/** Prepared authenticated-page composition point. Caller must use authorised reader data and canonical metadata. */
export function SupportedReportingSlice({ current, comparison = null }: {
  current: ReportingAdapterInput;
  comparison?: { period: DateRange; input: ReportingAdapterInput | null } | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const view = supportedSlice(current, comparison);
  return <section aria-label="Supported profit and sales evidence">
    <h2>What the supported evidence shows</h2>
    <p>{current.expected.period.from} – {current.expected.period.to} · {current.expected.currency} · {current.expected.timezone}</p>
    <p>{view.primary.state === 'stale' ? 'Dated retained evidence — freshness is unconfirmed.' : view.primary.context ? 'Review the supported figures and their evidence.' : 'Evidence is unavailable. Review source coverage before drawing conclusions.'}</p>
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>Explore the Numbers</button>
    {view.primary.issues.map(issue => <p key={issue}>{issue}</p>)}
    {view.comparisonIssue && <p>{view.comparisonIssue}</p>}
    <dl>{view.metrics.map(metric => <div key={metric.id}><dt>{metric.label}</dt><dd>{amount(metric.valuePence, current.expected.currency)}</dd></div>)}</dl>
    {expanded && <div>
      <p>Business: {current.expected.storeId} · Snapshot: {view.primary.context?.snapshotId ?? 'Unavailable'} · As of: {view.primary.context?.snapshotAsOf ?? 'Unavailable'} · Formula: {view.primary.context?.formulaVersion ?? 'Unavailable'}</p>
      <p>Source basis: {view.primary.source}. Comparison snapshot: {view.comparison?.context?.snapshotId ?? 'Unavailable'} · Comparison as of: {view.comparison?.context?.snapshotAsOf ?? 'Unavailable'}.</p>
      <p>Amounts are {current.mode === 'per-order' ? 'per original eligible order' : 'period totals'}. Missing values remain unavailable. Cash and marketing attribution are outside this slice.</p>
      <div className="v11-table-scroll" role="region" aria-label="Displayed figures evidence table" tabIndex={0} style={{overflowX: 'auto', maxWidth: '100%'}}><table><caption>Evidence for the displayed figures</caption><thead><tr><th>Metric</th><th>Current</th><th>Comparison</th><th>Change</th><th>Formula</th></tr></thead><tbody>{view.metrics.map(metric => <tr key={metric.id}><th scope="row">{metric.label}</th><td>{amount(metric.valuePence, current.expected.currency)}</td><td>{amount(metric.comparisonPence, current.expected.currency)}</td><td>{amount(metric.changePence, current.expected.currency)}</td><td>{metric.formula}</td></tr>)}</tbody></table></div>
    </div>}
  </section>;
}
