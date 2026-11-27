import type {useReviewedHistory} from '@/lib/useReviewedHistory';
import {reportingMonthLabel} from '@/lib/reportingMonth';
import {SharedReportingControls} from './SharedReportingControls';
import {reportingRangeLabel} from '@/lib/reportingRange';

type History = ReturnType<typeof useReviewedHistory>;
type Props = {history:History; monthLabel:string; comparison?:History; comparisonLabel?:string; planBaseline?:boolean};

/** One visual control contract. Display preferences are not report authority. */
export function ConnectedReportingControls({history:h,monthLabel,comparison,comparisonLabel='Comparison month',planBaseline=false}:Props){
 const {selection,setSelection}=h.reporting;
 const selectedMonth=selection.month;
 const months=h.months;
 const hasSelectedOption=months.some(m=>m.from===selectedMonth);
 const loading=h.loadingMonths||h.loading;
 const rangeSupported=selection.period==='last-month'&&selection.view==='monthly';
 return <div className="connected-reporting-context" aria-busy={loading}>
  <SharedReportingControls selection={selection} onChange={setSelection} includeNoComparison
   contextLabel={reportingRangeLabel(selection)}/>
  <div className="src-month-row">
   <label>Ending month <select aria-label={monthLabel} value={selectedMonth} disabled={h.loadingMonths}
    onChange={e=>h.selectMonth(e.target.value)}>
    <option value="">{h.loadingMonths?'Loading months…':'Choose a month'}</option>
    {selectedMonth&&!hasSelectedOption&&<option value={selectedMonth}>{reportingMonthLabel(selectedMonth)}</option>}
    {months.map(m=><option key={m.from} value={m.from}>{reportingMonthLabel(m.from)}</option>)}
   </select></label>
   {comparison&&<details className="np-comparison-controls src-custom-comparison"><summary>Choose a different comparison month</summary>
    <label>Comparison month <select aria-label={comparisonLabel} value={selection.comparisonMonth} disabled={comparison.loadingMonths}
     onChange={e=>comparison.selectMonth(e.target.value)}><option value="">No comparison</option>
     {selection.comparisonMonth&&!comparison.months.some(m=>m.from===selection.comparisonMonth)&&<option value={selection.comparisonMonth}>{reportingMonthLabel(selection.comparisonMonth)}</option>}
     {comparison.months.map(m=><option key={m.from} value={m.from} disabled={!!selectedMonth&&m.to>=selectedMonth}>{reportingMonthLabel(m.from)}</option>)}
    </select></label>
   </details>}
  </div>
  {loading&&<p role="status" aria-live="polite" className="src-context">{h.loadingMonths?'Loading months…':'Loading figures…'}</p>}
  {!loading&&!rangeSupported&&!planBaseline&&<p className="src-context">Figures for this view are not connected yet. A dash means no checked figure for the selected period; it does not mean zero.</p>}
  {planBaseline&&<p className="src-context">Plan uses three complete months ending at your selected month as its starting point. Future scenario dates are controlled separately below.</p>}
 </div>;
}
