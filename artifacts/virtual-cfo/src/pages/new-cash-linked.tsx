import {missingFigureLabel} from '@/lib/reportingDisplayStatus';
import {ConnectedReportingControls} from '@/components/ConnectedReportingControls';
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
 const missingLabel=missingFigureLabel({loading:h.loading||h.loadingMonths||sources.loading,error:!!h.error||!!sources.error,hasMonth:!!m});
 return <AppLayout showMonitoring={false}><div className="cash-demo new-profit nc-linked">
  <header className="nc-header"><div><span className="nc-eyebrow">NIGHT SCOUT · CASH DECISIONS</span><h1>Cash Control</h1><p>Are sales and profit turning into cash—and what needs attention?</p></div></header>
  <div className="nc-notice"><div><strong>{sources.current?'Reviewed synthetic cash records · historical month':missingLabel}</strong><p>Missing figures show their source requirement. Cash appears only after separate dated bank and working-capital records reconcile to the exact financial evidence version. Historical synthetic cash is not a current bank feed.</p></div></div>
  <ConnectedReportingControls history={h} monthLabel="Cash reference month"/><p className="nc-note">Cash balances and movements stay in total pounds; the Amounts selection does not divide bank cash by orders.</p>
  {(h.loadingMonths||h.loading)&&<p role="status">Loading…</p>}
  {h.error&&<p role="alert">{h.error} <button onClick={h.retry}>Retry evidence check</button></p>}
  <CashSourceFigures sources={sources} history={h}/>
  <CashReviewedProfitHistory history={h} cashMonths={sources.months} cashLoading={sources.loading||sources.loadingWindow}/>
  <section className="nc-section"><div className="nc-section-title"><span>03</span><div><p>FROM INSIGHT TO ACTION</p><h2>Your CFO cash review plan</h2></div></div><div className="nc-verdict"><div><h2>Check the cause, then the payment date.</h2><p>Historical cash movements help identify what to review. They do not establish a saving, a future payment date or cash available to spend.</p></div></div><div className="np-landscape-plan">{[
   {id:'cash-commitments',title:'Check the next significant payments',why:'Confirm supplier, stock, tax and debt commitments before relying on the bank balance.',value:null,label:'Future cash requirement',start:'Check recorded commitments and identify missing items. This page does not maintain a forecast payment schedule.'},
   {id:'cash-stock',title:'Understand the cash tied up in stock',why:'Review the recorded stock movement alongside supplier credit; neither is an additional cost or an available saving.',value:sources.current?.evidence.workingCapital.stock??null,label:'Historical stock cash effect',start:'Reconcile the stock movement and its timing before considering any change to ordering.'},
   {id:'cash-settlements',title:'Check when sales reach the bank',why:'Sales, operating cash and the bank balance describe different parts of the same story.',value:sources.current?.cash.unsettledProviderFunds??null,label:'Unsettled provider funds',start:'Check opening unsettled funds, payouts, refunds, fees and VAT once the matching settlement records are available.'},
  ].map((action,i)=><details className={'np-plan-card '+(i===0?'np-plan-priority':'')} key={action.id}><summary><div className="np-plan-card-intro"><span className="np-plan-rank">{i+1}</span><div className="np-plan-title"><h3>{action.title}</h3><p>{action.why}</p></div></div><div className="np-plan-facts"><div className="np-plan-impact"><span>{action.label}</span><strong>{action.value===null?(sources.loading||h.loading||h.loadingMonths?'Loading…':'—'):money(action.value)}</strong><small>{i===1?'Not an available saving':'Check timing and coverage'}</small></div><div><span>Next step</span><strong>Review the records</strong></div></div></summary><div className="np-plan-body"><h4>Start here</h4><p>{action.start}</p><p>No supplier, payment, reminder or advertising action is created here.</p></div></details>)}</div></section>
  <CashSourceResilience sources={sources} identity={`${h.userId}:${h.storeId}:${h.selection.period.from}:${h.selection.versionId}`}/>
  <section id="new-cash-numbers" className="nc-card"><h2>Explore the Numbers</h2><p>Selected business: {h.storeId}. GBP · Europe/London. Financial and cash evidence use separate readers and exact source versions. Closing bank cash is dated at the selected historical month end; it is not today’s bank balance.</p>{m&&<p>Profit evidence: {m.selection.period.from} – {m.selection.period.to}; version {m.evidence.versionId}; observed {m.evidence.observedAt}. EBITDA = contribution after marketing − overheads excluding depreciation/amortisation. Cost coverage: {m.evidence.costCoverage}. Canonical source revision check; no claim of a fresh bank feed.</p>}<div className="nc-table-scroll" tabIndex={0} aria-label="Scrollable cash source status"><table className="nc-table"><thead><tr><th>Figure</th><th>Status / missing evidence</th></tr></thead><tbody>{missing.map(([label,reason])=><tr key={label}><th>{label}</th><td >{sources.current&&(label!=='Cash resilience'||sources.months.length===3)?'Reviewed synthetic cash source · see reconciled figures above':(label==='Cash resilience'&&sources.loadingWindow?'Loading…':'—')+' — '+reason}</td></tr>)}</tbody></table></div><CashControlXeroReadiness/><button className="nc-badge" onClick={onSample}>Open cash design · fictional example</button><p>Sample charts, arithmetic, review drafts and buffer controls remain available explicitly for design review. They are not your business’s cash.</p></section>
 </div></AppLayout>;
}
