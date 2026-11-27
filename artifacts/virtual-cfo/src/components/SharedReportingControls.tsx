import { useId } from 'react';
import type { ReportingSelection, ReportingSelectionPatch, ReportingPeriod, ReportingView, ReportingComparison } from '@/lib/reportingSelection';
import './shared-reporting-controls.css';

type Props = {
  selection: ReportingSelection;
  onChange: (patch: ReportingSelectionPatch) => void;
  /** Already-resolved dates and coverage, supplied by the page's actual model. */
  contextLabel?: string;
  disabled?: boolean;
  className?: string;
  includeNoComparison?: boolean;
  unavailable?: {
    period?: readonly ReportingPeriod[];
    view?: readonly ReportingView[];
    comparison?: readonly ReportingComparison[];
    amount?: readonly ('total' | 'per-order')[];
  };
  availabilityNote?: string;
};

export function SharedReportingControls({ selection, onChange, contextLabel, disabled = false, className = '', includeNoComparison = false, unavailable, availabilityNote }: Props) {
  const noteId = useId();
  return <section className={`shared-reporting-controls ${className}`} aria-label="Reporting controls" aria-describedby={availabilityNote ? noteId : undefined}>
    <div className="src-control-row">
      <fieldset className="src-control-group src-amounts" disabled={disabled}><legend>Amounts</legend><div className="src-segments">
        <button type="button" aria-pressed={!selection.perOrder} disabled={unavailable?.amount?.includes('total')} onClick={() => onChange({ perOrder: false })}>Total</button>
        <button type="button" aria-pressed={selection.perOrder} disabled={unavailable?.amount?.includes('per-order')} onClick={() => onChange({ perOrder: true })}>Per order</button>
      </div></fieldset>
      <fieldset className="src-control-group src-period" disabled={disabled}><legend>Period</legend><div className="src-segments">
        {(['last-week', 'last-month', 3, 6, 12] as const).map(period => <button type="button" key={period} aria-pressed={selection.period === period} disabled={unavailable?.period?.includes(period)} onClick={() => onChange({ period })}>{period === 'last-week' ? 'Last week' : period === 'last-month' ? 'Last month' : `${period} months`}</button>)}
      </div></fieldset>
    </div>
    <div className="src-control-row">
      <fieldset className="src-control-group" disabled={disabled}><legend>View</legend><div className="src-segments">
        {(['weekly', 'monthly'] as const).map(view => <button type="button" key={view} aria-pressed={selection.view === view} disabled={unavailable?.view?.includes(view)} onClick={() => onChange({ view })}>{view === 'weekly' ? 'Weekly' : 'Monthly'}</button>)}
      </div></fieldset>
      <fieldset className="src-control-group src-compare" disabled={disabled}><legend>Compare</legend><div className="src-segments">
        <button type="button" aria-pressed={selection.comparison === 'last-year'} disabled={unavailable?.comparison?.includes('last-year')} onClick={() => onChange({ comparison: 'last-year' })}>Last year</button>
        <button type="button" aria-pressed={selection.comparison === 'rolling'} disabled={unavailable?.comparison?.includes('rolling')} onClick={() => onChange({ comparison: 'rolling' })}>{selection.view === 'weekly' ? 'Previous 12-week average' : 'Previous 3-month average'}</button>
        {(includeNoComparison || selection.comparison === 'none') && <button type="button" aria-pressed={selection.comparison === 'none'} disabled={unavailable?.comparison?.includes('none')} onClick={() => onChange({ comparison: 'none' })}>None</button>}
        {selection.comparison === 'custom' && <button type="button" aria-pressed disabled={unavailable?.comparison?.includes('custom')} onClick={() => onChange({ comparison: 'custom' })}>Selected month</button>}
      </div></fieldset>
    </div>
    {contextLabel && <p className="src-context">{contextLabel}</p>}
    {availabilityNote && <p id={noteId} className="src-context src-availability">{availabilityNote}</p>}
  </section>;
}
