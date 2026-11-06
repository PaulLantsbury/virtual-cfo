/** Proposal-only scheduled admission. Pure calculation: no driver, binding, retry or scheduler. */
import {addDays,date} from './generator.mjs';
import {HISTORY_EDITION,historyToday,historySourceAsOf} from './history-context.mjs';
import {stableId} from './staging-payload.mjs';
const ensure=(v,m)=>{if(!v)throw Error(m);};
export function dailyAdmission({now,initialThrough,throughDay,receipts=[],uncertainOutcome=false,operatorEnabled=false}){
 ensure(now instanceof Date&&Number.isFinite(+now),'Valid trusted clock required');
 date(initialThrough);date(throughDay);ensure(initialThrough>='2024-11-01'&&throughDay>=initialThrough,'Pinned accepted horizon required');
 const londonDay=historyToday(now),cutoff=addDays(londonDay,-1);
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hourCycle:'h23',hour:'2-digit',minute:'2-digit'}).formatToParts(now);
 const hour=Number(parts.find(p=>p.type==='hour').value),minute=Number(parts.find(p=>p.type==='minute').value);
 const context={edition:HISTORY_EDITION,anchor:'2024-11-01',profile:'uk-gifts-v2',currency:'GBP',timezone:'Europe/London',londonDay,cutoff,sourceAsOf:historySourceAsOf(cutoff),throughDay};
 if(uncertainOutcome)return {...context,state:'uncertain-review',mutationAllowed:false};
 ensure(Array.isArray(receipts),'Explicit durable receipts required');
 const sorted=[...receipts].sort((a,b)=>a.day.localeCompare(b.day));let expected=addDays(initialThrough,1);
 for(const r of sorted){date(r.day);ensure(r.day===expected&&r.runId===stableId('history-daily-run',`2024-11-01:${r.day}`)&&/^[0-9a-f]{64}$/.test(r.sourceHash)&&r.sourceAsOf===historySourceAsOf(r.day),'Contiguous exact receipt evidence required');expected=addDays(expected,1);}
 ensure(addDays(expected,-1)===throughDay,'Receipt horizon differs');
 if(throughDay>=londonDay)return {...context,state:'future-horizon-review',mutationAllowed:false};
 if(throughDay===cutoff)return {...context,state:'already-recorded-inspect',mutationAllowed:false};
 if(addDays(throughDay,1)!==cutoff)return {...context,state:'gap-review',mutationAllowed:false};
 if(hour!==2||minute>14)return {...context,state:'outside-london-window',mutationAllowed:false};
 return {...context,state:operatorEnabled?'eligible-for-reviewed-capability':'prepared-disabled',mutationAllowed:operatorEnabled};
}
