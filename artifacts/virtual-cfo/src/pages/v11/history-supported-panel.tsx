import type { ReactNode } from 'react';
import { composeHistoryMonth } from '../../lib/v11/history-composition';
import { HistoryMonthlyComposition } from './history-monthly-composition';
import { SupportedReportingSlice } from './supported-evidence-panel';
import { historyReadState, historyAvailableMonths, type HistorySelection } from '../../lib/v11/history-supported';
/** Authenticated host owns fetching and selection. This component neither requests data nor changes v1 defaults. */
export function HistorySupportedPanel({selection,response,availability,onMonthChange,versionControl,loading=false,error,invalidated=false,onRetry}:{selection:HistorySelection;response:unknown;availability:unknown;loading?:boolean;invalidated?:boolean;error?:'denied'|'unavailable';versionControl?:ReactNode;onRetry?:()=>void;onMonthChange:(range:{from:string;to:string})=>void}) {
 const state=historyReadState(selection,response,{loading,error,invalidated});
 const composition=state==='supported'?composeHistoryMonth(response,selection):null;
 const messages={unselected:selection.period.from?'Choose an evidence version for the selected month to inspect its figures.':'Choose a reviewed month first; then choose its evidence version.',loading:'Checking the selected month and version against source records…',unavailable:error==='unavailable'?'Checking the selected evidence failed. Retry the check.':'The selected evidence is unavailable. Check source coverage and try again later.',invalidated:'The selected source evidence is stale or invalidated. Review its version before using these figures.',denied:'Access to this history is not authorised. Check your business membership.',supported:''};
 const months=historyAvailableMonths(availability,selection);
 const selected=months.find(m=>m.from===selection.period.from&&m.to===selection.period.to);
 return <section aria-label="Versioned synthetic history">
 <h2>Two-year synthetic company history</h2>

 <label>Available reporting month<select value={selected?.from??''} onChange={e=>{const range=months.find(m=>m.from===e.target.value);onMonthChange(range?{from:range.from,to:range.to}:{from:'',to:''});}}><option value="">Choose a reviewed month</option>{months.map(m=><option key={m.from} value={m.from}>{m.from} – {m.to}</option>)}</select></label>
 {versionControl}
 {!months.length&&<p>No reviewed reporting choices are available for this history.</p>}
 <p>These are reviewed evidence choices. Figures are checked against actual source records after you choose a month and version.</p>
 <details><summary>History edition and selected version</summary><p>Opening balances from {selection.anchor || 'Unavailable'}. The original January view has different opening balances. Cash, cohorts, channels and provider freshness are not certified.</p><p>Edition: {selection.edition} · version: {selection.versionId || 'Not selected'} · month: {selection.period.from || 'Not selected'} – {selection.period.to || 'Not selected'} · snapshot: {selected?.snapshotId ?? 'Unavailable'}.</p></details>
 {composition?<><SupportedReportingSlice current={composition.input} preparedView={composition.view} additionalEvidence={<HistoryMonthlyComposition month={composition}/>}/><HistoryMonthlyComposition month={composition}/></>:<div role={state==='loading'?'status':state==='denied'||state==='unavailable'?'alert':undefined}><p>{messages[state]}</p>{error==='unavailable'&&onRetry&&<button type="button" onClick={onRetry}>Retry evidence check</button>}<details><summary>Explore the Numbers</summary><p>No supported figures are displayed. Business: {selection.storeId} · currency: {selection.currency} · timezone: {selection.timezone} · edition: {selection.edition} · version: {selection.versionId||'Not selected'}. Source dates and amounts become available only after this selection validates.</p></details></div>}
 </section>;
}
