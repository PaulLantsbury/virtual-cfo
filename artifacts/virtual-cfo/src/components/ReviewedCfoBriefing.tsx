import type {composeHistoryMonth} from '@/lib/v11/history-composition';
import {reviewedCfoBriefing} from '@/lib/reviewedCfoBriefing';
const money=(value:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',minimumFractionDigits:2,maximumFractionDigits:2}).format(value/100);
export function ReviewedCfoBriefing({month}:{month:ReturnType<typeof composeHistoryMonth>}){
 const briefing=reviewedCfoBriefing(month);
 return <section className="sv-checked-briefing" aria-label="Checked financial briefing"><h5>Checked financial briefing</h5>{briefing?<>
  <p>For the selected month, net product sales were {money(briefing.facts.find(f=>f.key==='netProductSales')!.value)}. Contribution after advertising was {money(briefing.facts.find(f=>f.key==='contribution')!.value)}, before overheads. EBITDA was {money(briefing.facts.find(f=>f.key==='ebitda')!.value)}, after overheads excluding depreciation and amortisation.</p>
  {briefing.investigation&&<p>{briefing.investigation}</p>}
  <p>This check covers the selected historical month. It does not assess cash available to spend, customer economics or future results.</p>
  <details className="sv-details"><summary>Explore the checked briefing</summary><div><p>Reviewed synthetic records · {month!.selection.period.from}–{month!.selection.period.to} · GBP excluding VAT · Europe/London. These are monthly totals, including when the flow above is displayed per order.</p>
   <table><caption>Same selected month and source version; amounts rounded only for display.</caption><thead><tr><th>Checked fact</th><th>Monthly total</th></tr></thead><tbody>{briefing.facts.map(f=><tr key={f.key}><th>{f.label}</th><td>{money(f.value)}</td></tr>)}</tbody></table>
   <p>Observed {briefing.observedAt}. Financial version {briefing.financialVersionId}; sales revision {briefing.salesRevision}; cost revision {briefing.costRevision}.</p>
   <p>Calculation {briefing.engineFormulaVersion}; rules {briefing.policyVersion}. Evidence reference {briefing.evidenceRef}. This check makes no comparison or recommendation to spend. Other comparisons on this page retain their own selected evidence.</p>
  </div></details>
 </>:<p>Checked financial commentary is unavailable for this report. The supported figures remain available.</p>}</section>;
}
