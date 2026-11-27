import type {ReportingSelection} from './reportingSelection.ts';
export type ReportingRange = {from:string;to:string;description:string};
const iso=(d:Date)=>d.toISOString().slice(0,10);
const date=(s:string)=>new Date(s+'T12:00:00Z');
const shift=(s:string,days:number)=>{const d=date(s);d.setUTCDate(d.getUTCDate()+days);return iso(d);};
const monthStart=(month:string,offset=0)=>iso(new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7))-1+offset,1,12)));
const monthEnd=(month:string)=>shift(monthStart(month,1),-1);
/** Resolve calendar hints only. This does not assert that source data exists. */
export function requestedReportingRange(s:ReportingSelection):ReportingRange|null{
 if(!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(s.month)||s.month.startsWith('0000'))return null;
 if(s.view==='monthly'){
  const count=typeof s.period==='number'?s.period:1;
  return {from:monthStart(s.month,1-count),to:monthEnd(s.month),description:`${count} complete calendar ${count===1?'month':'months'}`};
 }
 const weeks=s.period==='last-week'?1:s.period===3?13:s.period===6?26:s.period===12?52:1;
 const last=monthEnd(s.month),to=shift(last,-date(last).getUTCDay());
 return {from:shift(to,1-weeks*7),to,description:`${weeks} complete Monday–Sunday ${weeks===1?'week':'weeks'}`};
}
export function reportingRangeLabel(s:ReportingSelection):string{
 const r=requestedReportingRange(s);
 if(!r)return 'Choose the ending month for your report.';
 const format=(v:string)=>date(v).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 return `${format(r.from)} – ${format(r.to)} · ${r.description} · GBP · Europe/London`;
}
