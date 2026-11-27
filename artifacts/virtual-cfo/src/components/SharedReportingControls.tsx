import { useEffect, useId, useState, type ReactNode } from 'react';
import type { ReportingSelection, ReportingSelectionPatch, ReportingPeriod, ReportingView, ReportingComparison } from '@/lib/reportingSelection';
import { requestedReportingRange, reportingLondonToday, validReportingDate } from '@/lib/reportingRange';
import './shared-reporting-controls.css';

type Props = {
  selection: ReportingSelection;
  onChange: (patch: ReportingSelectionPatch) => void;
  /** Resolved dates and source context, supplied by the page's actual model. */
  contextLabel?: string;
  disabled?: boolean;
  className?: string;
  includeNoComparison?: boolean;
  sharedAcrossPages?: boolean;
  children?: ReactNode;
  unavailable?: {
    period?: readonly ReportingPeriod[];
    view?: readonly ReportingView[];
    comparison?: readonly ReportingComparison[];
    amount?: readonly ('total' | 'per-order')[];
  };
  availabilityNote?: string;
};

/** Compact shared preferences. Only Apply dates commits edited custom fields. */
export function SharedReportingControls({ selection, onChange, contextLabel, disabled = false, className = '', includeNoComparison = false, sharedAcrossPages = false, unavailable, availabilityNote, children }: Props) {
  const noteId = useId();
  const [draftFrom, setDraftFrom] = useState(selection.customFrom);
  const [draftTo, setDraftTo] = useState(selection.customTo);
  const [dateError, setDateError] = useState('');
  useEffect(() => { setDraftFrom(selection.customFrom); setDraftTo(selection.customTo); setDateError(''); }, [selection.customFrom, selection.customTo]);
  const today = reportingLondonToday();
  const choosePeriod = (period: ReportingPeriod) => {
    setDateError('');
    if (period === 'custom' && selection.period !== 'custom') {
      const range = requestedReportingRange(selection);
      onChange({ period, customFrom: range?.from ?? selection.customFrom, customTo: range?.to ?? selection.customTo });
    } else onChange({ period });
  };
  const applyDates = () => {
    if (!validReportingDate(draftFrom) || !validReportingDate(draftTo) || draftFrom > draftTo || draftTo > today) {
      setDateError('Choose valid dates, with the start on or before the end and neither date in the future.');
      return;
    }
    setDateError(''); onChange({ period: 'custom', customFrom: draftFrom, customTo: draftTo });
  };
  return <section className={`shared-reporting-controls ${className}`} aria-label="Reporting controls" aria-describedby={availabilityNote ? noteId : undefined}>
    <div className="src-control-row src-primary-row">
      <fieldset className="src-control-group src-period" disabled={disabled}><legend>Period</legend><div className="src-segments">
        {(['last-week', 'last-month', 3, 6, 12, 'custom'] as const).map(period => <button type="button" key={period} aria-pressed={selection.period === period} disabled={unavailable?.period?.includes(period)} onClick={() => choosePeriod(period)}>{period === 'last-week' ? 'Last week' : period === 'last-month' ? 'Last month' : period === 'custom' ? 'Custom' : `${period} months`}</button>)}
      </div></fieldset>
    </div>
    {selection.period === 'custom' && <div className="src-custom-dates">
      <label>From<input type="date" aria-label="Custom start date" value={draftFrom} max={today} disabled={disabled} onChange={event => { setDraftFrom(event.target.value); setDateError(''); }}/></label>
      <label>To<input type="date" aria-label="Custom end date" value={draftTo} max={today} disabled={disabled} onChange={event => { setDraftTo(event.target.value); setDateError(''); }}/></label>
      <button type="button" className="src-apply-dates" disabled={disabled} onClick={applyDates}>Apply dates</button>
      {dateError && <p className="src-date-error" role="alert">{dateError}</p>}
    </div>}
    <div className="src-control-row src-secondary-row">
      <fieldset className="src-control-group src-amounts" disabled={disabled}><legend>Amounts</legend><div className="src-segments">
        <button type="button" aria-pressed={!selection.perOrder} disabled={unavailable?.amount?.includes('total')} onClick={() => onChange({ perOrder: false })}>Total</button>
        <button type="button" aria-pressed={selection.perOrder} disabled={unavailable?.amount?.includes('per-order')} onClick={() => onChange({ perOrder: true })}>Per order</button>
      </div></fieldset>
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
    {(contextLabel || sharedAcrossPages) && <div className="src-summary" aria-live="polite">{contextLabel && <p className="src-context">{contextLabel}</p>}{sharedAcrossPages && <span>Used across all five pages</span>}</div>}
    {children}
    {availabilityNote && <p id={noteId} className="src-context src-availability">{availabilityNote}</p>}
  </section>;
}
