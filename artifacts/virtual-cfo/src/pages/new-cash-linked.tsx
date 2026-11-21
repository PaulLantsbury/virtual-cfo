import {AppLayout} from '@/components/layout/AppLayout';
import {useReviewedCash} from '@/lib/useReviewedCash';
import {CashSourceFigures,CashSourceResilience} from '@/components/CashSourceFigures';
import {useReviewedHistory} from '@/lib/useReviewedHistory';
import {CashReviewedProfitHistory} from '@/components/CashReviewedProfitHistory';
import {CashControlXeroReadiness} from '@/components/CashControlXeroReadiness';
import './new-profit.css';
import './cash-demo.css';
import './new-cash-linked.css';

const money=(p:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(p/100);
const missing=[
 ['Bank cash','Dated, unrestricted balances and confirmed included accounts.'],
 ['Operating cash generated','Complete stock, debtor, provider-settlement and supplier-credit movements.'],
 ['Cash generated less profit','A supported operating-cash reconciliation for the same period.'],
 ['Cash resilience','Dated bank cash and three complete reconciled months; a buffer alone is not evidence.'],
] as const;

/** Existing member-authorised evidence only. Profit is never substituted for cash. */
export default function NewCashLinked({onSample}:{onSample:()=>void}){
 const h=useReviewedHistory({handoffRole:'current'}),m=h.month,sources=useReviewedCash(h);
 return <AppLayout showMonitoring={false}><div className="cash-demo new-profit nc-linked">
  <header className="nc-header"><div><span className="nc-eyebrow">NIGHT SCOUT · CASH DECISIONS</span><h1>New Cash Control</h1><p>Are sales and profit turning into cash—and what needs attention?</p></div><a className="nc-badge" href="#new-cash-numbers">Explore the Numbers</a></header>
  <div className="nc-notice"><div><strong>{sources.current?'Reviewed synthetic cash records · historical month':'Cash figures need separate reviewed evidence.'}</strong><p>Yellow means not linked or unavailable. Cash appears only after separate dated bank and working-capital records reconcile to the exact financial evidence version. Historical synthetic cash is not a current bank feed.</p></div></div>
  <div className="nc-controls"><label>Reviewed month <select aria-label="Cash reference month" value={h.selection.period.from} onChange={e=>h.selectMonth(e.target.value)}><option value="">Choose a month</option>{h.months.map(v=><option key={v.from} value={v.from}>{v.from.slice(0,7)}</option>)}</select></label><label>Evidence version <select aria-label="Cash reference evidence version" value={h.selection.versionId} disabled={!h.selection.period.from} onChange={e=>h.selectVersion(e.target.value)}><option value="">Choose evidence</option>{h.versions.map((v,i)=><option key={v.versionId} value={v.versionId} disabled={v.status!=='selected'}>{v.kind==='base'?'Original reviewed evidence':'Reviewed correction'}{h.versions.length>1?` · ${i+1}`:''}</option>)}</select></label></div>
  {(h.loadingMonths||h.loading)&&<p role="status">Checking the selected business’s evidence…</p>}
  {h.error&&<p role="alert">{h.error} <button onClick={h.retry}>Retry evidence check</button></p>}
  <CashSourceFigures sources={sources} history={h}/>
  <CashReviewedProfitHistory history={h} cashMonths={sources.months}/><section className="nc-section"><div className="nc-section-title"><span>03</span><div><p>FROM INSIGHT TO ACTION</p><h2>Check cash coverage before using a figure.</h2></div></div><CashControlXeroReadiness/><p>The accounting connection check is status only. The separate reviewed synthetic cash source is not evidence of a live accounting or bank connection.</p><a className="nc-badge" href="#new-cash-numbers">Review missing cash evidence</a></section>
  <CashSourceResilience sources={sources} identity={`${h.userId}:${h.storeId}:${h.selection.period.from}:${h.selection.versionId}`}/>
  <section id="new-cash-numbers" className="nc-card"><h2>Explore the Numbers</h2><p>Selected business: {h.storeId}. GBP · Europe/London. Financial and cash evidence use separate readers and exact source versions. Closing bank cash is dated at the selected historical month end; it is not today’s bank balance.</p>{m&&<p>Profit evidence: {m.selection.period.from} – {m.selection.period.to}; version {m.evidence.versionId}; observed {m.evidence.observedAt}. EBITDA = contribution after marketing − overheads excluding depreciation/amortisation. Cost coverage: {m.evidence.costCoverage}. Canonical source revision check; no claim of a fresh bank feed.</p>}<div className="nc-table-scroll" tabIndex={0} aria-label="Scrollable cash source status"><table className="nc-table"><thead><tr><th>Figure</th><th>Status / missing evidence</th></tr></thead><tbody>{missing.map(([label,reason])=><tr key={label}><th>{label}</th><td className={sources.current&&(label!=='Cash resilience'||sources.months.length===3)?'':'nc-not-linked'}>{sources.current&&(label!=='Cash resilience'||sources.months.length===3)?'Reviewed synthetic cash source · see reconciled figures above':'Not linked / matched evidence unavailable — '+reason}</td></tr>)}</tbody></table></div><button className="nc-badge" onClick={onSample}>Open illustrative cash design · all figures not linked</button><p>Sample charts, arithmetic, review drafts and buffer controls remain available explicitly for design review. They are not your business’s cash.</p></section>
 </div></AppLayout>;
}
