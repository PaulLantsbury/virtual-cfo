import type {ReportingSelection} from './reportingSelection.ts';
export type ReportingRange = {from:string;to:string;description:string};
const iso=(d:Date)=>d.toISOString().slice(0,10);
const date=(s:string)=>new Date(s+'T12:00:00Z');
const shift=(s:string,days:number)=>{const d=date(s);d.setUTCDate(d.getUTCDate()+days);return iso(d);};
const monthStart=(month:string,offset=0)=>{const d=date(month.slice(0,7)+'-01');d.setUTCMonth(d.getUTCMonth()+offset);return iso(d);};
const monthEnd=(month:string)=>shift(monthStart(month,1),-1);
export function validReportingDate(value:unknown):value is string {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000'))return false;
 const d=date(value);return Number.isFinite(d.getTime())&&iso(d)===value;
}
/** Calendar dates are resolved in the store's current UK timezone, not the device timezone. */
export function reportingLondonToday(now:Date=new Date()):string {
 if(!Number.isFinite(now.getTime()))return '';
 const p=new Intl.DateTimeFormat('en-GB',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Europe/London'}).formatToParts(now);
 const get=(type:string)=>p.find(v=>v.type===type)?.value??'';
 return `${get('year')}-${get('month')}-${get('day')}`;
}
/** Resolve a requested date range only. This never asserts source availability or authority. */
export function requestedReportingRange(s:ReportingSelection,now:Date=new Date()):ReportingRange|null {
 const today=reportingLondonToday(now);if(!validReportingDate(today))return null;
 if(s.period==='custom'){
  if(!validReportingDate(s.customFrom)||!validReportingDate(s.customTo)||s.customFrom>s.customTo||s.customTo>today)return null;
  return {from:s.customFrom,to:s.customTo,description:'Custom dates'};
 }
 if(s.period==='last-week'||(typeof s.period==='number'&&s.view==='weekly')){
  const weeks=s.period==='last-week'?1:s.period===3?13:s.period===6?26:52;
  // Sunday itself is still in progress. Only yesterday or an earlier Sunday can end a full week.
  const weekday=date(today).getUTCDay(),to=shift(today,-(weekday===0?7:weekday));
  return {from:shift(to,1-weeks*7),to,description:`${weeks} complete Monday–Sunday ${weeks===1?'week':'weeks'}`};
 }
 const count=typeof s.period==='number'?s.period:1;
 const currentMonth=monthStart(today);
 return {from:monthStart(currentMonth,-count),to:shift(currentMonth,-1),description:`${count} complete calendar ${count===1?'month':'months'}`};
}
/** End anchor for monthly readers. This hint is not permission to read a partial range as a full month. */
export function reportingSourceMonth(s:ReportingSelection,now:Date=new Date()):string {
 const r=requestedReportingRange(s,now);return r?r.to.slice(0,7)+'-01':'';
}
/** The existing report adapters accept only one full calendar month. */
export function monthlyRangeSupported(s:ReportingSelection,now:Date=new Date()):boolean {
 const r=requestedReportingRange(s,now);
 return !!r&&s.view==='monthly'&&r.from===monthStart(r.to)&&r.to===monthEnd(r.to);
}
export function reportingRangeLabel(s:ReportingSelection,now:Date=new Date()):string {
 const r=requestedReportingRange(s,now);if(!r)return 'Choose valid start and end dates for your report.';
 const format=(v:string)=>date(v).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 const prefix=s.period==='last-week'?'Last week · ':s.period==='last-month'?'Last month · ':'';
 return `${prefix}${format(r.from)} – ${format(r.to)} · ${r.description} · GBP · Europe/London`;
}
