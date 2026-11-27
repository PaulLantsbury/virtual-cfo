import type {useReviewedHistory} from '@/lib/useReviewedHistory';
import {reportingMonthLabel} from '@/lib/reportingMonth';
import {SharedReportingControls} from './SharedReportingControls';
import {reportingRangeLabel} from '@/lib/reportingRange';

type History = ReturnType<typeof useReviewedHistory>;
type Props = {history:History; monthLabel:string; comparison?:History; comparisonLabel?:string; planBaseline?:boolean};

/** The shared dates are preferences. Each reader still validates its own evidence. */
export function ConnectedReportingControls({history:h,monthLabel,comparison,comparisonLabel='Comparison month',planBaseline=false}:Props){
 const {selection,setSelection}=h.reporting;
 const selectedMonth=h.resolvedMonth;
 const comparisonMonth=comparison?.resolvedMonth??selection.comparisonMonth;
 const loading=h.loadingMonths||h.loading;
 const allocated=!!h.month&&'range' in h.month&&typeof h.month.range==='object'&&h.month.range!==null&&'allocationBasis' in h.month.range&&h.month.range.allocationBasis==='allocated-recurring-monthly-costs';
 const planEnd=planBaseline&&/^\d{4}-\d{2}-01$/.test(h.resolvedMonth)?new Date(h.resolvedMonth+'T12:00:00Z'):null;
 if(planEnd){planEnd.setUTCMonth(planEnd.getUTCMonth()+1);planEnd.setUTCDate(0);}
 const planEndLabel=planEnd?.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 return <div className="connected-reporting-context" aria-busy={loading} aria-label={monthLabel.replace(/month$/i,'dates')}>
  <SharedReportingControls selection={selection} onChange={setSelection} includeNoComparison sharedAcrossPages contextLabel={reportingRangeLabel(selection)}>
   {comparison&&<details className="src-custom-comparison"><summary>Choose a different comparison month</summary>
    <label>Comparison month <select aria-label={comparisonLabel} value={comparisonMonth} disabled={comparison.loadingMonths}
     onChange={e=>comparison.selectMonth(e.target.value)}><option value="">No comparison</option>
     {comparisonMonth&&!comparison.months.some(m=>m.from===comparisonMonth)&&<option value={comparisonMonth}>{reportingMonthLabel(comparisonMonth)}</option>}
     {comparison.months.map(m=><option key={m.from} value={m.from} disabled={!!h.requestedRange&&m.to>=h.requestedRange.from}>{reportingMonthLabel(m.from)}</option>)}
    </select></label>
   </details>}
   {loading&&<p role="status" aria-live="polite" className="src-context src-read-status">{h.loadingMonths?'Loading reporting dates…':'Loading figures…'}</p>}
   {!loading&&h.error&&!planBaseline&&<p className="src-context">{h.error} A dash does not mean zero.</p>}
   {allocated&&<p className="src-context">Allocated from monthly costs: profit includes a calendar-day share of month-end payroll. Other costs retain their reliable dates; bank cash is not allocated.</p>}
   {h.rangeMode&&h.month&&!allocated&&<p className="src-context">Combined complete monthly actuals. Rates and per-order figures use the summed amounts and original orders.</p>}
   {planBaseline&&<p className="src-context">{planEndLabel?`Plan’s starting point uses three complete calendar months ending ${planEndLabel}, on or before the selected period end. Future scenario dates are controlled separately below.`:'Choose valid dates to choose a completed-month starting point for Plan.'}</p>}
  </SharedReportingControls>
 </div>;
}
