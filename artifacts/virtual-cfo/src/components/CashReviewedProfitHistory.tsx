import {Bar,BarChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis,ReferenceLine} from 'recharts';
import {useReviewedHistory} from '@/lib/useReviewedHistory';
import {useReviewedHistorySeries} from '@/lib/useReviewedHistorySeries';
import {cashProfitHistory} from '@/lib/cashSourceAdapter';
const money=(p:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:2}).format(p/100);
export function CashReviewedProfitHistory({history}:{history:ReturnType<typeof useReviewedHistory>}){
 const series=useReviewedHistorySeries(history,12);
 const points=series.status==='supported'?cashProfitHistory(series.months,history.storeId):null;
 return <section className="nc-section" aria-labelledby="cash-profit-history-title"><div className="nc-section-title"><span>02A</span><div><p>REVIEWED MONTHLY PROFIT · REFERENCE ONLY</p><h2 id="cash-profit-history-title">How has profit changed?</h2></div></div>
  <p>Each bar is EBITDA for a complete reviewed month. Operating cash and closing bank balances remain unavailable; no weekly or daily cash timing is estimated.</p>
  {series.status==='idle'&&<p>Choose a reviewed month and evidence version above to view the monthly profit history ending there.</p>}
  {series.loading&&<p role="status">Checking complete monthly profit evidence…</p>}
  {series.error&&<p role="alert">{series.error} <button onClick={series.retry}>Retry history check</button></p>}
  {series.status==='unavailable'&&!series.error&&<p className="nc-not-linked">Monthly profit history unavailable. Every month must have complete, supported evidence; missing months are not zero.</p>}
  {points&&<><p><strong>{points[0].from} – {points.at(-1)!.to}</strong> · {points.length} complete months · GBP · Europe/London · synthetic company.</p>
   <div className="nc-reviewed-profit-chart" role="img" aria-label={`Monthly EBITDA from ${points[0].label} to ${points.at(-1)!.label}; exact signed amounts in the table below.`}><ResponsiveContainer width="100%" height={260}><BarChart data={points} margin={{top:15,right:15,left:5,bottom:10}}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="label"/><YAxis tickFormatter={v=>`£${Math.round(v/100).toLocaleString('en-GB')}`}/><Tooltip formatter={(v:number)=>[money(v),'EBITDA · profit, not cash']}/><ReferenceLine y={0} stroke="currentColor"/><Bar dataKey="ebitda" name="EBITDA" fill="#6366f1"/></BarChart></ResponsiveContainer></div>
   <details><summary>Explore monthly profit figures and evidence</summary><div className="nc-table-scroll"><table className="nc-table"><thead><tr><th>Reviewed month</th><th>EBITDA · profit</th><th>Operating cash</th><th>Evidence version</th></tr></thead><tbody>{points.map((p,i)=><tr key={p.from}><th>{p.from} – {p.to}</th><td>{money(p.ebitda)}</td><td className="nc-not-linked">Unavailable · not linked</td><td>{series.months[i].evidence.versionId}</td></tr>)}</tbody></table></div><p>EBITDA = contribution after marketing less overheads excluding depreciation and amortisation. Every point uses the authenticated monthly reader and its exact source/cost revision checks. Selected-month evidence is preserved; this chart does not prove cash generation or bank-feed freshness.</p></details>
  </>}
  <article className="nc-card nc-not-linked"><strong>Cash trends need separate evidence</strong><p>Monthly operating cash, comparison cash and closing bank balances require matched reconciliations for every month. Bank balances will be shown separately from period cash generation.</p></article>
 </section>;
}
