import type {useReviewedHistory} from '@/lib/useReviewedHistory';
import {reportingMonthLabel} from '@/lib/reportingMonth';
import {SharedReportingControls} from './SharedReportingControls';
import {monthlyRangeSupported, reportingRangeLabel, requestedReportingRange} from '@/lib/reportingRange';

type History = ReturnType<typeof useReviewedHistory>;
type Props = {history:History; monthLabel:string; comparison?:History; comparisonLabel?:string; planBaseline?:boolean};

/** The shared dates are preferences. Each reader still validates its own evidence. */
export function ConnectedReportingControls({history:h,monthLabel,comparison,comparisonLabel='Comparison month',planBaseline=false}:Props){
 const {selection,setSelection}=h.reporting;
 const selectedMonth=h.resolvedMonth;
 const comparisonMonth=comparison?.resolvedMonth??selection.comparisonMonth;
 const loading=h.loadingMonths||h.loading;
 const rangeSupported=monthlyRangeSupported(selection);
 const range=requestedReportingRange(selection);
 const lastDay=range?new Date(range.to+'T12:00:00Z'):null;
 const planEndSupported=!!lastDay&&new Date(Date.UTC(lastDay.getUTCFullYear(),lastDay.getUTCMonth()+1,0)).toISOString().slice(0,10)===range?.to;
 return <div className="connected-reporting-context" aria-busy={loading} aria-label={monthLabel.replace(/month$/i,'dates')}>
  <SharedReportingControls selection={selection} onChange={setSelection} includeNoComparison sharedAcrossPages contextLabel={reportingRangeLabel(selection)}>
   {comparison&&<details className="src-custom-comparison"><summary>Choose a different comparison month</summary>
    <label>Comparison month <select aria-label={comparisonLabel} value={comparisonMonth} disabled={comparison.loadingMonths}
     onChange={e=>comparison.selectMonth(e.target.value)}><option value="">No comparison</option>
     {comparisonMonth&&!comparison.months.some(m=>m.from===comparisonMonth)&&<option value={comparisonMonth}>{reportingMonthLabel(comparisonMonth)}</option>}
     {comparison.months.map(m=><option key={m.from} value={m.from} disabled={!!selectedMonth&&m.to>=selectedMonth}>{reportingMonthLabel(m.from)}</option>)}
    </select></label>
   </details>}
   {loading&&<p role="status" aria-live="polite" className="src-context src-read-status">{h.loadingMonths?'Loading reporting dates…':'Loading figures…'}</p>}
   {!loading&&!rangeSupported&&!planBaseline&&<p className="src-context">Figures for this view are not connected yet. A dash means no checked figure for the selected period; it does not mean zero.</p>}
   {planBaseline&&<p className="src-context">{planEndSupported?'Plan’s starting point uses three complete calendar months ending at the selected period end. Future scenario dates are controlled separately below.':'Plan needs a period ending on a complete calendar month; choose Last month or suitable Custom dates.'}</p>}
  </SharedReportingControls>
 </div>;
}
