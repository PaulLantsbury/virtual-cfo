import {requestedReportingRange,type ReportingRange} from './reportingRange.ts';
import type {ReportingSelection} from './reportingSelection.ts';
const iso=(d:Date)=>d.toISOString().slice(0,10);
const date=(s:string)=>new Date(s+'T12:00:00Z');
const shift=(s:string,n:number)=>{const d=date(s);d.setUTCDate(d.getUTCDate()+n);return iso(d)};
const yearEarlier=(s:string)=>{const d=date(s),month=d.getUTCMonth();d.setUTCFullYear(d.getUTCFullYear()-1);if(d.getUTCMonth()!==month)d.setUTCDate(0);return iso(d)};
/** Comparison dates only; source completeness is independently checked by readers. */
export function reportingComparisonRange(s:ReportingSelection,now=new Date()):ReportingRange|null{
 const current=requestedReportingRange(s,now);if(!current||s.comparison==='none'||s.comparison==='rolling')return null;
 let from:string,to:string;
 if(s.comparison==='last-year'){
  from=s.view==='weekly'?shift(current.from,-364):yearEarlier(current.from);
  to=s.view==='weekly'?shift(current.to,-364):yearEarlier(current.to);
 }else{
  if(!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(s.comparisonMonth))return null;
  const end=date(s.comparisonMonth);end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);to=iso(end);
  // A selected comparison month anchors weekly reporting to its last Sunday,
  // not an arbitrary weekday at month end. Preserve the current span below.
  if(s.view==='weekly')to=shift(to,-date(to).getUTCDay());
  if(s.view==='monthly'&&typeof s.period==='number'){const start=date(s.comparisonMonth);start.setUTCMonth(start.getUTCMonth()+1-s.period);from=iso(start);}
  else if(s.view==='monthly'&&current.from.endsWith('-01')&&current.from.slice(0,7)===current.to.slice(0,7)){from=s.comparisonMonth;}
  else {const days=Math.round((+date(current.to)-+date(current.from))/86400000)+1;from=shift(to,1-days);}
 }
 if(to>=current.from||from>to)return null;
 return{from,to,description:s.comparison==='last-year'?'Same period last year':'Selected earlier comparison period'};
}
