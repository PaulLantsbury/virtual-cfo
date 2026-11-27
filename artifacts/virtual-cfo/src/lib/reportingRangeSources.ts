import {resolveHistoryMonthVersion} from './reportingMonth.ts';
import type {HistoryAvailability} from './v11/history-supported.ts';
export type RangeMonthSource={from:string;to:string;versionId:string};
/** All intersecting complete source months are required; never skip a gap. */
export function reportingRangeSources(months:HistoryAvailability['months'],range:{from:string;to:string}|null):RangeMonthSource[]|null{
 if(!range)return null;
 const day=new Date(range.from+'T12:00:00Z');day.setUTCDate(1);const out:RangeMonthSource[]=[];
 while(day.toISOString().slice(0,10)<=range.to){
  if(out.length===24)return null;
  const from=day.toISOString().slice(0,10),end=new Date(day);end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);const to=end.toISOString().slice(0,10);
  const candidates=months.filter(m=>m.from===from&&m.to===to);if(candidates.length!==1)return null;
  const versionId=resolveHistoryMonthVersion(candidates[0]).versionId;if(!versionId)return null;
  out.push({from,to,versionId});day.setUTCMonth(day.getUTCMonth()+1);
 }
 return out.length?out:null;
}
