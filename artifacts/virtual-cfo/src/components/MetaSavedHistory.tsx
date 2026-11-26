import {buildMetaHistoryPresentation} from '../lib/metaHistoryPresentation';
import {buildMetaHistoryFromWire,type MetaHistoryWirePresentation} from '../lib/metaHistoryWire';

/** Unmounted review component. No fetch, storage, provider action or production route integration. */
export function MetaSavedHistory(props:{result:unknown;requested:unknown;displayContext:unknown;membershipAuthorized:boolean}){
 const view=buildMetaHistoryPresentation(props.result,props.requested,props.displayContext,props.membershipAuthorized);
 return <MetaSavedHistoryView view={view}/>;
}

/** Unmounted wire review entry point; the caller supplies authenticated read-only results. */
export function MetaSavedHistoryFromWire(props:{wire:unknown;requested:unknown;membershipAuthorized:boolean}){
 return <MetaSavedHistoryView view={buildMetaHistoryFromWire(props.wire,props.requested,props.membershipAuthorized)}/>;
}
const coverageLabels={provider_row:'Reported by Meta',no_row:'No provider row',partial:'Partial coverage',failed:'Collection failed',not_collected:'Not collected'} as const;
export function MetaSavedHistoryView({view}:{view:MetaHistoryWirePresentation}){
 if(view.state==='withheld')return <section aria-label="Saved Meta spend"><h2>Saved Meta spend</h2><p role="status">Saved spend is withheld because access or the exact account and period could not be confirmed.</p></section>;
 return <section aria-label="Saved Meta spend" className="space-y-4 rounded-xl border p-4" style={{minWidth:0,overflowWrap:'anywhere'}}>
  <h2>Saved Meta spend</h2><p role="status">{view.connectionLabel}. {view.evidenceLabel}.</p>
  <p>Account {view.lineage.accountId} · {view.currency} · {view.timeZone}. Account-local dates: {view.lineage.from}–{view.lineage.to}.</p>
  <p>These are saved observations, not a new collection. Expired access requires reconnection before collecting new observations. Missing dates are unknown, not zero.</p>
  {view.state==='unavailable'?<p>No spend values were reported for this selected period.</p>:<p>Reported spend subtotal: <strong>{view.subtotalMinor} {view.currency} minor units</strong> · {view.days.filter(d=>d.coverage==='reported').length} of {view.days.length} days reported. This is not a complete-period total when any day is unknown.</p>}
  <div style={{maxWidth:'100%',overflowX:'auto'}} tabIndex={0} aria-label="Scrollable saved Meta spend evidence"><table style={{minWidth:680,overflowWrap:'normal',whiteSpace:'nowrap'}}><caption>Original daily observations · amounts in {view.currency} minor units</caption><thead><tr><th scope="col">Account-local date</th><th scope="col">Amount</th><th scope="col">Coverage</th><th scope="col">Original observation</th><th scope="col">Original run</th>{view.sourceDays&&<><th scope="col">Run status</th><th scope="col">Run started</th></>}</tr></thead><tbody>{view.days.map((row,index)=><tr key={row.date}><th scope="row">{row.date}</th><td>{row.amountMinor===null?'Unknown':row.amountMinor}</td><td>{view.sourceDays?coverageLabels[view.sourceDays[index].coverageState]:(row.coverage==='reported'?'Reported':'Unknown')}</td><td>{row.observedAt??'Not recorded'}</td><td>{row.runId??'Not recorded'}</td>{view.sourceDays&&<><td>{view.sourceDays[index].runStatus??'Not recorded'}</td><td>{view.sourceDays[index].runStartedAt??'Not recorded'}</td></>}</tr>)}</tbody></table></div>
  <p>Saved observations do not establish attribution, profitability or permission to spend.</p>
 </section>;
}
