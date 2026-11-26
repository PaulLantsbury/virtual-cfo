import {useState} from 'react';
import {useMetaSavedSpend} from '../lib/useMetaSavedSpend';
import {MetaSavedHistoryView} from './MetaSavedHistory';

export function MetaReadOnlySpendPanel(){
 const [from,setFrom]=useState(''),[to,setTo]=useState('');
 const source=useMetaSavedSpend(from,to);
 return <section className="nc-card" aria-label="Saved Meta spend reader" style={{minWidth:0}}>
  <h2>Saved Meta ad spend</h2><p>Read saved spend for the currently selected Meta account. Enter calendar dates in that account’s timezone; the returned account and timezone are shown with the evidence. These dates are separate from the financial review above.</p>
  <form onSubmit={event=>{event.preventDefault();void source.load();}} style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'end'}}>
   <label style={{display:'flex',flexDirection:'column',gap:6,minWidth:0,maxWidth:'100%'}}>Meta spend from<input style={{border:'1px solid hsl(var(--border))',borderRadius:6,padding:'8px 10px',minWidth:0,maxWidth:'100%',background:'transparent'}} aria-label="Meta spend from" type="date" value={from} onChange={e=>{source.clear();setFrom(e.target.value);}}/></label>
   <label style={{display:'flex',flexDirection:'column',gap:6,minWidth:0,maxWidth:'100%'}}>Meta spend to<input style={{border:'1px solid hsl(var(--border))',borderRadius:6,padding:'8px 10px',minWidth:0,maxWidth:'100%',background:'transparent'}} aria-label="Meta spend to" type="date" value={to} onChange={e=>{source.clear();setTo(e.target.value);}}/></label>
   <button className="mr-button" type="submit" disabled={!source.canLoad||source.state.status==='loading'}>Load saved spend</button>
  </form>
  <p>Choose an inclusive period of up to 93 days. This only reads saved observations; it does not connect an account, collect new spend or change advertising.</p>
  {source.state.status==='loading'&&<p role="status">Reading saved Meta evidence…</p>}
  {source.state.status==='unavailable'&&<p role="status">Saved Meta spend is unavailable for this company and period. No amount is inferred and no previous account is substituted.</p>}
  {source.state.status==='ready'&&source.state.view&&<><MetaSavedHistoryView view={source.state.view}/>{source.state.view.state!=='withheld'&&<details><summary>Explore the Numbers · saved Meta source</summary><p>Latest authorized selection returned by the reporting service for this read. The snapshot version was supplied by that service, not independently selected before this request.</p><p style={{overflowWrap:'anywhere'}}>Evidence version: {source.state.view.lineage.version}</p><p>Platform spend is separate from the reviewed financial model and does not change CAC, ROAS, contribution or forecasts.</p></details>}</>}
 </section>;
}
