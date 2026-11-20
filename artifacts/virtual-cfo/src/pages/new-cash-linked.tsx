import {AppLayout} from '@/components/layout/AppLayout';
import {useReviewedHistory} from '@/lib/useReviewedHistory';
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
 const h=useReviewedHistory(),m=h.month;
 return <AppLayout showMonitoring={false}><div className="cash-demo new-profit nc-linked">
  <header className="nc-header"><div><span className="nc-eyebrow">NIGHT SCOUT · CASH DECISIONS</span><h1>New Cash Control</h1><p>Are sales and profit turning into cash—and what needs attention?</p></div><a className="nc-badge" href="#new-cash-numbers">Explore the Numbers</a></header>
  <div className="nc-notice"><div><strong>Cash figures are not linked yet.</strong><p>Yellow means not linked or unavailable. Supported profit below comes from the selected business’s reviewed Supabase evidence; it does not establish cash in the bank.</p></div></div>
  <div className="nc-controls"><label>Reviewed month <select aria-label="Cash reference month" value={h.selection.period.from} onChange={e=>h.selectMonth(e.target.value)}><option value="">Choose a month</option>{h.months.map(v=><option key={v.from} value={v.from}>{v.from.slice(0,7)}</option>)}</select></label><label>Evidence version <select aria-label="Cash reference evidence version" value={h.selection.versionId} disabled={!h.selection.period.from} onChange={e=>h.selectVersion(e.target.value)}><option value="">Choose evidence</option>{h.versions.map((v,i)=><option key={v.versionId} value={v.versionId} disabled={v.status!=='selected'}>{v.kind==='base'?'Original reviewed evidence':'Reviewed correction'}{h.versions.length>1?` · ${i+1}`:''}</option>)}</select></label></div>
  {(h.loadingMonths||h.loading)&&<p role="status">Checking the selected business’s evidence…</p>}
  {h.error&&<p role="alert">{h.error} <button onClick={h.retry}>Retry evidence check</button></p>}
  <section className="nc-section"><div className="nc-section-title"><span>01</span><div><p>YOUR CASH SUMMARY</p><h2>{m?.amounts.ebitda!=null?'Profit is available separately; cash still needs evidence.':'Choose profit evidence; cash remains unavailable.'}</h2></div></div>
   <div className="nc-kpis nc-four-kpis">{missing.slice(0,3).map(([label,reason])=><article className="nc-kpi nc-not-linked" key={label}><span>{label}</span><strong>Unavailable</strong><p>Not linked</p><small>{reason}</small></article>)}<article className={`nc-kpi ${m?.amounts.ebitda===null||!m?'nc-not-linked':''}`}><span>Profit (EBITDA) · reference only</span><strong>{m?.amounts.ebitda!=null?money(m.amounts.ebitda):'Unavailable'}</strong><p>{m?'Supabase evidence · '+m.selection.period.from+' – '+m.selection.period.to:'Choose a reviewed month and evidence version'}</p><small>{m?'GBP · Europe/London · synthetic company. This is profit, not operating cash.':'Not linked until selected evidence is verified. No example amount is substituted.'}</small></article></div>
  </section>
  <section className="nc-section"><div className="nc-section-title"><span>02</span><div><p>FOLLOW THE MONEY</p><h2>What explains the gap?</h2></div></div><article className="nc-card nc-not-linked"><h3>Profit → operating cash → bank movement</h3><p>Not linked — a cash bridge cannot be calculated from profit alone. Stock, receivables, provider balances, supplier credit, tax, investment and financing must reconcile to dated bank balances.</p><strong>No cash totals or trend have been inferred.</strong></article></section>
  <section className="nc-section"><div className="nc-section-title"><span>03</span><div><p>FROM INSIGHT TO ACTION</p><h2>Check cash coverage before using a figure.</h2></div></div><CashControlXeroReadiness/><p>The accounting connection check is status only; it does not supply eligible cash amounts.</p><a className="nc-badge" href="#new-cash-numbers">Review missing cash evidence</a></section>
  <section className="nc-section"><div className="nc-section-title"><span>04</span><div><p>CASH RESILIENCE · NOT A FORECAST</p><h2>How much breathing room is there?</h2></div></div><article className="nc-card nc-not-linked"><strong>Unavailable · not linked</strong><p>{missing[3][1]} Profit history alone cannot establish historical cash cover or safe spending.</p></article></section>
  <section id="new-cash-numbers" className="nc-card"><h2>Explore the Numbers</h2><p>Selected business: {h.storeId}. GBP · Europe/London. No current bank balance, operating cash, settlement or stock movement is returned by the existing monthly profit reader.</p>{m&&<p>Profit evidence: {m.selection.period.from} – {m.selection.period.to}; version {m.evidence.versionId}; observed {m.evidence.observedAt}. EBITDA = contribution after marketing − overheads excluding depreciation/amortisation. Cost coverage: {m.evidence.costCoverage}. Canonical source revision check; no claim of a fresh bank feed.</p>}<table className="nc-table"><thead><tr><th>Figure</th><th>Status / missing evidence</th></tr></thead><tbody>{missing.map(([label,reason])=><tr key={label}><th>{label}</th><td className="nc-not-linked">Not linked — {reason}</td></tr>)}</tbody></table><button className="nc-badge" onClick={onSample}>Open illustrative cash design · all figures not linked</button><p>Sample charts, arithmetic, review drafts and buffer controls remain available explicitly for design review. They are not your business’s cash.</p></section>
 </div></AppLayout>;
}
