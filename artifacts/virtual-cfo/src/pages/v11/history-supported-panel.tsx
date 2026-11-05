import type { ReactNode } from 'react';
import { SupportedReportingSlice } from './supported-evidence-panel';
import { historySupportedInput, historyAvailableMonths, type HistorySelection } from '../../lib/v11/history-supported';
/** Authenticated host owns fetching and selection. This component neither requests data nor changes v1 defaults. */
export function HistorySupportedPanel({selection,response,availability,onMonthChange,versionControl}:{selection:HistorySelection;response:unknown;availability:unknown;versionControl?:ReactNode;onMonthChange:(range:{from:string;to:string})=>void}) {
 const months=historyAvailableMonths(availability,selection);
 const selected=months.find(m=>m.from===selection.period.from&&m.to===selection.period.to);
 return <section aria-label="Versioned synthetic history">
 <h2>Two-year synthetic company history</h2>
 <p>Opening balances from {selection.anchor || 'Unavailable'}. The original January view starts with different opening balances; monthly sales and profit can agree while accumulated cash differs. Cash, cohorts, channels and provider freshness are not certified.</p>
 <label>Available reporting month<select value={selected?.from??''} onChange={e=>{const range=months.find(m=>m.from===e.target.value);if(range)onMonthChange({from:range.from,to:range.to});}}><option value="">Choose a reviewed month</option>{months.map(m=><option key={m.from} value={m.from}>{m.from} – {m.to}</option>)}</select></label>
 {versionControl}
 {!months.length&&<p>No reviewed reporting choices are available for this history.</p>}
 <p>These are reviewed evidence choices. Figures are checked against actual source records after you choose a month and version.</p>
 <details><summary>History edition and selected version</summary><p>Edition: {selection.edition} · version: {selection.versionId || 'Not selected'} · month: {selection.period.from || 'Not selected'} – {selection.period.to || 'Not selected'} · snapshot: {selected?.snapshotId ?? 'Unavailable'}.</p></details>
 <SupportedReportingSlice current={historySupportedInput(response,selection)}/>
 </section>;
}
